<template>
  <article class="message d-flex">
    <div
      class="message-text translate-border d-flex flex-column align-items-start w-100"
      :class="messageClasses">
      <h1 class="sender-label fs-xs">{{ messageName }}</h1>

      <p class="text-content fs-small mb-0">
        <template
          v-if="message.type === 'bot' && isMessageLoading && !message.text">
          <i-fa6-solid:spinner
            class="icon-style spin-fast"
            aria-hidden="true" />
        </template>
        <template v-else>
          {{ displayText }}
        </template>
      </p>

      <section
        v-if="showTranslated && message.translation"
        class="translated-text pt-space-xxs px-0 pb-space-xxxs">
        <span class="fs-xs mb-0">Translation:</span>
        <p class="text-content translate-text fs-small mb-0 color-dark-2">
          {{ message.translation }}
        </p>
      </section>

      <section
        v-if="showFeedback && message.type === 'user' && message.feedback"
        class="feedback-text pt-space-xxs px-0 pb-space-xxxs"
        aria-label="Feedback">
        <span class="fs-xs mb-0">Get feedback:</span>
        <p class="text-content translate-text fs-small mb-0">
          {{ message.feedback }}
        </p>
      </section>

      <!-- <footer class="message-buttons d-flex align-items-center">
        <ButtonComponent
          :disabled="playButtonDisabled"
          :loading="playLoading || props.audioRegenerating"
          v-if="message.type === 'bot' && !hasBotError"
          :has-toggle="true"
          :on-click="isAudioPlayingNormal ? handleStop : handlePlay"
          :aria-label="playButtonAriaLabel">
          <template #default="{ isActive }">
            <i-fa6-solid:spinner
              v-if="playLoading || props.audioRegenerating"
              class="icon-style spin-fast"
              aria-hidden="true" />
            <i-custom-stop
              v-else-if="isAudioPlayingNormal"
              class="icon-style stop-icon"
              aria-hidden="true" />
            <i-custom-volume v-else class="icon-style" aria-hidden="true" />
            <span class="button-text fs-xs">{{ playButtonText }}</span>
          </template>
        </ButtonComponent>

        <ButtonComponent
          :disabled="isDisabledDuringBotResponse"
          :loading="feedbackState?.isLoading"
          v-if="message.type === 'user'"
          :on-click="handleFeedback"
          :aria-label="feedbackButtonAriaLabel">
          <template #default>
            <i-fa6-solid:spinner
              v-if="feedbackState?.isLoading"
              class="icon-style spin-fast"
              aria-hidden="true" />
            <i-custom-comment v-else class="icon-style" aria-hidden="true" />
            <span class="button-text fs-xs">Get feedback</span>
          </template>
        </ButtonComponent>

        <ButtonComponent
          :disabled="isDisabledDuringBotResponse"
          :loading="translationState?.isLoading"
          v-if="!hasBotError"
          :on-click="handleTranslate"
          :aria-label="translateButtonAriaLabel">
          <template #default>
            <i-fa6-solid:spinner
              v-if="translationState?.isLoading"
              class="icon-style spin-fast"
              aria-hidden="true" />
            <i-custom-language v-else class="icon-style" aria-hidden="true" />
            <span class="button-text fs-xs">{{ translateButtonText }}</span>
          </template>
        </ButtonComponent>

        <ButtonComponent
          :disabled="playSlowButtonDisabled"
          :loading="playSlowLoading || props.audioRegenerating"
          v-if="message.type === 'bot' && !hasBotError"
          :has-toggle="true"
          :on-click="isAudioPlayingSlow ? handleStop : handlePlaySlow"
          :aria-label="playSlowButtonAriaLabel">
          <template #default="{ isActive }">
            <i-fa6-solid:spinner
              v-if="playSlowLoading || props.audioRegenerating"
              class="icon-style spin-fast"
              aria-hidden="true" />
            <i-custom-stop
              v-else-if="isAudioPlayingSlow"
              class="icon-style stop-icon"
              aria-hidden="true" />
            <i-custom-turtle v-else class="icon-style" aria-hidden="true" />
            <span class="button-text fs-xs">{{ playSlowButtonText }}</span>
          </template>
        </ButtonComponent>

        <ButtonComponent
          v-if="message.type === 'bot' && hasBotError"
          :on-click="handleRetry"
          :aria-label="'Retry bot message'">
          <template #default>
            <i-fa6-solid:arrow-rotate-right
              class="icon-style retry-icon"
              aria-hidden="true" />
            <span class="button-text fs-xs">Retry</span>
          </template>
        </ButtonComponent>
      </footer> -->
    </div>
  </article>
</template>

<script setup lang="ts">
import { useAppStore } from "../stores/appStore";
import { useMessageStore } from "../stores/messageStore";

const messageStore = useMessageStore();
const appStore = useAppStore();

