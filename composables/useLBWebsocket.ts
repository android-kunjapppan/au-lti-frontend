import { useWebSocket, type RemovableRef } from "@vueuse/core";
import { computed, onBeforeUnmount, watch } from "vue";
import { useContentKey } from "~/composables/useContentKey";
import { useAppStore } from "~/stores/appStore";
import { useMessageStore } from "~/stores/messageStore";
import { useAudioStore } from "~/stores/useAudioStore";
import { useChatbotStore } from "~/stores/useChatbotStore";
import type {
  ConversationEndWebSocketResponseData,
  ConversationStartWebSocketResponseData,
  FeedbackWebSocketResponseData,
  SuggestionWebSocketResponseData,
  TextEndWebSocketResponseData,
  TranslationWebSocketResponseData,
  UserTextWebSocketResponseData,
  WebSocketResponse,
} from "~/types/types";
import {
  ERROR_MESSAGES,
  WEBSOCKET_CONFIG,
  WebSocketEventType,
  WebSocketResponseType,
  WebSocketTextRequestType,
} from "~/utils/constants";

// Type for error response data
interface WebSocketErrorResponseData {
  message_id?: string;
  response_type?: string;
}

// Type for error WebSocket response
interface WebSocketErrorResponse {
  type: "error";
  code: number;
  event_type: string;
  data: WebSocketErrorResponseData;
  message: string;
}

type WebSocketTextMessageData =
  | UserTextWebSocketResponseData
  | TranslationWebSocketResponseData
  | FeedbackWebSocketResponseData
  | SuggestionWebSocketResponseData
  | TextEndWebSocketResponseData;

type WebSocketMessageData =
  | WebSocketTextMessageData
  | ConversationStartWebSocketResponseData
  | ConversationEndWebSocketResponseData;

// Type for parsed WebSocket message
type ParsedWebSocketMessage =
  | WebSocketResponse<WebSocketMessageData>
  | WebSocketErrorResponse
  | "ping"
  | "pong";

// Error handling helper
const handleWebSocketError = (
  messageId: string | undefined,
  responseType: string | undefined,
  appStore: ReturnType<typeof useAppStore>,
  messageStore: ReturnType<typeof useMessageStore>,
  clearTTSRequest?: (messageId: string) => void
) => {
  if (!messageId) {
    appStore.addAlert("An unexpected error occurred. Please try again later.");
    // Clear any active TTS requests since we can't identify the specific message (with delay)
    setTimeout(() => {
      appStore.clearAllTTSRequests();
    }, 1000);
    // Clear suggestion loading state since it's global (with delay)
    setTimeout(() => {
      messageStore.setIsSuggestionLoading(false);
    }, 1000);
    // Clear submit loading state since it's global (with delay)
    setTimeout(() => {
      messageStore.isSubmitting = false;
    }, 1000);
    // Clear any active bot message loading states (with delay)
    const mostRecentLoadingBotMessageId =
      messageStore.getMostRecentLoadingBotMessage();
    if (mostRecentLoadingBotMessageId) {
      setTimeout(() => {
        messageStore.setMessageComplete(mostRecentLoadingBotMessageId, false);
      }, 1000);
    }
    return;
  }

  if (!responseType) {
    appStore.addAlert("Something went wrong. Try again later.");
    // Clear TTS request tracking if this was a TTS request
    if (messageId && appStore.ttsRequestMessageIds?.has(messageId)) {
      appStore.clearTTSRequest(messageId);
    }
    return;
  }

  switch (responseType) {
    case WebSocketTextRequestType.USER_TEXT:
      appStore.addAlert("Failed to send message. Please try again.");
      // Clear STT text buffer when user text fails
      appStore.userPrompt = "";
      // Don't clear TTS requests for user text errors - let TTS requests complete normally
      break;
    case WebSocketTextRequestType.TRANSLATION:
      appStore.addAlert(ERROR_MESSAGES.TRANSLATION);
      messageStore.setTranslationError(messageId, ERROR_MESSAGES.TRANSLATION);
      messageStore.clearTranslationTimeout(messageId);
      break;
    case WebSocketTextRequestType.FEEDBACK:
      appStore.addAlert(ERROR_MESSAGES.FEEDBACK);
      messageStore.setFeedbackError(messageId, ERROR_MESSAGES.FEEDBACK);
      messageStore.clearFeedbackTimeout(messageId);
      break;
    case WebSocketTextRequestType.SUGGESTION:
      appStore.addAlert("Failed to get suggestion. Please try again.");
      messageStore.setSuggestionError(
        "Failed to get suggestion. Please try again."
      );
      break;
    case WebSocketTextRequestType.TTS:
      messageStore.setTTSError(
        messageId,
        "Failed to generate audio. Please try again."
      );
      break;
    default:
      appStore.addAlert("Something went wrong, please try again later.");
      // Clear TTS request tracking if this was a TTS request
      if (messageId && appStore.ttsRequestMessageIds?.has(messageId)) {
        appStore.clearTTSRequest(messageId);
      }
      break;
  }
};

// Helper function to handle unexpected errors and mark bot messages as failed
const handleUnexpectedError = (
  appStore: ReturnType<typeof useAppStore>,
  messageStore: ReturnType<typeof useMessageStore>
) => {
  const mostRecentLoadingBotMessageId =
    messageStore.getMostRecentLoadingBotMessage();
  if (mostRecentLoadingBotMessageId) {
    messageStore.addMessageError(mostRecentLoadingBotMessageId);
    messageStore.setMessageComplete(mostRecentLoadingBotMessageId, false);
    messageStore.updateMessage(mostRecentLoadingBotMessageId, {
      type: "bot",
      text: "Message failed",
    });
  }
  appStore.addAlert("An unexpected error occurred. Please try again later.");
};

