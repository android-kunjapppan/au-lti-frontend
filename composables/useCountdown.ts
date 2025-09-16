/**
 * @description useCountdown is a composable that creates a countdown timer
 * @param callbackFun - a function to call when the countdown is finished
 * @param timeout - the timeout for the countdown
 * @returns countdown, startCountdown, pauseCountdown, resetCountdown, isCountdownFinished
 */

export const useCountdown = (
  callbackFun: () => void,
  timeout = 120,
  args?: { onTick?: () => void }
) => {
  let timer: NodeJS.Timeout | null;
  const remaining = ref(timeout);
  const isActive = ref(false);

  // Fired during the interval
  const intervalFunc = () => {
    remaining.value--;
    args?.onTick?.();
    console.log("Remaining: ", remaining.value);
    if (remaining.value === 0) {
      callbackFun();
      stop();
    }
  };

  // start countdown till countdown is 0
  const start = async () => {
    stop();
    isActive.value = true;
    timer = setInterval(intervalFunc, 1000);
  };

  const stop = () => {
    cleanup();
  };

  // pause countdown
  const pause = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  // pause countdown
  const resume = () => {
    if (timer) clearInterval(timer);
    timer = null;
    timer = setInterval(intervalFunc, 1000);
  };

  // reset countdown
  const reset = () => {
    stop();
    start();
  };

  const cleanup = () => {
    remaining.value = timeout;
    isActive.value = false;
    if (timer) clearInterval(timer);
    timer = null;
  };

  const percentRemaining = computed(() => {
    return ((timeout - remaining.value) / timeout) * 100;
  });

  onUnmounted(() => {
    stop();
  });

  return {
    remaining,
    stop,
    start,
    reset,
    pause,
    resume,
    isActive,
    percentRemaining,
  };
};