const showFeedback = ref(false);
const showTranslated = ref(false);

const playLoading = ref(false);
const playSlowLoading = ref(false);
let playTimeout: NodeJS.Timeout | null = null;
let playSlowTimeout: NodeJS.Timeout | null = null;

const props = defineProps<{
  messageId: string;
  message: UserMessage | BotMessage;
  isPlaying?: boolean;
  isPlayingSlow?: boolean;
  audioRegenerating?: boolean;
  hasAnyPlayButtonLoading?: boolean;
}>();

const translationState = computed(() =>
  messageStore.getTranslationState(props.messageId)
);

const feedbackState = computed(() =>
  messageStore.getFeedbackState(props.messageId)
);

const emit = defineEmits<{
  translate: [messageId: string];
  feedback: [messageId: string];
  play: [messageId: string, speed: "normal" | "slow"];
  stop: [messageId: string];
  retry: [messageId: string];
}>();

// Function to set loading state when TTS request is sent
const setPlayLoading = (loading: boolean, speed?: "normal" | "slow") => {
  if (speed === "slow") {
    playSlowLoading.value = loading;

    if (loading) {
      // Set 2-minute timeout for play slow loading
      playSlowTimeout = setTimeout(
        () => {
          playSlowLoading.value = false;
        },
        2 * 60 * 1000
      );
    } else {
      // Clear timeout when loading stops
      if (playSlowTimeout) {
        clearTimeout(playSlowTimeout);
        playSlowTimeout = null;
      }
    }
  } else if (speed === "normal") {
    playLoading.value = loading;

    if (loading) {
      // Set 2-minute timeout for play loading
      playTimeout = setTimeout(
        () => {
          playLoading.value = false;
        },
        2 * 60 * 1000
      );
    } else {
      // Clear timeout when loading stops
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
    }
  } else {
    // When speed is undefined, clear both loading states
    playLoading.value = false;
    playSlowLoading.value = false;

    // Clear both timeouts
    if (playTimeout) {
      clearTimeout(playTimeout);
      playTimeout = null;
    }
    if (playSlowTimeout) {
      clearTimeout(playSlowTimeout);
      playSlowTimeout = null;
    }
  }
};

// Expose the function to parent component
defineExpose({
  setPlayLoading,
});

const handleFeedback = () => {
  if (props.message.type === "user") {
    if (!showFeedback.value) {
      // Check if feedback already exists in the message
      if (props.message.feedback) {
        showFeedback.value = true;
      }
      // Check if feedback is already being loaded or waiting for response
      else if (
        messageStore.isWaitingForFeedback(props.messageId) ||
        feedbackState.value?.isLoading
      ) {
        // Don't send another request if already loading
        return;
      }
      // Only send request if feedback doesn't exist and isn't being loaded
      else {
        messageStore.clearFeedbackError(props.messageId);
        emit("feedback", props.messageId);
      }
    } else {
      showFeedback.value = false;
    }
  }
};

const handleTranslate = () => {
  if (showTranslated.value) {
    showTranslated.value = false;
  } else {
    showTranslated.value = true;
    // Check if translation already exists in the message
    if (props.message.translation) {
      // Translation already exists, just show it
      return;
    }
    // Check if translation is already being loaded
    else if (
      messageStore.isWaitingForTranslation(props.messageId) ||
      translationState.value?.isLoading
    ) {
      // Don't send another request if already loading
      return;
    }
    // Only send request if translation doesn't exist and isn't being loaded
    else {
      messageStore.clearTranslationError(props.messageId);
      messageStore.setTranslationLoadingWithTimeout(props.messageId);
      emit("translate", props.messageId);
    }
  }
};

const handlePlay = () => {
  emit("play", props.messageId, "normal");
};

const handlePlaySlow = () => {
  emit("play", props.messageId, "slow");
};

const handleStop = () => {
  emit("stop", props.messageId);
};

const hasBotError = computed(() => {
  const hasError =
    props.message.type === "bot" &&
    messageStore.hasMessageError(props.messageId);
  return hasError;
});

const handleRetry = () => {
  emit("retry", props.messageId);
};

const messageClasses = computed(() => {
  return {
    "bg-light-3 ms-space-xl": props.message.type === "user",
    "me-space-xl ps-0": props.message.type === "bot",
    "translate-border": props.message.translation,
  };
});

const messageName = computed(() => {
  return props.message.type === "user" ? "You" : appStore.avatarName;
});

const isMessageLoading = computed(() => {
  return props.message.isLoading === true && !props.message.isComplete;
});

// Check if message has valid text (moved outside if/else for early return)
const hasValidText = computed(() => {
  return !!props.message.text && props.message.text.trim().length > 0;
});

