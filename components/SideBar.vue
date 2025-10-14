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
          <!-- Show empty state when no messages -->
          <EmptyTranscriptScreen
            v-if="
              !messageStoreRef.messages.value ||
              messageStoreRef.messages.value.size === 0
            "
            class="flex-grow-1 d-flex align-items-center justify-content-center" />

          <!-- Show messages when they exist -->
          <div
            ref="messagesContainer"
            class="messages flex-grow-1 mh-100 w-100 overflow-y-auto"
            v-else>
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
import { useAudioPlayback } from "~/composables/useAudioPlayback";
import { useContentKey } from "~/composables/useContentKey";
import { useAudioStore } from "~/stores/useAudioStore";
import { useChatbotStore } from "~/stores/useChatbotStore";
import { SupportedLang } from "~/utils/constants";
import Tooltip from "../components/ToolTip.vue";
import { useAppStore } from "../stores/appStore";
import { useMessageStore } from "../stores/messageStore";
import type { UserTextConversationRequestBody } from "../types/types";
import {
  ERROR_MESSAGES,
  WebSocketEventType,
  WebSocketTextRequestType,
} from "../utils/constants";

interface Props {
  isInputDisabled?: boolean;
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
const { isChatbotDrawerOpen, userPrompt, audioPlaybackSpeed } =
  storeToRefs(appStore);

const messageStore = useMessageStore();
const messageStoreRef = storeToRefs(messageStore);

// Fullscreen state for handling viewport changes
const { isFullscreen } = useFullscreen();

// Initialize audio playback composable
const audioPlayback = useAudioPlayback(
  {
    defaultSpeed: "normal",
    enableLipSync: true,
    volume: 0.8,
    autoCleanup: true,
  },
  {
    onPlayStart: (messageId: string, speed: "normal" | "slow") => {
      messageStore.setAudioPlaying(messageId, true, speed);
    },
    onPlayEnd: (messageId: string, speed: "normal" | "slow") => {
      messageStore.setAudioPlaying(messageId, false, speed);
    },
    onError: (messageId: string, error: string) => {
      console.error("Audio playback error:", error);
      appStore.addAlert(`Audio playback failed: ${error}`);
    },
    onLoadingChange: (messageId: string, isLoading: boolean) => {
      const chatMessageRef = chatMessageRefs.value.get(messageId);
      if (chatMessageRef && chatMessageRef.setPlayLoading) {
        chatMessageRef.setPlayLoading(false, "normal");
        chatMessageRef.setPlayLoading(false, "slow");
      }
    },
  }
);

// Track if handleBotPlay is currently processing to prevent multiple rapid calls
const isProcessingPlayRequest = ref(false);

// Computed property to check if any TTS requests are pending
// This will disable all play buttons when any TTS request is pending
const hasAnyPlayButtonLoading = computed(() => {
  return appStore.ttsRequestMessageIds?.size > 0;
});

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
  // Check both the audio playback composable state and the message store state
  const isComposablePlaying = audioPlayback.isMessagePlaying(messageId, speed);
  const isStorePlaying = messageStore.isAudioPlaying(messageId, speed);

  return isComposablePlaying || isStorePlaying;
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
      // Set isLoading: true during creation to prevent race condition
      // where WebSocket response arrives before setMessageLoading is called
      const botMessageId = messageStore.createMessage("bot", {
        data: {
          text: "",
          isComplete: false,
          isLoading: true, // Set immediately to prevent duplicate bot message creation
        },
      });

      // Set loading state with timeout (still needed for timeout management)
      messageStore.setMessageLoading(botMessageId, true);

      // Set the current bot message ID in the WebSocket composable
      // This ensures that finalizeBotMessage uses the correct bot message ID
      // Only set if there isn't already a bot response in progress (prevent race condition)
      if (!messageStore.isBotResponding) {
        appStore.setCurrentBotMessageId(botMessageId);
      }

