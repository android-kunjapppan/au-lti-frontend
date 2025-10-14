import { useIntervalFn } from "@vueuse/core";

export const useWaveform = () => {
  // Use centralized constants
  const BAR_COUNT = WAVEFORM_CONFIG.BAR_COUNT;
  const MAX_HEIGHT = 100;
  const UPDATE_INTERVAL = WAVEFORM_CONFIG.UPDATE_INTERVAL;

  const waveform = ref<number[]>(Array.from({ length: BAR_COUNT }, () => 0));

  const resetWaveform = () => {
    waveform.value = waveform.value.map(() => 0);
  };

  const updateWaveform = () => {
    waveform.value = waveform.value.map(() => Math.random() * MAX_HEIGHT);
  };

  // Use VueUse's useIntervalFn for better interval management
  const {
    pause: stopWaveform,
    resume: startWaveform,
    isActive,
  } = useIntervalFn(updateWaveform, UPDATE_INTERVAL, { immediate: false });

  watch(isActive, (newValue) => {
    if (newValue === false) {
      resetWaveform();
    }
  });

  return {
    waveform,
    startWaveform,
    stopWaveform,
    updateWaveform,
  };
};
