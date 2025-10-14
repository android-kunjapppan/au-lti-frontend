import { ref } from "vue";
import type { LessonOverviewData } from "~/types/types";
import { createApiHeaders } from "~/utils";
import { DEFAULT_REQUEST_TIMEOUT_LENGTH } from "~/utils/constants";

export const useLessonOverview = () => {
  const appStore = useAppStore();
  const config = useRuntimeConfig();
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lessonOverview = ref<LessonOverviewData | null>(null);
  let lessonOverviewTimeout: NodeJS.Timeout | null = null;

  const fetchLessonOverview = async (): Promise<LessonOverviewData | null> => {
    if (!appStore.selectedTemplate) {
      error.value = "Missing template id";
      return null;
    }
    if (isLoading.value) return lessonOverview.value;

    try {
      isLoading.value = true;
      error.value = null;

      // Set 2-minute timeout
      lessonOverviewTimeout = setTimeout(() => {
        isLoading.value = false;
        error.value =
          "Loading lesson overview timed out. Please refresh the page.";
      }, DEFAULT_REQUEST_TIMEOUT_LENGTH);

      // Get authentication headers
      const headers = createApiHeaders();
      if (appStore.lbCanvasJwt) {
        headers.Authorization = `Bearer ${appStore.lbCanvasJwt}`;
      }

      const response = await fetch(
        `${config.public.httpApiUrl}/lesson-overview?lessonId=${appStore.selectedTemplate}`,
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
  };
};
