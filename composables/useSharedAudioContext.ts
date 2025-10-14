import { ref, shallowRef } from "vue";

// Custom error types for better error handling
class AudioContextError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AudioContextError";
  }
}

class AudioContextInitializationError extends AudioContextError {
  constructor(message: string) {
    super(message, "INITIALIZATION_FAILED");
    this.name = "AudioContextInitializationError";
  }
}

class AudioContextNotSupportedError extends AudioContextError {
  constructor() {
    super("AudioContext not supported in this browser", "NOT_SUPPORTED");
    this.name = "AudioContextNotSupportedError";
  }
}

// Global singleton state - shared across all instances
const globalAudioContext = shallowRef<AudioContext | null>(null);
const globalIsInitialized = shallowRef(false);
const globalIsInitializing = shallowRef(false);
const globalNeedsUserInteraction = ref(false);
const globalUserInteractionHandlers = ref<Set<() => void>>(new Set());

/**
 * Shared AudioContext composable for Safari compatibility
 * Centralizes AudioContext management to avoid conflicts between multiple instances
 * Uses singleton pattern to ensure all instances share the same AudioContext
 */
export const useSharedAudioContext = () => {
  // Use global state instead of creating new refs
  const audioContext = globalAudioContext;
  const isInitialized = globalIsInitialized;
  const isInitializing = globalIsInitializing;
  const needsUserInteraction = globalNeedsUserInteraction;
  const userInteractionHandlers = globalUserInteractionHandlers;

  /**
   * Initialize the shared AudioContext with Safari-specific handling
   */
  const initAudioContext = async (): Promise<AudioContext> => {
    // Return existing context if already initialized
    if (audioContext.value && audioContext.value.state !== "closed") {
      return audioContext.value;
    }

    // Prevent multiple simultaneous initializations
    if (isInitializing.value) {
      return new Promise<AudioContext>((resolve, reject) => {
        const checkInitialized = () => {
          if (isInitialized.value && audioContext.value) {
            resolve(audioContext.value);
          } else if (!isInitializing.value) {
            reject(
              new AudioContextInitializationError(
                "AudioContext initialization failed"
              )
            );
          } else {
            requestAnimationFrame(checkInitialized);
          }
        };
        checkInitialized();
      });
    }

    isInitializing.value = true;

    try {
      // Safari-specific AudioContext initialization
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        throw new AudioContextNotSupportedError();
      }

      audioContext.value = new AudioContextClass();

      // Safari-specific: Ensure context is running
      if (audioContext.value.state === "suspended") {
        await audioContext.value.resume();
      }

      isInitialized.value = true;
      return audioContext.value;
    } catch (error) {
      isInitializing.value = false;
      throw error;
    } finally {
      isInitializing.value = false;
    }
  };

  /**
   * Ensure AudioContext is running (Safari-specific)
   */
  const ensureAudioContextRunning = async (): Promise<boolean> => {
    if (!audioContext.value) {
      await initAudioContext();
    }

    if (audioContext.value?.state === "suspended") {
      try {
        await audioContext.value.resume();
        needsUserInteraction.value = false;
        return true;
      } catch (error) {
        needsUserInteraction.value = true;
        return false;
      }
    }

    return true;
  };

  /**
   * Handle user interaction to resume AudioContext
   */
  const handleUserInteraction = async (): Promise<boolean> => {
    let success = true;

    // Try to resume AudioContext if it exists and is suspended
    if (audioContext.value?.state === "suspended") {
      try {
        await audioContext.value.resume();
      } catch (error) {
        success = false;
      }
    }

    // Clear the user interaction flag and notify handlers
    // This is important for Safari HTMLAudioElement playback
    needsUserInteraction.value = false;

    // Notify all waiting handlers
    userInteractionHandlers.value.forEach((handler) => handler());
    userInteractionHandlers.value.clear();

    // Trigger Safari-specific audio retry
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("safariUserInteraction"));
    }

    return success;
  };

  /**
   * Wait for user interaction to resume AudioContext
   */
  const waitForUserInteraction = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!needsUserInteraction.value) {
        resolve();
        return;
      }

      userInteractionHandlers.value.add(resolve);
    });
  };

  /**
   * Get the current AudioContext state
   */
  const getAudioContextState = (): {
    context: AudioContext | null;
    state: AudioContextState | "not-initialized";
    isInitialized: boolean;
    isInitializing: boolean;
  } => {
    return {
      context: audioContext.value,
      state: audioContext.value?.state || "not-initialized",
      isInitialized: isInitialized.value,
      isInitializing: isInitializing.value,
    };
  };

  /**
   * Cleanup AudioContext (for testing or cleanup purposes)
   */
  const cleanup = () => {
    if (audioContext.value && audioContext.value.state !== "closed") {
      audioContext.value.close();
    }
    audioContext.value = null;
    isInitialized.value = false;
    isInitializing.value = false;
  };

  return {
    audioContext,
    isInitialized,
    isInitializing,
    needsUserInteraction,
    initAudioContext,
    ensureAudioContextRunning,
    handleUserInteraction,
    waitForUserInteraction,
    getAudioContextState,
    cleanup,
  };
};

/**
 * Get the current global AudioContext state without creating a new instance
 * Useful for debugging and checking state from anywhere in the app
 */
export const getGlobalAudioContextState = (): {
  context: AudioContext | null;
  state: AudioContextState | "not-initialized";
  isInitialized: boolean;
  isInitializing: boolean;
  needsUserInteraction: boolean;
} => {
  return {
    context: globalAudioContext.value,
    state: globalAudioContext.value?.state || "not-initialized",
    isInitialized: globalIsInitialized.value,
    isInitializing: globalIsInitializing.value,
    needsUserInteraction: globalNeedsUserInteraction.value,
  };
};
