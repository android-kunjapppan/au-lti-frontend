import type { AnimationAction } from "three";
import { AnimationMixer, LoopRepeat } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { reactive, ref, shallowRef } from "vue";
import { AnimationStates } from "~/utils/constants";
import { useTweakpaneControls } from "./useTweakpaneControls";

/**
 * Composable for managing 3D model animations using THREE.AnimationMixer.
 * Handles animation state, transitions, and Tweakpane controls.
 */
export const useAnimationManager = () => {
  // Currently active animation action
  const activeAction = ref<AnimationAction>();
  // Previously active animation action (for transitions)
  const previousAction = ref<AnimationAction>();
  // Animation mixer for the current model
  const mixer = shallowRef<AnimationMixer>();
  // Map of animation actions by name
  const actions = shallowRef<{ [key: string]: AnimationAction }>({});
  // Reactive object to track animation state and expose callbacks for each animation
  const animationList = reactive<{
    state: string;
    [key: string]: VoidFunction | string;
  }>({
    state: AnimationStates.IDLE,
  });

  // Get Tweakpane animation controls
  const { createAnimationPane } = useTweakpaneControls();

  /**
   * Utility function to check if an animation is currently running
   * @param animationName - Name of the animation to check
   * @returns boolean indicating if the animation is running
   */
  const isAnimationRunning = (animationName: string): boolean => {
    const action = actions.value[animationName];
    return action ? action.isRunning() : false;
  };

  /**
   * Starts the IDLE animation (Take 001) in loop.
   * @param delay - Optional delay before starting (useful for initialization)
   * @returns Promise that resolves when animation starts successfully
   */
  const startIdleAnimation = async (delay: number = 0): Promise<boolean> => {
    // Early validation checks
    if (!mixer.value) {
      console.warn("❌ Animation mixer not available");
      return false;
    }

    if (!actions.value[AnimationStates.IDLE]) {
      console.warn("❌ Take 001 IDLE animation not available");
      return false;
    }

    // Check if animation is already running to avoid unnecessary restarts
    if (
      activeAction.value === actions.value[AnimationStates.IDLE] &&
      activeAction.value.isRunning()
    ) {
      return true;
    }

    try {
      const idleAction = actions.value[AnimationStates.IDLE];

      // Configure animation properties in optimal order
      idleAction
        .reset()
        .setLoop(LoopRepeat, Infinity) // Set loop first for better performance
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(0.3);

      // Apply delay if specified (using Promise for better async handling)
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Start the animation and update state
      idleAction.play();
      activeAction.value = idleAction;

      return true;
    } catch (error) {
      console.error("❌ Failed to start IDLE animation:", error);
      return false;
    }
  };

  /**
   * Initializes the animation mixer and actions for a new model.
   * Also sets up Tweakpane controls for the available animations.
   * @param newModel - The loaded GLTF model
   */
  const updateAnimationsList = async (newModel: GLTF) => {
    // Initialize animation mixer
    mixer.value = new AnimationMixer(newModel.scene);

    // Set up animation actions
    if (newModel.animations && newModel.animations.length > 0) {
      for (const clip of newModel.animations) {
        actions.value[clip.name] = mixer.value.clipAction(clip);
      }

      // Start IDLE animation with initialization delay
      await startIdleAnimation(100);
    } else {
      console.warn("❌ No animations found in model");
    }

    // Create animation controls in Tweakpane (client-side only)
    if (import.meta.client) {
      createAnimationPane(newModel, playAnimation, restoreState);
    }
  };

  /**
   * Fades from the current action to the specified action.
   * Handles special case to prevent transition from MARKETING to IDLE.
   * @param name - Name of the animation to play
   * @param duration - Duration of the fade transition
   */
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

  /**
   * Plays the specified animation, handling pause toggling and event listeners.
   * @param name - Name of the animation to play
   */
  const playAnimation = (name: string) => {
    // If the current action is paused, toggle it (for marketing animation)
    if (activeAction.value && activeAction.value.paused === true) {
      toggleMarketingAnimation();
    }
    fadeToAction(name, 0.2);
    // Listen for animation end or loop to restore state
    mixer.value?.addEventListener("finished", restoreState);
    mixer.value?.addEventListener("loop", restoreState);
  };

  /**
   * Toggles the paused state of the current active action.
   * Used for pausing/resuming marketing animation.
   */
  const toggleMarketingAnimation = () => {
    if (activeAction.value) {
      activeAction.value.paused = !activeAction.value.paused;
    }
  };

  /**
   * Restores the animation state to the default (animationList.state) after an animation finishes.
   * Removes event listeners to prevent duplicate triggers.
   */
  const restoreState = () => {
    console.log("finished animation");
    mixer.value?.removeEventListener("finished", restoreState);
    mixer.value?.removeEventListener("loop", restoreState);
    fadeToAction(animationList.state, 0.2);
  };

  /**
   * Creates a callback for a specific animation and adds it to the animationList.
   * This allows Tweakpane or other UI to trigger the animation by name.
   * @param name - Name of the animation
   */
  const createAnimationCallback = (name: string) => {
    animationList[name] = () => {
      fadeToAction(name, 0.2);
      mixer.value?.addEventListener("finished", restoreState);
    };
  };

  // Expose state and animation control methods
  return {
    activeAction,
    previousAction,
    mixer,
    actions,
    animationList,
    updateAnimationsList,
    fadeToAction,
    playAnimation,
    toggleMarketingAnimation,
    restoreState,
    createAnimationCallback,
    startIdleAnimation,
    isAnimationRunning, // Utility for checking animation state
  };
};
