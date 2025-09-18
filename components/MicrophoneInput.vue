<template>
  <div class="microphone-container">
    <!-- Combined STT/Audio Button -->
    <button
      class="speaker-model"
      :disabled="isSttDisabled || messageStore.isBotResponding || !isActive">
      <div
        :class="[
          'circle',
          buttonClass,
          {
            'loading-state': isLoadingState,
          },
        ]"
        @click="handleSttClick">
        <!-- Custom Mic Loader (stage 2) -->
        <img
          v-if="isLoadingState"
          src="/assets/custom/mic-loader.gif"
          alt="Microphone Loading"
          class="microphone-icon"
          width="53"
          height="53" />

        <!-- Retry icon when there's a bot error -->
        <i-fa6-solid:arrow-rotate-right
          v-else-if="hasBotError"
          class="microphone-icon icon-white retry-icon" />

        <!-- Stop icon when actively listening or recording -->
        <i-fa6-solid:stop
          v-else-if="sttListening || isAudioRecording"
          class="microphone-icon icon-white"
          width="26"
          height="26" />

        <!-- Microphone icon when ready (not listening, not recording, not loading) -->
        <i-fa6-solid:microphone
          v-else
          class="microphone-icon icon-white"
          width="26"
          height="26" />
      </div>

      <!-- Waveform -->
      <div class="waveform-container">
        <div class="waveform">
          <div
            class="wave-bar"
            v-for="(bar, index) in waveform"
            :key="index"
            :style="{ height: bar + 'px', width: '2px', margin: '0 2px' }" />
        </div>
      </div>
    </button>

    <!-- Manual input fallback when STT is disabled -->
    <div v-if="isSttDisabled && isActive" class="manual-input-fallback">
      <input
        v-model="manualInput"
        @keyup.enter="sendManualMessage"
        placeholder="Type your message here..."
        class="manual-input" />
      <button @click="sendManualMessage" class="send-button">Send</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

interface Props {
  isActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: true,
});

const appStore = useAppStore();
const { userPrompt } = storeToRefs(appStore);

// STT Manager - direct usage instead of going through app store
const sttManager = useSTTManager({
  textStorage: userPrompt,
  onAlert: appStore.addAlert,
  onWebSocketOpen: appStore.openWS,
  onWebSocketSend: appStore.sendWS,
  onWebSocketStatus: () => appStore.statusWS,
  onAudioCleanup: () => {
    // Force stop audio recording when STT errors occur
    if (isAudioRecording.value) {
      stopAudioRecording(handleAudioEnd);
    }
  },
});

// Destructure STT manager state and methods
const {
  sttListening,
  isSttDisabled,
  isGracefullyStopping,
  isProcessingInBackground,
  toggleSttWithErrorHandling,
  handleSttMessage,
} = sttManager;

// Message store for bot response state
const messageStore = useMessageStore();

// Computed to check if there are any bot errors
const hasBotError = computed(() => {
  const messages = messageStore.messages ?? new Map();

  for (const [id, message] of messages.entries()) {
    if (message.type === "bot" && messageStore.hasMessageError(id)) {
      return true;
    }
  }
  return false;
});

// Composables
const { waveform, startWaveform, stopWaveform } = useWaveform();
const { sendAudioMessage, sendAudioEndMessage } = useAudioWebSocket();

// State
const manualInput = ref("");
const firstAudioChunkSent = ref(false);

// Create a callback for when audio ends
const handleAudioEnd = async (audioBlob?: Blob) => {
  // Only send audio end message if audio data was actually sent
  if (audioSessionId.value && firstAudioChunkSent.value) {
    await sendAudioEndMessage(audioSessionId.value, audioBlob);
  }
  // Reset the flag regardless
  firstAudioChunkSent.value = false;
};

const {
  isAudioRecording,
  audioSessionId,
  isAudioEnded,
  startAudioRecording,
  stopAudioRecording,
  cleanupAudio,
} = useAudioRecording(handleAudioEnd);

// Computed
const buttonClass = computed(() => {
  // If there's a bot error, show error state
  if (hasBotError.value) return "circle-error";

  // If bot is responding or microphone is disabled, show disabled state
  if (isSttDisabled.value || messageStore.isBotResponding || !props.isActive)
    return "circle-disabled";

  // If actively listening or recording, show active state (red)
  if (sttListening.value || isAudioRecording.value) return "circle-active";

  // If in stopping states or processing in background, show disabled state (grey) instead of inactive (green)
  if (isGracefullyStopping.value || isProcessingInBackground.value)
    return "circle-disabled";

  // Default to inactive state (green) when ready
  return "circle-inactive";
});

// Computed for loading state
const isLoadingState = computed(
  () =>
    messageStore.isBotResponding ||
    isGracefullyStopping.value ||
    isProcessingInBackground.value
);

// Watch both STT and audio recording to control waveform
watch([sttListening, isAudioRecording], ([isSttActive, isRecording]) => {
  if (isSttActive || isRecording) {
    startWaveform();
  } else {
    stopWaveform();
  }
});

// Watch for bot response completion to ensure proper microphone state
watch(
  () => messageStore.isBotResponding,
  (isResponding) => {
    if (!isResponding) {
      // When bot stops responding, only reset retry counter if no errors
      messageStore.resetRetryCount();
    }
  }
);

// Watch for STT state changes to automatically handle audio recording
watch(sttListening, async (isListening) => {
  if (isListening && !isAudioRecording.value) {
    // STT started listening, so start audio recording
    await handleStartAudio();
  } else if (!isListening && isAudioRecording.value) {
    // STT stopped listening, so stop audio recording
    await stopAudioRecording(handleAudioEnd);
  }
});