      // Get selectedTemplate
      if (!appStore.selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      appStore.sendWS(
        JSON.stringify({
          event_type: WebSocketEventType.EVENT_TEXT_START,
          user_id: userId,
          conversation_id: messageStore.getConversationId() as string,
          message_id: userMessageId,
          selectedTemplate: appStore.selectedTemplate,
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
    // Set flag to prevent generic websocket errors
    appStore.setWebsocketRequestInProgress(true);

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

        // Get conversation ID with fallback to last submitted conversation
        const conversationId = appStore.getConversationId(messageStore);
        if (!conversationId) {
          appStore.addAlert("No conversation ID available");
          messageStore.setIsFeedbackLoading(messageId, false);
          return;
        }

        // Get selectedTemplate
        if (!appStore.selectedTemplate) {
          appStore.addAlert(
            "Missing selectedTemplate, please reload or try again"
          );
          messageStore.setIsFeedbackLoading(messageId, false);
          return;
        }

        // Set feedback loading state for WebSocket request tracking
        messageStore.setFeedbackLoadingWithTimeout(messageId);

        appStore.sendWS(
          JSON.stringify({
            event_type: WebSocketEventType.EVENT_TEXT_START,
            user_id: userId,
            conversation_id: conversationId,
            message_id: messageId,
            selectedTemplate: appStore.selectedTemplate,
            data: {
              request_type: WebSocketTextRequestType.FEEDBACK,
              text: message.text,
              language: "es",
            },
          })
        );
      } else {
        appStore.addAlert(
          "Unable to get feedback for this message. Please try again."
        );
        messageStore.setIsFeedbackLoading(messageId, false);
      }
    } else {
      // Set feedback error with 2s delay - don't clear loading immediately
      messageStore.setFeedbackError(
        messageId,
        "Connection failed. Unable to get feedback at this time."
      );
    }
  } catch (error) {
    console.error("Error sending feedback request:", error);

    // Set feedback error with 2s delay - don't clear loading immediately
    messageStore.setFeedbackError(
      messageId,
      "Connection failed. Unable to get feedback at this time."
    );
  }
};

const handleUserTranslate = async (messageId: string) => {
  try {
    // Set flag to prevent generic websocket errors
    appStore.setWebsocketRequestInProgress(true);

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

        // Get selectedTemplate
        if (!appStore.selectedTemplate) {
          appStore.addAlert(
            "Missing selectedTemplate, please reload or try again"
          );
          messageStore.setIsTranslationLoading(messageId, false);
          return;
        }

        // Set translation loading state for WebSocket request tracking
        messageStore.setTranslationLoadingWithTimeout(messageId);

        appStore.sendWS(
          JSON.stringify({
            event_type: WebSocketEventType.EVENT_TEXT_START,
            user_id: userId,
            conversation_id: conversationId,
            message_id: messageId,
            selectedTemplate: appStore.selectedTemplate,
            data: {
              request_type: WebSocketTextRequestType.TRANSLATION,
              text: message.text,
              language: "es",
            },
          })
        );
      } else {
        appStore.addAlert(
          "Unable to translate this message. Please try again."
        );
        messageStore.setIsTranslationLoading(messageId, false);
      }
    } else {
      // Set translation error with 2s delay - don't clear loading immediately
      messageStore.setTranslationError(
        messageId,
        "Connection failed. Unable to translate at this time."
      );
      // Don't clear timeout immediately - let the error function handle it with delay
    }
  } catch (error) {
    console.error("Error sending translation request:", error);
    // Set translation error with 2s delay - don't clear loading immediately
    messageStore.setTranslationError(messageId, ERROR_MESSAGES.TRANSLATION);
    // Don't clear timeout immediately - let the error function handle it with delay
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
    // Set flag to prevent generic websocket errors
    appStore.setWebsocketRequestInProgress(true);

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
          await chatbotStore.ttsAudioManager.stopAudio();
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
      // Get conversation ID with fallback to last submitted conversation
      const conversationId = appStore.getConversationId(messageStore);
      if (!conversationId) {
        appStore.addAlert(
          "No active conversation. Please start a lesson first."
        );
        // Add 1 second delay before clearing loading state
        setTimeout(() => {
          if (chatMessageRef && chatMessageRef.setPlayLoading) {
            chatMessageRef.setPlayLoading(false, speed);
          }
          // Clear message error state so play buttons can be clicked again
          messageStore.removeMessageError(messageId);
          // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
          appStore.clearTTSRequest(messageId);
        }, 1000);
        return;
      }

      // Get selectedTemplate
      if (!appStore.selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        // Add 1 second delay before clearing loading state
        setTimeout(() => {
          if (chatMessageRef && chatMessageRef.setPlayLoading) {
            chatMessageRef.setPlayLoading(false, speed);
          }
          // Clear message error state so play buttons can be clicked again
          messageStore.removeMessageError(messageId);
          // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
          appStore.clearTTSRequest(messageId);
        }, 1000);
        return;
      }

      const ttsMessage = {
        user_id: appStore.getUserId(),
        event_type: "EVENT_TEXT_START",
        conversation_id: conversationId,
        message_id: messageId,
        selectedTemplate: appStore.selectedTemplate,
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
      // WebSocket connection failed - add alert
      appStore.addAlert(
        "Connection failed. Unable to request TTS at this time."
      );
      // Add 1 second delay before clearing loading state
      setTimeout(() => {
        if (chatMessageRef && chatMessageRef.setPlayLoading) {
          chatMessageRef.setPlayLoading(false, speed);
        }
        // Clear message error state so play buttons can be clicked again
        messageStore.removeMessageError(messageId);
        // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
        appStore.clearTTSRequest(messageId);
      }, 1000);
    }
  } catch (error) {
    console.error("Error sending TTS request:", error);
    // Add alert for TTS error
    appStore.addAlert("Failed to request TTS. Please try again later.");
    // Add 1 second delay before clearing loading state
    setTimeout(() => {
      const chatMessageRef = chatMessageRefs.value.get(messageId);
      if (chatMessageRef && chatMessageRef.setPlayLoading) {
        chatMessageRef.setPlayLoading(false, speed);
      }
      // Clear message error state so play buttons can be clicked again
      messageStore.removeMessageError(messageId);
      // Clear TTS request tracking so hasAnyPlayButtonLoading becomes false
      appStore.clearTTSRequest(messageId);
    }, 1000);
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

    // Step 1: Stop any conflicting audio systems cleanly
    await audioPlayback.stopAllAudio();

    // Stop any TTS audio that might be playing
    const chatbotStore = useChatbotStore();
    if (chatbotStore.ttsAudioManager.isPlaying) {
      await chatbotStore.ttsAudioManager.stopAudio();
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
            // No cached audio found, send TTS request
            if (message.text) {
              await sendTTSRequest(messageId, message.text, speed);
            }
            return;
          }
        }
      }

      if (audioData) {
        // Play cached audio using the new composable
        await audioPlayback.playCachedAudio(messageId, audioData, speed);
      }
    }
  } catch (error) {
    console.error("Error in handleBotPlay:", error);
    appStore.addAlert("Failed to play audio. Please try again later.");

    // Clear loading state on error
    const chatMessageRef = chatMessageRefs.value.get(messageId);
    if (chatMessageRef && chatMessageRef.setPlayLoading) {
      chatMessageRef.setPlayLoading(false, speed);
    }
  } finally {
    // Always reset the processing flag
    isProcessingPlayRequest.value = false;
  }
};

const handleBotStop = (messageId: string) => {
  // Use the audio playback composable to stop all audio
  audioPlayback.stopAllAudio();
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

// Watch for audio playback speed changes and update the composable
watch(
  () => audioPlaybackSpeed.value,
  (newSpeed) => {
    audioPlayback.setSlowPlaybackRate(newSpeed);
  },
  { immediate: true }
);

// Listen for global event to stop cached audio when TTS starts
onMounted(() => {
  const handleStopAllCachedAudio = () => {
    audioPlayback.stopAllAudio();
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
