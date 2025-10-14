<template>
  <NuxtLayout>
    <LoadingSpinner
      v-if="
        isStartConversationLoading ||
        isLoadingUserInfo ||
        isLoadingLessonOverview ||
        !lessonOverview
      " />
    <ContentContainer v-if="lessonOverview && !isLoadingLessonOverview">
      <!-- Left section -->
      <template #left>
        <h1 id="lesson-title" class="lesson-title p-small-xs">
          {{ lessonOverview.lessonTitle }}
        </h1>
        <div
          class="lesson-description fs-large"
          aria-label="Lesson description">
          {{ lessonOverview.lessonDescription }}
        </div>
        <button
          class="start-lesson-btn fs-medium align-self-start"
          @click="onStartConversation"
          :disabled="isStartConversationLoading"
          aria-label="Start the lesson">
          <i-fa6-solid:spinner
            v-if="isStartConversationLoading"
            class="icon-style spin-fast"
            aria-hidden="true" />
          {{
            isStartConversationLoading
              ? "Starting..."
              : lessonOverview.startButtonText
          }}
        </button>
      </template>
      <!-- Right section -->
      <template #right>
        <section
          class="location-info pb-space-xl justify-content-start"
          aria-label="Location information">
          <div class="location-image-wrapper">
            <img
              :src="lessonOverview.locationPicUrl"
              :alt="`Location of ${lessonOverview.sceneLocationName}`"
              class="location-image"
              aria-label="Location" />
          </div>
          <div class="location-text">
            <div class="location-label fs-medium">
              {{ lessonOverview.sceneLocationLabel }}
            </div>
            <div class="location-name">
              {{ lessonOverview.sceneLocationName }}
            </div>
          </div>
        </section>
        <section
          class="speaker-info mb-space-lg"
          aria-label="Speaker information">
          <div class="speaker-details">
            <div class="speaker-label fs-medium">
              {{ lessonOverview.speakerLabel }}
            </div>
            <div class="speaker-name">
              {{ lessonOverview.speakerName }}
            </div>
          </div>
        </section>
        <div class="speaker-avatar-container">
          <Suspense>
            <AvatarModel />
          </Suspense>
        </div>
      </template>
    </ContentContainer>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
import { useAvatarStore } from "@/stores/useAvatarStore";
import ContentContainer from "~/components/ContentContainer.vue";
import LoadingSpinner from "~/components/LoadingSpinner.vue";
import { useLessonOverview } from "~/composables/useLessonOverview";

definePageMeta({
  middleware: "conversation-auth",
});

// Use the lesson overview composable
const {
  lessonOverview: lessonOverviewData,
  isLoading: isLoadingLessonOverview,
  error: lessonOverviewError,
  fetchLessonOverview,
} = useLessonOverview();

// Computed property to provide lesson overview display data (no fallback)
const lessonOverview = computed(() => {
  const lesson = lessonOverviewData.value?.lesson;
  if (lesson?.location && lesson?.character && lesson?.lesson) {
    const isTest = appStore.isTest;

    return {
      lessonTitle: isTest ? "Showcase Assignment" : "Lesson Overview",
      lessonDescription: lesson.lesson.description,
      startButtonText: isTest ? "Start Now" : "Start lesson",
      sceneLocationLabel: "You're in:",
      sceneLocationName: lesson.location.city,
      speakerLabel: "You'll be speaking with:",
      speakerName: lesson.character.name,
      locationPicUrl: lesson.location.photo || "/images/mexico.png",
    };
  }
  return null; // Only return null if no lesson overview data at all
});

const appStore = useAppStore();
const avatarStore = useAvatarStore();
const { userInfo, isLoadingUserInfo, footerHeading, footerSubheading } =
  storeToRefs(appStore);
const { startConversation, isStartConversationLoading } =
  useConversationManager();

const onStartConversation = async () => {
  if (isStartConversationLoading.value) return;

  try {
    isStartConversationLoading.value = true;

    if (!userInfo.value) {
      await navigateTo("/login");
      return;
    }

    // At this point, userInfo is guaranteed
    await startConversation(userInfo.value);
    await navigateTo("/lesson-content");
  } catch (error) {
    console.error("Error during conversation start:", error);
  } finally {
    isStartConversationLoading.value = false;
  }
};

// Function to update footer information based on lesson overview
const updateFooterInfo = () => {
  const lesson = lessonOverviewData.value?.lesson;
  if (lesson?.lesson) {
    const isTest = appStore.isTest;
    const prefix = isTest ? "Showcase Assignment" : "Practice Session";

    footerHeading.value = lesson.lesson.title;
    footerSubheading.value = `${prefix} - ${lesson.lesson.description}`;
  } else {
    // Clear footer when no data (shows loading instead)
    footerHeading.value = "";
    footerSubheading.value = "";
  }
};

// Watch for changes in lesson overview to update footer
watch(
  lessonOverviewData,
  () => {
    updateFooterInfo();
  },
  { immediate: true }
);

// Preload user info and lesson overview on component mount for better UX
onMounted(async () => {
  try {
    await appStore.fetchUserInfoWithOAuth();
    if (!userInfo.value) navigateTo("/login");
    await fetchLessonOverview();
    await avatarStore.loadModel();
  } catch (error) {
    if (lessonOverviewError.value) {
      appStore.addAlert(
        `Failed to load lesson overview: ${lessonOverviewError.value}`
      );
    }
  }
  updateFooterInfo();
});

// User info is now managed by the app store and fetched when needed
</script>

<style scoped>
/* Left section styles */

.lesson-title {
  color: var(--rds-text-primary);
  font-weight: 700;
  font-size: 2rem;
}

.lesson-description {
  line-height: 27px;
  padding: 8px 0;
  min-height: 187px;
  color: var(--rds-label-color);
}

.start-lesson-btn {
  display: flex;
  height: 40px;
  padding: 8px 24px;
  justify-content: center;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  border-radius: 103px;
  background: var(--rds-success-light-hover);
  border: none;
  font-style: normal;
  font-weight: 700;
  color: var(--rds-text-primary);
  transition: all 0.3s ease;
}
.start-lesson-btn:hover {
  background: var(--rds-success-light);
}

.start-lesson-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-lesson-btn:disabled:hover {
  background: var(--rds-success-light-hover);
}

/* Right section styles */

.location-image-wrapper {
  width: 110px;
  height: 110px;
  border: 1px solid var(--rds-translate-border);
  border-radius: 50%;
  background-color: white;
}

.location-image {
  width: 110px;
  height: 110px;
  object-fit: cover;
  border-radius: 50%;
}

.location-info {
  display: flex;
  align-items: center;
}

.location-label {
  line-height: 21px;
  margin-bottom: 4px;
  color: var(--rds-dark-3);
}

.location-text {
  min-width: 155px;
  display: flex;
  flex-direction: column;
  padding-left: 24px;
}

.location-name {
  font-weight: 700;
  font-size: 1.375rem;
  min-height: 55px;
}

.speaker-info {
  display: flex;
  align-items: flex-start;
}

.speaker-label {
  line-height: 21px;
  color: var(--rds-label-color);
}

.speaker-name {
  font-weight: 700;
  font-size: 1.375rem;
  color: var(--rds-label-color);
}

.speaker-avatar-container {
  position: absolute;
  bottom: 0px;
  right: 0px;
  width: 300px;
  height: 200px;
}
</style>
