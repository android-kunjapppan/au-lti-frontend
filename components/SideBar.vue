<template>
  <div class="chatbox-wrapper">
    <!-- Button to toggle chatbox when open -->
    <button
      class="sidebar-icon p-space-xxs fs-xl"
      :class="sidebarIconClass"
      @click="toggleChatbox"
      @mouseenter="handleButtonMouseEnter"
      @mouseleave="handleButtonMouseLeave">
      <Tooltip
        ref="tooltipRef"
        :text="
          isChatbotDrawerOpen ? 'Hide chat transcript' : 'Open chat transcript'
        "
        position="left"
        :y-offset="20">
        <div class="tooltip-content">
          <template v-if="isChatbotDrawerOpen"
            ><i-fa6-solid:chevron-right class="arrow-icon arrow-right"
          /></template>
          <template v-else>
            <div class="comment-sidebar">
              <i-fa6-solid:chevron-left class="arrow-icon arrow-left" />
              <i-fa6-solid:comments class="message-icon" /></div
          ></template>
        </div>
      </Tooltip>
    </button>

    <!-- Chatbox UI -->
    <transition name="slide-chatbox">
      <div class="chatbox w-100 h-100" v-show="isChatbotDrawerOpen">
        <div
          class="chatbox-body px-space-md pt-space-sm mh-100 w-100 h-100 flex-grow-1 d-flex flex-column overflow-y-auto">
          <div
            ref="messagesContainer"
            class="messages flex-grow-1 mh-100 w-100 overflow-y-auto"
            v-if="messageStoreRef.messages.value">
            <template
              v-for="[id, msg] in messageStoreRef.messages.value.entries()"
              :key="id">
              <ChatMessage
                :ref="(el) => setChatMessageRef(id, el)"
                :message-id="id"
                :message="msg"
                :is-playing="isMessagePlaying(id, 'normal')"
                :is-playing-slow="isMessagePlaying(id, 'slow')"
                :has-any-play-button-loading="hasAnyPlayButtonLoading"
                @feedback="handleUserFeedback"
                @translate="handleUserTranslate"
                @play="handleBotPlay"
                @stop="handleBotStop"
                @retry="handleBotRetry" />
            </template>
          </div>
          <div class="flex-grow-1 spacer"></div>
          <div v-if="runtimeConfig.public.stage === 'dev'">
            <button
              @click="appStore.openWS"
              :disabled="appStore.statusWS === 'OPEN'">
              {{
                appStore.statusWS === "CLOSED"
                  ? "Open Websocket"
                  : "Connection Active!"
              }}
            </button>
            <input
              :disabled="appStore.statusWS !== 'OPEN' || isInputDisabled"
              type="text"
              v-model="userPrompt"
              @keyup.enter="sendMessage"
              placeholder="Type a message..."
              class="chat-input w-100" />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from "@vueuse/core";
import { storeToRefs } from "pinia";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { lipSyncStatus } from "~/composables/useAudioAnalysis";
import { useContentKey } from "~/composables/useContentKey";
import { useMorphTargets } from "~/composables/useMorphTargets";
import { useTTSAudioManager } from "~/composables/useTTSAudioManager";
import { useAudioStore } from "~/stores/useAudioStore";
import { analyzeAudioData } from "~/utils/audioAnalysis";
import { AUDIO_ANALYSIS_CONFIG } from "~/utils/constants";
import Tooltip from "../components/ToolTip.vue";
import { useAppStore } from "../stores/appStore";
import { useMessageStore } from "../stores/messageStore";
import type {
  FeedbackConversationRequestBody,
  TranslationConversationRequestBody,
  UserTextConversationRequestBody,
} from "../types/types";
import {
  ERROR_MESSAGES,
  WebSocketEventType,
  WebSocketTextRequestType,
} from "../utils/constants";

interface Props {
  isInputDisabled?: boolean;
}

interface ExtendedAudioElement extends HTMLAudioElement {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isInputDisabled: false,
});

