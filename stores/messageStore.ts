import { StorageSerializers, useStorage } from "@vueuse/core";
import { v4 as uuid } from "uuid";
import type { Optional } from "~/types/types";
import { SupportedLang } from "~/utils/constants";

interface ConversationMessage {
  text?: string;
  translation?: string;
  type: string;
  isLoading?: boolean;
  isComplete?: boolean;
}

export interface BotMessage extends ConversationMessage {
  // swap with actual audio format or way to store audio
  audio?: string;
  type: "bot";
}

export interface UserMessage extends ConversationMessage {
  // swap with actual audio format or way to store audio
  audio?: string;
  type: "user";
  feedback?: string;
}

// Stores user and bot messages
export const useMessageStore = defineStore("messages", () => {
  // JWT to access CreateAI Platform
  const appStore = useAppStore();
  const messages = useStorage<Map<string, UserMessage | BotMessage> | null>(
    "lb-messages",
    new Map(),
    window !== undefined ? sessionStorage : undefined,
    { mergeDefaults: true, serializer: StorageSerializers.map }
  );

  // Store conversation ID for current session
  const conversationId = useStorage<string | null>(
    "lb-conversation-id",
    null,
    window !== undefined ? sessionStorage : undefined,
    { mergeDefaults: true }
  );
  const minRequiredPair = ref<number | null>(null);
  const maxResponsePair = ref<number | null>(null);
  const isSubmitted = ref<boolean>(false);
  const isSubmitting = ref<boolean>(false);
  const submitSuccess = ref<boolean>(false);

  const responsePairCount = computed(() => {
    if (!messages.value?.size) return 0;

    let validUserCount = 0;
    let validBotCount = 0;

    for (const [, message] of messages.value.entries()) {
      if (message.type === "user") {
        validUserCount += 1;
      } else if (
        message.type === "bot" &&
        !(
          typeof message.text === "string" &&
          message.text.includes("Message failed")
        )
      ) {
        validBotCount += 1;
      }
    }

    // Only count pairs where both user and valid bot message exist
    return Math.min(validUserCount, validBotCount);
  });

  // Track messages waiting for feedback
  const messagesWaitingForFeedback = ref<Set<string>>(new Set());

  // Track messages with errors
  const messagesWithErrors = ref<Set<string>>(new Set());

  // Track which messages have updated feedback
  const feedbackUpdated = ref<Set<string>>(new Set());

  // Track which TTS requests have completed (for loader clearing)
  const ttsCompleted = ref<Set<string>>(new Set());

  // Track which messages are currently playing audio with speed info
  const audioPlaying = ref<Map<string, "normal" | "slow">>(new Map());

  // Shared retry counter for bot messages
  const retryCount = ref(0);

  const translationState = ref<
    Map<string, { error?: string; isLoading: boolean }>
  >(new Map());

  // Feedback state management (mirroring translation pattern)
  const feedbackState = ref<
    Map<string, { error?: string; isLoading: boolean }>
  >(new Map());

  // suggestion begin
  const suggestion = ref<{
    error?: string;
    isLoading: boolean;
    data: string;
  }>({ isLoading: false, data: "", error: undefined });

  const setSuggestion = (value: string) => {
    suggestion.value = {
      isLoading: suggestion.value.isLoading, // Preserve current loading state
      data: suggestion.value.data + value,
      error: suggestion.value.error,
    };
  };

  const clearSuggestion = () => {
    suggestion.value = { isLoading: false, data: "", error: undefined };
  };

  const getSuggestion = () => {
    return suggestion.value;
  };

  const setIsSuggestionLoading = (isLoading: boolean) => {
    suggestion.value = {
      isLoading,
      data: suggestion.value?.data || "",
      error: suggestion.value?.error,
    };
  };

  const setSuggestionError = (error: string) => {
    suggestion.value = {
      error,
      isLoading: false,
      data: "",
    };
  };
  // suggestion end

  // Computed: true if any bot message is loading and not complete
  const isBotResponding = computed(() => {
    if (!messages.value) {
      return false;
    }

    // Check all bot messages to see if any are currently loading
    for (const message of messages.value.values()) {
      if (message.type === "bot") {
        if (message.isLoading === true) {
          return true;
        }
      }
    }

    return false;
  });

  // Set Max Response Pair
  const setMaxResponsePair = (max: number) => {
    maxResponsePair.value = max;
  };

  // Set Min Required Pair
  const setMinRequiredPair = (min: number) => {
    minRequiredPair.value = min;
  };

  // Used to create a new message
  const createMessage = (
    type: "bot" | "user",
    args?: {
      data: Optional<UserMessage, "type"> | Optional<BotMessage, "type">;
      id?: string;
    }
  ): string => {
    if (!messages.value)
      messages.value = new Map<string, UserMessage | BotMessage>();

    const id = args?.id || uuid();
    messages.value.set(id, {
      ...args?.data,
      type,
    } satisfies UserMessage | BotMessage);
    return id;
  };

  // Track feedback request
  const addFeedbackRequest = (messageId: string) => {
    messagesWaitingForFeedback.value.add(messageId);
    // Also update the new feedback state system
    setIsFeedbackLoading(messageId, true);

    setTimeoutForOperation(`feedback-${messageId}`, () => {
      messagesWaitingForFeedback.value.delete(messageId);
      addMessageError(messageId);
      const appStore = useAppStore();
      appStore.addAlert("Feedback request timed out. Please try again.");
    });
  };

  // Check if message is waiting for feedback
  const isWaitingForFeedback = (messageId: string) => {
    const state = feedbackState.value.get(messageId);
    return state?.isLoading === true;
  };

  // Check if message is waiting for translation
  const isWaitingForTranslation = (messageId: string) => {
    const state = translationState.value.get(messageId);
    return state?.isLoading === true;
  };

  // Remove feedback request when feedback is received
  const removeFeedbackRequest = (messageId: string) => {
    messagesWaitingForFeedback.value.delete(messageId);
    clearTimeoutForOperation(`feedback-${messageId}`);
    // Also update the new feedback state system
    setIsFeedbackLoading(messageId, false);
  };

  // Add error state for a message
  const addMessageError = (messageId: string) => {
    messagesWithErrors.value.add(messageId);
  };

  // Remove error state for a message
  const removeMessageError = (messageId: string) => {
    messagesWithErrors.value.delete(messageId);
  };

  // Check if message has an error
  const hasMessageError = (messageId: string) => {
    return messagesWithErrors.value.has(messageId);
  };

  // Unified timeout management
  const TIMEOUT_DURATION = 2 * 60 * 1000; // 2 minutes
  const timeouts = new Map<string, NodeJS.Timeout>();

  // Helper function to set timeout
  const setTimeoutForOperation = (
    operationId: string,
    callback: () => void
  ) => {
    const existingTimeout = timeouts.get(operationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      callback();
      timeouts.delete(operationId);
    }, TIMEOUT_DURATION);

    timeouts.set(operationId, timeout);
  };

  // Helper function to clear timeout
  const clearTimeoutForOperation = (operationId: string) => {
    const timeout = timeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(operationId);
    }
  };

  // Mark message as loading
  const setMessageLoading = (messageId: string, isLoading: boolean) => {
    if (!messages.value) return;
    const message = messages.value.get(messageId);
    if (message) {
      message.isLoading = isLoading;
      messages.value.set(messageId, message);

      if (isLoading) {
        setTimeoutForOperation(`message-${messageId}`, () => {
          message.isLoading = false;
          messages.value?.set(messageId, message);
          addMessageError(messageId);
        });
      } else {
        clearTimeoutForOperation(`message-${messageId}`);
      }
    }
  };

  // Mark message as complete
  const setMessageComplete = (messageId: string, isComplete: boolean) => {
    if (!messages.value) return;
    const message = messages.value.get(messageId);
    if (message) {
      message.isComplete = isComplete;
      message.isLoading = false; // Stop loading when complete
      messages.value.set(messageId, message);

      // Clear timeout when message is complete
      clearTimeoutForOperation(`message-${messageId}`);
    }
  };

  const updateMessage = (
    id: string,
    data: UserMessage | BotMessage,
    args: { overwrite?: boolean } = { overwrite: false }
  ) => {
    const { overwrite } = args;

    if (!messages.value) {
      messages.value = new Map<string, UserMessage | BotMessage>();
    }

    const message = messages.value.get(id);

    // Create new message if it doesn't exist
    if (!message) {
      messages.value.set(id, {
        ...data,
        type: data.type,
      } satisfies UserMessage | BotMessage);
      return;
    }

    // Update existing message
    const newMessage = { ...message };

    for (const [key, value] of Object.entries(data)) {
      // Skip type field and undefined values, but allow false, 0, empty string
      if (key === "type" || value === undefined) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentValue = (newMessage as any)[key];

      if (overwrite || key === "requestType" || key === "audio") {
        // Always overwrite for requestType, audio, or when overwrite flag is true
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newMessage as any)[key] = value;
      } else if (!currentValue) {
        // Set value if it doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newMessage as any)[key] = value;
      } else {
        // Concatenate with existing value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newMessage as any)[key] += value;
      }
    }

    // Force reactivity by creating a new Map reference
    const newMessages = new Map(messages.value);
    newMessages.set(id, newMessage);
    messages.value = newMessages;

    // If this is a user message and feedback is present, mark as updated
    if (newMessage.type === "user" && newMessage.feedback) {
      feedbackUpdated.value.add(id);
    }
  };

  const getMessage = (messageId: string) => {
    return messages.value?.get(messageId);
  };

  const clearMessages = () => {
    messages.value?.clear();
    conversationId.value = null;
  };

  // Function to set conversation ID
  const setConversationId = (id: string) => {
    conversationId.value = id;
  };

  // Function to get conversation ID
  const getConversationId = () => {
    return conversationId.value;
  };

  watch(
    [responsePairCount, minRequiredPair, isBotResponding],
    async ([responsePairCount, minRequiredPair, isBotResponding]) => {
      if (!isBotResponding && minRequiredPair) {
        const newProgress = (responsePairCount / minRequiredPair) * 100;
        // waiting for appStore to load
        await nextTick();
        appStore.updateProgress(newProgress);
      }
    },
    { immediate: true }
  );

  // Clear feedback updated flag for a message
  const clearFeedbackUpdated = (messageId: string) => {
    feedbackUpdated.value.delete(messageId);
  };

  // TTS completion tracking functions
  const markTTSCompleted = (messageId: string) => {
    ttsCompleted.value.add(messageId);
  };

  const isTTSCompleted = (messageId: string): boolean => {
    return ttsCompleted.value.has(messageId);
  };

  const clearTTSCompleted = (messageId: string) => {
    ttsCompleted.value.delete(messageId);
  };

  // Audio playing state functions
  const setAudioPlaying = (
    messageId: string,
    isPlaying: boolean,
    speed?: "normal" | "slow"
  ) => {
    if (isPlaying && speed) {
      audioPlaying.value.set(messageId, speed);
    } else {
      audioPlaying.value.delete(messageId);
    }
  };

  const isAudioPlaying = (
    messageId: string,
    speed?: "normal" | "slow"
  ): boolean => {
    if (speed) {
      return audioPlaying.value.get(messageId) === speed;
    }
    return audioPlaying.value.has(messageId);
  };

  const getAudioPlayingSpeed = (
    messageId: string
  ): "normal" | "slow" | undefined => {
    return audioPlaying.value.get(messageId);
  };

  const clearAudioPlaying = (messageId: string) => {
    audioPlaying.value.delete(messageId);
  };

  const clearAllAudioPlaying = () => {
    audioPlaying.value.clear();
  };

  // Set translation value for a message
  const setIsTranslationLoading = (messageId: string, isLoading: boolean) => {
    translationState.value.set(messageId, {
      error: undefined,
      isLoading,
    });

    if (isLoading) {
      setTimeoutForOperation(`translation-${messageId}`, () => {
        translationState.value.set(messageId, {
          isLoading: false,
          error: "Translation timed out. Please try again.",
        });
      });
    } else {
      clearTimeoutForOperation(`translation-${messageId}`);
    }
  };

  // Set translation error for a message
  const setTranslationError = (messageId: string, error: string) => {
    translationState.value.set(messageId, {
      error,
      isLoading: false,
    });
  };

  // Get translation error for a message
  const getTranslationState = (messageId: string) => {
    return translationState.value.get(messageId);
  };

  // Clear translation error for a message
  const clearTranslationError = (messageId: string) => {
    translationState.value.delete(messageId);
  };

  // Set translation loading with timeout for WebSocket operations
  const setTranslationLoadingWithTimeout = (messageId: string) => {
    setIsTranslationLoading(messageId, true);

    setTimeoutForOperation(`translation-ws-${messageId}`, () => {
      setIsTranslationLoading(messageId, false);
      setTranslationError(
        messageId,
        "Translation timed out. Please try again."
      );
      const appStore = useAppStore();
      appStore.addAlert("Translation request timed out. Please try again.");
    });
  };

  // Clear translation timeout when translation is received
  const clearTranslationTimeout = (messageId: string) => {
    clearTimeoutForOperation(`translation-ws-${messageId}`);
  };

  // Set feedback loading for a message
  const setIsFeedbackLoading = (messageId: string, isLoading: boolean) => {
    feedbackState.value.set(messageId, {
      error: undefined,
      isLoading,
    });

    if (isLoading) {
      setTimeoutForOperation(`feedback-${messageId}`, () => {
        feedbackState.value.set(messageId, {
          isLoading: false,
          error: "Feedback request timed out. Please try again.",
        });
        const appStore = useAppStore();
        appStore.addAlert("Feedback request timed out. Please try again.");
      });
    }
  };

  const setFeedbackError = (messageId: string, error: string) => {
    feedbackState.value.set(messageId, {
      error,
      isLoading: false,
    });
  };

  // Get feedback state for a message
  const getFeedbackState = (messageId: string) => {
    return feedbackState.value.get(messageId);
  };

  // Clear feedback error for a message
  const clearFeedbackError = (messageId: string) => {
    feedbackState.value.delete(messageId);
  };

  // Set feedback loading with timeout
  const setFeedbackLoadingWithTimeout = (messageId: string) => {
    setIsFeedbackLoading(messageId, true);
    setTimeoutForOperation(`feedback-ws-${messageId}`, () => {
      setFeedbackError(
        messageId,
        "Feedback request timed out. Please try again."
      );
      const appStore = useAppStore();
      appStore.addAlert("Feedback request timed out. Please try again.");
    });
  };

  const clearFeedbackTimeout = (messageId: string) => {
    clearTimeoutForOperation(`feedback-ws-${messageId}`);
  };

  // Helper function to find the most recent loading bot message
  const getMostRecentLoadingBotMessage = () => {
    if (!messages.value) return null;

    // Since Map maintains insertion order, the last entry is the most recent
    let mostRecentId: string | null = null;

    for (const [id, message] of messages.value.entries()) {
      if (message.type === "bot" && message.isLoading) {
        mostRecentId = id;
      }
    }

    return mostRecentId;
  };

  // Shared retry function for bot messages
  const retryBotMessage = async (
    messageId: string,
    appStore: ReturnType<typeof useAppStore>
  ) => {
    try {
      // Check retry limit
      if (retryCount.value >= 3) {
        appStore.addAlert("Max retry limit hit. start new session");
        return false;
      }

      // Increment retry counter
      retryCount.value++;

      // Find the user message that preceded this bot message
      const messagesMap = messages.value ?? new Map();
      if (!messagesMap) {
        appStore.addAlert("Unable to retry. Please try sending a new message.");
        return false;
      }

      // Find the user message that should trigger this bot response
      let userMessageId: string | null = null;
      let userMessageText: string | null = null;

      // Look for the most recent user message before this bot message
      for (const [id, msg] of messagesMap.entries()) {
        if (msg.type === "user" && msg.text) {
          userMessageId = id;
          userMessageText = msg.text;
        }
        if (id === messageId) {
          break; // Stop when we reach the bot message
        }
      }

      if (!userMessageId || !userMessageText) {
        appStore.addAlert("Unable to retry. Please try sending a new message.");
        return false;
      }

      // Get actual user ID from Canvas
      const userId = appStore.getUserId();
      if (!userId) {
        appStore.addAlert("Unable to get user ID from Canvas");
        return false;
      }

      // Clear the error state for the bot message
      removeMessageError(messageId);

      // Update the bot message to show it's loading and clear any error text
      updateMessage(
        messageId,
        {
          type: "bot",
          text: "", // Clear any existing text including "Message failed"
          isComplete: false,
        },
        { overwrite: true }
      ); // Use overwrite to ensure text is completely replaced

      // Set loading state with timeout
      setMessageLoading(messageId, true);

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      // Resend the original user message to trigger a new bot response
      appStore.sendWS(
        JSON.stringify({
          event_type: "EVENT_TEXT_START",
          user_id: userId,
          conversation_id: getConversationId() as string,
          message_id: userMessageId,
          selectedTemplate,
          data: {
            request_type: "user-text",
            text: userMessageText,
            language: SupportedLang.ENGLISH,
            bot_message_id: messageId,
          },
        })
      );
      return true;
    } catch (error) {
      console.error("Error retrying bot message:", error);
      // Clear loading state on error
      setMessageLoading(messageId, false);
      addMessageError(messageId);
      appStore.addAlert("Failed to retry. Please try again later.");
      return false;
    }
  };

  // Reset retry counter when bot response completes successfully
  const resetRetryCount = () => {
    // Only reset retry count if there are no messages with errors
    if (messagesWithErrors.value.size === 0) {
      retryCount.value = 0;
    }
  };

  // Handle successful bot response completion
  const handleBotResponseSuccess = (messageId: string) => {
    // Remove error state for this message
    removeMessageError(messageId);
    // Reset retry counter since the response was successful
    retryCount.value = 0;
  };

  return {
    messages,
    getMessage,
    createMessage,
    updateMessage,
    clearMessages,
    responsePairCount,
    maxResponsePair,
    setConversationId,
    getConversationId,
    conversationId,
    addFeedbackRequest,
    isWaitingForFeedback,
    isWaitingForTranslation,
    removeFeedbackRequest,
    setMessageLoading,
    setMessageComplete,
    isBotResponding,
    addMessageError,
    removeMessageError,
    hasMessageError,
    feedbackUpdated,
    clearFeedbackUpdated,
    ttsCompleted,
    markTTSCompleted,
    isTTSCompleted,
    clearTTSCompleted,
    audioPlaying,
    setAudioPlaying,
    isAudioPlaying,
    getAudioPlayingSpeed,
    clearAudioPlaying,
    clearAllAudioPlaying,
    setIsTranslationLoading,
    setTranslationLoadingWithTimeout,
    clearTranslationTimeout,
    setTranslationError,
    getTranslationState,
    clearTranslationError,
    setIsFeedbackLoading,
    setFeedbackLoadingWithTimeout,
    clearFeedbackTimeout,
    setFeedbackError,
    getFeedbackState,
    clearFeedbackError,
    getMostRecentLoadingBotMessage,
    retryBotMessage,
    isSubmitted,
    isSubmitting,
    submitSuccess,
    setMaxResponsePair,
    setMinRequiredPair,
    minRequiredPair,
    retryCount,
    resetRetryCount,
    handleBotResponseSuccess,
    suggestion,
    setSuggestion,
    getSuggestion,
    setIsSuggestionLoading,
    setSuggestionError,
    clearSuggestion,
  };
});
