import { useIntervalFn } from "@vueuse/core";
import { ref } from "vue";

export const useWaveform = () => {
  // Use centralized constants
  const BAR_COUNT = WAVEFORM_CONFIG.BAR_COUNT;
  const MAX_HEIGHT = WAVEFORM_CONFIG.MAX_HEIGHT;
  const UPDATE_INTERVAL = WAVEFORM_CONFIG.UPDATE_INTERVAL;

  const waveform = ref(
    Array.from({ length: BAR_COUNT }, () => Math.random() * MAX_HEIGHT)
  );

  const updateWaveform = () => {
    waveform.value = waveform.value.map(() => Math.random() * MAX_HEIGHT);
  };

  // Use VueUse's useIntervalFn for better interval management
  const { pause: stopWaveform, resume: startWaveform } = useIntervalFn(
    updateWaveform,
    UPDATE_INTERVAL,
    { immediate: false }
  );

  return {
    waveform,
    startWaveform,
    stopWaveform,
    updateWaveform,
  };
};