// Utility function to clear all loading states when WebSocket connection fails
const clearAllLoadingStates = (
  appStore: ReturnType<typeof useAppStore>,
  messageStore: ReturnType<typeof useMessageStore>
) => {
  // Clear TTS play button loaders with delay
  setTimeout(() => {
    appStore.clearAllTTSRequests();
  }, 1000);

  // Clear suggestion (Get Tip) loaders (with delay)
  setTimeout(() => {
    messageStore.setIsSuggestionLoading(false);
  }, 1000);

  // Clear submit loaders (with delay)
  setTimeout(() => {
    messageStore.isSubmitting = false;
  }, 1000);

  // Clear any active bot message loading states and mark as failed for retry (with delay)
  const mostRecentLoadingBotMessageId =
    messageStore.getMostRecentLoadingBotMessage();
  if (mostRecentLoadingBotMessageId) {
    messageStore.addMessageError(mostRecentLoadingBotMessageId);
    setTimeout(() => {
      messageStore.setMessageComplete(mostRecentLoadingBotMessageId, false);
      messageStore.updateMessage(mostRecentLoadingBotMessageId, {
        type: "bot",
        text: "Message failed",
      });
    }, 1000);
  }

  // Clear all feedback and translation loading states by iterating through all messages
  if (messageStore.messages) {
    for (const [messageId] of messageStore.messages.entries()) {
      // Clear feedback loading state for this message and set error (without adding alert)
      const feedbackState = messageStore.getFeedbackState(messageId);
      if (feedbackState?.isLoading) {
        messageStore.setFeedbackError(
          messageId,
          "Connection failed. Unable to get feedback at this time.",
          false // Don't add alert
        );
      }

      // Clear translation loading state for this message and set error (without adding alert)
      const translationState = messageStore.getTranslationState(messageId);
      if (translationState?.isLoading) {
        messageStore.setTranslationError(
          messageId,
          "Connection failed. Unable to translate at this time.",
          false // Don't add alert
        );
      }
    }
  }
};

