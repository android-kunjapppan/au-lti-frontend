import type * as THREE from "three";
// Enum of supported languages and associated ISO codes
export const SupportedLang = {
  SPANISH: "es",
} as const;

export const CONVERSATION_ID = "c8c8e60a-1900-46d2-8c03-348f241ac0e5";

export const ERROR_MESSAGES = {
  TRANSLATION:
    "Something failed when attempting to translate this message, try again later",
  FEEDBACK:
    "Something failed when attempting to get feedback for this message, try again later",
  USER_TEXT: "Failed to send message. Please try again.",
  WS_OPEN:
    "Something failed when attempting to connect to the websocket, try again later",
  WS_CLOSE:
    "Something failed when attempting to close the websocket, try again later",
} as const;

export const COMMON_ERROR_MESSAGES = {
  NO_JWT: "No JWT token found",
  NO_USER_INFO: "No user info found",
  NO_CANVAS_JWT: "No Canvas JWT available",
  NO_ASSIGNMENT_ID: "No assignment ID available",
  NO_COURSE_ID: "No course ID available",
  NO_USER_ID: "No user ID available",
  NO_USER_NAME: "No user name available",
} as const;

export const HTTP_ERROR_MESSAGES = {
  NOT_OK: "Network error!",
} as const;

// STT Error messages mapping
export const STT_ERROR_MESSAGES = {
  network:
    "Speech recognition network error. Please check your internet connection and try again.",
  "not-allowed":
    "Microphone access denied. Please allow microphone permissions and try again.",
  "no-speech": "No speech detected. Please try speaking again.",
  disabled:
    "Speech recognition is temporarily disabled. Please refresh the page to try again.",
  notSupported:
    "Speech recognition is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.",
  notSecure:
    "Speech recognition requires a secure connection (HTTPS). Please access this site via HTTPS.",
  persistent:
    "Speech recognition is temporarily disabled due to persistent errors. Please refresh the page or try again later.",
} as const;

// STT Configuration constants
export const STT_CONFIG = {
  SILENCE_THRESHOLD: 1500, // ms - Time to wait before auto-stopping STT
  GRACEFUL_STOP_DELAY: 2000, // ms - Time to wait before force-stopping STT
  MAX_CONSECUTIVE_ERRORS: 3, // Maximum consecutive errors before disabling STT
  TRANSLATION_TIMEOUT_MS: 5000, // ms - Timeout for translation requests
  BROWSER_TIMEOUT_MS: 28000, // ms - Timeout to handle browser STT timeout
} as const;

// Audio Recording Configuration constants
export const AUDIO_CONFIG = {
  SAFETY_TIMEOUT_MS: 30000, // ms - Maximum recording time to prevent infinite recording
  SAMPLE_RATE: 16000, // Hz - Audio sample rate
  CHANNEL_COUNT: 1, // Mono audio
  MIME_TYPE: "audio/webm;codecs=opus", // Preferred audio format
  ALTERNATIVE_MIME_TYPES: [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ] as const,
  CHUNK_INTERVAL: 1000, // ms - Interval for audio data chunks
  PROCESSING_DELAY: 500, // ms - Delay to ensure all audio data is processed
  UPLOAD_TIMEOUT_MS: 5000, // ms - Maximum wait time for transcription before clearing pending audio
} as const;

// Waveform Configuration constants
export const WAVEFORM_CONFIG = {
  UPDATE_INTERVAL: 100, // ms - Interval for waveform updates
  BAR_COUNT: 30, // Number of waveform bars
  MAX_HEIGHT: 20, // Maximum height of waveform bars in pixels
} as const;

// WebSocket Configuration constants
export const WEBSOCKET_CONFIG = {
  RECONNECT_DELAY: 1000, // ms - Base delay for reconnection attempts
  MAX_RECONNECT_DELAY: 30000, // ms - Maximum delay between reconnection attempts
  BACKOFF_MULTIPLIER: 1.5, // Exponential backoff multiplier
  MAX_RETRIES: 5, // Maximum number of reconnection attempts
  ERROR_TIMEOUT: 2000, // ms - Timeout for error handling
} as const;