const runtimeConfig = useRuntimeConfig();
const isTooltipVisible = ref(false);
const tooltipText = ref("");
const messagesContainer = ref<HTMLElement>();
const tooltipRef = ref();

// Button hover handlers
const handleButtonMouseEnter = () => {
  if (tooltipRef.value) {
    tooltipRef.value.setHovered(true);
  }
};

const handleButtonMouseLeave = () => {
  if (tooltipRef.value) {
    tooltipRef.value.setHovered(false);
  }
};

// Function to scroll to bottom of messages with smooth behavior
const scrollToBottom = (smooth = false) => {
  if (messagesContainer.value) {
    nextTick(() => {
      if (smooth) {
        messagesContainer.value!.scrollTo({
          top: messagesContainer.value!.scrollHeight,
          behavior: "smooth",
        });
      } else {
        messagesContainer.value!.scrollTop =
          messagesContainer.value!.scrollHeight;
      }
    });
  }
};

// Function to hide the tooltip
const hideTooltip = () => {
  isTooltipVisible.value = false;
  tooltipText.value = "";
  tooltipStyles.value = {};
};

const tooltipStyles = ref({});

// State to control the visibility of the chatbox
const appStore = useAppStore();
const { isChatbotDrawerOpen, userPrompt } = storeToRefs(appStore);
const messageStore = useMessageStore();
const messageStoreRef = storeToRefs(messageStore);

// Fullscreen state for handling viewport changes
const { isFullscreen } = useFullscreen();

// Chat audio analysis for mouth movement
const { updateMouthMovement } = useMorphTargets();
let chatAudioContext: AudioContext | null = null;
let chatAnalyser: AnalyserNode | null = null;
let chatDataArray: Uint8Array<ArrayBuffer> | null = null;
let chatLipSyncIntervalId: ReturnType<typeof setInterval> | null = null;
let lastChatAmplitude = 0;
const { stopAudio } = useTTSAudioManager();

// State for stored audio playback
const currentPlayingAudio = ref<{
  messageId: string;
  speed: "normal" | "slow";
  audioElement: HTMLAudioElement;
} | null>(null);

// Track if handleBotPlay is currently processing to prevent multiple rapid calls
const isProcessingPlayRequest = ref(false);

// Computed property to check if any TTS requests are pending
// This will disable all play buttons when any TTS request is pending
const hasAnyPlayButtonLoading = computed(() => {
  return appStore.ttsRequestMessageIds?.size > 0;
});

// Forward declarations for audio analysis functions
// eslint-disable-next-line prefer-const
let setupChatAudioAnalysis: (audioElement: HTMLAudioElement) => Promise<void>;
// eslint-disable-next-line prefer-const
let startChatLipSyncLoop: () => void;
// eslint-disable-next-line prefer-const
let stopChatLipSyncLoop: () => void;

// Ref to store ChatMessage component instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatMessageRefs = ref<Map<string, any>>(new Map());

const setChatMessageRef = (
  messageId: string,
  el: Element | ComponentPublicInstance | null
) => {
  if (el) {
    chatMessageRefs.value.set(messageId, el);
  } else {
    chatMessageRefs.value.delete(messageId);
  }
};

const sidebarIconClass = computed(() => {
  return {
    "sidebar-open": isChatbotDrawerOpen.value,
    "sidebar-closed": !isChatbotDrawerOpen.value,
  };
});

// Function to check if a specific message is currently playing
const isMessagePlaying = (
  messageId: string,
  speed: "normal" | "slow"
): boolean => {
  // Check both the local currentPlayingAudio state and the message store state
  const isLocalPlaying =
    currentPlayingAudio.value?.messageId === messageId &&
    currentPlayingAudio.value?.speed === speed;

  const isStorePlaying = messageStore.isAudioPlaying(messageId, speed);

  return isLocalPlaying || isStorePlaying;
};

