/**
 * Utility composable for generating content keys from text
 * Used for audio content matching across different message IDs
 */
export const useContentKey = () => {
  /**
   * Generate a content key from text for audio matching
   * @param text - The text to generate a key from
   * @returns A trimmed substring of the first 50 characters
   */
  const generateContentKey = (text: string | undefined): string => {
    return text?.substring(0, 50).trim() || "";
  };

  return {
    generateContentKey,
  };
};
