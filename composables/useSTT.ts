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
  const preSttTextSnapshot = ref("");
  const sttStringBuffer = ref("");
  const sttFinishedPromise = shallowRef<Promise<void> | null>(null);
  const sttFinishedResolver = shallowRef<
    null | ((value: void | PromiseLike<void>) => void)
  >(null);

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

  const start = async () => {
    // Check permissions first to avoid duplicate requests
    if (!permissionManager.hasPermission.value) {
      const permissionGranted = await permissionManager.requestPermission();
      if (!permissionGranted) {
        throw new Error("Microphone permission denied");
      }
    }

    shouldBeListening.value = true;
    startSTT();
  };

  const toggle = async () => {
    if (isListening.value === true) {
      await stop();
    } else {
      start();
    }
  };

  const stop = async () => {
    if (isListening.value === true) {
      isStopping.value = true;
      sttFinishedPromise.value = new Promise<void>((resolve) => {
        sttFinishedResolver.value = resolve;
      });
      shouldBeListening.value = false;
      stopSTT();
      if (isFinal.value === true && sttFinishedResolver.value) {
        sttFinishedResolver.value();
      }
      return sttFinishedPromise.value;
    } else {
      return;
    }
  };

  /**
   * We
   */
  watch(isListening, (newValue) => {
    if (newValue === true) {
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
      !isStopping.value
    ) {
      start();
    } else if (shouldBeListening.value === false && sttFinishedResolver.value) {
      sttFinishedResolver.value();
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
