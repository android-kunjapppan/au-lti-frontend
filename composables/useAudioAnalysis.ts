import { reactive, ref } from "vue";
import { useChatbotStore } from "~/stores/useChatbotStore";

// Create a shared singleton lipSyncStatus object
const sharedLipSyncStatus = reactive<{
  activeSound: string;
  activeMorphValue: number;
  activeFrequency: number;
  source: "bot" | "replay";
}>({
  activeSound: "none", // Detected sound/phoneme
  activeMorphValue: 0, // Value for mouth morph target
  activeFrequency: 0, // Amplitude in selected frequency range
  source: "bot", // Source of the audio
});

// Export the shared lipSyncStatus for direct access
export { sharedLipSyncStatus as lipSyncStatus };

/**
 * Composable for analyzing audio and extracting lip sync data.
 * Provides audio controls, frequency analysis, and state for lip sync.
 */
export const useAudioAnalysis = () => {
  // Reference to the HTMLAudioElement used for playback
  const audioElement = ref<HTMLAudioElement | null>(null);
  // Whether the audio is currently playing
  const isPlaying = ref<boolean>(false);
  // Audio volume (0.0 - 1.0)
  const volume = ref<number>(0.8);
  // Use the shared lipSyncStatus object
  const lipSyncStatus = sharedLipSyncStatus;
  // Web Audio API objects
  let audioContext: AudioContext | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;
  // Last smoothed amplitude value for morphing
  let lastAmplitude = 0;
  // Interval ID for the lip sync update loop
  let lipSyncIntervalId: ReturnType<typeof setInterval> | null = null;
  // Parameters for audio analysis, tweakable via UI
  const params = ref({
    sensitivity: 6.0,
    threshold: 0.02,
    smoothness: 0.5,
    minFrequency: 150,
    maxFrequency: 3000,
  });
  /**
   * Sets up the Web Audio API context and connects the audio element.
   * Also starts the lip sync update loop.
   */
  const setupAudioAnalysis = (): void => {
    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = AUDIO_ANALYSIS_CONFIG.FFT_SIZE; // Determines frequency resolution
      analyser.smoothingTimeConstant =
        AUDIO_ANALYSIS_CONFIG.SMOOTHING_TIME_CONSTANT;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      // Delay to ensure audio element is mounted and ready
      setTimeout(() => {
        const audio = audioElement.value;
        if (!audio || !audioContext || !analyser) return;
        audio.volume = volume.value;
        // Create a source node from the audio element
        audioSource = audioContext.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);
        startLipSyncLoop();
      }, AUDIO_ANALYSIS_CONFIG.SETUP_DELAY);
    } catch (error) {
      console.error("Audio setup failed:", error);
    }
  };
  /**
   * Starts a fast interval loop to update lip sync status from audio.
   * Runs every ~12ms for smooth mouth movement.
   */
  const startLipSyncLoop = (): void => {
    lipSyncIntervalId = setInterval(() => {
      // Check if TTS is playing first - if so, don't interfere at all
      const chatbotStore = useChatbotStore();
      const ttsIsPlaying = chatbotStore.ttsAudioManager.isPlaying;

      if (ttsIsPlaying) {
        // TTS is playing, don't interfere with its lip sync
        return;
      }

      if (isPlaying.value && audioElement.value && !audioElement.value.paused) {
        // Analyze audio and update lip sync status
        const { amplitude, activeSound: sound } = analyzeAudio();
        lipSyncStatus.activeSound = sound;
        lipSyncStatus.activeMorphValue = amplitude;
      } else {
        // Only reset mouth if demo audio is not playing AND TTS is not playing AND replay audio is not actively playing
        // Note: Replay audio manages its own lip sync state, so we don't interfere
        if (
          !isPlaying.value &&
          !ttsIsPlaying &&
          lipSyncStatus.source !== "replay"
        ) {
          // Reset mouth if no audio is playing
          lipSyncStatus.activeSound = "none";
          lipSyncStatus.activeMorphValue = 0;
        }
      }
    }, AUDIO_ANALYSIS_CONFIG.LIP_SYNC_INTERVAL);
  };
  /**
   * Stops the lip sync update loop.
   */
  const stopLipSyncLoop = (): void => {
    if (lipSyncIntervalId) {
      clearInterval(lipSyncIntervalId);
      lipSyncIntervalId = null;
    }
  };
  /**
   * Plays or pauses the audio element, and manages audio context state.
   */
  const playPauseAudio = async (): Promise<void> => {
    try {
      const audio = audioElement.value;
      if (!audio) return;
      if (isPlaying.value) {
        audio.pause();
        isPlaying.value = false;
      } else {
        // Resume audio context if it was suspended (browser autoplay policy)
        if (audioContext?.state === "suspended") {
          await audioContext.resume();
        }
        await audio.play();
        isPlaying.value = true;
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };
  /**
   * Handler for when the audio ends.
   */
  const handleAudioEnded = (): void => {
    isPlaying.value = false;
  };
  /**
   * Updates the audio element's volume to match the reactive volume value.
   */
  const updateVolume = (): void => {
    if (audioElement.value) {
      audioElement.value.volume = volume.value;
    }
  };
  /**
   * Analyzes the current audio frame and returns amplitude and detected sound.
   * - Calculates amplitude in several frequency bands for phoneme detection.
   * - Calculates overall amplitude in a user-defined frequency range for morphing.
   */
  const analyzeAudio = (): { amplitude: number; activeSound: string } => {
    if (!analyser || !dataArray || !audioContext)
      return { amplitude: 0, activeSound: "none" };
    // Get frequency data from the analyser node
    analyser.getByteFrequencyData(dataArray);
    // Calculate frequency bin width
    const nyquist = audioContext.sampleRate / 2;
    const binWidth = nyquist / analyser.frequencyBinCount;
    // Use centralized frequency bands for phoneme detection
    const bands = AUDIO_ANALYSIS_CONFIG.FREQUENCY_BANDS;
    // Helper to convert frequency (Hz) to bin index
    const getBin = (freq: number) => Math.floor(freq / binWidth);
    // Get bin indices for each band
    const veryLowStart = getBin(bands.VERY_LOW.start);
    const veryLowEnd = getBin(bands.VERY_LOW.end);
    const lowStart = getBin(bands.LOW.start);
    const lowEnd = getBin(bands.LOW.end);
    const midStart = getBin(bands.MID.start);
    const midEnd = getBin(bands.MID.end);
    const highStart = getBin(bands.HIGH.start);
    const highEnd = getBin(bands.HIGH.end);
    const veryHighStart = getBin(bands.VERY_HIGH.start);
    const veryHighEnd = getBin(bands.VERY_HIGH.end);
    // Helper to calculate average amplitude in a frequency range
    const calculateAverage = (start: number, end: number) => {
      if (!dataArray) return 0;
      let sum = 0;
      const count = end - start + 1;
      for (let i = start; i <= end; i++) {
        sum += dataArray[i];
      }
      // Normalize to [0, 1]
      return count > 0 ? sum / (count * 255) : 0;
    };
    // Calculate average amplitude for each band
    const veryLowAmp = calculateAverage(veryLowStart, veryLowEnd);
    const lowAmp = calculateAverage(lowStart, lowEnd);
    const midAmp = calculateAverage(midStart, midEnd);
    const highAmp = calculateAverage(highStart, highEnd);
    const veryHighAmp = calculateAverage(veryHighStart, veryHighEnd);
    // Find the band with the highest amplitude
    const maxAmp = Math.max(veryLowAmp, lowAmp, midAmp, highAmp, veryHighAmp);
    // Map the loudest band to a phoneme/sound label
    let activeSound = "none";
    if (maxAmp > params.value.threshold) {
      if (maxAmp === veryLowAmp) activeSound = "uuu";
      else if (maxAmp === lowAmp) activeSound = "www";
      else if (maxAmp === midAmp) activeSound = "rrr";
      else if (maxAmp === highAmp) activeSound = "eh";
      else if (maxAmp === veryHighAmp) activeSound = "sss";
    }
    // Calculate amplitude in the user-defined frequency range for morphing
    const startBin = getBin(params.value.minFrequency);
    const endBin = getBin(params.value.maxFrequency);
    let sum = 0;
    const count = endBin - startBin + 1;
    for (let i = startBin; i <= endBin; i++) {
      sum += dataArray[i];
    }
    // Normalize amplitude to [0, 1]
    const rawAmplitude = count > 0 ? sum / (count * 255) : 0;
    // Smooth amplitude for more natural mouth movement
    lastAmplitude =
      lastAmplitude * params.value.smoothness +
      rawAmplitude * (1 - params.value.smoothness);
    // Store the smoothed amplitude for debugging/visualization
    lipSyncStatus.activeFrequency = lastAmplitude;
    return { amplitude: lastAmplitude, activeSound };
  };
  /**
   * Cleans up audio resources and stops the lip sync loop.
   */
  const cleanup = () => {
    stopLipSyncLoop();
    if (audioContext) audioContext.close();
  };
  // Expose state and methods for use in components
  return {
    audioElement,
    isPlaying,
    volume,
    lipSyncStatus,
    params,
    setupAudioAnalysis,
    playPauseAudio,
    handleAudioEnded,
    updateVolume,
    analyzeAudio,
    cleanup,
  };
};
