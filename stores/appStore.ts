import { StorageSerializers, useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import type { useMessageStore } from "~/stores/messageStore";
import type { UserInfo } from "~/types/types";
import { createApiHeaders } from "~/utils";
import { getUserIdFromJWT } from "~/utils/auth";
import { COMMON_ERROR_MESSAGES, HTTP_ERROR_MESSAGES } from "~/utils/constants";

interface AlertMessage {
  id: string;
  text: string;
  type: "error";
  timestamp: number;
}

export const useAppStore = defineStore("frontend", () => {
  const speedOptions = [0.5, 0.6, 0.7, 0.8, 0.9]; // Only slow speed options
  const alertQueue = ref<AlertMessage[]>([]);
  const alertTimeouts = ref<Map<string, NodeJS.Timeout>>(new Map());

  // The selected Module Template UUID
  const selectedTemplate = useStorage<string | null>(
    "selectedTemplate",
    null,
    window !== undefined ? sessionStorage : undefined,
    { mergeDefaults: true }
  );

  // JWT to access CreateAI Platform
  const lbJwt = useStorage<string | null>(
    "lb-jwt",
    null,
    window !== undefined ? localStorage : undefined,
    { mergeDefaults: true }
  );
  // JWT from canvas deeplink
  const lbCanvasJwt = useStorage<string | null>(
    "lb-canvas-jwt",
    null,
    window !== undefined ? sessionStorage : undefined,
    { mergeDefaults: true }
  );
  // Stores assignmentId info, currently not setup
  const assignmentId = useStorage<string | null>(
    "lb-assignment-id",
    null,
    window !== undefined ? localStorage : undefined,
    { mergeDefaults: true, serializer: StorageSerializers.object }
  );

  // Stores courseId info, currently not setup
  const courseId = useStorage<string | null>(
    "lb-course-id",
    null,
    window !== undefined ? localStorage : undefined,
    { mergeDefaults: true, serializer: StorageSerializers.object }
  );

  // User info state
  const userInfo = ref<UserInfo | null>(null);
  const isLoadingUserInfo = ref(false);
  // Promise cache to handle concurrent requests
  let fetchUserInfoPromise: Promise<UserInfo> | null = null;
  let userInfoTimeout: NodeJS.Timeout | null = null;

  const isChatbotDrawerOpen = ref(false);
  const showSettings = ref(false);
  const audioPlaybackSpeed = ref(0.7); // Default to 0.7x for slow playback
  const footerHeading = useStorage<string>(
    "lb-footer-heading",
    "Default Footer Headings",
    window !== undefined ? localStorage : undefined,
    { mergeDefaults: true }
  );
  const footerSubheading = useStorage<string>(
    "lb-footer-subheading",
    "This is a subheading for the footer.",
    window !== undefined ? localStorage : undefined,
    { mergeDefaults: true }
  );
  const progress = ref(100); // Start from 0% progress
  const userPrompt = ref("");

  // Avatar name state
  const avatarName = ref<string>("Jose"); // Default fallback name

  // Suggestion state - moved from messageStore
  const suggestion = ref<{ suggestionId: string; content: string } | null>(
    null
  );

  const {
    open: openWS,
    status: statusWS,
    send: sendWS,
    close: closeWS,
    ws,
    trackTTSRequest,
    clearTTSRequest,
    clearAllTTSRequests,
    ttsRequestMessageIds,
  } = useLBWebSocket(lbJwt);

  // Function to get dynamic user ID
  const getUserId = (): string => {
    if (!userInfo.value?.userId) {
      throw new Error(
        "User information not loaded. Please call fetchUserInfo() first."
      );
    }
    return userInfo.value.userId;
  };

  // Function to add a new alert message
  const addAlert = (text: string) => {
    const id = crypto.randomUUID();
    const message: AlertMessage = {
      id,
      text,
      type: "error",
      timestamp: Date.now(),
    };
    alertQueue.value.push(message);

    // Auto remove after 5 seconds
    const timeout = setTimeout(() => {
      removeAlert(id);
    }, 5000);
    alertTimeouts.value.set(id, timeout);
  };

  // Function to remove an alert message
  const removeAlert = (id: string) => {
    alertQueue.value = alertQueue.value.filter((msg) => msg.id !== id);
    // Clear the timeout if it exists
    const timeout = alertTimeouts.value.get(id);
    if (timeout) {
      clearTimeout(timeout);
      alertTimeouts.value.delete(id);
    }
  };

  // STT Manager
  const sttManager = useSTTManager({
    textStorage: userPrompt,
    onAlert: addAlert,
    onWebSocketOpen: openWS,
    onWebSocketSend: sendWS,
    onWebSocketStatus: () => statusWS.value,
  });

  const lessonFeedback = useStorage<{
    whatWentWell: string[];
    suggestionsForImprovement: string[];
  }>(
    "lesson-feedback",
    {
      whatWentWell: [],
      suggestionsForImprovement: [],
    },
    window !== undefined ? localStorage : undefined,
    {
      mergeDefaults: false,
      serializer: StorageSerializers.object,
    }
  );

  // Computed property to get isTest from assignment info
  const isTest = computed(() => {
    return userInfo.value?.assignmentInfo?.isTest;
  });

  const updateLessonFeedback = (
    whatWentWell: string[],
    suggestionsForImprovement: string[]
  ) => {
    lessonFeedback.value.whatWentWell = whatWentWell;
    lessonFeedback.value.suggestionsForImprovement = suggestionsForImprovement;
  };

  const clearLessonFeedback = () => {
    lessonFeedback.value.whatWentWell = [];
    lessonFeedback.value.suggestionsForImprovement = [];
  };

  const toggleChatbotDrawer = () => {
    isChatbotDrawerOpen.value = !isChatbotDrawerOpen.value;
  };

  const updateProgress = (newProgress: number) => {
    progress.value = newProgress;
  };

  const toggleSettings = () => {
    showSettings.value = !showSettings.value;
  };
  const selectAudioPlaybackSpeed = (speed: number) => {
    audioPlaybackSpeed.value = speed;
  };

  // Fetch user info from API
  const fetchUserInfo = async (): Promise<UserInfo> => {
    // Return cached data if available
    if (userInfo.value !== null) {
      return userInfo.value;
    }

    if (!lbCanvasJwt.value) {
      addAlert(COMMON_ERROR_MESSAGES.NO_CANVAS_JWT);
      throw new Error(COMMON_ERROR_MESSAGES.NO_CANVAS_JWT);
    }

    // If a request is already in progress, return the same promise
    if (fetchUserInfoPromise) {
      return fetchUserInfoPromise;
    }

    // Create and cache the promise
    fetchUserInfoPromise = (async () => {
      try {
        const asurite = getUserIdFromJWT(lbJwt.value);
        isLoadingUserInfo.value = true;

        // Set 2-minute timeout
        userInfoTimeout = setTimeout(
          () => {
            isLoadingUserInfo.value = false;
            addAlert(
              "Loading user information timed out. Please refresh the page."
            );
          },
          2 * 60 * 1000
        );
        const config = useRuntimeConfig();
        const response = await fetch(`${config.public.httpApiUrl}/lti/info`, {
          method: "POST",
          credentials: "include",
          headers: createApiHeaders({
            Authorization: `Bearer ${lbCanvasJwt.value}`,
          }),
          body: JSON.stringify({ asurite }),
        });

        if (!response.ok) {
          // Special handling for OAuth-required case
          if (response.status === 401) {
            let errorData: unknown = null;

            try {
              errorData = await response.json();
            } catch (jsonError) {
              console.warn("Failed to parse error JSON:", jsonError);
            }

            if (
              typeof errorData === "object" &&
              errorData !== null &&
              "code" in errorData &&
              (errorData as { code?: string }).code === "CANVAS_OAUTH_REQUIRED"
            ) {
              // Expected OAuth flow needed, don't alert
              throw new Error("Canvas OAuth Required");
            }
          }

          addAlert(HTTP_ERROR_MESSAGES.NOT_OK);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData: UserInfo = await response.json();

        // Store selectedTemplate in sessionStorage
        if (userData.selectedTemplate) {
          selectedTemplate.value = userData.selectedTemplate;
        }

        // Store assignment and course IDs
        assignmentId.value = userData.assignmentId;
        courseId.value = userData.courseId;

        if (!userData.userId) {
          addAlert(COMMON_ERROR_MESSAGES.NO_USER_ID);
          throw new Error("Invalid user data received from API");
        }

        // Cache and return
        userInfo.value = userData;
        return userData;
      } catch (error: unknown) {
        console.error("Error fetching user info:", error);

        if (
          !(error instanceof Error) ||
          error.message !== "Canvas OAuth Required"
        ) {
          addAlert(COMMON_ERROR_MESSAGES.NO_USER_INFO);
        }

        throw error;
      } finally {
        isLoadingUserInfo.value = false;
        fetchUserInfoPromise = null;
        if (userInfoTimeout) {
          clearTimeout(userInfoTimeout);
          userInfoTimeout = null;
        }
      }
    })();

    return fetchUserInfoPromise;
  };

  const setUserInfo = async (userData: UserInfo | null) => {
    userInfo.value = userData;
  };

  // Avatar name management
  const setAvatarName = (name: string) => {
    avatarName.value = name;
  };

  // Suggestion management functions - moved from messageStore
  const setSuggestion = (suggestionId: string, content: string) => {
    suggestion.value = { suggestionId, content };
  };

  const getSuggestion = () => {
    return suggestion.value;
  };

  const getSuggestionId = () => {
    return suggestion.value?.suggestionId || null;
  };

  const getSuggestionContent = () => {
    return suggestion.value?.content || null;
  };

  const clearSuggestion = () => {
    suggestion.value = null;
  };

  // Use the maxAttemptsReached flag from backend
  const isMaxAttemptsReached = computed(() => {
    return userInfo.value?.assignmentInfo?.maxAttemptsReached ?? false;
  });

  // Get conversation ID with fallback to last submitted conversation when max attempts reached
  const getConversationId = (
    messageStore: ReturnType<typeof useMessageStore>
  ): string | null => {
    let conversationId = messageStore.getConversationId();
    if (!conversationId && isMaxAttemptsReached.value) {
      conversationId =
        userInfo.value?.assignmentInfo?.lastSubmittedConversation
          ?.conversation_id ?? null;
    }
    return conversationId;
  };

  return {
    lbJwt,
    lbCanvasJwt,
    assignmentId,
    courseId,
    userInfo,
    getUserId,
    isChatbotDrawerOpen,
    toggleChatbotDrawer,
    updateProgress,
    progress,
    showSettings,
    footerHeading,
    footerSubheading,
    speedOptions,
    audioPlaybackSpeed,
    toggleSettings,
    selectAudioPlaybackSpeed,
    lessonFeedback,
    updateLessonFeedback,
    clearLessonFeedback,
    isTest,
    alertQueue,
    addAlert,
    removeAlert,
    userPrompt,
    openWS,
    statusWS,
    sendWS,
    closeWS,
    trackTTSRequest,
    clearTTSRequest,
    clearAllTTSRequests,
    ttsRequestMessageIds,
    ws,
    // STT Manager exports
    sttSupported: sttManager.sttSupported,
    sttListening: sttManager.sttListening,
    stopStt: sttManager.stopStt,
    toggleStt: sttManager.toggleStt,
    toggleSttWithErrorHandling: sttManager.toggleSttWithErrorHandling,
    handleSttMessage: sttManager.handleSttMessage,
    isGracefullyStopping: sttManager.isGracefullyStopping,
    isSttDisabled: sttManager.isSttDisabled,
    isProcessingInBackground: sttManager.isProcessingInBackground,
    isLoadingUserInfo,
    fetchUserInfo,
    setUserInfo,
    suggestion,
    setSuggestion,
    getSuggestion,
    getSuggestionId,
    getSuggestionContent,
    clearSuggestion,
    isMaxAttemptsReached,
    getConversationId,
    avatarName,
    setAvatarName,
  };
});
