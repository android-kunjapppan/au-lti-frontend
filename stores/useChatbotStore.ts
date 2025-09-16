import type { Thread, ThreadMessage } from "~/types/types";
import { decodeBase64Audio, type BackendAudioResponse } from "~/utils";

export const TEMP_USER_NAME = "demo";

/**
 * @description Stores a bunch of the chatbot logic that needs to be persisted across the app.
 */
export const useChatbotStore = defineStore("chatbot", () => {
  const maxConversationCharCount = 70000;

  const threadRef = ref<Thread>({ name: "New thread", messages: [] });
  const isStreaming = ref<boolean>(false);
  const streamingResponse = ref("");
  const lastMessageSent = ref(true);
  const toolCallStatus = ref<string[]>([]);
  const audioContext = shallowRef<AudioContext | null>(null);
  const eventResponseQueue = ref<
    Array<{
      text?: string;
      audioSource?: AudioBufferSourceNode;
    }>
  >([]);
  const isAudioPlaying = shallowRef(false);

  /** Resets the animation state of the avatar */
  const { resetAnimation } = useAvatarStore();

  /** Resets the chat to the initial state */
  const resetChat = () => {
    threadRef.value = { name: "New thread", messages: [] };
    eventResponseQueue.value = [];
    isAudioPlaying.value = false;
    streamingResponse.value = "";
    toolCallStatus.value = [];
  };

  /** Resets the chat and resets the animation state of the avatar */
  const resetFunction = () => {
    resetChat();
    resetAnimation();
  };

  const { isActive, start, reset, stop } = useCountdown(resetFunction, 120);

  /** Returns the index of the first message included in the chat history sent up to the LLM */
  const messageHistoryStartingIndex = computed(() => {
    let cuttoffIndex: number = 0;
    const streamingThreadLength = threadRef.value
      ? threadRef.value?.messages.length
      : 0;
    const reverseMessageArray = threadRef.value?.messages.toReversed();
    if (streamingThreadLength > 0 && reverseMessageArray) {
      let charCount = 0;
      for (let i = 0; i < reverseMessageArray.length; i++) {
        if (
          reverseMessageArray[i].content &&
          typeof reverseMessageArray[i].content === "string"
        ) {
          charCount += reverseMessageArray[i].content!.length;
          if (charCount > maxConversationCharCount) {
            cuttoffIndex = streamingThreadLength - i;
            break;
          }
        }
      }
    }
    return cuttoffIndex;
  });

  /** @description Chat history minus current message */
  const chatHistory = computed(() => {
    let messages: Array<ThreadMessage> = [];
    if (threadRef.value) {
      messages = threadRef.value.messages.slice(
        messageHistoryStartingIndex.value
      );
    }
    return messages;
  });

  /** updates thread store with latest messages from streamingThread */
  const setStreamingThreadLatestMessage = (content: string) => {
    if (threadRef.value) {
      const lastIdx = threadRef.value.messages.length - 1;
      const currentThreadMessages: Thread = threadRef.value;
      if (currentThreadMessages.messages[lastIdx])
        currentThreadMessages.messages[lastIdx].content = content;
      threadRef.value = currentThreadMessages;
    } else {
      console.log("no existing thread or guid undefined");
    }
  };

  /** Creates an audio buffer source node of the Base64 audio then adds it to the last item with text or pushes it to the end.
   * We assume text is sent down before audio so the majority of audio should be added to array items with text already present.
   */
  const enqueueAudio = async (args: { audio: BackendAudioResponse }) => {
    const { audio } = args;
    if (!audio) throw new Error("missing audio and text");
    if (!audioContext.value) throw new Error("Audio context not setup");
    try {
      const audioSource = await bufferAndConnectAudio({
        audioBufferArray: audio,
        audioContext: audioContext.value,
      });
      const index = Math.max(eventResponseQueue.value.length - 1, 0);
      if (
        eventResponseQueue.value[index] &&
        eventResponseQueue.value[index].text &&
        !eventResponseQueue.value[index].audioSource
      ) {
        eventResponseQueue.value[index].audioSource = audioSource;
      } else {
        eventResponseQueue.value.push({ audioSource });
      }
      processQueue();
    } catch (e) {
      console.log("error creating audio source and connecting it: ", e);
    }
  };

  /** adds text to the eventResponseQueue. We assume text is sent down before audio so we don't check for existing audio array items. */
  const enqueueText = (args: { text: string }) => {
    const { text } = args;
    if (text) eventResponseQueue.value.push({ text: text });
  };

  /** Fires after the eventStream is closed and all text & audio have been played then added to the streaming response */
  const runMessageQueueCleanup = async () => {
    console.log("closing");
    setStreamingThreadLatestMessage(streamingResponse.value);
    streamingResponse.value = "";
    toolCallStatus.value = [];
  };

  /** If nothing is currently playing it will shift the first everResponse in the queue, add the text to the streamingResponse, play the associated audio, then move onto the next item.
   * If we know the event stream is done, and there is nothing in the queue we run some cleanup.  */
  const processQueue = async () => {
    console.log("processing queue");
    if (isAudioPlaying.value == true || eventResponseQueue.value.length === 0)
      return;

    isAudioPlaying.value = true;
    const currentResponse = eventResponseQueue.value.shift();
    if (currentResponse) {
      const { text = null, audioSource = null } = currentResponse;
      if (text) await updateCaption(text);
      if (audioSource) await playAudioPromise({ audioSource });
    }
    isAudioPlaying.value = false;
    if (
      lastMessageSent.value === true &&
      eventResponseQueue.value.length === 0
    ) {
      await runMessageQueueCleanup();
    }
    processQueue(); // Process next item in the queue
  };

  const updateCaption = async (text: string) => {
    streamingResponse.value += text;
  };

  /** Takes Base64 audio, decodes it using the current audio context, creates a new `AudioBufferSourceNode` and connects it to the audio context. Provides a slight perf boost to run this while other audio is playing, instead of waiting for audio to finish. */
  const bufferAndConnectAudio = async (args: {
    audioBufferArray: BackendAudioResponse;
    audioContext: AudioContext;
  }) => {
    const { audioBufferArray, audioContext } = args;
    if (audioBufferArray == undefined || audioContext == undefined)
      throw new Error("missing string or audio context");
    try {
      const audioBuffer = await decodeBase64Audio({
        audioBufferArray,
        audioContext,
      });
      if (!audioBuffer) throw new Error("Failed to decode audio");

      const source = new AudioBufferSourceNode(audioContext, {
        buffer: audioBuffer,
      });
      source.connect(audioContext.destination);
      return source;
    } catch (error) {
      console.error("Error buffering and connecting audio: ", error);
    }
  };

  /** Creates a promise that plays the audio buffer passed down, then resolves once the audio is over */
  const playAudioPromise = async (args: {
    audioSource: AudioBufferSourceNode;
  }) => {
    const { audioSource } = args;
    return new Promise<void>((resolve) => {
      audioSource.addEventListener("ended", () => {
        resolve();
      });
      audioSource.start();
    });
  };

  /** gets audio context from the window so we can actually play audio, there should only be 1 audio context per session. */
  const getAudioContext = async (): Promise<AudioContext> => {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
    }
    return audioContext.value;
  };

  onMounted(() => {
    getAudioContext();
  });

  return {
    threadRef,
    audioContext,
    isStreaming,
    streamingResponse,
    toolCallStatus,
    chatHistory,
    lastMessageSent,
    enqueueAudio,
    enqueueText,
    setStreamingThreadLatestMessage,
    eventResponseQueue,
    resetChat,
    isActive,
    start,
    reset,
    stop,
  };
});

/** Code to get volume of incoming audio, needs rework */
// const { counter, reset, pause, resume } = useInterval(100, {
//   controls: true,
//   callback: () => {
//     if (analyser.value && dataArray.value) {
//       console.log("Analyser alive!");
//       analyser.value.getFloatTimeDomainData(dataArray.value);
//       let sumSquares = 0.0;
//       for (const amplitude of dataArray.value) {
//         sumSquares += amplitude * amplitude;
//       }
//       const plshalp = Math.sqrt(sumSquares / dataArray.value.length);
//       console.log("audio data?: ", plshalp);
//     } else {
//       console.log("no Analyser");
//     }
//   },
// });
