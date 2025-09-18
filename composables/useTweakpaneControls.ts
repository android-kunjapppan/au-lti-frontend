import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FolderApi } from "tweakpane";
import { shallowRef } from "vue";

/**
 * Provides composable functions for creating and managing Tweakpane UI controls
 * for lip sync, audio, and animation debugging.
 */
export const useTweakpaneControls = () => {
  // References to Tweakpane folders for cleanup and access
  const lipSyncFolder = shallowRef<FolderApi>();
  const audioControlsFolder = shallowRef<FolderApi>();
  const morphTargetsFolder = shallowRef<FolderApi>();
  const paneFolderAnimations = shallowRef<FolderApi>();
  const paneFolderLighting = shallowRef<FolderApi>();

  /**
   * Creates a Tweakpane folder to display real-time lip sync status.
   * @param lipSyncStatus - Object containing current lip sync state
   */
  const createLipSyncPane = (lipSyncStatus: {
    activeSound: string;
    activeMorphValue: number;
    activeFrequency: number;
  }) => {
    // Check if pane is available (not hidden)
    const nuxtApp = useNuxtApp();
    if (!nuxtApp.$pane || nuxtApp.$pane.hidden) {
      return;
    }

    lipSyncFolder.value = nuxtApp.$pane.addFolder({
      title: "Lip Sync",
    });
    // Display the currently detected sound/phoneme
    lipSyncFolder.value.addBinding(lipSyncStatus, "activeSound", {
      label: "Active Sound",
      readonly: true,
    });
    // Display the morph target value (mouth openness)
    lipSyncFolder.value.addBinding(lipSyncStatus, "activeMorphValue", {
      label: "Active Morph Value",
      readonly: true,
      format: (v: number) => v.toFixed(3),
    });
    // Display the detected frequency amplitude
    lipSyncFolder.value.addBinding(lipSyncStatus, "activeFrequency", {
      label: "Active Frequency",
      readonly: true,
      format: (v: number) => v.toFixed(3),
    });
  };

  /**
   * Creates a Tweakpane folder for audio controls and analysis parameters.
   * @param volume - Reactive volume object
   * @param params - Reactive audio analysis parameters
   * @param playPauseAudio - Function to play or pause audio
   * @param updateVolume - Function to update volume
   */
  const createAudioControlsPane = (
    volume: { value: number },
    params: {
      value: {
        sensitivity: number;
        threshold: number;
        smoothness: number;
        minFrequency: number;
        maxFrequency: number;
      };
    },
    playPauseAudio: () => void,
    updateVolume: () => void
  ) => {
    // Check if pane is available (not hidden)
    const nuxtApp = useNuxtApp();
    if (!nuxtApp.$pane || nuxtApp.$pane.hidden) {
      return;
    }

    audioControlsFolder.value = nuxtApp.$pane.addFolder({
      title: "Audio Controls",
    });
    // Button to play or pause audio
    audioControlsFolder.value
      .addButton({ title: "Play/Pause" })
      .on("click", () => {
        console.log("playPauseAudio");
        playPauseAudio();
      });
    // Volume slider
    audioControlsFolder.value
      .addBinding(volume, "value", {
        label: "Volume",
        min: 0,
        max: 1,
        step: 0.1,
      })
      .on("change", () => updateVolume());
    // Sensitivity parameter
    audioControlsFolder.value.addBinding(params.value, "sensitivity", {
      label: "Sensitivity",
      min: 0.1,
      max: 15.0,
      step: 0.01,
    });
    // Threshold parameter
    audioControlsFolder.value.addBinding(params.value, "threshold", {
      label: "Threshold",
      min: 0,
      max: 0.8,
      step: 0.01,
    });
    // Smoothness parameter
    audioControlsFolder.value.addBinding(params.value, "smoothness", {
      label: "Smoothness",
      min: 0,
      max: 2.5,
      step: 0.01,
    });
    // Minimum frequency parameter
    audioControlsFolder.value.addBinding(params.value, "minFrequency", {
      label: "Min Frequency",
      min: 50,
      max: 500,
      step: 10,
    });
    // Maximum frequency parameter
    audioControlsFolder.value.addBinding(params.value, "maxFrequency", {
      label: "Max Frequency",
      min: 1000,
      max: 4000,
      step: 50,
    });
  };

  /**
   * Creates a Tweakpane folder for animation controls, allowing the user
   * to play or stop model animations.
   * @param model - The loaded GLTF model containing animations
   * @param playAnimation - Function to play a specific animation
   * @param stopAllActions - Function to stop all animations
   */
  const createAnimationPane = (
    model: GLTF,
    playAnimation: (name: string) => void,
    stopAllActions: () => void
  ) => {
    // Check if pane is available (not hidden)
    const nuxtApp = useNuxtApp();
    if (!nuxtApp.$pane || nuxtApp.$pane.hidden) {
      return;
    }

    // Dispose previous animation folder if it exists
    if (paneFolderAnimations.value) paneFolderAnimations.value.dispose();
    paneFolderAnimations.value = nuxtApp.$pane.addFolder({
      title: "Animations",
      expanded: true,
    });
    // Button to stop all animations
    const stopBtn = paneFolderAnimations.value.addButton({
      title: "Stop",
      label: "Stop all",
    });
    stopBtn.on("click", () => {
      stopAllActions();
    });
    // Create a play button for each animation clip
    for (const clip of model.animations) {
      const btn = paneFolderAnimations.value.addButton({
        title: "Play",
        label: clip.name,
      });
      btn.on("click", () => {
        playAnimation(clip.name);
      });
    }
  };
  /**
   * Creates a Tweakpane folder for lighting controls
   */
  const createLightingPane = (
    ambientLightValues: {
      intensity: number;
      color: string;
    },
    directionalLightValues: {
      position: { x: number; y: number; z: number };
      intensity: number;
      color: string;
    }
  ) => {
    // Check if pane is available (not hidden)
    const nuxtApp = useNuxtApp();
    if (!nuxtApp.$pane || nuxtApp.$pane.hidden) {
      // Return a no-op cleanup function if pane is not available
      return () => {};
    }

    // Dispose previous animation folder if it exists
    if (paneFolderLighting.value) paneFolderLighting.value.dispose();
    paneFolderLighting.value = nuxtApp.$pane.addFolder({
      title: "Lighting",
      expanded: true,
    });

    paneFolderLighting.value.addBinding(directionalLightValues, "intensity", {
      label: "directional intensity",
      min: 0,
      max: 1,
      step: 0.01,
    });
    paneFolderLighting.value.addBinding(directionalLightValues, "position", {
      label: "Position",
    });
    paneFolderLighting.value.addBinding(directionalLightValues, "color");
    paneFolderLighting.value.addBinding(ambientLightValues, "color");
    paneFolderLighting.value.addBinding(ambientLightValues, "intensity", {
      label: "ambient intensity",
      min: 0,
      max: 1,
      step: 0.01,
    });

    return () => {
      if (paneFolderLighting.value) {
        paneFolderLighting.value.dispose();
        paneFolderLighting.value = undefined;
      }
    };
  };

  /**
   * Disposes all Tweakpane folders to clean up UI and memory.
   */
  const cleanupPanes = () => {
    paneFolderAnimations.value?.dispose();
    morphTargetsFolder.value?.dispose();
    lipSyncFolder.value?.dispose();
    audioControlsFolder.value?.dispose();
    paneFolderLighting.value?.dispose();
  };

  return {
    lipSyncFolder,
    audioControlsFolder,
    morphTargetsFolder,
    paneFolderAnimations,
    createLipSyncPane,
    createAudioControlsPane,
    createAnimationPane,
    cleanupPanes,
    createLightingPane,
  };
};
