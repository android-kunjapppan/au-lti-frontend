import { ref } from "vue";
import type { LessonOverviewData } from "~/types/types";
import { createApiHeaders } from "~/utils";
import { SupportedLang } from "~/utils/constants";

export const useLessonOverview = () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lessonOverview = ref<LessonOverviewData | null>(null);
  let lessonOverviewTimeout: NodeJS.Timeout | null = null;

  // Helper function to get lesson ID (default for now, will use /info details in future)
  const getLessonId = (): number => {
    // Default to lesson 1 - will be replaced with /info details in future
    return 1;
  };

  // Helper function to get language from course data
  const getLanguage = (): string => {
    try {
      const appStore = useAppStore();

      if (appStore.userInfo?.assignmentInfo?.assignment?.course?.Language) {
        const courseLanguage =
          appStore.userInfo.assignmentInfo.assignment.course.Language;

        // Map course language to supported language codes
        if (courseLanguage.toLowerCase() === "spanish") {
          return SupportedLang.SPANISH;
        }

        // For other languages, use first 2 characters
        return courseLanguage.substring(0, 2).toLowerCase();
      }
    } catch (error) {
      console.warn("Could not get language from course data:", error);
    }

    // Default to English if no course language found
    return "en";
  };

  const fetchLessonOverview = async (
    lessonId?: number
  ): Promise<LessonOverviewData | null> => {
    const targetLessonId = lessonId || getLessonId();

    if (!targetLessonId) {
      error.value = "No lesson ID provided";
      return null;
    }
    if (isLoading.value) return lessonOverview.value;

    try {
      isLoading.value = true;
      error.value = null;

      // Set 2-minute timeout
      lessonOverviewTimeout = setTimeout(
        () => {
          isLoading.value = false;
          error.value =
            "Loading lesson overview timed out. Please refresh the page.";
        },
        2 * 60 * 1000
      );

      const config = useRuntimeConfig();
      const appStore = useAppStore();

      // Get authentication headers
      const headers = createApiHeaders();
      if (appStore.lbCanvasJwt) {
        headers.Authorization = `Bearer ${appStore.lbCanvasJwt}`;
      }

      const language = getLanguage();
      const response = await fetch(
        `${config.public.httpApiUrl}/lesson-overview?language=${language}&lessonId=${targetLessonId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch lesson overview: ${response.status}`);
      }

      const responseData = await response.json();
      const data: LessonOverviewData = responseData.data || responseData;
      lessonOverview.value = data;
      // Update avatar name in app store
      if (data.lesson?.character?.name) {
        const appStore = useAppStore();
        appStore.setAvatarName(data.lesson.character.name);
      }

      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch lesson overview";
      error.value = errorMessage;
      return null;
    } finally {
      isLoading.value = false;
      if (lessonOverviewTimeout) {
        clearTimeout(lessonOverviewTimeout);
        lessonOverviewTimeout = null;
      }
    }
  };

  return {
    lessonOverview: readonly(lessonOverview),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchLessonOverview,
    getLessonId,
    getLanguage,
  };
};