// Check if message is fully processed (audio saved and text available)
const isMessageFullyProcessed = computed(() => {
  // Early return if no valid text - this check applies to both user and bot messages
  if (!hasValidText.value) {
    return false;
  }

  // User messages are fully processed if they have valid text
  if (props.message.type === "user") {
    return true;
  }

  // For bot messages, check if they are currently loading
  // If not loading, consider them processed (even without stored audio for old messages)
  if (props.message.isLoading) {
    return false;
  }

  // Bot messages are processed if they have valid text and are not currently loading
  // Audio storage is not required for button functionality in old messages
  return true;
});

// Check if message has audio available for play buttons
const hasAudioAvailable = computed(() => {
  if (props.message.type === "user") {
    return false; // User messages don't have audio
  }

  // For bot messages, check if audio is stored or if message is complete
  return (
    props.message.audio === "stored" ||
    (!props.message.isLoading && hasValidText.value)
  );
});

// Check if buttons should be disabled during bot response
// Only disable for the current message being processed, not all messages
const isDisabledDuringBotResponse = computed(() => {
  // Only disable if this specific message is the one being processed
  if (props.message.type === "bot") {
    const mostRecentLoadingBotMessage =
      messageStore.getMostRecentLoadingBotMessage();
    return (
      mostRecentLoadingBotMessage === props.messageId && props.message.isLoading
    );
  }
  // For user messages, never disable during bot response - they should remain clickable
  return false;
});

const displayText = computed(() => {
  // For bot messages with errors, show error message
  if (props.message.type === "bot" && hasBotError.value) {
    return "Something went wrong, try again.";
  }
  // For bot messages with "Message failed" text, also show error message
  if (props.message.type === "bot" && props.message.text === "Message failed") {
    return "Something went wrong, try again.";
  }
  // For bot messages, show the text even while loading (streaming)
  if (props.message.type === "bot") {
    return props.message.text || "";
  }
  return props.message.text || "";
});

// Computed properties for aria-labels to replace nested ternary operators
const playButtonAriaLabel = computed(() => {
  if (isDisabledDuringBotResponse.value)
    return "Button disabled during bot response";
  if (playLoading.value || props.audioRegenerating) return "Audio loading";
  if (!hasAudioAvailable.value) return "Audio not available";
  return "Play audio";
});

const feedbackButtonAriaLabel = computed(() => {
  if (isDisabledDuringBotResponse.value)
    return "Button disabled during bot response";
  if (feedbackState.value?.isLoading) return "Feedback loading";
  return "Toggle feedback";
});

const translateButtonAriaLabel = computed(() => {
  if (isDisabledDuringBotResponse.value)
    return "Button disabled during bot response";
  if (translationState.value?.isLoading) return "Translation loading";
  return "Toggle translation";
});

const playSlowButtonAriaLabel = computed(() => {
  if (isDisabledDuringBotResponse.value)
    return "Button disabled during bot response";
  if (playLoading.value || props.audioRegenerating) return "Audio loading";
  if (!hasAudioAvailable.value) return "Audio not available";
  return "Play audio slower";
});

const translateButtonText = computed(() => {
  return translationState.value?.isLoading ? "Translating" : "Translate";
});

const playButtonText = computed(() => {
  if (playLoading.value) return "Play";
  return isAudioPlayingNormal.value ? "Stop" : "Play";
});

const playSlowButtonText = computed(() => {
  if (playSlowLoading.value) return "Loading...";
  return isAudioPlayingSlow.value ? "Stop" : "Play slower";
});

watch(props.message, (newValue) => {
  const isUserMessage = newValue.type === "user";
  const feedback = isUserMessage
    ? (newValue as UserMessage).feedback
    : undefined;
  if (
    isUserMessage &&
    feedbackState.value?.isLoading === true &&
    feedback !== undefined &&
    feedback.trim().length > 0
  ) {
    showFeedback.value = true;
    messageStore.setIsFeedbackLoading(props.messageId, false);
  }
  if (playLoading.value === true && newValue?.audio !== undefined) {
    playLoading.value = false;
    if (playTimeout) {
      clearTimeout(playTimeout);
      playTimeout = null;
    }
  }
  if (playSlowLoading.value === true && newValue?.audio !== undefined) {
    playSlowLoading.value = false;
    if (playSlowTimeout) {
      clearTimeout(playSlowTimeout);
      playSlowTimeout = null;
    }
  }
});

// Watch for feedback updates using the reactive set
watch(
  () => messageStore.feedbackUpdated.has(props.messageId),
  (hasFeedbackUpdate) => {
    if (hasFeedbackUpdate && feedbackState.value?.isLoading) {
      showFeedback.value = true;
      messageStore.setIsFeedbackLoading(props.messageId, false);
      messageStore.clearFeedbackUpdated(props.messageId);
    }
  }
);