// Function to toggle the chatbox visibility
const toggleChatbox = () => {
  hideTooltip();
  appStore.toggleChatbotDrawer();
};

// Sends a message with mostly pre-defined payload, needs an update badly.
const sendMessage = async () => {
  if (appStore.statusWS === "OPEN" && !props.isInputDisabled) {
    try {
      if (!userPrompt.value.trim()) {
        appStore.addAlert("Please enter a message before sending.");
        return;
      }

      // Stop STT if it's currently listening before sending manual message
      if (appStore.sttListening) {
        await appStore.toggleSttWithErrorHandling();
      }

      // Check if conversation ID exists
      if (!messageStore.getConversationId()) {
        appStore.addAlert(
          "No active conversation. Please start a lesson first."
        );
        return;
      }

      // Get actual user ID from Canvas
      const userId = appStore.getUserId();
      if (!userId) {
        appStore.addAlert("Unable to get user ID from Canvas");
        return;
      }

      const userMessageId = messageStore.createMessage("user", {
        data: {
          text: userPrompt.value,
        },
      });

      // Create initial bot message with loading state
      const botMessageId = messageStore.createMessage("bot", {
        data: {
          text: "",
          isComplete: false,
        },
      });

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      // Set loading state with timeout
      messageStore.setMessageLoading(botMessageId, true);

      appStore.sendWS(
        JSON.stringify({
          event_type: WebSocketEventType.EVENT_TEXT_START,
          user_id: userId,
          conversation_id: messageStore.getConversationId() as string,
          message_id: userMessageId,
          selectedTemplate,
          data: {
            request_type: "user-text",
            text: userPrompt.value,
            language: SupportedLang.SPANISH,
            bot_message_id: botMessageId,
          },
        } satisfies UserTextConversationRequestBody)
      );
      userPrompt.value = ""; // Clear input after sending
      scrollToBottom(); // Scroll to show the new message
    } catch (error) {
      console.error("Error sending message:", error);
      appStore.addAlert("Failed to send your message. Please try again.");
    }
  } else {
    appStore.addAlert(
      "Connection is not available. Please check your connection and try again."
    );
  }
};

// Need to fix all of these handlers with the actual logic
const handleUserFeedback = async (messageId: string) => {
  try {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }
    if (appStore.statusWS === "OPEN") {
      const message = messageStore.getMessage(messageId);

      if (message && message.text) {
        // Get actual user ID from Canvas
        const userId = appStore.getUserId();
        if (!userId) {
          appStore.addAlert("Unable to get user ID from Canvas");
          messageStore.setIsFeedbackLoading(messageId, false);
          return;
        }
        // Track that this message is waiting for feedback
        messageStore.setIsFeedbackLoading(messageId, true);

        // Get conversation ID with fallback to last submitted conversation
        const conversationId = appStore.getConversationId(messageStore);
        if (!conversationId) {
          appStore.addAlert("No conversation ID available");
          messageStore.setIsFeedbackLoading(messageId, false);
          return;
        }

        // Get selectedTemplate from sessionStorage
        const selectedTemplate = sessionStorage.getItem("selectedTemplate");
        if (!selectedTemplate) {
          appStore.addAlert(
            "Missing selectedTemplate, please reload or try again"
          );
          messageStore.setIsFeedbackLoading(messageId, false);
          return;
        }

        // Set feedback loading with timeout
        messageStore.setFeedbackLoadingWithTimeout(messageId);

        appStore.sendWS(
          JSON.stringify({
            event_type: WebSocketEventType.EVENT_TEXT_START,
            user_id: userId,
            conversation_id: conversationId,
            message_id: messageId,
            selectedTemplate,
            data: {
              request_type: WebSocketTextRequestType.FEEDBACK,
              text: message.text,
              language: "es",
            },
          } satisfies FeedbackConversationRequestBody)
        );
      } else {
        appStore.addAlert(
          "Unable to get feedback for this message. Please try again."
        );
        messageStore.setIsFeedbackLoading(messageId, false);
      }
    } else {
      // Clear feedback loading state when connection fails
      messageStore.setIsFeedbackLoading(messageId, false);
      messageStore.setFeedbackError(
        messageId,
        "Connection failed. Unable to get feedback at this time."
      );
      appStore.addAlert(
        "Connection failed. Unable to get feedback at this time."
      );
    }
  } catch (error) {
    console.error("Error sending feedback request:", error);

    messageStore.setIsFeedbackLoading(messageId, false);
    messageStore.setFeedbackError(
      messageId,
      "Connection failed. Unable to get feedback at this time."
    );
    appStore.addAlert(
      "Connection failed. Unable to get feedback at this time."
    );
  }
};

