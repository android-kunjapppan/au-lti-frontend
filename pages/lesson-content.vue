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
            <MicrophoneInput :is-active="!isMicrophoneDisabled" />

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
          :is-input-disabled="isInputDisabled"
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
  DEFAULT_REQUEST_TIMEOUT_LENGTH,
  WebSocketEventType,
  WebSocketTextRequestType,
} from "../utils/constants";

import { onUnmounted } from "vue";
import { useLessonOverview } from "~/composables/useLessonOverview";
import { useTTSAudioManager } from "~/composables/useTTSAudioManager";

definePageMeta({
  middleware: ["conversation-auth", "test-navigation"],
});
const avatarStore = useAvatarStore();
const { audioElement } = storeToRefs(avatarStore);
const appStore = useAppStore();
const { isChatbotDrawerOpen, isLoadingUserInfo, isTest } =
  storeToRefs(appStore);
const { startConversation, isStartConversationLoading } =
  useConversationManager();
const messageStore = useMessageStore();
const { fetchLessonOverview } = useLessonOverview();

const {
  responsePairCount,
  isSubmitted,
  minRequiredPair,
  isBotResponding,
  isSubmitting,
} = storeToRefs(messageStore);

// Initialize TTS audio manager
const ttsAudioManager = useTTSAudioManager();

// Single source of truth for submit eligibility
const canSubmit = computed(() => {
  return (
    responsePairCount.value >= (minRequiredPair.value ?? 0) &&
    !isSubmitted.value &&
    !appStore.isMaxAttemptsReached
  );
});

// Input disabled state
const isInputDisabled = computed(() => {
  return isTest.value && canSubmit.value;
});

// Optimized: Microphone disabled state
const isMicrophoneDisabled = computed(() => {
  return (
    appStore.isMaxAttemptsReached ||
    isInputDisabled.value ||
    isSubmitting.value ||
    isBotResponding.value
  );
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
  if (suggestion.value.isLoading) {
    return;
  }

  try {
    // Set flag to prevent generic websocket errors
    appStore.setWebsocketRequestInProgress(true);

    // Generate a unique ID for the suggestion request
    const suggestionId = crypto.randomUUID();

    messageStore.clearSuggestion();
    messageStore.setIsSuggestionLoading(true, suggestionId);

    // Set 2-minute timeout for suggestion request
    suggestionTimeout = setTimeout(() => {
      messageStore.setIsSuggestionLoading(false);
      appStore.addAlert("Suggestion request timed out. Please try again.");
    }, DEFAULT_REQUEST_TIMEOUT_LENGTH);

    // Don't show suggestion box yet - wait for first response
    const conversationString = createConversationString();

    await submitSuggestionRequest(conversationString, suggestionId);
  } catch (error) {
    console.error("Error getting suggestion:", error);
    // Set suggestion error with 1s delay - don't clear loading immediately
    messageStore.setSuggestionError(
      "Failed to get suggestion. Please try again."
    );
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

const submitSuggestionRequest = async (
  conversationString: string,
  suggestionId: string
) => {
  try {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();
    }

    if (appStore.statusWS === "OPEN") {
      const userId = appStore.getUserId();
      if (!userId) {
        throw new Error("Unable to get user ID");
      }

      // Store the suggestion ID in Pinia
      appStore.setSuggestion(suggestionId, "");

      // Get conversation ID with fallback to last submitted conversation
      const conversationId = appStore.getConversationId(messageStore);
      if (!conversationId) {
        throw new Error("No conversation ID available");
      }

      // Get selectedTemplate
      if (!appStore.selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      const wsMessage = {
        event_type: WebSocketEventType.EVENT_TEXT_START,
        user_id: userId,
        conversation_id: conversationId,
        message_id: suggestionId,
        selectedTemplate: appStore.selectedTemplate,
        data: {
          request_type: WebSocketTextRequestType.SUGGESTION,
          text: conversationString,
          language: "es",
        },
      };

      appStore.sendWS(JSON.stringify(wsMessage));
    } else {
      throw new Error("WebSocket connection not available");
    }
  } catch (error) {
    console.error("Error in submitSuggestionRequest:", error);
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

  // Clear timeout when suggestion is received successfully
  if (
    !newSuggestion.isLoading &&
    newSuggestion.data.trim().length > 0 &&
    suggestionTimeout
  ) {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = null;
  }
});

// Watch for suggestion loading state changes to clear timeout when request completes
watch(
  () => suggestion.value.isLoading,
  (newValue, oldValue) => {
    // If loading changed from true to false, clear the local timeout
    if (oldValue && !newValue && suggestionTimeout) {
      clearTimeout(suggestionTimeout);
      suggestionTimeout = null;
    }
  }
);

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
  // Check navigation restrictions first
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
    // Fetch lesson overview to set avatar name
    await fetchLessonOverview();
    await startConversation(userData);
  } catch (error) {
    appStore.addAlert("Error starting conversation:");
  }

  // Listen for websocket responses
  if (appStore.ws) {
    appStore.ws.addEventListener("message", (event: MessageEvent) => {
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
