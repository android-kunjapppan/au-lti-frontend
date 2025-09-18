import { useUrlSearchParams } from "@vueuse/core";
import { defineStore } from "pinia";
import { shallowRef } from "vue";

// A utility to grab the language from URL or environment variables
const getSessionLanguage = (): string => {
  const params = useUrlSearchParams();
  const urlLanguage = params.lang as string;
  if (urlLanguage) {
    return urlLanguage.substring(0, 2);
  }

  // Next, fallback to an environment variable (for example, `VUE_APP_LANG`).
  const envLanguage = import.meta.env.VITE_APP_LANG || "en";
  return envLanguage.substring(0, 2);
};

export const useEnvironmentStore = defineStore("environment", () => {
  // Holds the environment map URL
  const environmentMap = shallowRef<string>(
    "/environmentMaps/spiaggia_di_mondello_4k.hdr"
  );

  // Mapping of languages to specific environment maps
  const languageToEnvironmentMap: { [key: string]: string } = {
    en: "/environmentMaps/spiaggia_di_mondello_4k.hdr", // Default for English
    // Other languages can be added here as needed
    // de: "/environmentMaps/deutsch_environment.hdr",
    // fr: "/environmentMaps/francais_environment.hdr",
    // es: "/environmentMaps/spanish_environment.hdr",
  };

  // Update the environment map based on the passed URL
  const updateEnvironmentMap = (newMap: string) => {
    environmentMap.value = newMap;
    console.log("Updated environment map:", environmentMap.value);
  };

  // Restore the default environment map based on the user's language
  const restoreDefaultEnvironmentMap = () => {
    const language = getSessionLanguage(); // Use the refactored `getUserLanguage`
    const defaultEnvironmentMap =
      languageToEnvironmentMap[language] || languageToEnvironmentMap.en; // Default to English if not found
    environmentMap.value = defaultEnvironmentMap;
    console.log("Restored default environment map:", environmentMap.value);
  };

  return {
    environmentMap,
    updateEnvironmentMap,
    restoreDefaultEnvironmentMap,
  };
});