const handleUserTranslate = async (messageId: string) => {
  try {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }
    if (appStore.statusWS === "OPEN") {
      const message = messageStore.getMessage(messageId);

      if (message && message.text) {
        // Get actual user ID from Canvas
        const userId = appStore.getUserId();
        if (!userId) {
          appStore.addAlert("Unable to get user ID from Canvas");
          messageStore.setIsTranslationLoading(messageId, false);
          return;
        }

        // Get conversation ID with fallback to last submitted conversation
        const conversationId = appStore.getConversationId(messageStore);
        if (!conversationId) {
          appStore.addAlert("No conversation ID available");
          messageStore.setIsTranslationLoading(messageId, false);
          return;
        }

        // Get selectedTemplate from sessionStorage
        const selectedTemplate = sessionStorage.getItem("selectedTemplate");
        if (!selectedTemplate) {
          appStore.addAlert(
            "Missing selectedTemplate, please reload or try again"
          );
          messageStore.setIsTranslationLoading(messageId, false);
          return;
        }

        // Set translation loading state
        messageStore.setTranslationLoadingWithTimeout(messageId);

        appStore.sendWS(
          JSON.stringify({
            event_type: WebSocketEventType.EVENT_TEXT_START,
            user_id: userId,
            conversation_id: conversationId,
            message_id: messageId,
            selectedTemplate,
            data: {
              request_type: WebSocketTextRequestType.TRANSLATION,
              text: message.text,
              language: "es",
            },
          } satisfies TranslationConversationRequestBody)
        );
      } else {
        appStore.addAlert(
          "Unable to translate this message. Please try again."
        );
        messageStore.setIsTranslationLoading(messageId, false);
      }
    } else {
      // Clear translation loading state when connection fails
      messageStore.setIsTranslationLoading(messageId, false);
      appStore.addAlert("Connection failed. Unable to translate at this time.");
    }
  } catch (error) {
    console.error("Error sending translation request:", error);
    messageStore.setIsTranslationLoading(messageId, false);
    messageStore.setTranslationError(messageId, ERROR_MESSAGES.TRANSLATION);
    appStore.addAlert("Failed to translate message. Please try again later.");
  }
};

const handleBotRetry = async (messageId: string) => {
  try {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }
    if (appStore.statusWS === "OPEN") {
      // Use shared retry function
      await messageStore.retryBotMessage(messageId, appStore);
    } else {
      appStore.addAlert("Connection failed. Unable to retry at this time.");
    }
  } catch (error) {
    console.error("Error retrying bot message:", error);
    appStore.addAlert("Failed to retry. Please try again later.");
  }
};

