declare const window: Window & {
  dataLayer?: object[];
  utag?: Record<string, unknown>[];
};
/**
 * @description helps reset the dataLayer to handle the issue where attributes that aren't present in future events, will carry over to new events.
 */
export const resetDataLayer = () => {
  if (typeof window !== "undefined" && window !== null) {
    if (window.dataLayer) {
      window.dataLayer.push(function () {
        this.reset();
      });
    }
  }
};

// export function bytesToBase64(bytes: number[]) {
//   const binString = String.fromCodePoint(...bytes);
//   return btoa(binString);
// }
export function bytesToBase64(bytes: number[]) {
  // const unit8Array = new Uint8Array(bytes);
  let binString = "";
  for (let i = 0; i < bytes.length; i++) {
    binString += String.fromCodePoint(bytes[i]);
  }
  return btoa(binString);
}

export interface BackendAudioResponse {
  type: "Buffer";
  data: number[];
}

/** audio data is sent down as byte array to prevent SSE text requirements from excluding data, converted into base64, then converted into a buffer and decoded. Might be able to skip a step somehow? */
export const decodeBase64Audio = async (args: {
  audioBufferArray: BackendAudioResponse;
  audioContext: AudioContext;
}): Promise<AudioBuffer | null> => {
  const { audioBufferArray, audioContext } = args;
  if (audioBufferArray == undefined || audioContext == undefined)
    throw new Error("missing string or audio context");
  try {
    // Ensure AudioContext is running before decoding (Safari-specific)
    if (audioContext.state === "suspended") {
      console.log(
        "🎵 AudioContext suspended, attempting to resume before decoding..."
      );
      await audioContext.resume();
    }

    // Convert Base64bytes to Base64
    const base64bytes = bytesToBase64(audioBufferArray.data);
    const binaryString = atob(base64bytes);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Safari-specific: Ensure proper buffer alignment
    const buffer = isSafari() ? bytes.buffer.slice(0) : bytes.buffer;

    return await audioContext.decodeAudioData(buffer);
  } catch (error) {
    console.error("Error decoding base64 audio:", error);

    // Safari fallback: Try alternative buffer preparation
    if (isSafari()) {
      try {
        console.log("🎵 Attempting Safari fallback audio decoding...");
        const base64String = bytesToBase64(audioBufferArray.data);
        const binaryString = atob(base64String);
        const audioBytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
          audioBytes[i] = binaryString.charCodeAt(i);
        }

        // Create a new buffer with proper byte alignment for Safari
        const buffer = new ArrayBuffer(audioBytes.length);
        const view = new Uint8Array(buffer);
        view.set(audioBytes);

        return await audioContext.decodeAudioData(buffer);
      } catch (fallbackError) {
        console.error(
          "Safari fallback audio decoding also failed:",
          fallbackError
        );
        return null;
      }
    }

    return null;
  }
};

export const createApiHeaders = (
  additionalHeaders: Record<string, string> = {}
): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  return headers;
};

/**
 * Creates a promise that resolves after the specified delay
 * @param ms - The delay in milliseconds
 * @returns A promise that resolves after the delay
 */
export function promiseTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
