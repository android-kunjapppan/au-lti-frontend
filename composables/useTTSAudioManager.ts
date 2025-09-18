import { ref, shallowRef } from "vue";
import { lipSyncStatus } from "~/composables/useAudioAnalysis";
import { useMessageStore } from "~/stores/messageStore";
import { useAvatarStore } from "~/stores/useAvatarStore";
import type { BackendAudioResponse } from "~/utils";
import { bytesToBase64, decodeBase64Audio } from "~/utils";
import { analyzeAudioData } from "~/utils/audioAnalysis";
import { AUDIO_ANALYSIS_CONFIG } from "~/utils/constants";

/**
 * Composable for managing TTS audio playback with avatar lip sync.
 * Handles streaming audio chunks and integrates with the avatar's lip sync system.
 */
export const useTTSAudioManager = () => {
  const avatarStore = useAvatarStore();
  const messageStore = useMessageStore();
  const audioContext = shallowRef<AudioContext | null>(null);
  const currentAudioSource = shallowRef<AudioBufferSourceNode | null>(null);
  const isPlaying = ref(false);
  const audioQueue = ref<
    Array<{
      audioData: BackendAudioResponse;
      messageId?: string;
      speed?: "normal" | "slow";
    }>
  >([]);
  const isProcessingQueue = ref(false);
  const isStopped = ref(false); // Flag to track if audio has been stopped
  const currentProcessingMessageId = ref<string | null>(null); // Track which message is currently being processed
  // Small prebuffer to smooth playback between chunks
  const prebufferTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null);
  const MIN_PREBUFFER_CHUNKS = 2;
  const PREBUFFER_TIMEOUT_MS = 250;

  // Audio analysis components for TTS
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;
  let lastAmplitude = 0;
  let lipSyncIntervalId: ReturnType<typeof setInterval> | null = null;

  // Initialize audio context
  const initAudioContext = async () => {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    return audioContext.value;
  };

  // Add audio chunk to queue
  const enqueueAudioChunk = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: "normal" | "slow"
  ) => {
    // Check queue size limit to prevent memory issues
    const MAX_QUEUE_SIZE = 50; // Limit queue to prevent memory overflow
    if (audioQueue.value.length >= MAX_QUEUE_SIZE) {
      console.warn(
        `🎵 TTS Audio Manager: Queue size limit reached (${MAX_QUEUE_SIZE}), dropping oldest chunks`
      );
      // Remove oldest chunks to make room
      const excessChunks = audioQueue.value.length - MAX_QUEUE_SIZE + 1;
      audioQueue.value.splice(0, excessChunks);
    }

    audioQueue.value.push({ audioData, messageId, speed });

    // Start processing after minimal prebuffer to reduce gaps
    if (!isProcessingQueue.value) {
      if (audioQueue.value.length >= MIN_PREBUFFER_CHUNKS) {
        await processAudioQueue();
      } else {
        if (prebufferTimeoutId.value) clearTimeout(prebufferTimeoutId.value);
        prebufferTimeoutId.value = setTimeout(async () => {
          await processAudioQueue();
        }, PREBUFFER_TIMEOUT_MS);
      }
    }
  };

  // Process audio queue
  const processAudioQueue = async () => {
    if (isProcessingQueue.value || audioQueue.value.length === 0) {
      return;
    }

    isProcessingQueue.value = true;

    // Get the first item to determine messageId and speed for playing state
    const firstItem = audioQueue.value[0];
    let currentMessageId: string | undefined;
    let currentSpeed: "normal" | "slow" | undefined;

    if (firstItem) {
      currentMessageId = firstItem.messageId;
      currentSpeed = firstItem.speed;

      // Check if this is a new message sequence
      if (
        currentMessageId &&
        currentMessageId !== currentProcessingMessageId.value
      ) {
        // This is a new message sequence, reset the stopped flag
        isStopped.value = false;
        currentProcessingMessageId.value = currentMessageId;
      }

      // Set playing state once at the beginning of the entire sequence
      if (currentMessageId && currentSpeed && !isStopped.value) {
        // Clear all other audio playing states before starting TTS
        messageStore.clearAllAudioPlaying();

        // Emit a global event to stop any cached audio elements
        // This will be caught by SideBar.vue to stop currentPlayingAudio
        window.dispatchEvent(new CustomEvent("stopAllCachedAudio"));

        messageStore.setAudioPlaying(currentMessageId, true, currentSpeed);
      }
    }

    try {
      while (audioQueue.value.length > 0 && !isStopped.value) {
        const queueItem = audioQueue.value.shift();
        if (queueItem) {
          await playAudioChunk(
            queueItem.audioData,
            queueItem.messageId,
            queueItem.speed
          );
        }
      }

      // Clear playing state once at the end of the entire sequence (only if not stopped)
      if (currentMessageId && !isStopped.value) {
        messageStore.setAudioPlaying(currentMessageId, false);
      }
    } catch (error) {
      console.error("Error processing TTS audio queue:", error);
      // Clear playing state on error
      if (currentMessageId) {
        messageStore.setAudioPlaying(currentMessageId, false);
      }
    } finally {
      isProcessingQueue.value = false;
    }
  };

  // Play individual audio chunk
  const playAudioChunk = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: "normal" | "slow"
  ) => {
    try {
      if (!audioContext.value) {
        await initAudioContext();
      }

      // Resume audio context if suspended
      if (audioContext.value && audioContext.value.state === "suspended") {
        await audioContext.value.resume();
      }

      // Validate audio data before decoding
      if (!audioData || !audioData.data || audioData.data.length === 0) {
        console.warn("🎵 TTS Audio Manager: Invalid audio data received");
        return;
      }

      // Decode the audio data
      let audioBuffer: AudioBuffer | null = null;
      try {
        audioBuffer = await decodeBase64Audio({
          audioBufferArray: audioData,
          audioContext: audioContext.value!,
        });
      } catch (decodeError) {
        console.error(
          "🎵 TTS Audio Manager: Error decoding audio with standard method:",
          decodeError
        );

        // Try alternative decoding approach
        try {
          const base64String = bytesToBase64(audioData.data);
          const binaryString = atob(base64String);
          const audioBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            audioBytes[i] = binaryString.charCodeAt(i);
          }

          // Validate the audio bytes before decoding
          if (audioBytes.length === 0) {
            console.warn(
              "🎵 TTS Audio Manager: Empty audio bytes after conversion"
            );
            return;
          }

          audioBuffer = await audioContext.value!.decodeAudioData(
            audioBytes.buffer
          );
        } catch (altError) {
          console.error(
            "🎵 TTS Audio Manager: Alternative decoding also failed:",
            altError
          );
          return;
        }
      }

      // Validate decoded audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        console.warn("🎵 TTS Audio Manager: Invalid decoded audio buffer");
        return;
      }

      if (!audioBuffer) {
        console.error("Failed to decode audio buffer");
        return;
      }

      // Create audio source
      const source = new AudioBufferSourceNode(audioContext.value!, {
        buffer: audioBuffer,
      });

      // Bot response audio should always play at 1x speed
      // Playback speed settings are only for slow play, not for bot responses
      source.playbackRate.value = 1;

      // Set up audio analysis for lip sync
      setupAudioAnalysis(source);

      // Connect to audio context destination
      source.connect(audioContext.value!.destination);

      // Play the audio
      isPlaying.value = true;
      currentAudioSource.value = source;

      // Note: Audio playing state is now managed at the sequence level in processAudioQueue

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        source.addEventListener("ended", () => {
          isPlaying.value = false;
          currentAudioSource.value = null;
          stopLipSyncLoop();
          resetLipSyncStatus();
          // Note: Audio playing state is now managed at the sequence level in processAudioQueue
          resolve();
        });

        source.addEventListener("error", (error) => {
          console.error("TTS audio source error:", error);
          isPlaying.value = false;
          currentAudioSource.value = null;
          stopLipSyncLoop();
          // Note: Audio playing state is now managed at the sequence level in processAudioQueue
          resolve();
        });

        source.start();
      });
    } catch (error) {
      console.error("Error playing TTS audio chunk:", error);
      isPlaying.value = false;
      currentAudioSource.value = null;
      stopLipSyncLoop();
      // Clear audio playing state on error
      if (messageId) {
        messageStore.setAudioPlaying(messageId, false);
      }
    }
  };

  // Set up audio analysis for lip sync
  const setupAudioAnalysis = (source: AudioBufferSourceNode) => {
    if (!audioContext.value) return;

    // Create analyser node
    analyser = audioContext.value.createAnalyser();
    analyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE;
    analyser.smoothingTimeConstant =
      AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Connect source to analyser
    source.connect(analyser);

    // Start lip sync loop
    startLipSyncLoop();
  };

  // Start lip sync loop
  const startLipSyncLoop = () => {
    lipSyncIntervalId = setInterval(() => {
      if (isPlaying.value && analyser && dataArray) {
        const { amplitude, activeSound } = analyzeAudio();
        updateAvatarLipSync(amplitude, activeSound);
      } else {
        // Only reset if TTS is not playing AND demo is not playing
        if (!isPlaying.value && lipSyncStatus.activeSound === "none") {
          updateAvatarLipSync(0, "none");
        }
      }
    }, AUDIO_ANALYSIS_CONFIG.LIP_SYNC_INTERVAL);
  };

  // Stop lip sync loop
  const stopLipSyncLoop = () => {
    if (lipSyncIntervalId) {
      clearInterval(lipSyncIntervalId);
      lipSyncIntervalId = null;
    }
  };

  // Analyze audio for lip sync using shared utility
  const analyzeAudio = (): { amplitude: number; activeSound: string } => {
    if (!analyser || !dataArray || !audioContext.value) {
      return { amplitude: 0, activeSound: "none" };
    }

    // Get frequency data from the analyser node
    analyser.getByteFrequencyData(dataArray);

    // Use shared audio analysis utility
    const result = analyzeAudioData(
      dataArray,
      audioContext.value,
      lastAmplitude
    );
    lastAmplitude = result.amplitude;

    return result;
  };

  // Update avatar lip sync by updating the lipSyncStatus
  const updateAvatarLipSync = (amplitude: number, activeSound: string) => {
    // Update the lipSyncStatus directly
    lipSyncStatus.activeMorphValue = amplitude;
    lipSyncStatus.activeSound = activeSound;
    lipSyncStatus.activeFrequency = amplitude;
    lipSyncStatus.source = "bot"; // Set source to bot for tracking
  };

  // Reset lip sync status when bot audio ends
  const resetLipSyncStatus = () => {
    // Only reset if we're not interfering with chat audio
    if (lipSyncStatus.source === "bot") {
      lipSyncStatus.activeMorphValue = 0;
      lipSyncStatus.activeSound = "none";
      lipSyncStatus.activeFrequency = 0;
      // Keep source as "bot" but with no activity
    }
  };

  // Stop current audio playback
  const stopAudio = () => {
    // Set stopped flag to prevent further processing
    isStopped.value = true;

    // Clear audio playing state for any message that might be playing
    // This ensures the UI updates immediately when audio is stopped
    const currentMessageId =
      currentProcessingMessageId.value || audioQueue.value[0]?.messageId;
    if (currentMessageId) {
      messageStore.setAudioPlaying(currentMessageId, false);
    }

    if (currentAudioSource.value) {
      currentAudioSource.value.stop();
      currentAudioSource.value = null;
    }
    isPlaying.value = false;
    audioQueue.value = [];
    isProcessingQueue.value = false;
    currentProcessingMessageId.value = null; // Clear the current processing message ID
    stopLipSyncLoop();
    if (prebufferTimeoutId.value) {
      clearTimeout(prebufferTimeoutId.value);
      prebufferTimeoutId.value = null;
    }
  };

  // Clear audio queue for a specific message
  const clearQueueForMessage = (messageId: string) => {
    // Remove all audio chunks for this specific message from the queue
    audioQueue.value = audioQueue.value.filter(
      (item) => item.messageId !== messageId
    );

    // If this was the current processing message, stop processing
    if (currentProcessingMessageId.value === messageId) {
      isStopped.value = true;
      currentProcessingMessageId.value = null;

      // Clear audio playing state
      messageStore.setAudioPlaying(messageId, false);

      // Stop current audio source if playing
      if (currentAudioSource.value) {
        currentAudioSource.value.stop();
        currentAudioSource.value = null;
      }
      isPlaying.value = false;
    }
  };

  // Cleanup
  const cleanup = () => {
    stopAudio();
    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
  };

  return {
    enqueueAudioChunk,
    isPlaying,
    stopAudio,
    clearQueueForMessage,
    cleanup,
  };
};
