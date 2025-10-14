import { computed, onBeforeUnmount, readonly, ref } from "vue";
import { lipSyncStatus } from "~/composables/useAudioAnalysis";
import { useSharedAudioContext } from "~/composables/useSharedAudioContext";
import type { BackendAudioResponse } from "~/utils";
import { analyzeAudioData } from "~/utils/audioAnalysis";
import { isSafari } from "~/utils/browserDetection";
import { AUDIO_ANALYSIS_CONFIG } from "~/utils/constants";

/**
 * Audio playback speed options
 */
export type PlaybackSpeed = "normal" | "slow";

/**
 * Audio playback state
 */
export interface AudioPlaybackState {
  isPlaying: boolean;
  currentMessageId: string | null;
  currentSpeed: PlaybackSpeed | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Audio playback events
 */
export interface AudioPlaybackEvents {
  onPlayStart?: (messageId: string, speed: PlaybackSpeed) => void;
  onPlayEnd?: (messageId: string, speed: PlaybackSpeed) => void;
  onError?: (messageId: string, error: string) => void;
  onLoadingChange?: (messageId: string, isLoading: boolean) => void;
}

/**
 * Configuration options for audio playback
 */
export interface AudioPlaybackConfig {
  /** Default playback speed */
  defaultSpeed?: PlaybackSpeed;
  /** Slow playback rate multiplier */
  slowPlaybackRate?: number;
  /** Enable lip-sync analysis */
  enableLipSync?: boolean;
  /** Volume level (0.0 - 1.0) */
  volume?: number;
  /** Auto-cleanup on component unmount */
  autoCleanup?: boolean;
  /** Enable TTS mode with queue management */
  enableTTSMode?: boolean;
  /** Minimum chunks to prebuffer before playing */
  minPrebufferChunks?: number;
  /** Prebuffer timeout in milliseconds */
  prebufferTimeoutMs?: number;
  /** Maximum queue size to prevent memory issues */
  maxQueueSize?: number;
}

/**
 * Extended HTMLAudioElement with Safari-specific properties
 */
interface ExtendedAudioElement extends HTMLAudioElement {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
}

/**
 * Currently playing audio instance
 */
interface PlayingAudioInstance {
  messageId: string;
  speed: PlaybackSpeed;
  audioElement: HTMLAudioElement;
}

/**
 * TTS audio queue item
 */
interface TTSQueueItem {
  audioData: BackendAudioResponse;
  messageId?: string;
  speed?: PlaybackSpeed;
}

/**
 * Safari audio completion tracker
 */
interface SafariAudioTracker {
  chunks: BackendAudioResponse[];
  isComplete: boolean;
  messageId: string;
  speed?: PlaybackSpeed;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Composable for centralized audio playback with lip-sync integration
 *
 * Features:
 * - Browser compatibility (Safari vs Chrome/Firefox)
 * - Lip-sync analysis for mouth movement
 * - Cached audio playback from IndexedDB/sessionStorage
 * - TTS request handling
 * - Clean state management and cleanup
 * - Event-driven architecture
 */
export const useAudioPlayback = (
  config: AudioPlaybackConfig = {},
  events: AudioPlaybackEvents = {}
) => {
  // Configuration with defaults
  const {
    defaultSpeed = "normal",
    slowPlaybackRate: initialSlowPlaybackRate = 0.7,
    enableLipSync = true,
    volume = 0.8,
    autoCleanup = true,
    enableTTSMode = false,
    minPrebufferChunks = 2,
    prebufferTimeoutMs = 250,
    maxQueueSize = 50,
  } = config;

  // Make slowPlaybackRate reactive
  const slowPlaybackRate = ref(initialSlowPlaybackRate);

  // Shared audio context for Web Audio API
  const { audioContext, initAudioContext, ensureAudioContextRunning } =
    useSharedAudioContext();

  // State management
  const state = ref<AudioPlaybackState>({
    isPlaying: false,
    currentMessageId: null,
    currentSpeed: null,
    isLoading: false,
    error: null,
  });

  // Currently playing audio instance
  const currentAudio = ref<PlayingAudioInstance | null>(null);

  // TTS-specific state (only used when enableTTSMode is true)
  const audioQueue = ref<TTSQueueItem[]>([]);
  const isProcessingQueue = ref(false);
  const isStopped = ref(false);
  const currentProcessingMessageId = ref<string | null>(null);
  const prebufferTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null);