const sendTTSRequest = async (
  messageId: string,
  text: string,
  speed: "normal" | "slow"
) => {
  try {
    // Check if this message already has a TTS request in progress
    const messageStore = useMessageStore();
    if (messageStore.isTTSCompleted(messageId)) {
      return;
    }

    // Track this TTS request with speed
    appStore.trackTTSRequest(messageId, speed);

    // Clear any existing loaders for other messages to prevent multiple loaders running simultaneously
    for (const [
      otherMessageId,
      chatMessageRef,
    ] of chatMessageRefs.value.entries()) {
      if (
        otherMessageId !== messageId &&
        chatMessageRef &&
        chatMessageRef.setPlayLoading
      ) {
        // Clear both loading states for other messages
        chatMessageRef.setPlayLoading(false, "normal");
        chatMessageRef.setPlayLoading(false, "slow");

        // Also clear any pending TTS requests for this message
        appStore.clearTTSRequest(otherMessageId);

        // Only stop TTS audio processing if we're actually requesting TTS
        // This prevents interfering with IndexedDB audio playback
        const chatbotStore = useChatbotStore();
        if (chatbotStore.ttsAudioManager.isPlaying) {
          chatbotStore.ttsAudioManager.stopAudio();
        }

        // Clear any queued audio for this message to prevent mixing
        if (chatbotStore.ttsAudioManager.clearQueueForMessage) {
          chatbotStore.ttsAudioManager.clearQueueForMessage(otherMessageId);
        }
      }
    }

    // Set loading state on the ChatMessage component
    const chatMessageRef = chatMessageRefs.value.get(messageId);
    if (chatMessageRef && chatMessageRef.setPlayLoading) {
      chatMessageRef.setPlayLoading(true, speed);
    }

    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }

    if (appStore.statusWS === "OPEN") {
      const conversationId = messageStore.getConversationId();
      if (!conversationId) {
        appStore.addAlert(
          "No active conversation. Please start a lesson first."
        );
        // Clear loading state on error
        if (chatMessageRef && chatMessageRef.setPlayLoading) {
          chatMessageRef.setPlayLoading(false, speed);
        }
        // Clear message error state so play buttons can be clicked again
        messageStore.removeMessageError(messageId);
        // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
        appStore.clearTTSRequest(messageId);
        return;
      }

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        // Clear loading state on error
        if (chatMessageRef && chatMessageRef.setPlayLoading) {
          chatMessageRef.setPlayLoading(false, speed);
        }
        // Clear message error state so play buttons can be clicked again
        messageStore.removeMessageError(messageId);
        // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
        appStore.clearTTSRequest(messageId);
        return;
      }

      const ttsMessage = {
        user_id: appStore.getUserId(),
        event_type: "EVENT_TEXT_START",
        conversation_id: conversationId,
        message_id: messageId,
        selectedTemplate,
        data: {
          request_type: "tts",
          text: text,
          language: SupportedLang.SPANISH,
        },
      };

      appStore.sendWS(JSON.stringify(ttsMessage));

      // Track this TTS request so we can associate the response with the correct message
      // We'll use a different approach - store the message ID in a way that the websocket can access it
      // For now, we'll rely on the improved message ID detection in the websocket processing
    } else {
      appStore.addAlert(
        "Connection failed. Unable to request TTS at this time."
      );
      // Clear loading state on error
      if (chatMessageRef && chatMessageRef.setPlayLoading) {
        chatMessageRef.setPlayLoading(false, speed);
      }
      // Clear message error state so play buttons can be clicked again
      messageStore.removeMessageError(messageId);
      // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
      appStore.clearTTSRequest(messageId);
    }
  } catch (error) {
    console.error("Error sending TTS request:", error);
    appStore.addAlert("Failed to request TTS. Please try again later.");
    // Clear loading state on error
    const chatMessageRef = chatMessageRefs.value.get(messageId);
    if (chatMessageRef && chatMessageRef.setPlayLoading) {
      chatMessageRef.setPlayLoading(false, speed);
    }
    // Clear message error state so play buttons can be clicked again
    messageStore.removeMessageError(messageId);
    // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
    appStore.clearTTSRequest(messageId);
  }
};

