import type {
  ConversationEndRequestBody,
  ConversationStartRequestBody,
  UserInfo,
} from "~/types/types";
import {
  WebSocketEventType,
  WebSocketTextRequestType
} from "~/utils/constants";

export const useConversationManager = () => {
  const appStore = useAppStore();
  const messageStore = useMessageStore();
  const isStartConversationLoading = ref(false);
  const isEndConversationLoading = ref(false);
  let startConversationTimeout: NodeJS.Timeout | null = null;
  let endConversationTimeout: NodeJS.Timeout | null = null;

  const startConversation = async (userData: UserInfo) => {
    if (isStartConversationLoading.value) return;

    try {
      isStartConversationLoading.value = true;

      // Set 2-minute timeout
      startConversationTimeout = setTimeout(
        () => {
          isStartConversationLoading.value = false;
          appStore.addAlert(
            "Starting conversation timed out. Please try again."
          );
        },
        2 * 60 * 1000
      );

      // Clear any previous lesson feedback
      appStore.clearLessonFeedback();

      // Check if max attempts are reached
      if (appStore.isMaxAttemptsReached) {
        // If max attempts reached, load the last submitted conversation instead of starting a new one
        const lastConversation =
          userData.assignmentInfo?.lastSubmittedConversation;
        if (lastConversation) {
          // Set the conversation ID from the last submitted conversation
          messageStore.setConversationId(lastConversation.conversation_id);

          // Clear existing messages and load the last submitted conversation
          messageStore.clearMessages();

          // Add each message from the last submitted conversation
          lastConversation.messages.forEach((msg) => {
            const messageId = msg.message_id;
            if (msg.type === "user") {
              messageStore.createMessage("user", {
                id: messageId,
                data: {
                  text: msg.text,
                },
              });
            } else if (msg.type === "bot") {
              messageStore.createMessage("bot", {
                id: messageId,
                data: {
                  text: msg.text,
                },
              });
            }
          });

          // Still establish WebSocket connection for features like suggestions, feedback, translations
          await ensureWebSocketConnection();
          return; // Exit early, no need to start a new conversation
        }
      }

      // Ensure WebSocket connection
      await ensureWebSocketConnection();

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      // Send conversation start request
      const conversationStartRequest: ConversationStartRequestBody = {
        user_id: userData.userId,
        event_type: WebSocketEventType.EVENT_CONVERSATION_START,
        assignment_id: userData.assignmentId,
        selectedTemplate,
        data: {
          request_type: WebSocketTextRequestType.START_CONVERSATION,
        },
      };

      appStore.sendWS(JSON.stringify(conversationStartRequest));
      // Wait for backend to process and set up conversation
      await waitForConversationSetup();
    } catch (error) {
      console.error("Error starting conversation:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong when trying to start your conversation. Check your internet connection and try again later.";
      appStore.addAlert(errorMessage);
      throw error;
    } finally {
      isStartConversationLoading.value = false;
      if (startConversationTimeout) {
        clearTimeout(startConversationTimeout);
        startConversationTimeout = null;
      }
    }
  };

  const endConversation = async () => {
    try {
      isEndConversationLoading.value = true;

      // Set 2-minute timeout
      endConversationTimeout = setTimeout(
        () => {
          isEndConversationLoading.value = false;
          appStore.addAlert("Ending conversation timed out. Please try again.");
        },
        2 * 60 * 1000
      );
      // Ensure WebSocket connection
      await ensureWebSocketConnection();
      // Send conversation end request
      // if (!appStore.lbCanvasJwt) {
      //   appStore.addAlert(COMMON_ERROR_MESSAGES.NO_CANVAS_JWT);
      //   throw new Error("No Canvas JWT found");
      // }

      // Get selectedTemplate from sessionStorage
      const selectedTemplate = sessionStorage.getItem("selectedTemplate");
      if (!selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      const conversationEndRequest: ConversationEndRequestBody = {
        user_id: appStore.getUserId(),
        selectedTemplate,
        event_type: WebSocketEventType.EVENT_CONVERSATION_END,
        conversation_id: messageStore.getConversationId() as string,
        lb_canvas_jwt: appStore.lbCanvasJwt || "abc",
      };

      appStore.sendWS(JSON.stringify(conversationEndRequest));
      // Wait for backend to process the request
      await waitForConversationSetup();
    } catch (error) {
      console.error("Error ending conversation:", error);
      appStore.addAlert("Failed to end conversation. Please try again.");
      throw error; // Re-throw the error so the calling function can handle it
    } finally {
      isEndConversationLoading.value = false;
      if (endConversationTimeout) {
        clearTimeout(endConversationTimeout);
        endConversationTimeout = null;
      }
    }
  };

  const ensureWebSocketConnection = async () => {
    if (appStore.statusWS !== "OPEN") {
      await appStore.openWS();

      // Wait for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (String(appStore.statusWS) !== "OPEN") {
        throw new Error("Failed to establish WebSocket connection");
      }
    }
  };

  const waitForConversationSetup = async () => {
    // Create a promise that resolves when conversation ID is set
    const waitForConversationId = new Promise<string>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 5; // 10 seconds total (5 * 2000ms)

      const checkConversationId = () => {
        const conversationId = messageStore.getConversationId();
        if (conversationId) {
          resolve(conversationId);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          reject(
            new Error(
              "No conversation ID received from backend after 10 seconds"
            )
          );
          return;
        }

        // Check again in 2000ms
        setTimeout(checkConversationId, 2000);
      };

      // Start checking
      checkConversationId();
    });

    // Wait for the promise to resolve
    await waitForConversationId;
  };

  return {
    startConversation,
    endConversation,
    isStartConversationLoading,
    isEndConversationLoading,
  };
};
