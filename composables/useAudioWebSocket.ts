import { useAppStore } from "~/stores/appStore";
import { useMessageStore } from "~/stores/messageStore";
import {
  WebSocketEventType,
  WebSocketTextRequestType,
} from "~/utils/constants";

export const useAudioWebSocket = () => {
  const appStore = useAppStore();
  const messageStore = useMessageStore();
  const { statusWS, lbJwt } = storeToRefs(appStore);

  const sendAudioMessage = async (
    eventType: string,
    audioBlob: Blob,
    sessionId: string
  ) => {
    if (statusWS.value !== "OPEN") await appStore.openWS();
    if (statusWS.value === "OPEN" && sessionId) {
      const conversationId = messageStore.getConversationId();
      if (!conversationId) {
        throw new Error("No active conversation. Please start a lesson first.");
      }

      const base64Audio = await blobToBase64(audioBlob);

      // Get selectedTemplate
      if (!appStore.selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      const message = {
        event_type: eventType,
        user_id: appStore.getUserId(),
        conversation_id: conversationId,
        message_id: sessionId,
        selectedTemplate: appStore.selectedTemplate,
        data: {
          request_type: WebSocketTextRequestType.USER_AUDIO,
          audio: base64Audio,
        },
      };
      appStore.sendWS(JSON.stringify(message));
    }
  };

  const sendAudioEndMessage = async (sessionId: string, audioBlob?: Blob) => {
    if (statusWS.value !== "OPEN") await appStore.openWS();
    if (statusWS.value === "OPEN" && sessionId) {
      const conversationId = messageStore.getConversationId();
      if (!conversationId) {
        throw new Error("No active conversation. Please start a lesson first.");
      }

      let base64Audio = "";
      if (audioBlob) {
        base64Audio = await blobToBase64(audioBlob);
      }

      // Get selectedTemplate
      if (!appStore.selectedTemplate) {
        appStore.addAlert(
          "Missing selectedTemplate, please reload or try again"
        );
        return;
      }

      const message = {
        event_type: WebSocketEventType.EVENT_AUDIO_END,
        user_id: appStore.getUserId(),
        conversation_id: conversationId,
        message_id: sessionId,
        selectedTemplate: appStore.selectedTemplate,
        data: {
          request_type: WebSocketTextRequestType.USER_AUDIO,
          audio: base64Audio,
        },
      };
      appStore.sendWS(JSON.stringify(message));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result.split(",")[1]);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return {
    sendAudioMessage,
    sendAudioEndMessage,
  };
};