const handleBotPlay = async (messageId: string, speed: "normal" | "slow") => {
  // Prevent multiple rapid calls to handleBotPlay
  if (isProcessingPlayRequest.value) {
    return;
  }

  isProcessingPlayRequest.value = true;

  try {
    const message = messageStore.getMessage(messageId);
    const { generateContentKey } = useContentKey();

    // Stop any cached audio that might be playing
    if (currentPlayingAudio.value) {
      try {
        const playingMessageId = currentPlayingAudio.value.messageId;
        const playingSpeed = currentPlayingAudio.value.speed;
        currentPlayingAudio.value.audioElement.pause();
        currentPlayingAudio.value.audioElement.currentTime = 0;
        URL.revokeObjectURL(currentPlayingAudio.value.audioElement.src);
        // Clear audio playing state with specific speed
        messageStore.setAudioPlaying(playingMessageId, false, playingSpeed);
      } catch (error) {
        console.error("Error stopping previous cached audio:", error);
      }
      currentPlayingAudio.value = null;
    }

    // Clear audio playing states for this specific message
    messageStore.setAudioPlaying(messageId, false, "normal");
    messageStore.setAudioPlaying(messageId, false, "slow");

    if (message && message.type === "bot") {
      let audioData: BackendAudioResponse | null = null;
      const audioStore = useAudioStore();
      const loadedAudio = await audioStore.loadAudio(messageId);

      if (loadedAudio) {
        audioData = loadedAudio;
      } else {
        // Try content-based lookup in IndexedDB
        const contentKey = generateContentKey(message.text);
        const contentAudio = await audioStore.loadAudioByContent(contentKey);

        if (contentAudio) {
          audioData = contentAudio;
        } else {
          // Try sessionStorage fallback
          const messages = messageStore.messages ?? new Map();
          let foundInSessionStorage = false;

          for (const [id, msg] of messages.entries()) {
            if (
              msg.type === "bot" &&
              msg.text === message.text &&
              msg.audio &&
              msg.audio !== "stored" &&
              !msg.audio.includes("storedstored") // Skip corrupted audio data
            ) {
              try {
                audioData = JSON.parse(msg.audio);
                foundInSessionStorage = true;
                break;
              } catch (parseError) {
                console.warn("Failed to parse session audio data:", parseError);
                // Clear corrupted audio data
                messageStore.updateMessage(id, {
                  type: "bot",
                  audio: undefined,
                });
                continue;
              }
            }
          }

          if (!foundInSessionStorage) {
            // Stop any TTS audio that might be playing before requesting new TTS
            const chatbotStore = useChatbotStore();
            if (chatbotStore.ttsAudioManager.isPlaying) {
              chatbotStore.ttsAudioManager.stopAudio();
            }

            // No cached audio found, send TTS request
            if (message.text) {
              await sendTTSRequest(messageId, message.text, speed);
            }
            return;
          }
        }
      }

      if (audioData) {
        // Stop any TTS audio that might be playing before playing cached audio
        const chatbotStore = useChatbotStore();
        if (chatbotStore.ttsAudioManager.isPlaying) {
          chatbotStore.ttsAudioManager.stopAudio();
        }

        // Play cached audio
        const audioBlob = new Blob([Uint8Array.from(audioData.data)], {
          type: "audio/wav",
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioElement = new Audio(audioUrl);

        // Set playback rate for slow speed
        if (speed === "slow") {
          audioElement.playbackRate = 0.7;
        }

        // Set up audio element
        currentPlayingAudio.value = {
          messageId,
          speed,
          audioElement,
        };

        // Mark audio as playing in message store
        messageStore.setAudioPlaying(messageId, true, speed);

        // Set up unified chat audio analysis for mouth movement
        setupChatAudioAnalysis(audioElement);

        // Play the audio
        await audioElement.play();

        // Clear any loading state since we successfully started playing cached audio
        const chatMessageRef = chatMessageRefs.value.get(messageId);
        if (chatMessageRef && chatMessageRef.setPlayLoading) {
          chatMessageRef.setPlayLoading(false, speed);
        }

        // Set up event listener for when audio ends
        audioElement.onended = () => {
          if (currentPlayingAudio.value?.messageId === messageId) {
            const currentSpeed = currentPlayingAudio.value.speed;
            currentPlayingAudio.value = null;
            // Clear audio playing state with specific speed
            messageStore.setAudioPlaying(messageId, false, currentSpeed);
          }
        };

        // Note: Lip sync is handled by the audio analysis system when audio is playing
        // No need to use TTS audio manager for chat play since we're using regular audio element
      }
    }
  } catch (error) {
    console.error("Error in handleBotPlay:", error);
    appStore.addAlert("Failed to play audio. Please try again later.");

    // Clear loading state on error
    const chatMessageRef = chatMessageRefs.value.get(messageId);
    if (chatMessageRef && chatMessageRef.setPlayLoading) {
      chatMessageRef.setPlayLoading(false);
    }
  } finally {
    // Always reset the processing flag
    isProcessingPlayRequest.value = false;
  }
};

// Chat audio analysis functions
setupChatAudioAnalysis = async (audioElement: HTMLAudioElement) => {
  try {
    chatAudioContext = new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    chatAnalyser = chatAudioContext.createAnalyser();
    chatAnalyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE;
    chatAnalyser.smoothingTimeConstant =
      AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
    chatDataArray = new Uint8Array(chatAnalyser.frequencyBinCount);

    const source = chatAudioContext.createMediaElementSource(audioElement);
    source.connect(chatAnalyser);
    chatAnalyser.connect(chatAudioContext.destination);

    // Start chat lip sync loop
    startChatLipSyncLoop();

    // Listen for audio end to stop analysis
    audioElement.addEventListener("ended", () => {
      stopChatLipSyncLoop();
    });
  } catch (error) {
    console.error("Failed to setup chat audio analysis:", error);
  }
};

startChatLipSyncLoop = () => {
  chatLipSyncIntervalId = setInterval(() => {
    if (chatAnalyser && chatDataArray) {
      // Analyze chat audio using the same method as bot audio
      chatAnalyser.getByteFrequencyData(chatDataArray);
      const result = analyzeAudioData(
        chatDataArray,
        chatAudioContext!,
        lastChatAmplitude
      );
      lastChatAmplitude = result.amplitude;

      // Update lip sync status for chat play button
      lipSyncStatus.activeSound = result.activeSound;
      lipSyncStatus.activeMorphValue = result.amplitude;
      lipSyncStatus.source = "replay";

      // Let avatar store handle mouth movement - no duplicate calls
      // updateMouthMovement(result.amplitude, result.activeSound, { threshold: 0.02, sensitivity: 6.0 }, "replay");
    }
  }, AUDIO_ANALYSIS_CONFIG.LIP_SYNC_INTERVAL);
};

stopChatLipSyncLoop = () => {
  if (chatLipSyncIntervalId) {
    clearInterval(chatLipSyncIntervalId);
    chatLipSyncIntervalId = null;
  }
};

const handleBotStop = (messageId: string) => {
  // Stop any currently playing audio
  if (currentPlayingAudio.value) {
    try {
      const playingMessageId = currentPlayingAudio.value.messageId;
      const playingSpeed = currentPlayingAudio.value.speed;
      currentPlayingAudio.value.audioElement.pause();
      currentPlayingAudio.value.audioElement.currentTime = 0;
      URL.revokeObjectURL(currentPlayingAudio.value.audioElement.src);
      // Clear audio playing state with specific speed
      messageStore.setAudioPlaying(playingMessageId, false, playingSpeed);
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
    currentPlayingAudio.value = null;
  }

  // Stop any TTS audio that might be playing
  const chatbotStore = useChatbotStore();
  if (chatbotStore.ttsAudioManager.isPlaying) {
    chatbotStore.ttsAudioManager.stopAudio();
  }
};

// Watch for new messages and scroll to bottom
watch(
  () => messageStoreRef.messages.value?.size,
  () => {
    scrollToBottom();
  }
);

// Watch for chatbox opening and scroll to bottom
watch(
  () => isChatbotDrawerOpen.value,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        scrollToBottom();
      });
    }
  }
);