export const DEFAULT_REQUEST_TIMEOUT_LENGTH = 2 * 60 * 1000;

// Audio Analysis Configuration constants
export const AUDIO_ANALYSIS_CONFIG = {
  SETUP_DELAY: 100, // ms - Delay to ensure audio element is mounted and ready
  LIP_SYNC_INTERVAL: 12, // ms - Interval for lip sync updates (~83 FPS)
  FFT_SIZE: 1024, // Determines frequency resolution
  SMOOTHING_TIME_CONSTANT: 0.2, // Smoothing factor for frequency data
  FREQUENCY_BANDS: {
    VERY_LOW: { start: 100, end: 300 },
    LOW: { start: 300, end: 600 },
    MID: { start: 600, end: 1200 },
    HIGH: { start: 1200, end: 2000 },
    VERY_HIGH: { start: 2000, end: 4000 },
  } as const,
} as const;

export const WebSocketResponseEventType = {
  SAMPLE: "EVENT_ENTITY_ACTION_STATE",
  EVENT_TEXT_START: "EVENT_TEXT_START",
  EVENT_TEXT_UPDATE: "EVENT_TEXT_UPDATE",
  EVENT_TEXT_END: "EVENT_TEXT_END",
  EVENT_AUDIO_ACK: "EVENT_AUDIO_ACK",
  EVENT_AUDIO_START: "EVENT_AUDIO_START",
  EVENT_AUDIO_UPDATED: "EVENT_AUDIO_UPDATED",
  EVENT_AUDIO_END: "EVENT_AUDIO_END",
  EVENT_CONVERSATION_START: "EVENT_CONVERSATION_START",
  EVENT_CONVERSATION_STATUS: "EVENT_CONVERSATION_STATUS",
} as const;

export const WebSocketEventType = {
  EVENT_TEXT_START: "EVENT_TEXT_START",
  EVENT_TEXT_UPDATE: "EVENT_TEXT_UPDATE",
  EVENT_TEXT_END: "EVENT_TEXT_END",
  EVENT_AUDIO_START: "EVENT_AUDIO_START",
  EVENT_AUDIO_UPDATED: "EVENT_AUDIO_UPDATED",
  EVENT_AUDIO_END: "EVENT_AUDIO_END",
  EVENT_AUDIO_ACK: "EVENT_AUDIO_ACK",
  EVENT_CONVERSATION_START: "EVENT_CONVERSATION_START",
  EVENT_CONVERSATION_STATUS: "EVENT_CONVERSATION_STATUS",
  EVENT_CONVERSATION_END: "EVENT_CONVERSATION_END",
} as const;

export const WebSocketTextRequestType = {
  USER_AUDIO: "user-audio",
  USER_TEXT: "user-text",
  FEEDBACK: "feedback",
  START_CONVERSATION: "start-conversation",
  TTS: "tts",
  TRANSLATION: "translation",
  SUGGESTION: "suggestion",
} as const;

export const WebSocketResponseType = {
  USER_AUDIO: "user-audio",
  USER_TEXT: "user-text",
  FEEDBACK: "feedback",
  START_CONVERSATION: "start-conversation",
  TTS: "tts",
  TRANSLATION: "translation",
  SUGGESTION: "suggestion",
} as const;

export const AnimationStates = {
  IDLE: "Take 001",
  YES: "C_Yes",
  NO: "C_No",
  MARKETING: "C_QR",
  MEGARAFFE: "C_Megaraffe",
  DANCE1: "C_Dance_SpinV",
  DANCE2: "C_Dance_SpinH",
} as const;

export const AvatarChildMeshNames = {
  INNERSPHERE: "InnerSphere",
  OUTERSPHERE: "OuterSphere",
  PUPIL_WAVEFORM: "Pupil_Waveform",
  QR_CODE_MESH: "QR_Code_Mesh",
} as const;

