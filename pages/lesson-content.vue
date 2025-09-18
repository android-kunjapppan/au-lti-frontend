<template>
  <NuxtLayout>
    <LoadingSpinner v-if="isStartConversationLoading || isLoadingUserInfo" />
    <div class="canvas-container overflow-hidden">
      <div class="d-flex h-100 w-100 flex-grow-1">
        <div class="content-area" :class="contentAreaClasses">
          <Suspense>
            <AvatarModel
              class="h-100 w-auto position-absolute"
              ref="avatarRef" />
          </Suspense>
          <div class="flex-grow-1 flex-spacer"></div>
          <div
            class="left-suggestion-box"
            v-if="showSuggestionBox && !isChatbotDrawerOpen">
            <SuggestionBox
              @close="handleCloseSuggestion"
              :content="suggestion.data"
              :disabled="suggestion.isLoading" />
          </div>
          <div
            class="speaker-model-container"
            :class="{ 'shift-left': isChatbotDrawerOpen }">
            <SuggestionBox
              @close="handleCloseSuggestion"
              v-if="showSuggestionBox && isChatbotDrawerOpen"
              :content="suggestion.data"
              :disabled="suggestion.isLoading" />
            <MicrophoneInput
              :is-active="!isSubmitButtonVisible && !isMicrophoneDisabled" />
            <SuggestionBar
              @on-suggestion-click="handleShowSuggestion"
              :is-active="showSuggestionBox || suggestion.isLoading"
              :is-loading="suggestion.isLoading"
              class="mb-space-xxs" />
          </div>
          <audio
            ref="audioElement"
            src="/audios/elevenlabs.wav"
            style="display: none"
            @ended="avatarStore.handleAudioEnded" />
        </div>
        <SideBar
          :class="sideBarClasses"
          :is-input-disabled="isSubmitButtonVisible"
          class="side-bar" />
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useAudioStore } from "~/stores/useAudioStore";
import { useAppStore } from "../stores/appStore";
import {
  useMessageStore,
  type BotMessage,
  type UserMessage,
} from "../stores/messageStore";
import { useAvatarStore } from "../stores/useAvatarStore";
import {
  WebSocketEventType,
  WebSocketTextRequestType,
} from "../utils/constants";

import { onUnmounted } from "vue";
import { useLessonOverview } from "~/composables/useLessonOverview";
import { useTTSAudioManager } from "~/composables/useTTSAudioManager";
definePageMeta({
  middleware: "conversation-auth",
});
const avatarStore = useAvatarStore();
const { audioElement } = storeToRefs(avatarStore);
const appStore = useAppStore();
const { isChatbotDrawerOpen, isLoadingUserInfo } = storeToRefs(appStore);
const { startConversation, isStartConversationLoading } =
  useConversationManager();
const messageStore = useMessageStore();
const { responsePairCount, isSubmitted, minRequiredPair, isBotResponding } =
  storeToRefs(messageStore);

// Get lesson overview for lessonId
const { getLessonId } = useLessonOverview();

// Initialize TTS audio manager
const ttsAudioManager = useTTSAudioManager();

// Computed property to determine if submit button is visible
const isSubmitButtonVisible = computed(() => {
  // Check if max attempts reached
  if (appStore.isMaxAttemptsReached) {
    return false; // Hide submit button when max attempts reached
  }

  return (
    responsePairCount.value === minRequiredPair.value &&
    !isSubmitted.value &&
    !isBotResponding.value
  );
});

// Computed property to determine if microphone should be disabled
const isMicrophoneDisabled = computed(() => {
  return appStore.isMaxAttemptsReached;
});

// Show alert when max attempts reached
const showMaxAttemptsAlert = computed(() => {
  return appStore.isMaxAttemptsReached;
});

// Watch for max attempts reached and show alert
watch(
  showMaxAttemptsAlert,
  (shouldShow) => {
    if (shouldShow) {
      const assignmentInfo = appStore.userInfo?.assignmentInfo;
      if (assignmentInfo) {
        appStore.addAlert(
          `You have already submitted the assignment the maximum number of times (${assignmentInfo.maxAttempts} attempts).`
        );
      }
    }
  },
  { immediate: true }
);

const showSuggestionBox = ref(false);
const suggestion = computed(() => messageStore.getSuggestion());
let suggestionTimeout: NodeJS.Timeout | null = null;

