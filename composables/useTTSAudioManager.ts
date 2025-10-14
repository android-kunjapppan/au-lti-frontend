import { storeToRefs } from "pinia";
import { ref } from "vue";
import { useAudioPlayback } from "~/composables/useAudioPlayback";
import { useAppStore } from "~/stores/appStore";
import { useMessageStore } from "~/stores/messageStore";
import type { BackendAudioResponse } from "~/utils";

export const useTTSAudioManager = () => {
  const messageStore = useMessageStore();
  const appStore = useAppStore();
  const { audioPlaybackSpeed } = storeToRefs(appStore);

  // Initialize the audio playback composable with TTS-specific configuration
  const audioPlayback = useAudioPlayback(
    {
      defaultSpeed: "normal",
      enableLipSync: true,
      volume: 1.0,
      autoCleanup: true,
      enableTTSMode: true,
      minPrebufferChunks: 2,
      prebufferTimeoutMs: 250,
      maxQueueSize: 50,
    },
    {
      onPlayStart: (messageId: string, speed: "normal" | "slow") => {
        // Clear all other audio playing states before starting TTS
        messageStore.clearAllAudioPlaying();

        // Emit a global event to stop any cached audio elements
        window.dispatchEvent(new CustomEvent("stopAllCachedAudio"));

        // Set playing state for this message
        messageStore.setAudioPlaying(messageId, true, speed);
      },
      onPlayEnd: (messageId: string, speed: "normal" | "slow") => {
        // Clear playing state for this message
        messageStore.setAudioPlaying(messageId, false, speed);
      },
      onError: (messageId: string, error: string) => {
        console.error(`TTS Audio error for ${messageId}:`, error);
        // Clear playing state on error
        messageStore.setAudioPlaying(messageId, false);
      },
      onLoadingChange: (messageId: string, isLoading: boolean) => {
        // Handle loading state changes if needed
      },
    }
  );

  // Watch for audio playback speed changes and update the composable
  watch(
    () => audioPlaybackSpeed.value,
    (newSpeed) => {
      audioPlayback.setSlowPlaybackRate(newSpeed);
    },
    { immediate: true }
  );

  // TTS-specific methods that delegate to the audio playback composable
  const enqueueAudioChunk = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: "normal" | "slow"
  ) => {
    if (audioPlayback.enqueueAudioChunk) {
      await audioPlayback.enqueueAudioChunk(audioData, messageId, speed);
    } else {
      throw new Error("TTS mode is not enabled in audio playback composable");
    }
  };

  const clearQueueForMessage = (messageId: string) => {
    if (audioPlayback.clearQueueForMessage) {
      audioPlayback.clearQueueForMessage(messageId);
    }
  };

  const markSafariAudioComplete = async (messageId: string) => {
    if (audioPlayback.markSafariAudioComplete) {
      await audioPlayback.markSafariAudioComplete(messageId);
    }
  };

  const cleanup = () => {
    audioPlayback.cleanup();
  };

  // Additional TTS-specific state that might be needed
  const isProcessingQueue = audioPlayback.isProcessingQueue || ref(false);
  const audioQueue = audioPlayback.audioQueue || ref([]);

  return {
    // Core TTS functionality
    enqueueAudioChunk,
    isPlaying: audioPlayback.isPlaying,
    stopAudio: audioPlayback.stopAllAudio,
    clearQueueForMessage,
    markSafariAudioComplete,
    cleanup,

    // Additional state for compatibility
    isProcessingQueue,
    audioQueue,

    // Expose the underlying audio playback composable for advanced usage
    audioPlayback,
  };
};