// Helps setup and send messages to the conversation websocket
export const useLBWebSocket = (
  accessToken: Ref<string> | RemovableRef<string | null>
) => {
  const runtimeConfig = useRuntimeConfig();
  const messageStore = useMessageStore();
  const appStore = useAppStore();
  const { generateContentKey } = useContentKey();

  // Store accumulated audio data for the current bot message
  const currentBotAudioData = ref<BackendAudioResponse[]>([]);

  // Track the current bot message ID being processed
  const currentBotMessageId = ref<string | null>(null);

  // Track TTS request message IDs
  const ttsRequestMessageIds = ref<Map<string, "normal" | "slow">>(new Map());

  // Function to track TTS request
  const trackTTSRequest = (messageId: string, speed: "normal" | "slow") => {
    ttsRequestMessageIds.value.set(messageId, speed);
  };

  // Function to clear TTS request tracking
  const clearTTSRequest = (messageId: string) => {
    ttsRequestMessageIds.value.delete(messageId);
  };

  // Function to clear all TTS request tracking
  const clearAllTTSRequests = () => {
    ttsRequestMessageIds.value.clear();
  };

  // Function to set current bot message ID
  const setCurrentBotMessageId = (messageId: string) => {
    currentBotMessageId.value = messageId;
  };

  // Function to clear current bot message ID
  const clearCurrentBotMessageId = () => {
    currentBotMessageId.value = null;
  };

  // Track delayed finalization
  const finalizationTimeout = ref<NodeJS.Timeout | null>(null);

  // Track audio chunk arrival to ensure we have all chunks before finalizing
  const audioChunkTracker = ref<{
    messageId: string | null;
    expectedChunks: number;
    receivedChunks: number;
    lastChunkTime: number;
    isFinalizing: boolean;
  }>({
    messageId: null,
    expectedChunks: 0,
    receivedChunks: 0,
    lastChunkTime: 0,
    isFinalizing: false,
  });

  // Function to concatenate multiple audio chunks into a single audio buffer
  const concatenateAudioChunks = (
    audioChunks: BackendAudioResponse[]
  ): BackendAudioResponse => {
    if (audioChunks.length === 0) {
      throw new Error("No audio chunks to concatenate");
    }

    if (audioChunks.length === 1) {
      return audioChunks[0];
    }

    // Use a more efficient method to avoid stack overflow with large arrays
    const totalLength = audioChunks.reduce(
      (sum, chunk) => sum + chunk.data.length,
      0
    );
    const concatenatedData = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of audioChunks) {
      // Ensure chunk.data is a regular array, not Uint8Array
      const dataArray: number[] = Array.isArray(chunk.data)
        ? chunk.data
        : Array.from(chunk.data);
      concatenatedData.set(dataArray, offset);
      offset += dataArray.length;
    }

    return {
      type: "Buffer" as const,
      data: Array.from(concatenatedData),
    };
  };

  // Helper function to set finalization timeout
  const setFinalizationTimeout = (messageId: string): void => {
    // Clear any existing timeout
    if (finalizationTimeout.value) {
      clearTimeout(finalizationTimeout.value);
    }

    // Calculate delay and set new timeout
    const audioChunkCount = currentBotAudioData.value.length;
    const finalizationDelay = Math.max(1500, audioChunkCount * 500); // At least 1.5 seconds, +0.5 seconds per chunk

    finalizationTimeout.value = setTimeout(() => {
      finalizeBotMessage(messageId);
      finalizationTimeout.value = null;
    }, finalizationDelay);
  };

  // Function to finalize bot message with accumulated audio data
  const finalizeBotMessage = async (messageId: string) => {
    // Prevent multiple finalizations for the same message
    if (
      audioChunkTracker.value.isFinalizing &&
      audioChunkTracker.value.messageId === messageId
    ) {
      return;
    }

    // Handle successful completion
    messageStore.handleBotResponseSuccess(messageId);

    // Mark as finalizing to prevent race conditions
    audioChunkTracker.value.isFinalizing = true;

    // Clear current bot message tracking
    currentBotMessageId.value = null;

    // Handle audio saving FIRST, then mark as complete
    try {
      if (currentBotAudioData.value.length > 0) {
        const concatenatedAudioData = concatenateAudioChunks(
          currentBotAudioData.value
        );

        // Ensure the audio data is properly serializable for IndexedDB
        const serializableAudioData: BackendAudioResponse = {
          type: "Buffer" as const,
          data: Array.isArray(concatenatedAudioData.data)
            ? concatenatedAudioData.data
            : Array.from(concatenatedAudioData.data),
        };

        const audioStore = useAudioStore();
        // Get the message text to create a content key for content-based lookup
        const message = messageStore.getMessage(messageId);
        const contentKey = generateContentKey(message?.text);

        // Save audio to IndexedDB (BLOCKING - wait for completion)
        const savedSuccessfully = await audioStore.saveAudio(
          messageId,
          serializableAudioData,
          contentKey
        );

        if (!savedSuccessfully) {
          console.warn(
            `⚠️ Failed to save audio to IndexedDB for message ${messageId}`
          );
        }

        messageStore.updateMessage(
          messageId,
          {
            type: "bot",
            audio: savedSuccessfully ? "stored" : undefined,
          },
          { overwrite: true }
        );

        // Mark TTS as completed to trigger loader clearing
        messageStore.markTTSCompleted(messageId);

        // Safari-specific: Mark audio as complete for immediate playback
        const chatbotStore = useChatbotStore();
        if (chatbotStore.ttsAudioManager.markSafariAudioComplete) {
          await chatbotStore.ttsAudioManager.markSafariAudioComplete(messageId);
        }

        // Clear accumulated audio data
        currentBotAudioData.value = [];
      } else {
        // Still mark TTS as completed even if no audio data to finalize
        // This ensures loaders get cleared for messages that were processed by TTS audio manager
        messageStore.markTTSCompleted(messageId);

        // Safari-specific: Mark audio as complete even without audio data
        const chatbotStore = useChatbotStore();
        if (chatbotStore.ttsAudioManager.markSafariAudioComplete) {
          await chatbotStore.ttsAudioManager.markSafariAudioComplete(messageId);
        }
      }

      messageStore.setMessageComplete(messageId, true);

      // Clear current bot message tracking
      currentBotMessageId.value = null;

      // Reset audio chunk tracker
      audioChunkTracker.value = {
        messageId: null,
        expectedChunks: 0,
        receivedChunks: 0,
        lastChunkTime: 0,
        isFinalizing: false,
      };
    } catch (error) {
      console.error(`❌ Error finalizing bot message ${messageId}:`, error);
      audioChunkTracker.value.isFinalizing = false;
    }
  };

  // Function to check if we should wait for more audio chunks
  const shouldWaitForMoreChunks = (messageId: string): boolean => {
    const timeSinceLastChunk =
      Date.now() - audioChunkTracker.value.lastChunkTime;
    const chunkCount = currentBotAudioData.value.length;

    // If we received a chunk very recently (< 2 seconds), wait longer
    if (timeSinceLastChunk < 2000) {
      return true;
    }

    // If we have very few chunks (< 3), wait longer as ElevenLabs typically sends more
    if (chunkCount < 3) {
      return true;
    }

    // If we have many chunks but received one recently, wait a bit more
    if (chunkCount >= 3 && timeSinceLastChunk < 3000) {
      return true;
    }

    return false;
  };

  // Function to schedule finalization with dynamic timeout based on audio chunk activity
  const scheduleFinalization = (messageId: string) => {
    if (finalizationTimeout.value) {
      clearTimeout(finalizationTimeout.value);
    }

    // Calculate timeout based on audio chunk activity and chunk count
    const timeSinceLastChunk =
      Date.now() - audioChunkTracker.value.lastChunkTime;
    const chunkCount = currentBotAudioData.value.length;

    // Base timeout increases with chunk count (more chunks = longer wait)
    const baseTimeout = Math.max(3000, chunkCount * 500); // At least 3 seconds, +500ms per chunk
    const dynamicTimeout = Math.max(baseTimeout, timeSinceLastChunk + 1500); // At least 1.5 seconds after last chunk

    finalizationTimeout.value = setTimeout(() => {
      // Check if we should wait for more chunks
      if (shouldWaitForMoreChunks(messageId)) {
        scheduleFinalization(messageId); // Reschedule with new timeout
        return;
      }

      // Only finalize if we have audio chunks and haven't finalized yet
      if (
        currentBotAudioData.value.length > 0 &&
        !audioChunkTracker.value.isFinalizing
      ) {
        finalizeBotMessage(messageId);
      }

      finalizationTimeout.value = null;
    }, dynamicTimeout);
  };

  const webSocketUrl = computed(() => {
    return `${runtimeConfig.public.wsUrl}/conversation?access_token=${accessToken.value}`;
  });

  // Track reconnection attempts for exponential backoff
  const reconnectAttempts = ref(0);
  const reconnectTimeout = ref<NodeJS.Timeout | null>(null);
  const isReconnecting = ref(false);

  const {
    status,
    send,
    open: openWs,
    close,
    ws,
  } = useWebSocket(webSocketUrl, {
    immediate: false,
    autoConnect: false,
    autoReconnect: false, // Disable built-in autoReconnect to implement custom logic
    onMessage: async (ws, event) => {
      await processWebSocketMessage(event);
    },
    heartbeat: {
      responseMessage: "ping",
      message: "pong",
      interval: 3000,
      pongTimeout: 3000,
    },
    onDisconnected: (ws, event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      isReconnecting.value = false;

      // Dispatch custom event for ChatMessage components to listen to
      window.dispatchEvent(
        new CustomEvent("websocket-error", {
          detail: { event, code: event.code },
        })
      );

      // Only attempt reconnection if it wasn't a manual close
      if (
        event.code !== 1000 &&
        reconnectAttempts.value < WEBSOCKET_CONFIG.MAX_RETRIES
      ) {
        scheduleReconnect();
      } else if (reconnectAttempts.value >= WEBSOCKET_CONFIG.MAX_RETRIES) {
        console.error("WebSocket reconnection failed after maximum retries");

        // Only show generic websocket error if no specific actions are in progress
        if (!appStore.websocketRequestInProgress) {
          appStore.addAlert(ERROR_MESSAGES.WS_OPEN);
        }

        // Clear all loading states when WebSocket connection fails permanently
        clearAllLoadingStates(appStore, messageStore);
      }
    },
    onError: (ws, event) => {
      console.error("WebSocket error:", event);
      // Dispatch custom event for ChatMessage components to listen to
      const customEvent = new CustomEvent("websocket-error", {
        detail: { event },
      });
      window.dispatchEvent(customEvent);
    },
  });

  // Custom exponential backoff reconnection logic
  const scheduleReconnect = () => {
    // Prevent multiple reconnection attempts
    if (isReconnecting.value) {
      console.log("Reconnection already in progress, skipping...");
      return;
    }

    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value);
    }

    const delay = Math.min(
      WEBSOCKET_CONFIG.RECONNECT_DELAY *
        Math.pow(WEBSOCKET_CONFIG.BACKOFF_MULTIPLIER, reconnectAttempts.value),
      WEBSOCKET_CONFIG.MAX_RECONNECT_DELAY
    );

    console.log(
      `WebSocket reconnection attempt ${reconnectAttempts.value + 1}, delay: ${delay}ms`
    );

    reconnectTimeout.value = setTimeout(() => {
      // Check if we're already connected or connecting
      if (status.value === "OPEN" || status.value === "CONNECTING") {
        console.log(
          "WebSocket already connected or connecting, skipping reconnection"
        );
        return;
      }

      isReconnecting.value = true;
      reconnectAttempts.value++;

      console.log(
        `Attempting to reconnect WebSocket (attempt ${reconnectAttempts.value})`
      );
      openWs();
    }, delay);
  };

  // Reset reconnection attempts on successful connection
  watch(status, (newStatus) => {
    if (newStatus === "OPEN") {
      console.log(
        "WebSocket connected successfully, resetting reconnection state"
      );
      reconnectAttempts.value = 0;
      isReconnecting.value = false;
      if (reconnectTimeout.value) {
        clearTimeout(reconnectTimeout.value);
        reconnectTimeout.value = null;
      }
    } else if (newStatus === "CONNECTING") {
      console.log("WebSocket connecting...");
    } else if (newStatus === "CLOSED") {
      console.log("WebSocket closed");
      isReconnecting.value = false;
    }
  });

  // Process feedback responses
  const processFeedbackResponse = (data: FeedbackWebSocketResponseData) => {
    const originalMessage = messageStore.getMessage(data.message_id);
    if (originalMessage) {
      messageStore.updateMessage(data.message_id, {
        type: originalMessage.type,
        feedback: data.text,
      });
      messageStore.setIsFeedbackLoading(data.message_id, false);
      messageStore.clearFeedbackTimeout(data.message_id);
    }
  };

  // Process final bot response (EVENT_TEXT_END)
  const processBotResponse = (data: TextEndWebSocketResponseData) => {
    // Find the most recent loading bot message to update
    const mostRecentLoadingBotMessageId =
      messageStore.getMostRecentLoadingBotMessage();

    if (mostRecentLoadingBotMessageId) {
      // Update the existing bot message with the final text
      // This ensures we update the same message that was being streamed
      messageStore.updateMessage(
        mostRecentLoadingBotMessageId,
        {
          type: "bot",
          text: data.text,
          isLoading: false,
          isComplete: true,
        },
        {
          overwrite: true,
        }
      );
      // Handle successful completion
      messageStore.handleBotResponseSuccess(mostRecentLoadingBotMessageId);
    } else {
      // Fallback: use backend message_id if no loading message found
      const botMessageId = data.message_id;
      messageStore.updateMessage(
        botMessageId,
        {
          type: "bot",
          text: data.text,
          isLoading: false,
          isComplete: true,
        },
        {
          overwrite: true,
        }
      );
      // Handle successful completion
      messageStore.handleBotResponseSuccess(botMessageId);
    }
  };

  // Process translation responses
  const processTranslationResponse = (
    data: TranslationWebSocketResponseData
  ) => {
    const originalMessage = messageStore.getMessage(data.message_id);
    if (originalMessage) {
      messageStore.updateMessage(data.message_id, {
        type: originalMessage.type,
        translation: data.text,
      });
      messageStore.setIsTranslationLoading(data.message_id, false);
      messageStore.clearTranslationTimeout(data.message_id);
    }
  };

  // Process user text responses (bot message chunks)
  const processUserTextResponse = (data: UserTextWebSocketResponseData) => {
    // For streaming chunks, we need to accumulate the text
    // Find the most recent loading bot message to update
    const mostRecentLoadingBotMessageId =
      messageStore.getMostRecentLoadingBotMessage();

    if (!mostRecentLoadingBotMessageId) {
      return;
    }

    // Get the current message to accumulate text
    const currentMessage = messageStore.getMessage(
      mostRecentLoadingBotMessageId
    );
    const currentText = currentMessage?.text || "";
    const newText = currentText + data.text;

    // Update the existing bot message with accumulated text
    messageStore.updateMessage(
      mostRecentLoadingBotMessageId,
      {
        type: "bot",
        text: newText,
        isLoading: true,
        isComplete: false,
      },
      {
        overwrite: true,
      }
    );

    // Track this as the current bot message
    currentBotMessageId.value = mostRecentLoadingBotMessageId;
  };

  // Process suggestion responses
  const processSuggestionResponse = (data: SuggestionWebSocketResponseData) => {
    messageStore.setSuggestion(data.text, data.message_id);
    // Don't clear loading state here - only clear on EVENT_TEXT_END
  };

  // Process bot response audio (for response_type: "user-text")
  const processBotResponseAudio = (data: WebSocketMessageData) => {
    // Handle bot response audio chunks for immediate playback
    if (
      "audio" in data &&
      typeof data.audio === "string" &&
      "message_id" in data &&
      typeof data.message_id === "string" &&
      "response_type" in data &&
      data.response_type === "user-text"
    ) {
      try {
        // Convert Base64 string to number array
        const base64String = data.audio;
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to BackendAudioResponse format
        const audioData = {
          type: "Buffer" as const,
          data: Array.from(bytes),
        };

        // Get the incoming message ID from the data
        const incomingMessageId = (data as { message_id: string }).message_id;

        // For bot responses, always use the incoming message_id from the data
        const targetMessageId = incomingMessageId;

        if (!targetMessageId) {
          console.error(
            `🎵 No target message ID found for bot response audio. Incoming message_id: ${incomingMessageId}`
          );
          return;
        }

        // Set currentBotMessageId for bot responses to enable proper finalization
        if (!currentBotMessageId.value) {
          currentBotMessageId.value = targetMessageId;
        }

        // Check if the message is already finalized
        const message = messageStore.getMessage(targetMessageId);
        const isMessageFinalized = message && message.isComplete === true;

        // For bot responses, always treat them as loading messages that need audio accumulation
        const shouldAccumulateAudio = !isMessageFinalized;

        if (shouldAccumulateAudio) {
          // Message is still loading, accumulate audio data normally
          // Add size limit to prevent memory issues
          const MAX_ACCUMULATED_CHUNKS = 100;
          if (currentBotAudioData.value.length >= MAX_ACCUMULATED_CHUNKS) {
            console.warn(
              `🎵 Audio accumulation limit reached for message ${targetMessageId}, dropping oldest chunks`
            );
            // Remove oldest chunks to make room
            const excessChunks =
              currentBotAudioData.value.length - MAX_ACCUMULATED_CHUNKS + 1;
            currentBotAudioData.value.splice(0, excessChunks);
          }

          currentBotAudioData.value.push(audioData);

          // Update the tracker with the current message ID and chunk arrival time
          audioChunkTracker.value.messageId = targetMessageId;
          audioChunkTracker.value.lastChunkTime = Date.now();
          audioChunkTracker.value.receivedChunks++;

          // Reset finalization timeout if this is for the current message
          if (targetMessageId) {
            scheduleFinalization(targetMessageId);
          }
        }

        // Use the chatbot store to handle bot response audio playback for immediate avatar lip sync
        const chatbotStore = useChatbotStore();
        chatbotStore.enqueueAudio({
          audio: audioData,
          messageId: targetMessageId || undefined,
          speed: "normal", // Bot responses always play at normal speed
        });
      } catch (error) {
        console.error("Error processing bot response audio data:", error);
      }
    }
  };

  // Process TTS audio responses (for manual TTS requests)
  const processTTSAudioResponse = async (data: WebSocketMessageData) => {
    // Handle TTS audio chunks for avatar lip sync
    if (
      "audio" in data &&
      typeof data.audio === "string" &&
      "message_id" in data &&
      typeof data.message_id === "string"
    ) {
      try {
        // Convert Base64 string to number array
        const base64String = data.audio;
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to BackendAudioResponse format
        const audioData = {
          type: "Buffer" as const,
          data: Array.from(bytes),
        };

        // Get the incoming message ID from the data
        const incomingMessageId = (data as { message_id: string }).message_id;

        // Debug logging

        // For TTS requests, always use the incoming message_id from the data
        // This ensures each TTS request gets its own audio chunks
        const targetMessageId = incomingMessageId;

        // If we have a currentBotMessageId but it's different from the incoming message_id,
        // this is a new TTS request, so clear the old one and start fresh
        if (
          currentBotMessageId.value &&
          currentBotMessageId.value !== incomingMessageId
        ) {
          // Clear any accumulated audio data for the previous message
          currentBotAudioData.value = [];
          currentBotMessageId.value = null;

          // Stop any ongoing TTS audio processing to prevent mixing
          const chatbotStore = useChatbotStore();
          if (chatbotStore.ttsAudioManager.isPlaying) {
            await chatbotStore.ttsAudioManager.stopAudio();
          }
        }

        // For TTS requests, we should always have a targetMessageId from the incoming data
        // If we don't, something is wrong with the request
        if (!targetMessageId) {
          console.error(
            `🎵 No target message ID found for TTS audio. Incoming message_id: ${incomingMessageId}`
          );
          return;
        }

        // Verify this is a valid TTS request by checking if the message ID is in our tracking
        if (!ttsRequestMessageIds.value.has(targetMessageId)) {
          console.warn(
            `🎵 Received TTS audio for untracked message: ${targetMessageId}. Ignoring to prevent audio mixing.`
          );

          // Clear any accumulated audio data for this untracked message
          if (currentBotMessageId.value === targetMessageId) {
            currentBotAudioData.value = [];
            currentBotMessageId.value = null;
          }

          // Don't process audio for untracked messages to prevent mixing
          return;
        }

        // Set currentBotMessageId for TTS requests to enable proper finalization
        if (!currentBotMessageId.value) {
          currentBotMessageId.value = targetMessageId;
        }

        // Check if the message is already finalized
        const message = messageStore.getMessage(targetMessageId);
        const isMessageFinalized = message && message.isComplete === true;

        // For TTS requests, always treat them as loading messages that need audio accumulation
        // Don't treat them as finalized even if they have audio, because we need to accumulate chunks
        const isTTSRequest =
          data && typeof data === "object" && "message_id" in data;
        const shouldAccumulateAudio = !isMessageFinalized || isTTSRequest;

        if (shouldAccumulateAudio) {
          // Message is still loading or this is a TTS request, accumulate audio data normally
          // Add size limit to prevent memory issues
          const MAX_ACCUMULATED_CHUNKS = 100;
          if (currentBotAudioData.value.length >= MAX_ACCUMULATED_CHUNKS) {
            console.warn(
              `🎵 Audio accumulation limit reached for message ${targetMessageId}, dropping oldest chunks`
            );
            // Remove oldest chunks to make room
            const excessChunks =
              currentBotAudioData.value.length - MAX_ACCUMULATED_CHUNKS + 1;
            currentBotAudioData.value.splice(0, excessChunks);
          }

          currentBotAudioData.value.push(audioData);

          // Update the tracker with the current message ID and chunk arrival time
          audioChunkTracker.value.messageId = targetMessageId;
          audioChunkTracker.value.lastChunkTime = Date.now();
          audioChunkTracker.value.receivedChunks++;

          // Reset finalization timeout if this is for the current message
          if (targetMessageId) {
            scheduleFinalization(targetMessageId);
          }
        }

        // Use the chatbot store to handle TTS audio playback for immediate avatar lip sync
        const chatbotStore = useChatbotStore();
        const ttsSpeed = targetMessageId
          ? ttsRequestMessageIds.value.get(targetMessageId)
          : undefined;
        chatbotStore.enqueueAudio({
          audio: audioData,
          messageId: targetMessageId || undefined,
          speed: ttsSpeed,
        });

        // For TTS requests, we don't immediately update the message's audio field
        // Instead, we let the normal accumulation and finalization process handle it
        // The loader will be cleared when the message is finalized and audio is saved to IndexedDB
      } catch (error) {
        console.error("Error processing TTS audio data:", error);
      }
    }
  };

  const handleTextEvent = (
    data: WebSocketTextMessageData,
    eventType?: string
  ) => {
    if (!data?.message_id) {
      return;
    }

    // Handle EVENT_TEXT_END (final complete text) - no response_type needed
    if (!("response_type" in data) || !data.response_type) {
      // Check if this is actually a translation response that came back as EVENT_TEXT_END
      const originalMessage = messageStore.getMessage(data.message_id);

      // If the original message has a translation field and the text matches, this is a translation response
      const isTranslationResponse =
        originalMessage &&
        originalMessage.translation &&
        originalMessage.translation === data.text;

      if (isTranslationResponse) {
        return;
      }

      // Feedback responses are handled by the response_type switch below

      // Handle EVENT_TEXT_END for suggestions - clear loading state
      // IMPORTANT: Only stop loader if this message_id matches the active suggestion request
      // This prevents bot response EVENT_TEXT_END from stopping suggestion loader (race condition fix)
      const activeSuggestionId = messageStore.getActiveSuggestionRequestId();
      if (
        messageStore.getSuggestion().isLoading &&
        activeSuggestionId === data.message_id
      ) {
        messageStore.setIsSuggestionLoading(false);
        return;
      }

      // Check if there are any loading bot messages that need finalization
      // This is a fallback for cases where the original message is not a bot message
      // but we still have loading bot messages that need to be finalized
      const mostRecentLoadingBotMessageId =
        messageStore.getMostRecentLoadingBotMessage();
      if (mostRecentLoadingBotMessageId) {
        // Schedule finalization with delay to ensure all audio chunks arrive
        setFinalizationTimeout(mostRecentLoadingBotMessageId);
        return;
      }

      // Handle EVENT_TEXT_END for bot responses - finalize the message
      if (originalMessage && originalMessage.type === "bot") {
        // Use the current bot message ID instead of the user message ID from the response
        let botMessageId = currentBotMessageId.value || data.message_id;

        // If currentBotMessageId is null, try to find the bot message by looking for loading bot messages
        if (!currentBotMessageId.value) {
          const mostRecentLoadingBotMessageId =
            messageStore.getMostRecentLoadingBotMessage();
          if (mostRecentLoadingBotMessageId) {
            botMessageId = mostRecentLoadingBotMessageId;
          }
        }

        // Schedule finalization with delay to ensure all audio chunks arrive
        setFinalizationTimeout(botMessageId);

        return;
      }

      // Fallback: If no original message found or it's not a bot message,
      // but we have a current bot message ID, use that for finalization
      if (currentBotMessageId.value) {
        // Schedule finalization with delay to ensure all audio chunks arrive
        setFinalizationTimeout(currentBotMessageId.value);

        return;
      }

      return;
    }

    // Handle other response types that have response_type field
    switch (data.response_type) {
      case WebSocketResponseType.TRANSLATION:
        processTranslationResponse(data as TranslationWebSocketResponseData);
        break;
      case WebSocketResponseType.FEEDBACK:
        processFeedbackResponse(data as FeedbackWebSocketResponseData);
        break;
      case WebSocketResponseType.USER_TEXT:
        // Handle streaming text chunks
        if (data.text && data.text.length > 0) {
          // This is a text chunk, accumulate it
          processUserTextResponse(data as UserTextWebSocketResponseData);
        } else {
          // Empty text indicates end of streaming, use delayed finalization
          const mostRecentLoadingBotMessageId =
            messageStore.getMostRecentLoadingBotMessage();
          if (mostRecentLoadingBotMessageId) {
            scheduleFinalization(mostRecentLoadingBotMessageId);
          }
        }
        break;
      case WebSocketResponseType.SUGGESTION:
        processSuggestionResponse(data as SuggestionWebSocketResponseData);
        // Clear loading state if this is EVENT_TEXT_END
        if (eventType === WebSocketEventType.EVENT_TEXT_END) {
          const activeSuggestionId =
            messageStore.getActiveSuggestionRequestId();
          if (
            messageStore.getSuggestion().isLoading &&
            activeSuggestionId === data.message_id
          ) {
            messageStore.setIsSuggestionLoading(false);
          }
        }
        break;
      default:
        // Handle any other response types
        break;
    }
  };

  const handleConversationStartEvent = (
    data: ConversationStartWebSocketResponseData
  ) => {
    // Store existing audio data before clearing messages
    const existingMessages = messageStore.messages ?? new Map();
    const audioByContent = new Map<string, string>();

    existingMessages.forEach(
      (message: UserMessage | BotMessage, id: string) => {
        if (message.type === "bot" && message.text && message.audio) {
          const contentKey = generateContentKey(message.text);
          audioByContent.set(contentKey, message.audio);
        }
      }
    );

    // Clear existing messages and set conversation ID
    messageStore.clearMessages();
    messageStore.setConversationId(data.conversation_id);

    // Set the minimum required pairs for progress tracking
    messageStore.setMinRequiredPair(data.min_pairs_required);

    // Process incoming messages and match with existing audio
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((message) => {
        const messageData: UserMessage | BotMessage = {
          type: message.type,
          text: message.text,
          isLoading: false,
          isComplete: true,
        };

        if (message.type === "bot" && message.text) {
          const contentKey = generateContentKey(message.text);
          const existingAudio = audioByContent.get(contentKey);
          if (existingAudio) {
            messageData.audio = existingAudio;
          }
        }

        messageStore.updateMessage(message.message_id, messageData);
      });
    }
  };

  const handleConversationEndEvent = async (
    data: ConversationEndWebSocketResponseData
  ) => {
    if (!data) {
      throw new Error("Missing conversation end event data");
    }
    if (
      !data.feedback ||
      !data.feedback.whatWentWell ||
      !data.feedback.suggestionsForImprovement
    ) {
      throw new Error("Missing feedback");
    }

    // Only navigate if submit was successful
    if (messageStore.submitSuccess) {
      appStore.updateLessonFeedback(data.feedback);
      await navigateTo("/lesson-result");
    }
  };

  // Process WebSocket messages
  const processWebSocketMessage = async (event: MessageEvent<string>) => {
    if (!event?.data) return;

    try {
      const message = JSON.parse(event.data) as ParsedWebSocketMessage;

      if (message === "pong" || message === "ping") {
        return;
      }

      // Handle error messages directly
      if (message.type === "error") {
        console.error("WebSocket error:", message);

        // Handle bot message errors
        if (message.event_type === WebSocketEventType.EVENT_TEXT_END) {
          // Check if this is a feedback request error
          const messageId = (message.data as WebSocketErrorResponseData)
            ?.message_id;
          const responseType = (message.data as WebSocketErrorResponseData)
            ?.response_type;

          // Handle feedback errors
          if (
            messageId &&
            (messageStore.isWaitingForFeedback(messageId) ||
              responseType === WebSocketTextRequestType.FEEDBACK)
          ) {
            messageStore.setFeedbackError(messageId, ERROR_MESSAGES.FEEDBACK);
            // Don't clear timeout immediately - let the error function handle it with delay
            appStore.addAlert(ERROR_MESSAGES.FEEDBACK);
            return;
          }

          // Handle translation errors
          if (
            messageId &&
            (messageStore.isWaitingForTranslation(messageId) ||
              responseType === WebSocketTextRequestType.TRANSLATION)
          ) {
            messageStore.setTranslationError(
              messageId,
              ERROR_MESSAGES.TRANSLATION
            );
            // Don't clear timeout immediately - let the error function handle it with delay
            appStore.addAlert(ERROR_MESSAGES.TRANSLATION);
            return;
          }

          // Handle suggestion errors first
          if (
            messageId &&
            responseType === WebSocketTextRequestType.SUGGESTION
          ) {
            messageStore.setSuggestionError(
              "Failed to get suggestion. Please try again."
            );
            appStore.addAlert("Failed to get suggestion. Please try again.");
            return;
          }

          // Handle user text errors (check both response type and no loading bot message)
          if (
            messageId &&
            (responseType === WebSocketTextRequestType.USER_TEXT ||
              !messageStore.getMostRecentLoadingBotMessage())
          ) {
            // Check if this is a suggestion request that failed (no response_type but suggestion is loading)
            const currentSuggestion = messageStore.getSuggestion();
            if (currentSuggestion.isLoading) {
              messageStore.setSuggestionError(
                "Failed to get suggestion. Please try again."
              );
              appStore.addAlert("Failed to get suggestion. Please try again.");
              return;
            }

            // Clear loading state for the most recent bot message if it exists
            const mostRecentLoadingBotMessageId =
              messageStore.getMostRecentLoadingBotMessage();
            if (mostRecentLoadingBotMessageId) {
              messageStore.addMessageError(mostRecentLoadingBotMessageId);
              messageStore.setMessageComplete(
                mostRecentLoadingBotMessageId,
                false
              );
              messageStore.updateMessage(mostRecentLoadingBotMessageId, {
                type: "bot",
                text: "Message failed",
              });
            }
            appStore.addAlert(ERROR_MESSAGES.USER_TEXT);
            appStore.userPrompt = "";
            return;
          }

          // Only mark bot message as failed if this is NOT a suggestion error
          // Check if suggestion is loading to avoid marking bot messages as failed for suggestion errors
          const currentSuggestion = messageStore.getSuggestion();
          if (currentSuggestion.isLoading) {
            messageStore.setSuggestionError(
              "Failed to get suggestion. Please try again."
            );
            appStore.addAlert("Failed to get suggestion. Please try again.");
            return;
          }

          // Only mark bot message as failed if this is not a suggestion error
          const mostRecentLoadingBotMessageId =
            messageStore.getMostRecentLoadingBotMessage();
          if (
            mostRecentLoadingBotMessageId &&
            responseType !== WebSocketTextRequestType.SUGGESTION
          ) {
            messageStore.addMessageError(mostRecentLoadingBotMessageId);
            // Mark the bot message as not loading anymore and add error text
            messageStore.setMessageComplete(
              mostRecentLoadingBotMessageId,
              false
            );
            messageStore.updateMessage(mostRecentLoadingBotMessageId, {
              type: "bot",
              text: "Message failed",
            });
            appStore.addAlert("Something went wrong, try again.");
          } else {
            appStore.addAlert("Something went wrong, try again.");
          }
          return;
        }

        // Handle other error types
        const messageId = (message.data as WebSocketErrorResponseData)
          ?.message_id;
        const responseType = (message.data as WebSocketErrorResponseData)
          ?.response_type;
        handleWebSocketError(
          messageId,
          responseType,
          appStore,
          messageStore,
          clearTTSRequest
        );
        return;
      }

      // Handle different message types more gracefully
      if (message.type !== "success") {
        // Check if this is a translation response or other valid response type
        if (
          (message as WebSocketErrorResponse)?.type === "error" ||
          message.type === "warning"
        ) {
          // Still try to process the message if it has valid data
          if (message.data && message.event_type) {
            // Continue processing
          } else {
            // Handle invalid message structure
            handleUnexpectedError(appStore, messageStore);
            return;
          }
        } else {
          // Handle issues with message status
          handleUnexpectedError(appStore, messageStore);
          return;
        }
      }

      // Switch case to handle various event types
      switch (message.event_type) {
        case WebSocketEventType.EVENT_TEXT_START:
        case WebSocketEventType.EVENT_TEXT_UPDATE:
        case WebSocketEventType.EVENT_TEXT_END:
          handleTextEvent(
            message.data as
              | UserTextWebSocketResponseData
              | TranslationWebSocketResponseData
              | FeedbackWebSocketResponseData
              | SuggestionWebSocketResponseData,
            message.event_type
          );
          return;
        case WebSocketEventType.EVENT_AUDIO_START:
        case WebSocketEventType.EVENT_AUDIO_UPDATED:
          // Check if this is bot response audio or manual TTS request
          if (
            message.data &&
            typeof message.data === "object" &&
            "response_type" in message.data &&
            message.data.response_type === "user-text"
          ) {
            // This is bot response audio, process it separately
            processBotResponseAudio(message.data);
          } else {
            // This is a manual TTS request, process it with the existing logic
            await processTTSAudioResponse(message.data);
          }
          return;
        case WebSocketEventType.EVENT_AUDIO_END:
          // Handle TTS completion - audio processing is done
          if (
            message.data &&
            typeof message.data === "object" &&
            "message_id" in message.data
          ) {
            const messageId = (message.data as { message_id: string })
              .message_id;

            // Clear any pending finalization timeout for this message
            if (finalizationTimeout.value) {
              clearTimeout(finalizationTimeout.value);
              finalizationTimeout.value = null;
            }

            // Immediately finalize the message since we know audio is complete
            finalizeBotMessage(messageId);

            // Clear TTS request tracking for this message
            clearTTSRequest(messageId);
          }
          return;
        case "UPDATE":
          // Handle TTS completion updates (both success and error)
          if (
            message.data &&
            typeof message.data === "object" &&
            "message_id" in message.data
          ) {
            const messageId = (message.data as { message_id: string })
              .message_id;
            const botMessage = messageStore.getMessage(messageId);
            if (botMessage && botMessage.type === "bot") {
              // Check if this is a TTS error
              if (message.message === "TTS processing failed") {
                // Handle TTS failure with delay - use the setTTSError function
                messageStore.setTTSError(
                  messageId,
                  "Failed to generate audio. Please try again."
                );
              } else {
                // Handle successful TTS completion
                clearTTSRequest(messageId);
              }
            }
          }
          return;
        case WebSocketEventType.EVENT_CONVERSATION_START:
          handleConversationStartEvent(
            message.data as ConversationStartWebSocketResponseData
          );
          return;
        case WebSocketEventType.EVENT_CONVERSATION_END:
          handleConversationEndEvent(
            message.data as ConversationEndWebSocketResponseData
          );
          return;
        default:
          return;
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(e);
        try {
          const parsedData = JSON.parse(event.data);
          const messageId = (parsedData.data as WebSocketErrorResponseData)
            ?.message_id;
          const responseType = (parsedData.data as WebSocketErrorResponseData)
            ?.response_type;

          handleWebSocketError(
            messageId,
            responseType,
            appStore,
            messageStore,
            clearTTSRequest
          );
        } catch {
          // Handle unexpected errors
          handleUnexpectedError(appStore, messageStore);
        }
      }
    }
  };

  const open = async () => {
    openWs();
  };

  // Cleanup on component unmount
  onBeforeUnmount(() => {
    console.log("WebSocket composable unmounting, cleaning up...");

    // Clear any pending finalization timeouts
    if (finalizationTimeout.value) {
      clearTimeout(finalizationTimeout.value);
      finalizationTimeout.value = null;
    }

    // Clear reconnection timeout
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value);
      reconnectTimeout.value = null;
    }

    // Reset reconnection attempts and state
    reconnectAttempts.value = 0;
    isReconnecting.value = false;

    // Reset audio chunk tracker
    audioChunkTracker.value = {
      messageId: null,
      expectedChunks: 0,
      receivedChunks: 0,
      lastChunkTime: 0,
      isFinalizing: false,
    };

    // Clear accumulated audio data
    currentBotAudioData.value = [];
    currentBotMessageId.value = null;

    // Close WebSocket connection
    close();
  });

  return {
    ws,
    open,
    send,
    status,
    close,
    trackTTSRequest,
    clearTTSRequest,
    clearAllTTSRequests,
    setCurrentBotMessageId,
    clearCurrentBotMessageId,
    ttsRequestMessageIds,
  };
};
