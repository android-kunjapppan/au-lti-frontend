/**
 * Browser detection utilities
 * Provides methods to detect specific browsers and their capabilities
 */

export const isSafari = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(userAgent);
};

export const isChrome = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  return /chrome/i.test(userAgent) && !/edge/i.test(userAgent);
};

export const isFirefox = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  return /firefox/i.test(userAgent);
};

export const getBrowserInfo = () => {
  return {
    isSafari: isSafari(),
    isChrome: isChrome(),
    isFirefox: isFirefox(),
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
  };
};
