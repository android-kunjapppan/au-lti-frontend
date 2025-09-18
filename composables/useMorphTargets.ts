import type { Mesh } from "three";
import { ref } from "vue";
import type { MouthMesh } from "~/types/types";
import { SOUND_TO_TARGETS } from "~/utils/constants";

/**
 * Composable for managing morph targets (mouth shapes) for lip sync.
 */
export const useMorphTargets = () => {
  // List of mouth meshes and their morph target info
  const mouthMeshes = ref<MouthMesh[]>([]);
  // Current morph target values (for each targetName)
  const morphTargetValues = ref<{ [key: string]: number }>({});
  // Target morph values to interpolate towards (for each targetName)
  const targetMorphValues = ref<{ [key: string]: number }>({});
  // Whether interpolation is currently active (not used, but exposed)
  const isInterpolating = ref(false);

  /**
   * Updates mouth morph targets based on audio amplitude and detected sound.
   * Smoothly interpolates morph target values for natural mouth movement.
   * @param amplitude - Current audio amplitude (0-1)
   * @param activeSound - Detected sound/phoneme (string)
   * @param params - Object with threshold and sensitivity for mouth movement
   * @param source - Source of the audio ('bot' or 'replay')
   */
  const updateMouthMovement = (
    amplitude: number,
    activeSound: string,
    params: { threshold: number; sensitivity: number },
    source: "bot" | "replay" = "bot"
  ): void => {
    if (mouthMeshes.value.length === 0) return;

    // Calculate the base morph value for the mouth (0-1)
    const baseTargetValue =
      amplitude > params.threshold
        ? Math.min(amplitude * params.sensitivity * 2.5, 1.0)
        : 0;

    const interpolationSpeed = 0.25; // Controls how fast morphs interpolate

    for (const { mesh, targetName, targetIndex } of mouthMeshes.value) {
      if (mesh.morphTargetInfluences) {
        let targetValue = 0;
        // Only activate morph if the current sound maps to this target
        if (
          activeSound !== "none" &&
          activeSound in SOUND_TO_TARGETS &&
          SOUND_TO_TARGETS[activeSound].includes(targetName)
        ) {
          targetValue = baseTargetValue;
        }
        // Set the target value for this morph
        targetMorphValues.value[targetName] = targetValue;
        // Interpolate current value towards the target value
        morphTargetValues.value[targetName] +=
          (targetMorphValues.value[targetName] -
            morphTargetValues.value[targetName]) *
          interpolationSpeed;
        // Apply the interpolated value to the mesh's morph target
        mesh.morphTargetInfluences[targetIndex] =
          morphTargetValues.value[targetName];
      }
    }
  };

  /**
   * Registers a new mouth mesh and its morph target for animation.
   * @param mesh - THREE.Mesh instance
   * @param targetName - Name of the morph target (e.g. "A", "O", "M")
   * @param targetIndex - Index of the morph target in the mesh
   */
  const addMouthMesh = (
    mesh: Mesh,
    targetName: string,
    targetIndex: number
  ) => {
    morphTargetValues.value[targetName] = 0;
    targetMorphValues.value[targetName] = 0;
    mouthMeshes.value.push({
      mesh,
      targetName,
      targetIndex,
    });
  };

  /**
   * Resets all morph targets to zero (neutral mouth).
   */
  const resetMorphTargets = () => {
    for (const { mesh, targetName, targetIndex } of mouthMeshes.value) {
      if (mesh.morphTargetInfluences) {
        morphTargetValues.value[targetName] = 0;
        targetMorphValues.value[targetName] = 0;
        mesh.morphTargetInfluences[targetIndex] = 0;
      }
    }
  };

  return {
    mouthMeshes,
    morphTargetValues,
    targetMorphValues,
    isInterpolating,
    updateMouthMovement,
    addMouthMesh,
    resetMorphTargets,
  };
};
