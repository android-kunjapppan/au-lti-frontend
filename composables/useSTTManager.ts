import { computed, shallowRef, watch } from "vue";
import { useAppStore } from "~/stores/appStore";
import { useMessageStore } from "~/stores/messageStore";
import type { UserTextConversationRequestBody } from "~/types/types";
import {
  STT_CONFIG,
  STT_ERROR_MESSAGES,
  SupportedLang,
  WebSocketEventType,
  WebSocketTextRequestType,
} from "~/utils/constants";

interface STTManagerOptions {
  textStorage: Ref<string>;
  language?: (typeof SupportedLang)[keyof typeof SupportedLang];
  onAlert?: (message: string) => void;
  onWebSocketOpen?: () => Promise<void>;
  onWebSocketSend?: (message: string) => void;
  onWebSocketStatus?: () => string;
  onAudioCleanup?: () => void;
}

export const useSTTManager = ({
  textStorage,
  language = SupportedLang.SPANISH,
  onAlert,
  onWebSocketOpen,
  onWebSocketSend,
  onWebSocketStatus,
  onAudioCleanup,
}: STTManagerOptions) => {
  const appStore = useAppStore();
  const messageStore = useMessageStore();

  // State management - using shallowRef for better performance
  const isSecureContext = computed(
    () => typeof window !== "undefined" && window.isSecureContext
  );
  const isWaitingForSttCompletion = shallowRef(false);
  const consecutiveSttErrors = shallowRef(0);
  const isSttDisabled = shallowRef(false);
  const isGracefullyStopping = shallowRef(false);
  const isAutoStopping = shallowRef(false);
  const hasSpeechBeenDetected = shallowRef(false);
  const wasManuallyStopped = shallowRef(false);
  const messageSent = shallowRef(false); // Flag to prevent STT updates after message is sent
  const isProcessingInBackground = shallowRef(false); // Flag to track background STT processing

  // STT composable
  const {
    isSupported: sttSupported,
    isListening: sttListening,
    stop: stopStt,
    toggle: toggleStt,
    result,
    isFinal,
    error: sttError,
  } = useSTT({
    textStorage,
    lang: language,
    preventUpdates: messageSent,
  });

  // Use centralized constants
  const SILENCE_THRESHOLD = STT_CONFIG.SILENCE_THRESHOLD;
  const MAX_CONSECUTIVE_ERRORS = STT_CONFIG.MAX_CONSECUTIVE_ERRORS;

  // Use error messages from constants
  const ERROR_MESSAGES = STT_ERROR_MESSAGES;

  // Computed properties
  const canStartStt = computed(
    () =>
      !isSttDisabled.value &&
      sttSupported.value &&
      isSecureContext.value &&
      !isGracefullyStopping.value
  );

  const isSttActive = computed(
    () => sttListening.value || isGracefullyStopping.value
  );

  const hasValidText = computed(() => textStorage.value.trim().length > 0);

  // Helper functions
  const addAlert = (text: string) =>
    onAlert?.(text) || console.error("STT Alert:", text);

  const resetSpeechDetection = () => {
    hasSpeechBeenDetected.value = false;
    isAutoStopping.value = false;
  };

  // Error handling
  const handleSttError = async (error: { error: string }) => {
    console.error("STT Error:", error);
    consecutiveSttErrors.value++;

    if (consecutiveSttErrors.value >= MAX_CONSECUTIVE_ERRORS) {
      isSttDisabled.value = true;
      addAlert(ERROR_MESSAGES.persistent);
      return;
    }

    const errorMessage =
      ERROR_MESSAGES[error.error as keyof typeof ERROR_MESSAGES] ||
      `Speech recognition error: ${error.error}. Please try again.`;
    addAlert(errorMessage);
    isWaitingForSttCompletion.value = false;

    // Clear STT text buffer on any error to prevent accumulation
    textStorage.value = "";

    // Reset stopping states to ensure microphone returns to active state
    isGracefullyStopping.value = false;
    isAutoStopping.value = false;

    // Stop STT for specific errors that indicate the session should end
    if (error.error === "no-speech" || error.error === "network") {
      try {
        await stopStt();
        // Call audio cleanup callback to ensure audio recording is also stopped
        onAudioCleanup?.();
      } catch (stopError) {
        console.error("Failed to stop STT after error:", stopError);
      }
    }
  };

  // Validation checks
  const validateSttRequirements = () => {
    if (!canStartStt.value) {
      if (isSttDisabled.value) {
        addAlert(ERROR_MESSAGES.disabled);
      } else if (!sttSupported.value) {
        addAlert(ERROR_MESSAGES.notSupported);
      } else if (!isSecureContext.value) {
        addAlert(ERROR_MESSAGES.notSecure);
      }
      return false;
    }
    return true;
  };

  // Message handling
  const handleSttMessage = async () => {
    if (!onWebSocketStatus || !onWebSocketOpen || !onWebSocketSend) {
      addAlert("WebSocket functions not provided to STT manager");
      return;
    }

    if (onWebSocketStatus() !== "OPEN") {
      await onWebSocketOpen();
    }

    if (onWebSocketStatus() === "OPEN" && hasValidText.value) {
      try {
        // Get dynamic user ID from app store
        const userId = appStore.getUserId();

        // Check if conversation ID exists
        const conversationId = messageStore.getConversationId();
        if (!conversationId) {
          addAlert("No active conversation. Please start a lesson first.");
          return;
        }

        const userMessageId = messageStore.createMessage("user", {
          data: { text: textStorage.value },
        });

        // Create initial bot message with loading state
        const botMessageId = messageStore.createMessage("bot", {
          data: {
            text: "",
            isComplete: false,
          },
        });

        // Set loading state with timeout
        messageStore.setMessageLoading(botMessageId, true);

        // Get selectedTemplate from sessionStorage
        const selectedTemplate = sessionStorage.getItem("selectedTemplate");
        if (!selectedTemplate) {
          appStore.addAlert(
            "Missing selectedTemplate, please reload or try again"
          );
          return;
        }

        onWebSocketSend(
          JSON.stringify({
            event_type: WebSocketEventType.EVENT_TEXT_START,
            user_id: userId,
            conversation_id: conversationId,
            message_id: userMessageId,
            selectedTemplate,
            data: {
              request_type: WebSocketTextRequestType.USER_TEXT,
              text: textStorage.value,
              language: language,
              bot_message_id: botMessageId,
            },
          } satisfies UserTextConversationRequestBody)
        );

        // Clear text storage immediately after sending message
        textStorage.value = "";
        messageSent.value = true; // Set flag to prevent further STT updates
      } catch (error) {
        addAlert("Failed to send transcribed message. Please try again.");
        // Clear text storage on error to prevent accumulation
        textStorage.value = "";
      }
    } else {
      addAlert(
        "Connection is not available. Please check your connection and try again."
      );
      // Clear text storage when connection is not available
      textStorage.value = "";
    }
  };

  const toggleSttWithErrorHandling = async () => {
    // If STT is currently listening, stop immediately and process existing audio
    if (sttListening.value) {
      try {
        wasManuallyStopped.value = true;
        isProcessingInBackground.value = true; // Start background processing

        // Stop STT immediately to prevent new input
        await stopStt();

        // Wait a bit for any pending results to be processed
        setTimeout(async () => {
          if (isProcessingInBackground.value && hasValidText.value) {
            // Process the existing text and send message
            isProcessingInBackground.value = false;
            await handleSttMessage();
          } else if (isProcessingInBackground.value) {
            // No valid text, just reset the state
            isProcessingInBackground.value = false;
          }
        }, 1000); // Wait 1 second for final results
      } catch (error) {
        addAlert("Failed to stop speech recognition. Please try again.");
        isProcessingInBackground.value = false; // Reset on error
      }
      return;
    }

    // If trying to start STT, check requirements and prevent if already active
    if (!validateSttRequirements()) return;

    // Prevent starting STT if we're in the middle of stopping (only check graceful stopping now)
    if (isGracefullyStopping.value) {
      addAlert("Please wait for the current process to complete.");
      return;
    }

    try {
      await toggleStt();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("permission denied")) {
        addAlert(
          "Microphone permission denied. Please allow microphone access and try again."
        );
      } else {
        addAlert("Failed to start speech recognition. Please try again.");
      }
    }
  };

  // Watchers
  watch(sttError, (error) => {
    if (error) {
      handleSttError(error);
    } else {
      consecutiveSttErrors.value = 0;
    }
  });

  watch(sttListening, (isListening) => {
    if (isListening) {
      isWaitingForSttCompletion.value = true;
      consecutiveSttErrors.value = 0;
      wasManuallyStopped.value = false;
      messageSent.value = false; // Reset flag when starting to listen
      isProcessingInBackground.value = false; // Reset background processing flag
      resetSpeechDetection();
    } else {
      // When STT stops, reset all stopping states and speech detection
      resetSpeechDetection();
      isGracefullyStopping.value = false;
      isAutoStopping.value = false;
    }
  });

  watch(
    [sttListening, isFinal, textStorage],
    async ([isListening, isFinalResult, prompt]) => {
      if (
        !isListening &&
        isWaitingForSttCompletion.value &&
        hasValidText.value &&
        !wasManuallyStopped.value // Don't auto-send if manually stopped
      ) {
        // STT stopped naturally and there's valid text - send message and clear text
        isWaitingForSttCompletion.value = false;
        await handleSttMessage();
      } else if (
        !isListening &&
        isWaitingForSttCompletion.value &&
        !wasManuallyStopped.value
      ) {
        // STT stopped naturally without valid text
        isWaitingForSttCompletion.value = false;
      }
    }
  );

  watch(result, (newResult) => {
    if (newResult) {
      if (!hasSpeechBeenDetected.value) {
        hasSpeechBeenDetected.value = true;
      }
    }
  });

  return {
    // State
    sttSupported,
    sttListening,
    isWaitingForSttCompletion,
    isSttDisabled,
    isGracefullyStopping,
    wasManuallyStopped,
    isProcessingInBackground,

    // Computed properties
    canStartStt,
    isSttActive,
    hasValidText,

    // Methods
    stopStt,
    toggleStt,
    toggleSttWithErrorHandling,
    handleSttMessage,

    // Configuration
    silenceThreshold: SILENCE_THRESHOLD,
    maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS,
  };
};
