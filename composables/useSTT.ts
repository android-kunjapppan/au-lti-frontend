import { useSpeechRecognition } from "@vueuse/core";

/**
 *
 * @description Wrapper for `useSpeechRecognition` that handles watching for recognition to finish, then appending it to the `textStorage` passed in.
 */
export const useSTT = (args: { textStorage: Ref<string> }) => {
  if (!args.textStorage) console.log("No textStorage provied");
  const { textStorage = ref("") } = args;

  const sstUserPromptSnapshot = ref("");
  const sttStringBuffer = ref("");

  const {
    isSupported,
    isListening,
    result,
    start,
    stop,
    isFinal,
    error,
    recognition,
    toggle,
  } = useSpeechRecognition({
    lang: "en-US",
  });

  onMounted(async () => {
    await nextTick();
    // When we know STT is turned on we store a snapshot of the userPrompt, when we stop listening we store the result in the userPrompt
    watch(isListening, (newValue) => {
      if (newValue) {
        const endPiece = textStorage.value.length > 0 ? " " : "";

        sstUserPromptSnapshot.value = textStorage.value;

        sttStringBuffer.value = endPiece;
      }
      if (newValue === false)
        textStorage.value = sstUserPromptSnapshot.value + sttStringBuffer.value;
    });
    // We listen for the result object to be updated and use that when streaming what STT thinks is being said
    watch(result, (newValue) => {
      if (isFinal.value) {
        textStorage.value = sstUserPromptSnapshot.value + sttStringBuffer.value;
      } else {
        textStorage.value =
          sstUserPromptSnapshot.value + sttStringBuffer.value + newValue;
      }
    });
    // When the STT finishes decoding the audio input we add it to the buffer so we can store multiple starts and stops.
    watch(isFinal, (newValue) => {
      if (newValue) {
        sttStringBuffer.value += result.value;
        result.value = "";
      }
    });
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
  };
};