  // Safari-specific TTS state
  const safariAudioCompletion = ref<Map<string, SafariAudioTracker>>(new Map());
  let pendingSafariAudio: {
    audioData: BackendAudioResponse;
    messageId?: string;
    speed?: PlaybackSpeed;
    retryCount: number;
    timeoutId?: ReturnType<typeof setTimeout>;
  } | null = null;

  // Web Audio API objects for lip-sync
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;
  let lastAmplitude = 0;
  let lipSyncIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Computed properties
   */
  const isPlaying = computed(() => state.value.isPlaying);
  const currentMessageId = computed(() => state.value.currentMessageId);
  const currentSpeed = computed(() => state.value.currentSpeed);
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);

  /**
   * Check if a specific message is currently playing
   */
  const isMessagePlaying = (
    messageId: string,
    speed: PlaybackSpeed
  ): boolean => {
    return (
      currentAudio.value?.messageId === messageId &&
      currentAudio.value?.speed === speed
    );
  };

  /**
   * Create audio blob from backend response
   */
  const createAudioBlobFromBackendResponse = (
    audioData: BackendAudioResponse
  ): Blob => {
    if (audioData && audioData.type === "Buffer" && audioData.data) {
      const uint8Array = new Uint8Array(audioData.data);
      return new Blob([uint8Array], { type: "audio/wav" });
    } else {
      throw new Error("Unsupported audio data format");
    }
  };

  /**
   * Concatenate multiple audio chunks into one (TTS-specific)
   */
  const concatenateAudioChunks = (
    chunks: BackendAudioResponse[]
  ): BackendAudioResponse => {
    if (chunks.length === 1) {
      return chunks[0];
    }

    const totalLength = chunks.reduce(
      (sum, chunk) => sum + chunk.data.length,
      0
    );
    const concatenatedData = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      concatenatedData.set(chunk.data, offset);
      offset += chunk.data.length;
    }