// Watch for TTS completion to clear loaders
watch(
  () => messageStore.ttsCompleted.has(props.messageId),
  (isTTSCompleted) => {
    if (isTTSCompleted) {
      if (playLoading.value) {
        playLoading.value = false;
        if (playTimeout) {
          clearTimeout(playTimeout);
          playTimeout = null;
        }
      }
      if (playSlowLoading.value) {
        playSlowLoading.value = false;
        if (playSlowTimeout) {
          clearTimeout(playSlowTimeout);
          playSlowTimeout = null;
        }
      }
      messageStore.clearTTSCompleted(props.messageId);
    }
  }
);

// Watch for audio playing state to show/hide stop button
const isAudioPlaying = computed(() =>
  messageStore.isAudioPlaying(props.messageId)
);
const isAudioPlayingNormal = computed(() => {
  const result = messageStore.isAudioPlaying(props.messageId, "normal");
  return result;
});
const isAudioPlayingSlow = computed(() => {
  const result = messageStore.isAudioPlaying(props.messageId, "slow");
  return result;
});

// Watch for error states to reset loading
watch(
  () => messageStore.hasMessageError(props.messageId),
  (hasError) => {
    if (hasError && feedbackState.value?.isLoading) {
      messageStore.setIsFeedbackLoading(props.messageId, false);
      // Don't clear the error state automatically - let retry handle it
    }
  }
);

// Watch for feedback request removal to reset loading
watch(
  () => messageStore.isWaitingForFeedback(props.messageId),
  (isWaitingForFeedback) => {
    if (!isWaitingForFeedback && feedbackState.value?.isLoading) {
      messageStore.setIsFeedbackLoading(props.messageId, false);
    }
  }
);

// Watch for play loading error states to reset loading
watch(
  () => messageStore.hasMessageError(props.messageId),
  (hasError) => {
    if (hasError && playLoading.value) {
      playLoading.value = false;
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
    }
    if (hasError && playSlowLoading.value) {
      playSlowLoading.value = false;
      if (playSlowTimeout) {
        clearTimeout(playSlowTimeout);
        playSlowTimeout = null;
      }
    }
  }
);

// Watch for translation error states to reset loading
watch(
  () => messageStore.getTranslationState(props.messageId)?.error,
  (translationError) => {
    if (translationError && translationState.value?.isLoading) {
      // Reset the translation loading state when an error occurs
      messageStore.setIsTranslationLoading(props.messageId, false);
    }
  }
);

// Watch for feedback error states to reset loading
watch(
  () => messageStore.getFeedbackState(props.messageId)?.error,
  (feedbackError) => {
    if (feedbackError && feedbackState.value?.isLoading) {
      // Reset the feedback loading state when an error occurs
      messageStore.setIsFeedbackLoading(props.messageId, false);
    }
  }
);

// Watch for TTS request clearing to reset play button loading state
watch(
  () => appStore.ttsRequestMessageIds?.has(props.messageId),
  (hasTTSRequest) => {
    // If TTS request was cleared and we're still loading, reset the loading state
    if (!hasTTSRequest && (playLoading.value || playSlowLoading.value)) {
      if (playLoading.value) {
        playLoading.value = false;
        if (playTimeout) {
          clearTimeout(playTimeout);
          playTimeout = null;
        }
      }
      if (playSlowLoading.value) {
        playSlowLoading.value = false;
        if (playSlowTimeout) {
          clearTimeout(playSlowTimeout);
          playSlowTimeout = null;
        }
      }
    }
  }
);

// Computed for play button disabled state
const playButtonDisabled = computed(() => {
  const disabled =
    !hasAudioAvailable.value ||
    isDisabledDuringBotResponse.value ||
    playSlowLoading.value ||
    (props.hasAnyPlayButtonLoading && !playLoading.value);
  return disabled;
});

// Computed for play slower button disabled state
const playSlowButtonDisabled = computed(() => {
  return (
    !hasAudioAvailable.value ||
    isDisabledDuringBotResponse.value ||
    playLoading.value ||
    (props.hasAnyPlayButtonLoading && !playSlowLoading.value)
  );
});
</script>

<style scoped>
.button-text {
  line-height: 24px;
  color: var(--rds-dark-2);
}

.message-text {
  padding: 1rem;
  box-sizing: border-box;
  border-radius: 1.5rem 1.5rem 0 1.5rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.text-content {
  line-height: 1.4;
  padding: 8px 0px;
  margin-bottom: 0.1875rem;
  white-space: pre-line;
  word-break: break-word;
}

.icon-style {
  width: 14px;
  height: 12px;
  color: var(--rds-dark-2);
}

.stop-icon {
  width: var(--stop-icon-size);
  height: var(--stop-icon-size);
}

.sender-label {
  font-weight: 600;
  color: var(--rds-label-color);
  line-height: 24px;
}

.translated-text,
.feedback-text {
  border-top: 1px solid var(--rds-translate-border);
  width: 100%;
}
</style>
