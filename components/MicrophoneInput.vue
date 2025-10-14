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
            :style="{ height: bar + '%', width: '2px', margin: '0 2px' }" />
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
import { useSharedAudioContext } from "~/composables/useSharedAudioContext";
import { AUDIO_CONFIG } from "~/utils/constants";

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
  currentUserMessageId, // Track if text message was sent
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

// Consolidated pending audio state for atomic updates
const pendingAudio = ref<{
  blob: Blob | null;
  sessionId: string | null;
  timeoutId: NodeJS.Timeout | null;
  isUploading: boolean; // Guard against concurrent uploads
}>({
  blob: null,
  sessionId: null,
  timeoutId: null,
  isUploading: false,
});

// Helper: Clear pending audio timeout
const clearPendingAudioTimeout = () => {
  if (pendingAudio.value.timeoutId) {
    clearTimeout(pendingAudio.value.timeoutId);
    pendingAudio.value.timeoutId = null;
  }
};

// Helper: Clear all pending audio state
const clearPendingAudio = () => {
  clearPendingAudioTimeout();
  pendingAudio.value = {
    blob: null,
    sessionId: null,
    timeoutId: null,
    isUploading: false,
  };
};

// Create a callback for when audio ends
const handleAudioEnd = async (audioBlob?: Blob) => {
  // Reset chunk flag
  firstAudioChunkSent.value = false;

  // Clear any existing pending audio
  clearPendingAudioTimeout();

  // Guard: If no audio data, nothing to do
  if (!audioBlob || !audioSessionId.value) {
    return;
  }

  // Store the audio blob and session ID for later upload
  pendingAudio.value.blob = audioBlob;
  pendingAudio.value.sessionId = audioSessionId.value;

  // If text message already exists, upload immediately (no race with watcher)
  if (currentUserMessageId.value) {
    await uploadPendingAudio();
    return; // Exit early - watcher won't trigger since we're clearing state
  }

  // Set timeout to clear pending audio if transcription takes too long
  pendingAudio.value.timeoutId = setTimeout(() => {
    if (pendingAudio.value.blob && !currentUserMessageId.value) {
      console.warn(
        "[Audio] Transcription timeout - clearing pending audio after",
        AUDIO_CONFIG.UPLOAD_TIMEOUT_MS / 1000,
        "seconds"
      );
      clearPendingAudio();
    }
  }, AUDIO_CONFIG.UPLOAD_TIMEOUT_MS);
};

// Function to upload pending audio after text message is confirmed
const uploadPendingAudio = async () => {
  // Guard: Prevent concurrent uploads
  if (pendingAudio.value.isUploading) {
    return;
  }

  // Guard: Check if we have pending audio
  if (!pendingAudio.value.blob || !pendingAudio.value.sessionId) {
    return;
  }

  // Guard: Check if text message exists
  if (!currentUserMessageId.value) {
    clearPendingAudio();
    return;
  }

  // Set upload guard
  pendingAudio.value.isUploading = true;

  // Clear timeout since we're uploading now
  clearPendingAudioTimeout();

  // Store references for upload (in case state changes during async operation)
  const blobToUpload = pendingAudio.value.blob;
  const sessionIdToUpload = pendingAudio.value.sessionId;

  try {
    await sendAudioEndMessage(sessionIdToUpload, blobToUpload);
  } catch (error) {
    console.error("[Audio] Failed to upload audio:", error);
    appStore.addAlert("Failed to upload audio recording. Please try again.");
  } finally {
    // Clear all pending audio state after upload attempt
    clearPendingAudio();
  }
};

const {
  isAudioRecording,
  audioSessionId,
  isAudioEnded,
  startAudioRecording,
  stopAudioRecording,
  cleanupAudio,
} = useAudioRecording(handleAudioEnd);

const { initAudioContext, handleUserInteraction, ensureAudioContextRunning } =
  useSharedAudioContext();

// Computed
const buttonClass = computed(() => {
  // If there's a bot error, show error state
  if (hasBotError.value) {
    return "circle-error";
  }

  // If bot is responding, microphone is disabled, or not active, show disabled state (grey)
  if (isSttDisabled.value || messageStore.isBotResponding || !props.isActive) {
    return "circle-disabled";
  }

  // If in stopping states or processing in background, show disabled state (grey)
  if (isGracefullyStopping.value || isProcessingInBackground.value) {
    return "circle-disabled";
  }

  // If actively listening or recording, show active state (red)
  if (sttListening.value || isAudioRecording.value) {
    return "circle-active";
  }

  // Default to inactive state (green) when ready
  return "circle-inactive";
});

// Computed for loading state
const isLoadingState = computed(() => {
  return (
    messageStore.isBotResponding ||
    isGracefullyStopping.value ||
    isProcessingInBackground.value
  );
});

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
  (isResponding, wasResponding) => {
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

// Watch for text message creation to trigger pending audio upload
watch(
  currentUserMessageId,
  async (messageId) => {
    // Only trigger upload if we have pending audio and not already uploading
    if (
      messageId &&
      pendingAudio.value.blob &&
      !pendingAudio.value.isUploading
    ) {
      try {
        await uploadPendingAudio();
      } catch (error) {
        console.error("[Audio] Watcher failed to upload audio:", error);
      }
    }
  },
  { flush: "post" } // Run after component updates to avoid timing issues
);

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
  // Guard: Only send audio if STT is actively listening and audio hasn't ended
  if (
    event.data.size > 0 &&
    !isAudioEnded.value &&
    sttListening.value &&
    isAudioRecording.value
  ) {
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
    // Initialize AudioContext when user starts recording (natural user interaction)
    try {
      await initAudioContext();

      // Trigger user interaction to enable audio playback
      await handleUserInteraction();

      await ensureAudioContextRunning();
    } catch (error) {
      console.warn(
        "🎵 AudioContext initialization failed, but continuing with recording:",
        error
      );
    }

    firstAudioChunkSent.value = false;
    await startAudioRecording(handleAudioDataAvailable);
  } catch (e) {
    appStore.addAlert("Failed to start audio recording.");
  }
};

// Lifecycle
onUnmounted(() => {
  cleanupAudio();

  // Clear all pending audio state to prevent memory leaks
  clearPendingAudio();
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
  height: 100%;
}

.wave-bar {
  background-color: var(--rds-waveform-bg);
  transition: height 0.2s ease-out;
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