    return {
      type: "Buffer",
      data: Array.from(concatenatedData),
    };
  };

  /**
   * Add audio chunk to TTS queue
   */
  const enqueueAudioChunk = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: PlaybackSpeed
  ): Promise<void> => {
    if (!enableTTSMode) {
      throw new Error("TTS mode is not enabled");
    }

    // Reset stopped flag whenever a new chunk is enqueued
    isStopped.value = false;

    // Safari-specific: Collect chunks instead of immediate processing
    if (isSafari() && messageId) {
      collectSafariAudioChunk(audioData, messageId, speed);
      return;
    }

    // Non-Safari: Use queue processing
    if (audioQueue.value.length >= maxQueueSize) {
      const excessChunks = audioQueue.value.length - maxQueueSize + 1;
      audioQueue.value.splice(0, excessChunks);
    }

    audioQueue.value.push({ audioData, messageId, speed });

    // Start processing after minimal prebuffer
    if (!isProcessingQueue.value) {
      if (audioQueue.value.length >= minPrebufferChunks) {
        await processAudioQueue();
      } else {
        if (prebufferTimeoutId.value) clearTimeout(prebufferTimeoutId.value);
        prebufferTimeoutId.value = setTimeout(async () => {
          await processAudioQueue();
        }, prebufferTimeoutMs);
      }
    }
  };

  /**
   * Safari-specific: Collect audio chunks and wait for completion
   */
  const collectSafariAudioChunk = (
    audioData: BackendAudioResponse,
    messageId: string,
    speed?: PlaybackSpeed
  ): void => {
    let tracker = safariAudioCompletion.value.get(messageId);
    if (!tracker) {
      tracker = {
        chunks: [],
        isComplete: false,
        messageId,
        speed,
      };
      safariAudioCompletion.value.set(messageId, tracker);

      // Set playing state immediately when first chunk arrives
      events.onPlayStart?.(messageId, speed || defaultSpeed);
    }

    tracker.chunks.push(audioData);

    if (tracker.timeoutId) {
      clearTimeout(tracker.timeoutId);
    }

    tracker.timeoutId = setTimeout(async () => {
      tracker.isComplete = true;
      const concatenatedData = concatenateAudioChunks(tracker.chunks);

      try {
        await playCachedAudio(
          messageId,
          concatenatedData,
          speed || defaultSpeed
        );
      } catch (error) {
        events.onError?.(messageId, `Safari audio playback failed: ${error}`);
      } finally {
        safariAudioCompletion.value.delete(messageId);
      }
    }, 500);
  };

  /**
   * Mark Safari audio as complete
   */
  const markSafariAudioComplete = async (messageId: string): Promise<void> => {
    const tracker = safariAudioCompletion.value.get(messageId);
    if (tracker && !tracker.isComplete) {
      if (tracker.timeoutId) {
        clearTimeout(tracker.timeoutId);
      }

      tracker.isComplete = true;

      if (tracker.chunks.length > 0) {
        const concatenatedData = concatenateAudioChunks(tracker.chunks);

        try {
          await playCachedAudio(
            messageId,
            concatenatedData,
            tracker.speed || defaultSpeed
          );
        } catch (error) {
          events.onError?.(
            messageId,
            `Safari audio completion failed: ${error}`
          );
        } finally {
          safariAudioCompletion.value.delete(messageId);
        }
      }
    }
  };

  /**
   * Process TTS audio queue
   */
  const processAudioQueue = async (): Promise<void> => {
    if (isProcessingQueue.value || audioQueue.value.length === 0) {
      return;
    }

    isProcessingQueue.value = true;

    const firstItem = audioQueue.value[0];
    let currentMessageId: string | undefined;
    let currentSpeed: PlaybackSpeed | undefined;

    if (firstItem) {
      currentMessageId = firstItem.messageId;
      currentSpeed = firstItem.speed;

      if (
        currentMessageId &&
        currentMessageId !== currentProcessingMessageId.value
      ) {
        currentProcessingMessageId.value = currentMessageId;
      }

      if (currentMessageId && currentSpeed && !isStopped.value) {
        events.onPlayStart?.(currentMessageId, currentSpeed);
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

      if (currentMessageId && !isStopped.value) {
        events.onPlayEnd?.(currentMessageId, currentSpeed || defaultSpeed);
      }
    } catch (error) {
      if (currentMessageId) {
        events.onError?.(currentMessageId, `Queue processing failed: ${error}`);
      }
    } finally {
      isProcessingQueue.value = false;
    }
  };

  /**
   * Play individual audio chunk (TTS-specific)
   */
  const playAudioChunk = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: PlaybackSpeed
  ): Promise<void> => {
    try {
      // Cleanup any existing Web Audio resources before starting new playback
      cleanupWebAudioResources();

      if (!audioContext.value) {
        await initAudioContext();
      }

      if (!audioData || !audioData.data || audioData.data.length === 0) {
        return;
      }

      // For Safari, use HTMLAudioElement fallback
      if (isSafari()) {
        return await playAudioWithElement(audioData, messageId, speed);
      }
      // For non-Safari, use Web Audio API with AudioBufferSourceNode (like original TTS manager)
      await playAudioWithMSE(audioData, messageId, speed);
    } catch (error) {
      if (messageId) {
        events.onError?.(messageId, `Audio chunk playback failed: ${error}`);
      }
    }
  };

  /**
   * Play audio using MediaSource + <audio> element (works with Chrome/Firefox/Safari)
   */
  const playAudioWithMSE = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: PlaybackSpeed
  ): Promise<void> => {
    try {
      if (!audioContext.value) {
        throw new Error("AudioContext not available");
      }

      // Convert backend response to Blob (MP3/OGG/WEBM chunks work best with MSE)
      const audioBlob = createAudioBlobFromBackendResponse(audioData);

      // Create MediaSource and <audio> element
      const mediaSource = new MediaSource();
      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(mediaSource);
      audioElement.autoplay = true;
      audioElement.playbackRate =
        speed === "slow" ? slowPlaybackRate.value : 1.0;

      // Store current audio for cleanup
      currentAudio.value = {
        messageId: messageId || "unknown",
        speed: speed || defaultSpeed,
        audioElement,
      };

      // When MediaSource is ready, append buffer
      mediaSource.addEventListener("sourceopen", async () => {
        const mimeType = "audio/mpeg"; // or "audio/webm; codecs=opus" depending on backend format
        if (!MediaSource.isTypeSupported(mimeType)) {
          console.error("MIME type not supported:", mimeType);
          return;
        }

        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);

        // Load the ArrayBuffer from blob
        const arrayBuffer = await audioBlob.arrayBuffer();

        sourceBuffer.addEventListener("updateend", () => {
          if (mediaSource.readyState === "open") {
            mediaSource.endOfStream();
          }
        });

        sourceBuffer.appendBuffer(arrayBuffer);
      });

      // Connect <audio> element to Web Audio for lipsync
      const sourceNode =
        audioContext.value.createMediaElementSource(audioElement);
      setupAudioAnalysis(sourceNode);

      // Wait for playback to end
      await new Promise<void>((resolve, reject) => {
        audioElement.addEventListener("ended", () => resolve());
        audioElement.addEventListener("error", (err) => reject(err));
        audioElement.play().catch(reject);
      });
    } catch (error) {
      console.error("MSE playback failed:", error);
      throw error;
    }
  };

  /**
   * Set up audio analysis for any AudioNode (AudioBufferSourceNode or MediaElementAudioSourceNode)
   */
  const setupAudioAnalysis = (source: AudioNode): void => {
    if (!audioContext.value) return;

    // Create analyser node
    analyser = audioContext.value.createAnalyser();
    analyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE;
    analyser.smoothingTimeConstant =
      AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Connect source -> analyser
    source.connect(analyser);

    // Connect analyser -> destination (so audio is actually audible)
    analyser.connect(audioContext.value.destination);

    // Start lip-sync loop (bot/user depending on your logic)
    startLipSyncLoop("bot");
  };

  /**
   * Safari-specific: HTMLAudioElement fallback
   */
  const playAudioWithElement = async (
    audioData: BackendAudioResponse,
    messageId?: string,
    speed?: PlaybackSpeed
  ): Promise<void> => {
    try {
      if (!audioData.data || audioData.data.length === 0) {
        throw new Error("Invalid audio data: empty or missing data array");
      }

      const audioBlob = createAudioBlobFromBackendResponse(audioData);

      if (audioBlob.size === 0) {
        throw new Error("Invalid audio blob: zero size after creation");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioUrl);

      if (isSafari()) {
        audioElement.preload = "auto";
        audioElement.crossOrigin = "anonymous";
        audioElement.volume = 1.0;
      }

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio loading timeout after 5 seconds"));
        }, 5000);

        const onCanPlay = () => {
          clearTimeout(timeout);
          audioElement.removeEventListener("canplay", onCanPlay);
          audioElement.removeEventListener("error", onError);
          resolve(undefined);
        };

        const onError = (event: Event) => {
          clearTimeout(timeout);
          audioElement.removeEventListener("canplay", onCanPlay);
          audioElement.removeEventListener("error", onError);
          reject(
            new Error(
              `Audio loading error: ${audioElement.error?.message || "Unknown error"}`
            )
          );
        };

        audioElement.addEventListener("canplay", onCanPlay, { once: true });
        audioElement.addEventListener("error", onError, { once: true });
        audioElement.load();
      });
      audioElement.playbackRate =
        speed === "slow" ? slowPlaybackRate.value : 1.0;

      await audioElement.play();

      // Setup lip-sync for Safari
      if (enableLipSync) {
        setTimeout(async () => {
          try {
            await setupSafariLipSync(audioElement);
          } catch (error) {
            console.warn("Safari lip-sync setup failed:", error);
          }
        }, 200);
      }

      audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      if (messageId) {
        events.onError?.(messageId, `Safari audio playback failed: ${error}`);
      }
    }
  };

  /**
   * Setup Web Audio API analysis for lip-sync (Chrome/Firefox)
   */
  const setupWebAudioAnalysis = async (
    audioElement: HTMLAudioElement
  ): Promise<void> => {
    try {
      await initAudioContext();
      await ensureAudioContextRunning();

      if (!audioContext.value) {
        throw new Error("AudioContext not available");
      }

      // Create analyser with optimized settings for Chrome
      analyser = audioContext.value.createAnalyser();
      analyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant =
        AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Connect audio element to analyser
      const source = audioContext.value.createMediaElementSource(audioElement);
      source.connect(analyser);

      // Always connect analyser to destination for audio output
      // When using MediaElementSource, the HTMLAudioElement becomes muted
      // and the Web Audio API handles the audio output
      analyser.connect(audioContext.value.destination);

      // Start lip-sync loop for cached audio
      startLipSyncLoop("replay");
    } catch (error) {
      console.error("🎵 Web Audio API setup failed:", error);
      throw error;
    }
  };

  /**
   * Start lip-sync analysis loop
   */
  const startLipSyncLoop = (source: "bot" | "replay" = "replay"): void => {
    // Stop any existing lip-sync loop first
    stopLipSyncLoop();

    // Reset lip-sync status immediately
    lipSyncStatus.activeSound = "none";
    lipSyncStatus.activeMorphValue = 0;
    lipSyncStatus.source = source;

    // Add a delay to ensure audio is flowing and analyser is ready
    setTimeout(() => {
      lipSyncIntervalId = setInterval(() => {
        if (analyser && dataArray && audioContext.value) {
          // Get frequency data
          analyser.getByteFrequencyData(dataArray);

          // Analyze the audio data with Chrome-optimized settings
          const result = analyzeAudioData(
            dataArray,
            audioContext.value,
            lastAmplitude,
            {
              threshold: 0.015, // Lower threshold for better sensitivity
              smoothness: 0.3, // Less smoothing for more responsive lip-sync
              speechRange: { start: 150, end: 3000 }, // Focus on speech frequencies
            }
          );
          lastAmplitude = result.amplitude;

          // Update lip sync status
          lipSyncStatus.activeSound = result.activeSound;
          lipSyncStatus.activeMorphValue = result.amplitude;
          lipSyncStatus.source = source;
        }
      }, AUDIO_ANALYSIS_CONFIG.LIP_SYNC_INTERVAL);
    }, 200); // 200ms delay to ensure audio is flowing and analyser is ready
  };

  /**
   * Stop lip-sync analysis loop
   */
  const stopLipSyncLoop = (): void => {
    if (lipSyncIntervalId) {
      clearInterval(lipSyncIntervalId);
      lipSyncIntervalId = null;
    }

    // Clear lip sync status
    lipSyncStatus.activeSound = "none";
    lipSyncStatus.activeMorphValue = 0;
  };

  /**
   * Cleanup Web Audio API resources
   */
  const cleanupWebAudioResources = (): void => {
    // Stop lip-sync loop
    stopLipSyncLoop();

    // Disconnect and cleanup analyser
    if (analyser) {
      try {
        analyser.disconnect();
      } catch (error) {
        // Silently handle disconnect errors
      }
      analyser = null;
    }

    // Clear data array
    dataArray = null;
    lastAmplitude = 0;

    // Reset lip-sync status to prevent glitches
    lipSyncStatus.activeSound = "none";
    lipSyncStatus.activeMorphValue = 0;
    lipSyncStatus.source = "replay"; // Default to replay source
  };

  /**
   * Setup Safari-compatible lip-sync
   */
  const setupSafariLipSync = async (
    audioElement: HTMLAudioElement
  ): Promise<void> => {
    try {
      await initAudioContext();
      await ensureAudioContextRunning();

      if (!audioContext.value) {
        throw new Error("AudioContext not available");
      }

      // Create analyser for Safari
      analyser = audioContext.value.createAnalyser();
      analyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant =
        AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Fetch and decode audio for Safari
      const response = await fetch(audioElement.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.value.decodeAudioData(arrayBuffer);

      // Create buffer source
      const source = audioContext.value.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = audioElement.playbackRate;

      // gain node
      const gainNode = audioContext.value.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);

      // Connect to analyser
      source.connect(analyser);

      source.start();

      // Start lip-sync loop for Safari cached audio
      startLipSyncLoop("replay");
    } catch (error) {
      console.error("🎵 Safari lip-sync setup failed:", error);
      throw error;
    }
  };

  /**
   * Play audio with specified speed
   */
  const playAudio = async (
    audioElement: HTMLAudioElement,
    speed: PlaybackSpeed
  ): Promise<void> => {
    // Set playback rate and Safari-specific properties

    if (speed === "slow") {
      audioElement.playbackRate = slowPlaybackRate.value;
      (audioElement as ExtendedAudioElement).webkitPreservesPitch = false;
      (audioElement as ExtendedAudioElement).mozPreservesPitch = false;
    } else {
      audioElement.playbackRate = 1.0;
    }

    // Set volume
    audioElement.volume = volume;

    // Play audio
    await audioElement.play();
  };

  /**
   * Play cached audio from BackendAudioResponse
   */
  const playCachedAudio = async (
    messageId: string,
    audioData: BackendAudioResponse,
    speed: PlaybackSpeed = defaultSpeed
  ): Promise<void> => {
    try {
      // Stop any currently playing audio and cleanup Web Audio resources
      await stopAllAudio();
      cleanupWebAudioResources();

      // Set loading state
      setLoading(messageId, true);
      clearError(messageId);

      // Create audio blob and element
      const audioBlob = createAudioBlobFromBackendResponse(audioData);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioUrl);

      // Store current audio instance
      currentAudio.value = {
        messageId,
        speed,
        audioElement,
      };

      // Update state
      state.value.isPlaying = true;
      state.value.currentMessageId = messageId;
      state.value.currentSpeed = speed;

      // Play audio
      await playAudio(audioElement, speed);

      // Setup lip-sync if enabled
      if (enableLipSync) {
        setTimeout(async () => {
          try {
            if (isSafari()) {
              await setupSafariLipSync(audioElement);
            } else {
              await setupWebAudioAnalysis(audioElement);
            }
          } catch (error) {
            console.warn("Lip-sync setup failed:", error);
            // Continue without lip-sync
          }
        }, 50);
      }

      // Set up event listeners
      audioElement.onended = () => {
        handleAudioEnded(messageId, speed);
      };

      audioElement.onerror = () => {
        handleAudioError(messageId, "Audio playback failed");
      };

      // Clear loading state
      setLoading(messageId, false);

      // Emit play start event
      events.onPlayStart?.(messageId, speed);
    } catch (error) {
      handleAudioError(messageId, `Failed to play audio: ${error}`);
    }
  };

  /**
   * Stop all audio playback
   */
  const stopAllAudio = async (): Promise<void> => {
    // Set stopped flag for TTS mode
    if (enableTTSMode) {
      isStopped.value = true;
    }

    if (currentAudio.value) {
      try {
        const { messageId, speed, audioElement } = currentAudio.value;

        // Stop audio
        audioElement.pause();
        audioElement.currentTime = 0;

        // Cleanup
        URL.revokeObjectURL(audioElement.src);
        cleanupWebAudioResources();

        // Clear state
        currentAudio.value = null;
        state.value.isPlaying = false;
        state.value.currentMessageId = null;
        state.value.currentSpeed = null;

        // Emit play end event
        events.onPlayEnd?.(messageId, speed);
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    } else {
      // Even if no current audio, cleanup Web Audio resources
      cleanupWebAudioResources();

      // Reset state
      state.value.isPlaying = false;
      state.value.currentMessageId = null;
      state.value.currentSpeed = null;
    }

    // TTS-specific cleanup
    if (enableTTSMode) {
      // Clear audio queue
      audioQueue.value = [];
      isProcessingQueue.value = false;
      currentProcessingMessageId.value = null;

      // Clear prebuffer timeout
      if (prebufferTimeoutId.value) {
        clearTimeout(prebufferTimeoutId.value);
        prebufferTimeoutId.value = null;
      }

      // Clear Safari completion tracking
      safariAudioCompletion.value.forEach((tracker) => {
        if (tracker.timeoutId) {
          clearTimeout(tracker.timeoutId);
        }
      });
      safariAudioCompletion.value.clear();

      // Clear pending Safari audio
      if (pendingSafariAudio?.timeoutId) {
        clearTimeout(pendingSafariAudio.timeoutId);
      }
      pendingSafariAudio = null;
    }
  };

  /**
   * Handle audio ended event
   */
  const handleAudioEnded = (messageId: string, speed: PlaybackSpeed): void => {
    if (currentAudio.value?.messageId === messageId) {
      stopAllAudio();
    }
  };

  /**
   * Handle audio error
   */
  const handleAudioError = (messageId: string, errorMessage: string): void => {
    console.error("Audio error:", errorMessage);

    setError(messageId, errorMessage);
    setLoading(messageId, false);
    stopAllAudio();

    events.onError?.(messageId, errorMessage);
  };

  /**
   * Set loading state for a message
   */
  const setLoading = (messageId: string, loading: boolean): void => {
    state.value.isLoading = loading;
    events.onLoadingChange?.(messageId, loading);
  };

  /**
   * Set error state
   */
  const setError = (messageId: string, errorMessage: string): void => {
    state.value.error = errorMessage;
  };

  /**
   * Clear error state
   */
  const clearError = (messageId: string): void => {
    state.value.error = null;
  };

  /**
   * Clear audio queue for a specific message (TTS-specific)
   */
  const clearQueueForMessage = (messageId: string): void => {
    if (!enableTTSMode) {
      return;
    }

    // Remove all audio chunks for this specific message from the queue
    audioQueue.value = audioQueue.value.filter(
      (item) => item.messageId !== messageId
    );

    // Clear Safari completion tracking for this message
    const tracker = safariAudioCompletion.value.get(messageId);
    if (tracker) {
      if (tracker.timeoutId) {
        clearTimeout(tracker.timeoutId);
      }
      safariAudioCompletion.value.delete(messageId);
    }

    // If this was the current processing message, stop processing
    if (currentProcessingMessageId.value === messageId) {
      isStopped.value = true;
      currentProcessingMessageId.value = null;
      events.onPlayEnd?.(messageId, defaultSpeed);
    }
  };

  /**
   * Comprehensive cleanup of all resources
   */
  const cleanup = (): void => {
    // Stop all audio first
    stopAllAudio();

    // Cleanup Web Audio resources
    cleanupWebAudioResources();

    // Reset all state to initial values
    state.value = {
      isPlaying: false,
      currentMessageId: null,
      currentSpeed: null,
      isLoading: false,
      error: null,
    };

    // Clear current audio instance
    currentAudio.value = null;

    // Reset TTS-specific state regardless of mode
    audioQueue.value = [];
    isProcessingQueue.value = false;
    currentProcessingMessageId.value = null;
    isStopped.value = false;

    // Clear prebuffer timeout
    if (prebufferTimeoutId.value) {
      clearTimeout(prebufferTimeoutId.value);
      prebufferTimeoutId.value = null;
    }

    // Clear Safari completion tracking
    safariAudioCompletion.value = new Map();
    pendingSafariAudio = null;

    // Reset lip-sync status
    lipSyncStatus.activeSound = "none";
    lipSyncStatus.activeMorphValue = 0;
    lipSyncStatus.source = "replay";
  };

  /**
   * Update slow playback rate dynamically
   */
  const setSlowPlaybackRate = (rate: number): void => {
    slowPlaybackRate.value = rate;
  };

  /**
   * Check if composable is in clean state
   */
  const isClean = computed(() => {
    return (
      !state.value.isPlaying &&
      !currentAudio.value &&
      !lipSyncIntervalId &&
      !analyser &&
      audioQueue.value.length === 0 &&
      !isProcessingQueue.value
    );
  });

  // Auto-cleanup on unmount if enabled
  if (autoCleanup) {
    onBeforeUnmount(() => {
      cleanup();
    });
  }

  return {
    // State
    state: readonly(state),
    isPlaying,
    currentMessageId,
    currentSpeed,
    isLoading,
    error,

    // Methods
    playCachedAudio,
    stopAllAudio,
    isMessagePlaying,
    setLoading,
    setError,
    clearError,
    cleanup,

    // Update slow playback rate dynamically
    setSlowPlaybackRate,

    // Force complete reset (useful when switching between audio modes)
    forceReset: cleanup,

    // Check if composable is in clean state
    isClean,

    // TTS-specific methods (only available when enableTTSMode is true)
    ...(enableTTSMode && {
      enqueueAudioChunk,
      markSafariAudioComplete,
      clearQueueForMessage,
      isProcessingQueue: readonly(isProcessingQueue),
      audioQueue: readonly(audioQueue),
    }),

    // Configuration
    config: {
      defaultSpeed,
      slowPlaybackRate,
      enableLipSync,
      volume,
      enableTTSMode,
    },
  };
};
