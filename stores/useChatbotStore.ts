import { defineStore } from "pinia";
import { computed, onMounted, ref, shallowRef } from "vue";
import { useCountdown } from "~/composables/useCountdown";
import { useSharedAudioContext } from "~/composables/useSharedAudioContext";
import { useTTSAudioManager } from "~/composables/useTTSAudioManager";
import { useAvatarStore } from "~/stores/useAvatarStore";
import type { Thread } from "~/types/types";
import type { BackendAudioResponse } from "~/utils";

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
  const { audioContext, initAudioContext } = useSharedAudioContext();
  const eventResponseQueue = ref<
    Array<{
      text?: string;
      audioSource?: AudioBufferSourceNode;
    }>
  >([]);
  const isAudioPlaying = shallowRef(false);

  /** Resets the animation state of the avatar */
  const { resetAnimation } = useAvatarStore();

  /** TTS Audio Manager for handling TTS audio chunks */
  const ttsAudioManager = useTTSAudioManager();

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

  /** Sets the streaming thread's latest message */
  const setStreamingThreadLatestMessage = (message: string) => {
    if (threadRef.value.messages.length === 0) {
      threadRef.value.messages.push({
        role: "assistant",
        content: message,
      });
    } else {
      threadRef.value.messages[threadRef.value.messages.length - 1].content =
        message;
    }
  };

  /** Gets the chat history */
  const chatHistory = computed(() => {
    return threadRef.value.messages;
  });

  /** Creates an audio buffer source node of the Base64 audio then adds it to the last item with text or pushes it to the end.
   * We assume text is sent down before audio so the majority of audio should be added to array items with text already present.
   */
  const enqueueAudio = async (args: {
    audio: BackendAudioResponse;
    messageId?: string;
    speed?: "normal" | "slow";
  }) => {
    const { audio, messageId, speed } = args;
    if (!audio) throw new Error("missing audio and text");

    // Use TTS audio manager for TTS audio chunks
    await ttsAudioManager.enqueueAudioChunk(audio, messageId, speed);
  };

  /** adds text to the eventResponseQueue. We assume text is sent down before audio so we don't check for existing audio array items. */
  const enqueueText = (args: { text: string }) => {
    const { text } = args;
    if (text) eventResponseQueue.value.push({ text: text });
  };

  /** Fires after the eventStream is closed and all text & audio have been played then added to the streaming response */
  const runMessageQueueCleanup = async () => {
    setStreamingThreadLatestMessage(streamingResponse.value);
    streamingResponse.value = "";
    toolCallStatus.value = [];
  };

  /** If nothing is currently playing it will shift the first everResponse in the queue, add the text to the streamingResponse, play the associated audio, then move onto the next item.
   * If we know the event stream is done, and there is nothing in the queue we run some cleanup.  */
  const processQueue = async () => {
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

  onMounted(() => {
    initAudioContext();
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
    ttsAudioManager,
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