const handleShowSuggestion = async () => {
  if (suggestion.value.isLoading) return;

  try {
    messageStore.clearSuggestion();
    messageStore.setIsSuggestionLoading(true);

    // Set 2-minute timeout for suggestion request
    suggestionTimeout = setTimeout(
      () => {
        messageStore.setIsSuggestionLoading(false);
        appStore.addAlert("Suggestion request timed out. Please try again.");
      },
      2 * 60 * 1000
    );

    // Don't show suggestion box yet - wait for first response

    const conversationString = createConversationString();

    await submitSuggestionRequest(conversationString);
  } catch (error) {
    console.error("Error getting suggestion:", error);
    messageStore.setIsSuggestionLoading(false);
    messageStore.setSuggestionError(
      "Failed to get suggestion. Please try again."
    );
    appStore.addAlert("Failed to get suggestion. Please try again.");
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
      suggestionTimeout = null;
    }
  }
};

const createConversationString = (): string => {
  const messages = messageStore.messages ?? new Map();
  let conversationString = "";

  messages.forEach((message: UserMessage | BotMessage) => {
    const speaker = message.type === "user" ? "student" : appStore.avatarName;
    const text = message.text || "";
    if (text.trim()) {
      conversationString += `${speaker}: ${text}\n`;
    }
  });

  return conversationString.trim();
};

const submitSuggestionRequest = async (conversationString: string) => {
  try {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }

    if (appStore.statusWS === "OPEN") {
      const userId = appStore.getUserId();
      if (!userId) {
        throw new Error("Unable to get user ID");
      }

      // Generate a unique ID for the suggestion request
      const suggestionId = crypto.randomUUID();

      // Store the suggestion ID in Pinia
      appStore.setSuggestion(suggestionId, "");

      // Get conversation ID with fallback to last submitted conversation
      const conversationId = appStore.getConversationId(messageStore);
      if (!conversationId) {
        throw new Error("No conversation ID available");
      }

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      appStore.sendWS(
        JSON.stringify({
          event_type: WebSocketEventType.EVENT_TEXT_START,
          user_id: userId,
          conversation_id: conversationId,
          message_id: suggestionId,
          selectedTemplate,
          data: {
            request_type: WebSocketTextRequestType.SUGGESTION,
            text: conversationString,
            language: "es",
            lessonId: getLessonId(),
          },
        })
      );
    } else {
      throw new Error("WebSocket connection not available");
    }
  } catch (error) {
    console.error("Error submitting suggestion request:", error);
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
      suggestionTimeout = null;
    }
    throw error;
  }
};

const handleCloseSuggestion = () => {
  showSuggestionBox.value = false;
};

watch(suggestion, (newSuggestion) => {
  if (!showSuggestionBox.value && newSuggestion.data.trim().length > 10) {
    showSuggestionBox.value = true;
  }
});

interface Props {
  isErrorPage?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  isErrorPage: false,
});

const sideBarClasses = computed(() => {
  return isChatbotDrawerOpen.value ? "col-6" : "";
});
const contentAreaClasses = computed(() => {
  return isChatbotDrawerOpen.value ? "col-6" : "col-12";
});

onMounted(async () => {
  await avatarStore.loadModel();
  avatarStore.setupAudioAnalysis();

  // Initialize audio store
  const audioStore = useAudioStore();
  await audioStore.init();

  // Load conversation on page reload
  try {
    const userData = await appStore.fetchUserInfo();
    if (!userData) {
      appStore.addAlert("User info not found");
    }
    await startConversation(userData);
  } catch (error) {
    appStore.addAlert("Error starting conversation:");
  }

  // Listen for websocket responses
  if (appStore.ws) {
    appStore.ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle suggestion responses, suggestion end events, and suggestion errors only
        if (
          data.data?.response_type === "suggestion" ||
          (data.event_type === "EVENT_TEXT_END" &&
            suggestion.value.isLoading) ||
          (data.event_type === "ERROR" && suggestion.value.isLoading) ||
          (data.type === "error" && suggestion.value.isLoading)
        ) {
          // Suggestion handling is now managed by the message store
        }
      } catch (error) {
        console.error("Error parsing websocket message:", error);
      }
    });
  }
});

onUnmounted(() => {
  // Cleanup TTS audio manager
  ttsAudioManager.cleanup();

  // Clear suggestion timeout
  if (suggestionTimeout) {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = null;
  }
});
</script>

<style scoped>
.canvas-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  flex: 1;
  position: relative;
}

.content-area {
  flex-shrink: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  transition: width var(--standard-transition-duration) ease;
}

.left-suggestion-box {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 110;
  pointer-events: auto;
  /* Fix scrolling issue */
  overflow: visible;
}

.speaker-model-container {
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  transition: transform var(--standard-transition-duration) ease;
}
</style>