export type LanguageModelMapping = {
  modelPath: string;
  position: [number, number, number];
  scale: [number, number, number];
};

export const facialExpressions: { [key: string]: number } = {
  mouthOpen: 0,
  viseme_sil: 1,
  viseme_PP: 2,
  viseme_FF: 3,
  viseme_TH: 4,
  viseme_DD: 5,
  viseme_kk: 6,
  viseme_CH: 7,
  viseme_SS: 8,
  viseme_nn: 9,
  viseme_RR: 10,
  viseme_aa: 11,
  viseme_E: 12,
  viseme_I: 13,
  viseme_O: 14,
  viseme_U: 15,
  mouthSmile: 16,
  browDownLeft: 17,
  browDownRight: 18,
  browInnerUp: 19,
  browOuterUpLeft: 20,
  browOuterUpRight: 21,
  eyeSquintLeft: 22,
  eyeSquintRight: 23,
  eyeWideLeft: 24,
  eyeWideRight: 25,
  jawForward: 26,
  jawLeft: 27,
  jawRight: 28,
  mouthFrownLeft: 29,
  mouthFrownRight: 30,
  mouthPucker: 31,
  mouthShrugLower: 32,
  mouthShrugUpper: 33,
  noseSneerLeft: 34,
  noseSneerRight: 35,
  mouthLowerDownLeft: 36,
  mouthLowerDownRight: 37,
  mouthLeft: 38,
  mouthRight: 39,
  eyeLookDownLeft: 40,
  eyeLookDownRight: 41,
  eyeLookUpLeft: 42,
  eyeLookUpRight: 43,
  eyeLookInLeft: 44,
  eyeLookInRight: 45,
  eyeLookOutLeft: 46,
  eyeLookOutRight: 47,
  cheekPuff: 48,
  cheekSquintLeft: 49,
  cheekSquintRight: 50,
  jawOpen: 51,
  mouthClose: 52,
  mouthFunnel: 53,
  mouthDimpleLeft: 54,
  mouthDimpleRight: 55,
  mouthStretchLeft: 56,
  mouthStretchRight: 57,
  mouthRollLower: 58,
  mouthRollUpper: 59,
  mouthPressLeft: 60,
  mouthPressRight: 61,
  mouthUpperUpLeft: 62,
  mouthUpperUpRight: 63,
  mouthSmileLeft: 64,
  mouthSmileRight: 65,
  tongueOut: 66,
  eyeBlinkLeft: 67,
  eyeBlinkRight: 68,
  eyesClosed: 69,
  eyesLookUp: 70,
  eyesLookDown: 71,
};

export type EyeMesh = {
  mesh: THREE.Mesh;
  targetIndex: number;
};

export const MOUTH_TARGETS = new Set([
  "SkinDriver.eh_M",
  "SkinDriver.rrr_M",
  "SkinDriver.www_M",
  "SkinDriver.uuu_M",
  "SkinDriver.sss_M",
  "TeethDriver.eh_M",
  "TeethDriver.rrr_M",
  "TeethDriver.www_M",
  "TeethDriver.uuu_M",
  "TeethDriver.sss_M",
]);

export const INTERPOLATION_SPEED = 0.1;
export const BLINK_DURATION = 0.3; // Duration in seconds for the blink (open/close)
export const BLINK_PAUSE = 3; // Duration in seconds to wait between blinks

export const EYE_MORPH_TARGETS = [
  "SkinDriver.eyeBlinkLeft",
  "SkinDriver.eyeBlinkRight",
];

export const SOUND_TO_TARGETS: Record<string, string[]> = {
  eh: ["SkinDriver.eh_M", "TeethDriver.eh_M"],
  rrr: ["SkinDriver.rrr_M", "TeethDriver.rrr_M"],
  www: ["SkinDriver.www_M", "TeethDriver.www_M"],
  uuu: ["SkinDriver.uuu_M", "TeethDriver.uuu_M"],
  sss: ["SkinDriver.sss_M", "TeethDriver.sss_M"],
};
