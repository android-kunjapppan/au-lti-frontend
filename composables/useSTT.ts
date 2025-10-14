import { useSpeechRecognition } from "@vueuse/core";
import { usePermissionManager } from "~/composables/usePermissionManager";

/**
 *
 * @description Wrapper for `useSpeechRecognition` that handles watching for recognition to finish, then appending it to the `textStorage` passed in.
 */
export const useSTT = (args: {
  textStorage: Ref<string>;
  disableTimeout?: boolean;
  lang?: string;
  preventUpdates?: Ref<boolean>;
}) => {
  const {
    textStorage,
    disableTimeout = true,
    lang = "es",
    preventUpdates,
  } = args;

  // Permission management to prevent duplicate requests
  const permissionManager = usePermissionManager();

  const shouldBeListening = ref(false);
  const isStopping = ref(false);
  const isStarting = ref(false); // Flag to prevent concurrent starts
  const recognitionActuallyRunning = ref(false); // Track actual recognition state via events
  const lastStartAttempt = ref(0); // Timestamp of last start attempt for debouncing
  const lastStopTime = ref(0); // Track when STT last stopped
  const quickRestartCount = ref(0); // Count rapid start-stop cycles
  const preSttTextSnapshot = ref("");
  const sttStringBuffer = ref("");
  const sttFinishedPromise = shallowRef<Promise<void> | null>(null);
  const sttFinishedResolver = shallowRef<
    null | ((value: void | PromiseLike<void>) => void)
  >(null);

  const appStore = useAppStore();

  const {
    isSupported,
    isListening,
    result,
    isFinal,
    error,
    recognition,
    start: startSTT,
    stop: stopSTT,
  } = useSpeechRecognition({
    lang,
    interimResults: true,
    continuous: true,
  });

  // Set up direct event listeners on the recognition object to track actual state
  // This runs after the component is mounted to ensure recognition is available
  watchEffect(() => {
    if (recognition) {
      recognition.onstart = () => {
        recognitionActuallyRunning.value = true;
        isStarting.value = false;
      };

      recognition.onend = () => {
        recognitionActuallyRunning.value = false;
        isStarting.value = false;

        const now = Date.now();
        const timeSinceLastStop = now - lastStopTime.value;
        lastStopTime.value = now;

        // If stopped within 1 second of last stop, increment rapid cycle counter
        if (timeSinceLastStop < 1000) {
          quickRestartCount.value++;
          console.warn(`⚠️ Rapid cycle detected (${quickRestartCount.value})`);
        } else {
          // Reset counter if enough time has passed
          quickRestartCount.value = 0;
        }
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        recognitionActuallyRunning.value = false;
        isStarting.value = false;
        const errorEvent = event as unknown as { error: string };
        console.error("❌ SpeechRecognition error:", errorEvent.error);
      };
    }
  });

  const start = async () => {
    const now = Date.now();
    const DEBOUNCE_MS = 300; // Debounce rapid clicks
    const COOLDOWN_MS = 2000; // Cooldown after rapid cycles
    const MAX_RAPID_CYCLES = 5; // Max rapid cycles before cooldown

    // Check for excessive rapid cycling
    if (quickRestartCount.value >= MAX_RAPID_CYCLES) {
      const timeSinceLastStop = now - lastStopTime.value;
      if (timeSinceLastStop < COOLDOWN_MS) {
        appStore.addAlert(
          `Too many rapid cycles. Please wait ${Math.ceil((COOLDOWN_MS - timeSinceLastStop) / 1000)}s`
        );
        console.warn(
          `🔴 Cooldown active: Too many rapid cycles (${quickRestartCount.value}). Please wait ${Math.ceil((COOLDOWN_MS - timeSinceLastStop) / 1000)}s`
        );
        return;
      } else {
        // Cooldown period passed, reset counter
        quickRestartCount.value = 0;
      }
    }

    // Debounce: Ignore if called too soon after last attempt
    if (now - lastStartAttempt.value < DEBOUNCE_MS) {
      console.warn("🚫 Start called too quickly, debouncing");
      return;
    }
    lastStartAttempt.value = now;

    // Check if already listening or in the process of starting
    if (
      isListening.value ||
      isStarting.value ||
      recognitionActuallyRunning.value
    ) {
      console.warn("STT is already listening or starting, skipping start");
      return;
    }

    // Set starting flag immediately to prevent concurrent calls
    isStarting.value = true;

    try {
      // Check permissions first to avoid duplicate requests
      if (!permissionManager.hasPermission.value) {
        const permissionGranted = await permissionManager.requestPermission();
        if (!permissionGranted) {
          isStarting.value = false;
          throw new Error("Microphone permission denied");
        }
      }

      // Triple-check that we're still not listening (state might have changed during permission request)
      if (isListening.value || recognitionActuallyRunning.value) {
        console.warn(
          "STT started by another process during permission request, skipping start"
        );
        isStarting.value = false;
        return;
      }

      shouldBeListening.value = true;

      // Force stop any lingering recognition before starting
      if (recognition && recognitionActuallyRunning.value) {
        try {
          stopSTT();
          // Small delay to ensure cleanup
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (e) {
          // Ignore errors from stopping non-running recognition
        }
      }

      startSTT();
      // Note: isStarting flag will be cleared in the onstart event handler
    } catch (error) {
      // Clear starting flag on error
      isStarting.value = false;
      recognitionActuallyRunning.value = false;

      // Handle any remaining edge cases
      if (
        error instanceof Error &&
        error.message.includes("recognition has already started")
      ) {
        console.warn(
          "SpeechRecognition start failed - already started, forcing stop and retry"
        );
        // Force stop and clear state
        try {
          stopSTT();
          recognitionActuallyRunning.value = false;
        } catch (e) {
          // Ignore
        }
        return;
      }
      throw error; // Re-throw other errors
    }
  };

  const toggle = async () => {
    const now = Date.now();
    const MIN_TOGGLE_INTERVAL = 500; // Minimum time between toggles

    // Prevent rapid toggling
    if (now - lastStartAttempt.value < MIN_TOGGLE_INTERVAL) {
      console.warn("🚫 Toggle called too quickly, please wait");
      return;
    }

    // If currently listening or in the process of starting, stop
    if (
      isListening.value === true ||
      isStarting.value ||
      recognitionActuallyRunning.value
    ) {
      await stop();
    } else {
      await start();
    }
  };

  const stop = async () => {
    // If we're not listening and not starting, nothing to stop
    if (
      !isListening.value &&
      !isStarting.value &&
      !recognitionActuallyRunning.value
    )
      return;

    // If we're in the process of starting, cancel it
    if (isStarting.value && !recognitionActuallyRunning.value) {
      isStarting.value = false;
      shouldBeListening.value = false;
      recognitionActuallyRunning.value = false;
      return;
    }

    isStopping.value = true;
    shouldBeListening.value = false;

    // Stop the browser's STT engine IMMEDIATELY to prevent capturing new audio
    // The browser will still process audio already captured and fire one final result event
    stopSTT();

    // Create promise for tracking completion
    sttFinishedPromise.value = new Promise<void>((resolve) => {
      sttFinishedResolver.value = resolve;
    });

    // Case 1: Final result already available
    if (isFinal.value) {
      sttFinishedResolver.value?.();
      isStopping.value = false;
      return sttFinishedPromise.value;
    }

    // Case 2: Interim result, wait for final via watch or timeout
    if (result.value && !isFinal.value) {
      const waitForFinal = Promise.race([
        new Promise<boolean>((resolve) => {
          const stopWatch = watch(isFinal, (newIsFinal) => {
            if (newIsFinal) {
              stopWatch(); // cleanup
              resolve(true);
            }
          });
          // also cleanup if timeout wins
          setTimeout(() => stopWatch(), 2000); // Reduced to 2s since STT is already stopped
        }),
        new Promise<boolean>(
          (resolve) =>
            setTimeout(() => {
              console.warn("⏱️ [STT] Timeout waiting for final result");
              resolve(false);
            }, 2000) // Reduced timeout since we've already stopped capturing
        ),
      ]);

      const receivedFinal = await waitForFinal;
    }

    // Final cleanup
    sttFinishedResolver.value?.();
    isStopping.value = false;

    return sttFinishedPromise.value;
  };

  /**
   * We need to watch for the listening state changes to handle the case where the user stops talking and the STT stops listening.
   */
  watch(isListening, (newValue) => {
    if (newValue === true) {
      // Clear the starting flag now that STT has successfully started
      isStarting.value = false;

      // If textStorage is empty (cleared after sending message), start fresh
      if (textStorage.value.length === 0) {
        preSttTextSnapshot.value = "";
        sttStringBuffer.value = "";
        result.value = ""; // Clear any pending results
      } else {
        const endPiece = textStorage.value.length > 0 ? " " : "";
        preSttTextSnapshot.value = textStorage.value;
        sttStringBuffer.value = endPiece;
      }
      if (sttFinishedResolver.value) sttFinishedResolver.value();
      if (sttFinishedPromise.value) sttFinishedPromise.value = null;
      isStopping.value = false;
    } else if (
      disableTimeout === true &&
      shouldBeListening.value === true &&
      !isStopping.value &&
      !isStarting.value &&
      !recognitionActuallyRunning.value &&
      !preventUpdates?.value // Don't auto-restart if message was sent
    ) {
      // Add a small delay to prevent race conditions with browser timeouts
      setTimeout(() => {
        if (
          shouldBeListening.value === true &&
          !isListening.value &&
          !isStopping.value &&
          !isStarting.value &&
          !recognitionActuallyRunning.value &&
          !preventUpdates?.value // Double-check preventUpdates flag
        ) {
          start();
        }
      }, 500); // 500ms delay to let browser timeout settle
    } else if (shouldBeListening.value === false && sttFinishedResolver.value) {
      sttFinishedResolver.value();
    }

    // Always clear starting flag when STT stops to prevent stuck state
    if (newValue === false) {
      isStarting.value = false;
      // Note: recognitionActuallyRunning is cleared in the onend event handler
    }
  });

  // handles the user editing the text input while not talking. Couldn't find a good way to handle typing while a result was coming/ this is a weird thing to do.
  watch(textStorage, (newValue) => {
    if (isListening.value === true && result.value === "")
      preSttTextSnapshot.value = newValue;
  });

  /*  
  Handles: 
   - displaying a preview of the result 
   - appending the final result to the textStorage ref 
   - updating the snapshot of the textStorage ref
   - waiting for the result to finalize before resolving the stop request promise
  */
  watch([result, isFinal], ([newResult, newIsFinal]) => {
    if (newResult !== "" && !preventUpdates?.value) {
      if (newIsFinal === true) {
        sttStringBuffer.value += result.value;
        textStorage.value = preSttTextSnapshot.value + sttStringBuffer.value;
        preSttTextSnapshot.value = textStorage.value;
        sttStringBuffer.value = "";
        result.value = "";
        if (sttFinishedResolver.value !== null && isListening.value == false) {
          sttFinishedResolver.value();
          sttFinishedPromise.value = null;
          sttFinishedResolver.value = null;
        }
      } else {
        textStorage.value =
          preSttTextSnapshot.value + sttStringBuffer.value + newResult;
      }
    }
  });

  return {
    isSupported,
    isListening,
    result,
    start,
    stop,
    isFinal,
    error,
    recognition,
    toggle,
    sttFinishedPromise,
  };
};
