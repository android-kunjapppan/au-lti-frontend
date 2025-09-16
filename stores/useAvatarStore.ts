import type { GLTFResult } from "@tresjs/cientos";
import { AnimationMixer, type AnimationAction } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FolderApi } from "tweakpane";

/** State for the experience avatar ( animations, model, etc... ) */
export const useAvatarStore = defineStore("avatar", () => {
  /** ##Satewide Consts## */
  /** TODO: Update with actual states, then update `setAnimationState` func to check if match existing state */
  const DefaultAnimation = AnimationStates.IDLE;
  const loader = new GLTFLoader();

  /** ##Composables## */

  const { onLoop } = useRenderLoop();

  /** ##TweakPane related state, for testing purposes## */

  const paneFolder = shallowRef<FolderApi>();
  const paneFolderAnimations = shallowRef<FolderApi>();
  const state = reactive({
    avatarPos: { x: 0, y: 0, z: 0 },
    avatarScale: 1,
  });

  /** ##Create animation tweakPane to test animations## */

  const createAnimationPane = (model: GLTFResult) => {
    if (paneFolderAnimations.value) paneFolderAnimations.value.dispose();
    paneFolderAnimations.value = useNuxtApp().$pane.addFolder({
      title: "Animations",
      expanded: true,
    });
    const stopBtn = paneFolderAnimations.value.addButton({
      title: "Stop",
      label: "Stop all",
    });
    stopBtn.on("click", () => {
      mixer.value?.stopAllAction();
    });
    for (const clip of model.animations) {
      const btn = paneFolderAnimations.value.addButton({
        title: "Play",
        label: clip.name,
      });
      btn.on("click", () => {
        playAnimation(clip.name);
        mixer.value?.addEventListener("finished", restoreState);
        mixer.value?.addEventListener("loop", restoreState);
      });
    }
  };
  const createAvatarPane = () => {
    paneFolder.value = useNuxtApp().$pane.addFolder({
      title: "Avatar",
      expanded: true,
    });
    paneFolder.value.addBinding(state, "avatarPos");
    paneFolder.value.addBinding(state, "avatarScale");
  };
  const cleanupPanes = () => {
    paneFolder.value?.dispose();
    paneFolderAnimations.value?.dispose();
  };

  /** ##3D Model related state## */

  const avatarModel = shallowRef<GLTFResult>();
  const restoreDefaultAvatarModel = async () => {
    // called when files are dropped on zone
    const defaultAvatarModel = await useGLTF("/models/rodney-test.glb");
    updateAvatarModel(defaultAvatarModel);
  };
  const updateAvatarModel = async (model: GLTFResult) => {
    avatarModel.value = model;
    console.log("avatar model updated");
  };

  /** ##Animation related state## */

  const activeAction = ref<AnimationAction>();
  const previousAction = ref<AnimationAction>();
  const mixer = shallowRef<AnimationMixer>();
  const actions = shallowRef<{ [key: string]: AnimationAction }>({});
  const animationList = reactive<{
    state: string;
    [key: string]: VoidFunction | string;
  }>({
    /** Tracks animation avatar should trigger after another animation is triggered*/
    state: DefaultAnimation,
  });

  /**
   * @description Sets the `state` of the model, indicating what animation it should return to after an animation is triggered
   */
  const setAnimationState = (state: string) => {
    if (state.startsWith("null")) {
      return;
    }
    if (animationList.state === state) {
      return;
    }
    // make sure state actually exists
    // TODO FIX by passing in actual name of states, idle, qr_code, etc...
    // if (states.indexOf(state) === -1) {
    //   console.error("Invalid state: ", state);
    //   state = states.IDLE; // default to idle
    // }
    animationList.state = state;
    fadeToAction(state, 0.5);
  };

  const toggleMarketingAnimation = () => {
    if (activeAction.value) {
      activeAction.value.paused = !activeAction.value.paused;
    }
  };

  const fadeToAction = (name: string, duration: number) => {
    if (activeAction.value) previousAction.value = activeAction.value;
    activeAction.value = actions.value[name];
    if (previousAction.value && previousAction.value !== activeAction.value) {
      previousAction.value.fadeOut(duration);
    }
    if (activeAction.value) {
      const prevClipName = previousAction.value?.getClip().name;
      const activeClipName = activeAction.value?.getClip().name;

      // Prevent transition from MARKETING to IDLE
      if (
        !(
          prevClipName === AnimationStates.MARKETING &&
          activeClipName === AnimationStates.IDLE
        )
      ) {
        activeAction.value
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();
      }
    }
    console.log("fadeToAction: ", name, duration);
  };

  const createAnimationCallback = (name: string) => {
    animationList[name] = () => {
      fadeToAction(name, 0.2);
      mixer.value?.addEventListener("finished", restoreState);
    };
  };

  /** Removes the event listeners from the `mixer`, then transitions back to the default `state` animation. */
  const restoreState = () => {
    console.log("finished animation");
    mixer.value?.removeEventListener("finished", restoreState);
    mixer.value?.removeEventListener("loop", restoreState);
    fadeToAction(animationList.state, 0.2);
  };

  /** Plays an animation using the `fadeToAction` func. */
  const playAnimation = (name: string) => {
    if (activeAction.value && activeAction.value.paused === true) {
      toggleMarketingAnimation();
    }
    fadeToAction(name, 0.2);
    mixer.value?.addEventListener("finished", restoreState);
    mixer.value?.addEventListener("loop", restoreState);
  };

  /** @description Updates the list of animations stored in `animationList` and also in the tweakPane. */
  const updateAnimationsList = async (newModel: GLTFResult) => {
    mixer.value = new AnimationMixer(newModel.scene);
    if (newModel.animations && newModel.animations.length > 0) {
      for (const clip of newModel.animations) {
        actions.value[clip.name] = mixer.value.clipAction(clip);
      }
      /** TODO: Trigger only on dev deployment */
      createAnimationPane(newModel);
    }
  };

  const idleAnimationName = computed(() => {
    return avatarModel.value?.animations[0].name;
  });

  watch(avatarModel, async (newValue) => {
    console.log("updated model: ", newValue);
    if (newValue) {
      await updateAnimationsList(newValue);

      if (idleAnimationName.value) {
        setAnimationState(idleAnimationName.value);
        playAnimation(idleAnimationName.value);
      }
    }
  });

  if (getCurrentInstance()) {
    onMounted(async () => {
      if (!avatarModel.value) {
        console.log("loading default model");
        await restoreDefaultAvatarModel();
      }
      /** Setting up the tweak pane panel for the Avatar
       * TODO: Only display pane in dev
       */
      if (import.meta.client) {
        createAvatarPane();
      }
    });
    onUnmounted(() => {
      cleanupPanes();
    });
    onLoop(({ delta }) => {
      if (mixer.value) mixer.value.update(delta);
      const action = activeAction.value;
      const startTime = 2.5; // Start of loop
      const endTime = 7.5; // End of loop
      if (action?.time && action.time >= endTime) {
        action.time = startTime; // Reset back to 2s
      }
    });
  }

  return {
    state,
    updateAvatarModel,
    avatarModel,
    mixer,
    actions,
    animationList,
    playAnimation,
    resetAnimation: restoreState,
  };
});
