// composables/useEyeBlinking.ts
import { ref } from "vue";
import type { EyeMesh } from "~/utils/constants";

export const useEyeBlinking = () => {
  const eyeMeshes = ref<EyeMesh[]>([]);
  const blinkStartTime = ref<number>(0);
  const isBlinking = ref<boolean>(false);

  const updateEyeBlinking = (): void => {
    if (eyeMeshes.value.length === 0) return;

    const currentTime = performance.now() / 1000; // Convert to seconds
    if (!isBlinking.value) {
      blinkStartTime.value = currentTime;
      isBlinking.value = true;
    }

    const elapsedTime = currentTime - blinkStartTime.value;
    const cycleDuration = BLINK_DURATION + BLINK_PAUSE; // Total duration for one complete cycle
    const cycleTime = elapsedTime % cycleDuration;

    // Calculate blink value (0 to 1 and back to 0)
    let blinkValue = 0;
    if (cycleTime < BLINK_DURATION) {
      // Blinking phase (0 to 1 and back to 0)
      const blinkPhase = cycleTime / BLINK_DURATION;
      if (blinkPhase < 0.5) {
        // Closing phase (0 to 1)
        blinkValue = blinkPhase * 2;
      } else {
        // Opening phase (1 to 0)
        blinkValue = 1 - (blinkPhase - 0.5) * 2;
      }
    } else {
      // Pause phase - eyes stay open (value = 0)
      blinkValue = 0;
    }

    // Apply blink value to all eye morph targets
    for (const { mesh, targetIndex } of eyeMeshes.value) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[targetIndex] = blinkValue;
      }
    }
  };

  const addEyeMesh = (mesh: EyeMesh) => {
    eyeMeshes.value.push(mesh);
  };

  const resetEyeBlinking = () => {
    for (const { mesh, targetIndex } of eyeMeshes.value) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[targetIndex] = 0;
      }
    }
    isBlinking.value = false;
  };

  return {
    eyeMeshes,
    blinkStartTime,
    isBlinking,
    updateEyeBlinking,
    addEyeMesh,
    resetEyeBlinking,
  };
};
