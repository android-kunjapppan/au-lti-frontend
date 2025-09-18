import { Mesh, type Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { computed } from "vue";
import { useAnimationManager } from "~/composables/useAnimationManager";
import {
  lipSyncStatus,
  useAudioAnalysis,
} from "~/composables/useAudioAnalysis";
import { useEyeBlinking } from "~/composables/useEyeBlinking";
import { useModelLoader } from "~/composables/useModelLoader";
import { useMorphTargets } from "~/composables/useMorphTargets";
import { useTweakpaneControls } from "~/composables/useTweakpaneControls";
import { EYE_MORPH_TARGETS, MOUTH_TARGETS } from "../utils/constants";

/** State for the experience avatar (animations, model, etc...) */
export const useAvatarStore = defineStore("avatar", () => {
  const { onLoop } = useRenderLoop();
  const {
    avatarModel,
    loader,
    languageToModelMap,
    getSessionLanguage,
    restoreDefaultAvatarModel,
    getCurrentAvatarPath,
  } = useModelLoader();

  const {
    audioElement,
    volume,
    params,
    setupAudioAnalysis,
    playPauseAudio,
    handleAudioEnded,
    updateVolume,
    cleanup: cleanupAudio,
  } = useAudioAnalysis();

  const {
    morphTargetValues,
    targetMorphValues,
    isInterpolating,
    updateMouthMovement,
    addMouthMesh,
  } = useMorphTargets();

  const { updateEyeBlinking, addEyeMesh } = useEyeBlinking();

  const {
    activeAction,
    mixer,
    actions,
    animationList,
    updateAnimationsList,
    playAnimation,
    restoreState,
    startIdleAnimation,
  } = useAnimationManager();

  // Strict control: avatar is only visible when explicitly shown
  const isAvatarVisible = ref(false);

  // Hide avatar when model changes to prevent flickering
  watch(
    avatarModel,
    () => {
      isAvatarVisible.value = false;
    },
    { immediate: true }
  );

  // Show avatar 500ms after animation starts
  watch(
    activeAction,
    (newAction, oldAction) => {
      if (newAction?.isRunning() && newAction !== oldAction) {
        // Animation started, show avatar after delay
        isAvatarVisible.value = false;
        setTimeout(() => {
          if (newAction.isRunning() && avatarModel.value?.scene) {
            isAvatarVisible.value = true;
          }
        }, 500);
      } else {
        // No active animation, hide avatar
        isAvatarVisible.value = false;
      }
    },
    { immediate: true }
  );

  const {
    morphTargetsFolder,
    createLipSyncPane,
    createAudioControlsPane,
    cleanupPanes,
  } = useTweakpaneControls();

  // Reactive state for avatar's position, scale, and rotation
  const state = reactive({
    avatarPos: { x: 0, y: -2.65, z: 0 },
    avatarScale: [1.8, 1.8, 1.8],
    avatarRotation: [0.1, 0.15, 0],
  });

  /**
   * A utility function to check if the Take 001 animation is available in the current model
   * @returns boolean indicating if the animation is available
   */
  const hasIdleAnimation = computed(() => {
    return mixer.value && actions.value[AnimationStates.IDLE];
  });

  // Create individual computed properties for lip sync values to ensure reactivity
  const activeMorphValue = computed(() => lipSyncStatus.activeMorphValue);
  const activeSound = computed(() => lipSyncStatus.activeSound);

  // Loads the avatar model and sets up morph target controls
  const loadModel = async (): Promise<void> => {
    try {
      const avatarPath = getCurrentAvatarPath();
      const gltf = await loader.loadAsync(avatarPath);
      updateAnimationsList(gltf);

      // Add Tweakpane folder for the model
      const folder = useNuxtApp().$pane.addFolder({ title: gltf.scene.name });
      folder.addBinding(state, "avatarPos");

      // Traverse model meshes to set up morph target controls
      gltf.scene.traverse((node) => {
        if (
          node instanceof Mesh &&
          node.morphTargetDictionary &&
          node.morphTargetInfluences
        ) {
          const morphDict = node.morphTargetDictionary;
          const influences = node.morphTargetInfluences;
          morphTargetsFolder.value = folder.addFolder({
            title: node.name || "Mesh",
          });

          for (const [name, index] of Object.entries(morphDict)) {
            if (MOUTH_TARGETS.has(name)) {
              addMouthMesh(node, name, index);

              // Add Tweakpane slider for mouth morph target
              const binding = morphTargetsFolder.value.addBinding(
                influences,
                index,
                {
                  label: name
                    .replace("SkinDriver.", "")
                    .replace("TeethDriver.", ""),
                  min: 0,
                  max: 1,
                  step: 0.01,
                }
              );

              binding.on("change", (ev) => {
                morphTargetValues.value[name] = ev.value;
                targetMorphValues.value[name] = ev.value;
                isInterpolating.value = true;
              });
            }
            if (EYE_MORPH_TARGETS.includes(name)) {
              addEyeMesh({
                mesh: node,
                targetIndex: index,
              });
            }
          }
        }
      });
      avatarModel.value = gltf;
    } catch (error) {
      console.error("Failed to load model:", error);
    }
  };

  // Update avatar position state from a model's Object3D
  const updateStateFromModel = (model: Object3D) => {
    state.avatarPos = {
      x: model.position.x,
      y: model.position.y,
      z: model.position.z,
    };
  };

  // Update the avatar model and apply position/scale
  const updateAvatarModel = async (
    model: GLTF,
    position: [number, number, number] = [
      state.avatarPos.x,
      state.avatarPos.y,
      state.avatarPos.z,
    ]
  ) => {
    avatarModel.value = model;
    updateAnimationsList(model);

    if (model.scene) {
      model.scene.position.set(...position);
      const language = getSessionLanguage();
      const modelData = languageToModelMap[language] || languageToModelMap.en;
      model.scene.scale.set(...modelData.scale);
      updateStateFromModel(model.scene);
    }
    // Keep model's position/scale in sync on each render loop
    onLoop(() => {
      if (model.scene) {
        model.scene.traverse((child) => {
          if (child instanceof Mesh) {
            child.position.set(...position);
            const language = getSessionLanguage();
            const modelData =
              languageToModelMap[language] || languageToModelMap.en;
            child.scale.set(...modelData.scale);
          }
        });
      }
    });
  };

  // Lifecycle hooks for setup and cleanup
  if (getCurrentInstance()) {
    onMounted(async () => {
      if (!avatarModel.value) {
        const model = await restoreDefaultAvatarModel();
        if (model) {
          updateAvatarModel(model);
        } else {
          console.error("❌ Failed to load default avatar model");
        }
      } else {
        // Avatar model already exists, no need to load
      }
      if (import.meta.client) {
        createLipSyncPane(lipSyncStatus);
        createAudioControlsPane(volume, params, playPauseAudio, updateVolume);
      }
    });
    onUnmounted(() => {
      cleanupAudio();
      cleanupPanes();
    });
    // Main render loop: update animation, mouth, and eye blinking
    onLoop(({ delta }) => {
      if (mixer.value) {
        mixer.value.update(delta);
      } else {
        console.warn("⚠️ No animation mixer available in render loop");
      }
      const action = activeAction.value;
      const startTime = 2.5;
      const endTime = 7.5;
      if (action?.time && action.time >= endTime) {
        action.time = startTime;
      }

      // Use lip sync status directly to ensure we get the latest values
      const currentMorphValue = lipSyncStatus.activeMorphValue;
      const currentSound = lipSyncStatus.activeSound;
      const currentSource = lipSyncStatus.source;

      // Always update mouth movement to ensure proper mouth state
      // This handles both bot and chat audio mouth movement using the same code
      updateMouthMovement(
        currentMorphValue,
        currentSound,
        params.value,
        currentSource
      );

      updateEyeBlinking();
    });
  }

  // Expose relevant state and methods
  return {
    state,
    updateAvatarModel,
    loadModel,
    audioElement,
    setupAudioAnalysis,
    handleAudioEnded,
    restoreDefaultAvatarModel,
    avatarModel,
    mixer,
    actions,
    animationList,
    playAnimation,
    resetAnimation: restoreState,
    startIdleAnimation,
    hasIdleAnimation,
    isAvatarVisible,
  };
});
