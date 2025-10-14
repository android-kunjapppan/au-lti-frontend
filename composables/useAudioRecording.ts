import { useDevicesList, useTimeoutFn, useUserMedia } from "@vueuse/core";
import { v4 as uuid } from "uuid";
import { computed, onMounted, reactive, ref } from "vue";
import { usePermissionManager } from "~/composables/usePermissionManager";
import { AUDIO_CONFIG } from "~/utils/constants";

export const useAudioRecording = (
  onAudioEndCallback?: (audioBlob?: Blob) => void
) => {
  const isAudioRecording = ref(false);
  const mediaRecorder = ref<MediaRecorder | null>(null);
  const firstAudioChunkSent = ref(false);
  const audioSessionId = ref<string | null>(null);
  const isAudioEnded = ref(false);
  const finalAudioBlob = ref<Blob | null>(null);
  // Safety timeout removed - feature disabled

  // Permission management
  const permissionManager = usePermissionManager();

  // Get available audio devices
  const { devices } = useDevicesList({
    constraints: {
      audio: true,
    },
  });

  // Get the first available microphone
  const currentMicrophone = computed(() => {
    const audioDevices = devices.value.filter(
      (device) => device.kind === "audioinput"
    );
    return audioDevices.length > 0 ? audioDevices[0].deviceId : undefined;
  });

  // Use VueUse's useUserMedia for audio stream
  const { stream, start, stop, enabled } = useUserMedia({
    constraints: reactive({
      audio: {
        deviceId: currentMicrophone,
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }),
  });

  // Computed properties
  const canRecord = computed(() => enabled.value && stream.value);
  const isRecording = computed(
    () => isAudioRecording.value && mediaRecorder.value?.state === "recording"
  );

  const cleanupAudio = () => {
    // Safety timeout stop removed - feature disabled

    // Stop MediaRecorder if it's still recording
    if (mediaRecorder.value && mediaRecorder.value.state === "recording") {
      try {
        mediaRecorder.value.stop();
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
    }

    // Stop the stream using VueUse's stop method
    stop();

    if (mediaRecorder.value) mediaRecorder.value = null;
    firstAudioChunkSent.value = false;
    audioSessionId.value = null;
    isAudioEnded.value = false;
    isAudioRecording.value = false;
    finalAudioBlob.value = null;
  };

  const startAudioRecording = async (
    onDataAvailable: (event: BlobEvent) => void
  ) => {
    try {
      // Prevent multiple starts
      if (isAudioRecording.value || mediaRecorder.value) {
        return mediaRecorder.value;
      }

      // Check and request permission first
      if (!permissionManager.hasPermission.value) {
        const permissionGranted = await permissionManager.requestPermission();
        if (!permissionGranted) {
          throw new Error("Microphone permission denied");
        }
      }

      // Start the audio stream using VueUse
      await start();

      if (!stream.value) {
        throw new Error("Failed to get audio stream - stream is null");
      }

      firstAudioChunkSent.value = false;
      isAudioEnded.value = false;
      audioSessionId.value = uuid();

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error("MediaRecorder is not supported in this browser");
      }

      // Check if the mime type is supported
      const mimeType = AUDIO_CONFIG.MIME_TYPE;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const alternatives = AUDIO_CONFIG.ALTERNATIVE_MIME_TYPES;

        const supportedType = alternatives.find((type) =>
          MediaRecorder.isTypeSupported(type)
        );
        if (!supportedType) {
          throw new Error("No supported audio format found");
        }

        mediaRecorder.value = new MediaRecorder(stream.value, {
          mimeType: supportedType,
        });
      } else {
        mediaRecorder.value = new MediaRecorder(stream.value, {
          mimeType: AUDIO_CONFIG.MIME_TYPE,
        });
      }

      mediaRecorder.value.ondataavailable = (event) => {
        // Call the original data available handler
        onDataAvailable(event);

        // Store the final audio blob for EVENT_AUDIO_END
        // This is crucial for short recordings where the blob arrives after stopping
        if (event.data && event.data.size > 0) {
          finalAudioBlob.value = event.data;
        }
      };
      mediaRecorder.value.onstart = () => {
        isAudioRecording.value = true;
      };
      mediaRecorder.value.onstop = () => {
        isAudioRecording.value = false;
      };
      mediaRecorder.value.onerror = (event) => {
        isAudioRecording.value = false;
        cleanupAudio();
      };

      mediaRecorder.value.start(AUDIO_CONFIG.CHUNK_INTERVAL);

      // Safety timeout removed - feature disabled

      return mediaRecorder.value;
    } catch (e) {
      throw new Error(
        `Failed to start audio recording: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  const stopAudioRecording = async (onAudioEnd: (audioBlob?: Blob) => void) => {
    // Safety timeout stop removed - feature disabled

    if (mediaRecorder.value && isAudioRecording.value) {
      isAudioEnded.value = true;

      // Check if already stopped
      if (mediaRecorder.value.state !== "inactive") {
        mediaRecorder.value.stop();
      }

      isAudioRecording.value = false;

      // Stop the stream using VueUse's stop method
      stop();

      // Wait a bit longer to ensure all audio data has been processed
      const { start: startProcessingDelay } = useTimeoutFn(async () => {
        if (isAudioEnded.value) {
          onAudioEnd(finalAudioBlob.value || undefined);
          cleanupAudio();
        }
      }, AUDIO_CONFIG.PROCESSING_DELAY);
      startProcessingDelay();
    }
  };

  // Initialize permission state on mount
  onMounted(() => {
    permissionManager.initializePermissionState();
  });

  return {
    isAudioRecording,
    audioSessionId,
    isAudioEnded,
    audioConfig: {
      mimeType: AUDIO_CONFIG.MIME_TYPE,
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
    },
    startAudioRecording,
    stopAudioRecording,
    cleanupAudio,
    // Expose VueUse's stream and enabled state for additional functionality
    stream,
    enabled,
    devices,
    // Expose permission management
    hasPermission: permissionManager.hasPermission,
    canRequestPermission: permissionManager.canRequestPermission,
    isRequestingPermission: permissionManager.isRequestingPermission,
    requestPermission: permissionManager.requestPermission,
  };
};