// Event handlers
const handleSttClick = async () => {
  try {
    // If there's a bot error, handle retry functionality
    if (hasBotError.value) {
      // Find the most recent bot message with error and retry it
      const messages = messageStore.messages ?? new Map();
      let botMessageId: string | null = null;

      // Find the most recent bot message with error
      for (const [id, message] of messages.entries()) {
        if (message.type === "bot" && messageStore.hasMessageError(id)) {
          botMessageId = id;
          break;
        }
      }

      if (botMessageId) {
        // Find the original user message that triggered this bot response
        let userMessageId: string | null = null;
        let userMessageText: string | null = null;

        for (const [id, message] of messages.entries()) {
          if (message.type === "user" && message.text) {
            userMessageId = id;
            userMessageText = message.text;
          }
          if (id === botMessageId) {
            break; // Stop when we reach the bot message
          }
        }

        if (userMessageId && userMessageText) {
          // Check WebSocket connection first, just like bot message retry
          if (appStore.statusWS !== "OPEN") {
            await appStore.openWS();
          }
          if (appStore.statusWS === "OPEN") {
            // Use shared retry function
            await messageStore.retryBotMessage(botMessageId, appStore);
          } else {
            appStore.addAlert(
              "Connection failed. Unable to retry at this time."
            );
          }
        }
      }
      return;
    }

    // Prevent action if bot is responding, we're in the middle of stopping, processing in background, or microphone is disabled
    if (
      messageStore.isBotResponding ||
      isGracefullyStopping.value ||
      isProcessingInBackground.value ||
      !props.isActive
    ) {
      return;
    }

    // Simply toggle STT - the watcher will handle audio recording automatically
    await toggleSttWithErrorHandling();
  } catch (error) {
    appStore.addAlert("Failed to toggle microphone. Please try again.");
  }
};

const sendManualMessage = async () => {
  if (manualInput.value.trim() && props.isActive) {
    const inputText = manualInput.value;
    manualInput.value = "";
    userPrompt.value = inputText;

    // Stop STT if it's currently listening before sending manual message
    if (sttListening.value) {
      await toggleSttWithErrorHandling();
    }

    await handleSttMessage();
  }
};

// Audio handlers
const handleAudioDataAvailable = async (event: BlobEvent) => {
  if (event.data.size > 0 && !isAudioEnded.value) {
    if (!firstAudioChunkSent.value) {
      await sendAudioMessage(
        WebSocketEventType.EVENT_AUDIO_START,
        event.data,
        audioSessionId.value!
      );
      firstAudioChunkSent.value = true;
    } else {
      await sendAudioMessage(
        WebSocketEventType.EVENT_AUDIO_UPDATED,
        event.data,
        audioSessionId.value!
      );
    }
  }
};

const handleStartAudio = async () => {
  try {
    firstAudioChunkSent.value = false;
    await startAudioRecording(handleAudioDataAvailable);
  } catch (e) {
    appStore.addAlert("Failed to start audio recording.");
  }
};

// Lifecycle
onUnmounted(() => {
  cleanupAudio();
});
</script>

<style scoped>
.microphone-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.speaker-model {
  position: relative;
  transition: transform 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  border: none;
  background: transparent;
}

.circle {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 60.75px;
  height: 60.75px;
  border-radius: 50%;
  border: 5px solid var(--rds-waveform-bg);
  transition:
    background-color 0.2s ease,
    filter 0.2s ease;
}

.circle:hover {
  filter: brightness(90%);
}

.circle-error:hover {
  background-color: var(--dsl-black);
}

.circle-inactive {
  background-color: var(--mic-inactive);
}

.circle-active {
  background-color: var(--mic-active);
}

.circle-disabled {
  background-color: var(--mic-disabled);
  cursor: not-allowed;
}

/* Error state for microphone when there's a bot error */
.circle-error {
  background-color: var(--rds-buttons-bg);
}

/* Disable cursor during loading states */
.loading-state {
  cursor: not-allowed;
}

.circle-graceful-stop {
  background-color: var(--mic-graceful-stop);
  animation: pulse 1s infinite;
}

/* Auto-stop CSS removed - feature disabled */

/* Icon colors */
.icon-white {
  color: var(--mic-icon-white);
}

/* Retry icon styling */
.retry-icon {
  color: var(--mic-icon-white);
  width: var(--mic-retry-icon-size, 26px);
  height: var(--mic-retry-icon-size, 26px);
}

/* Custom mic loader */
.microphone-icon[src*="mic-loader.gif"] {
  object-fit: contain;
  background-color: var(--rds-gray-bg);
  border-radius: 50%;
  padding: 2px;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Auto-stop pulse animation removed - feature disabled */

/* Waveform */
.waveform-container {
  width: 235px;
  height: 40px;
  border-radius: 1.5rem;
  display: flex;
  cursor: default;
  justify-content: center;
  align-items: center;
  padding: 2px;
  background: linear-gradient(
    180deg,
    var(--mic-waveform-gradient-start) 0%,
    var(--mic-waveform-gradient-end) 100%
  );
  box-shadow: 0rem -0.25rem 1rem 0rem var(--mic-waveform-shadow);
}

.waveform {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 20%;
}

.wave-bar {
  background-color: var(--rds-waveform-bg);
  transition: height 0.2s ease;
}

.manual-input-fallback {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.manual-input {
  padding: 8px;
  width: 200px;
  border: 1px solid var(--mic-input-border);
  border-radius: 4px;
}
</style>
