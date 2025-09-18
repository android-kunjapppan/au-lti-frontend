import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { shallowRef } from "vue";

interface LanguageModelMapping {
  modelPath: string;
  position: [number, number, number];
  scale: [number, number, number];
}

export const useModelLoader = () => {
  const avatarModel = shallowRef<GLTF>();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  // Language-to-model mapping
  const languageToModelMap: { [key: string]: LanguageModelMapping } = {
    en: {
      modelPath: "/models/humanAvatar.glb",
      position: [0, -1, 0],
      scale: [1, 1, 1],
    }, // English model
  };

  // Function to get user's language from course data
  const getSessionLanguage = (): string => {
    try {
      const appStore = useAppStore();
      if (appStore.userInfo?.assignmentInfo?.assignment?.course?.Language) {
        const courseLanguage =
          appStore.userInfo.assignmentInfo.assignment.course.Language;
        return courseLanguage.substring(0, 2).toLowerCase();
      }
    } catch (error) {
      console.warn("Could not get language from course data:", error);
    }

    // Default to English if no course language found
    return "en";
  };

  // Function to restore the default avatar model based on the language
  const restoreDefaultAvatarModel = async () => {
    const avatarPath = getCurrentAvatarPath();
    return await loader.loadAsync(avatarPath);
  };

  // Function to get the current avatar path with lesson overview fallback
  const getCurrentAvatarPath = (): string => {
    const language = getSessionLanguage();
    const modelData = languageToModelMap[language] || languageToModelMap.en;

    // Fallback to default humanAvatar.glb
    return modelData.modelPath;
  };

  return {
    avatarModel,
    loader,
    languageToModelMap,
    getSessionLanguage,
    restoreDefaultAvatarModel,
    getCurrentAvatarPath,
  };
};