// Watch for bot response completion to reset retry counter
watch(
  () => messageStore.isBotResponding,
  (isResponding) => {
    if (!isResponding) {
      // When bot stops responding, reset retry counter
      messageStore.resetRetryCount();
    }
  }
);

// Listen for global event to stop cached audio when TTS starts
onMounted(() => {
  const handleStopAllCachedAudio = () => {
    if (currentPlayingAudio.value) {
      try {
        const playingMessageId = currentPlayingAudio.value.messageId;
        const playingSpeed = currentPlayingAudio.value.speed;
        currentPlayingAudio.value.audioElement.pause();
        currentPlayingAudio.value.audioElement.currentTime = 0;
        URL.revokeObjectURL(currentPlayingAudio.value.audioElement.src);
        messageStore.setAudioPlaying(playingMessageId, false, playingSpeed);
      } catch (error) {
        console.error("Error stopping cached audio:", error);
      }
      currentPlayingAudio.value = null;
    }
  };

  window.addEventListener("stopAllCachedAudio", handleStopAllCachedAudio);

  onBeforeUnmount(() => {
    window.removeEventListener("stopAllCachedAudio", handleStopAllCachedAudio);
  });
});
</script>

<style scoped lang="scss">
.chatbox-wrapper {
  position: relative;
  display: flex;
  flex-direction: row-reverse;
  z-index: 50;
  &:has(.slide-chatbox-enter-active),
  &:has(.slide-chatbox-leave-active) {
    transition: transform var(--standard-transition-duration) ease;
    will-change: transform;
  }

  &:has(.slide-chatbox-enter-from),
  &:has(.slide-chatbox-leave-to) {
    transform: translate3d(100%, 0, 0);
  }

  &:has(.slide-chatbox-enter-to),
  &:has(.slide-chatbox-leave-from) {
    transform: translate3d(0%, 0, 0);
  }
}

