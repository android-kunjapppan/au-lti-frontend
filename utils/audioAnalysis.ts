// Shared audio analysis utilities to avoid code duplication

export interface FrequencyBands {
  VERY_LOW: { start: number; end: number };
  LOW: { start: number; end: number };
  MID: { start: number; end: number };
  HIGH: { start: number; end: number };
  VERY_HIGH: { start: number; end: number };
}

export const FREQUENCY_BANDS: FrequencyBands = {
  VERY_LOW: { start: 100, end: 300 },
  LOW: { start: 300, end: 600 },
  MID: { start: 600, end: 1200 },
  HIGH: { start: 1200, end: 2000 },
  VERY_HIGH: { start: 2000, end: 4000 },
};

export interface AudioAnalysisResult {
  amplitude: number;
  activeSound: string;
}

export interface AudioAnalysisConfig {
  threshold: number;
  smoothness: number;
  speechRange: { start: number; end: number };
}

export const DEFAULT_AUDIO_CONFIG: AudioAnalysisConfig = {
  threshold: 0.02,
  smoothness: 0.5,
  speechRange: { start: 150, end: 3000 },
};

/**
 * Analyzes audio data and returns amplitude and detected phoneme
 * @param dataArray - Frequency data from analyser
 * @param audioContext - Web Audio API context
 * @param lastAmplitude - Previous amplitude for smoothing
 * @param config - Analysis configuration
 * @returns AudioAnalysisResult with amplitude and activeSound
 */
export const analyzeAudioData = (
  dataArray: Uint8Array,
  audioContext: AudioContext,
  lastAmplitude: number,
  config: AudioAnalysisConfig = DEFAULT_AUDIO_CONFIG
): AudioAnalysisResult => {
  // Calculate frequency bin width
  const nyquist = audioContext.sampleRate / 2;
  const binWidth = nyquist / dataArray.length;

  // Helper to convert frequency (Hz) to bin index
  const getBin = (freq: number) => Math.floor(freq / binWidth);

  // Get bin indices for each band
  const veryLowStart = getBin(FREQUENCY_BANDS.VERY_LOW.start);
  const veryLowEnd = getBin(FREQUENCY_BANDS.VERY_LOW.end);
  const lowStart = getBin(FREQUENCY_BANDS.LOW.start);
  const lowEnd = getBin(FREQUENCY_BANDS.LOW.end);
  const midStart = getBin(FREQUENCY_BANDS.MID.start);
  const midEnd = getBin(FREQUENCY_BANDS.MID.end);
  const highStart = getBin(FREQUENCY_BANDS.HIGH.start);
  const highEnd = getBin(FREQUENCY_BANDS.HIGH.end);
  const veryHighStart = getBin(FREQUENCY_BANDS.VERY_HIGH.start);
  const veryHighEnd = getBin(FREQUENCY_BANDS.VERY_HIGH.end);

  // Helper to calculate average amplitude in a frequency range
  const calculateAverage = (start: number, end: number) => {
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
  if (maxAmp > config.threshold) {
    if (maxAmp === veryLowAmp) activeSound = "uuu";
    else if (maxAmp === lowAmp) activeSound = "www";
    else if (maxAmp === midAmp) activeSound = "rrr";
    else if (maxAmp === highAmp) activeSound = "eh";
    else if (maxAmp === veryHighAmp) activeSound = "sss";
  }

  // Calculate amplitude in the speech frequency range
  const startBin = getBin(config.speechRange.start);
  const endBin = getBin(config.speechRange.end);

  let sum = 0;
  const count = endBin - startBin + 1;
  for (let i = startBin; i <= endBin; i++) {
    sum += dataArray[i];
  }

  // Normalize amplitude to [0, 1]
  const rawAmplitude = count > 0 ? sum / (count * 255) : 0;

  // Smooth amplitude for more natural mouth movement
  const amplitude =
    lastAmplitude * config.smoothness + rawAmplitude * (1 - config.smoothness);

  return { amplitude, activeSound };
};
