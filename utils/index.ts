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
    // turing the Base64bytes to Base64
    const base64bytes = bytesToBase64(audioBufferArray.data);
    const binaryString = atob(base64bytes);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return audioContext.decodeAudioData(bytes.buffer);
  } catch (error) {
    console.error("Error decoding base64 audio:", error);
    return null;
  }
};