.comment-sidebar {
  display: flex;
  justify-content: center;
  align-items: center;
}

.sidebar-icon {
  position: absolute;
  top: 50%;
  right: 100%;
  width: 3.8125rem;
  height: 3.8125rem;
  transform: translateY(-50%);
  border: none;
  z-index: 1000;
  color: var(--rds-gray-bg);
  background: var(--rds-opacity-bg);
  border-radius: 0.75rem 0 0 0.75rem;
  display: flex;
  align-items: center;
}

.sidebar-open {
  width: 32px;
  height: 60px;
}

.sidebar-closed {
  width: 61px;
  height: 61px;
}

.message-icon {
  height: 1.25rem;
  gap: 0.25rem;
}

/* .arrow-icon {
  transition: transform 0.3s ease;
} */

.arrow-left,
.arrow-right {
  width: 1rem;
  height: 1rem;
  font-size: 1.75rem;
}

.tooltip-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-icon:hover .arrow-left {
  animation: wiggle-left 2s ease-in-out infinite;
}

.sidebar-icon:hover .arrow-right {
  animation: wiggle-right 2s ease-in-out infinite;
}

.chatbox {
  background-color: var(--rds-opacity-bg);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: -0.125rem 0 0.5rem rgba(0, 0, 0, 0.1);
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
  max-height: calc(100vh - var(--footer-height));
}

.chat-input {
  padding: 0.625rem;
  border: 1px solid #ccc;
  border-radius: 0.3125rem;
  margin-top: 0.625rem;
}

.slide-chatbox-enter-active,
.slide-chatbox-leave-active {
  transition: color var(--standard-transition-duration) ease;
}

@keyframes wiggle-left {
  0%,
  25%,
  50%,
  100% {
    transform: translateX(0);
  }
  12.5%,
  37.5% {
    transform: translateX(-0.3125rem);
  }
}

@keyframes wiggle-right {
  0%,
  25%,
  50%,
  100% {
    transform: translateX(0);
  }
  12.5%,
  37.5% {
    transform: translateX(0.3125rem);
  }
}
</style>
