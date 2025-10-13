<template>
  <NuxtLayout>
    <LoadingSpinner v-if="isLoadingUserInfo" />
    <ContentContainer v-else-if="!isLoadingUserInfo && userInfo">
      <div class="feedback-avatar-container">
        <Suspense>
          <AvatarModel />
        </Suspense>
      </div>
      <template #left>
        <div class="left-content pretty-scrollbar">
          <div class="feedback-title">
            <h1 id="lesson-completed-title" class="text-success feedback-title">
              <span>
                {{ completionTitle }}
                <i-fa6-solid:circle-check
                  class="ms-space-xs check-icon"
                  aria-hidden="true" />
              </span>
            </h1>
            <p class="fs-large text-success">
              {{ completionMessage }}
            </p>
          </div>
          <div class="button-container">
            <button
              v-if="showPracticeAgainButton"
              type="button"
              class="btn btn-dark-2 px-space-sm fs-medium d-flex align-items-center practice-again-button"
              aria-label="Try this lesson again"
              @click="handleTryAgain">
              Practice Again
              <i-fa6-solid:chevron-right
                class="feedback-icon ms-space-xxs"
                aria-hidden="true" />
            </button>
          </div>
        </div>
      </template>

      <template #right>
        <div class="right-content">
          <div class="feedback-section pretty-scrollbar">
            <h2
              id="what-went-well-title"
              class="feedback-section-title fs-medium">
              What went well:
            </h2>
            <ul class="feedback-list">
              <li
                v-for="(item, index) in lessonFeedback.whatWentWell"
                :key="index"
                class="feedback-item">
                <span class="feedback-text fs-medium">
                  {{ item }}
                </span>
              </li>
            </ul>
            <h2 id="suggestions-title" class="feedback-section-title fs-medium">
              Suggestions for improvement:
            </h2>
            <ul class="feedback-list">
              <li
                v-for="(
                  item, index
                ) in lessonFeedback.suggestionsForImprovement"
                :key="index"
                class="feedback-item">
                <span class="feedback-text fs-medium">
                  {{ item }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </template>
      <template #footer>
        <i-custom-groupstars
          class="feedback-icon me-space-xxs"
          aria-hidden="true" />
        <span>
          Feedback is AI generated. Your professor will provide more feedback
          soon.
        </span>
        <div class="success-animation" aria-hidden="true">
          <div class="animation-container">
            <LottieLooper
              :src="successAnimation"
              :timeout="0"
              :loop="false"
              class="animation-section" />
            <LottieLooper
              :src="successAnimation"
              :timeout="0"
              :loop="false"
              class="animation-section" />
            <LottieLooper
              :src="successAnimation"
              :timeout="0"
              :loop="false"
              class="animation-section" />
          </div>
        </div>
      </template>
    </ContentContainer>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import successAnimation from "~/assets/animations/confetti.json?url";
import LottieLooper from "~/components/LottieLooper.vue";
const avatarStore = useAvatarStore();

// definePageMeta({
//   middleware: "conversation-auth",
// });
const appStore = useAppStore();
const messageStore = useMessageStore();
const { lessonFeedback, isTest, isLoadingUserInfo, userInfo } =
  storeToRefs(appStore);

// Computed properties to avoid duplication and improve readability
const completionTitle = computed(() =>
  isTest.value ? "Showcase Assignment Complete" : "Practice Complete"
);

const completionMessage = computed(() =>
  isTest.value
    ? "Congrats! Your grades will be available on Canvas soon."
    : "Great work! Keep practicing to build your confidence and prepare for the showcase assignment."
);

const showPracticeAgainButton = computed(() => !isTest.value);

const handleTryAgain = async () => {
  /**
   * TODO: Update to actual logic of marking conversation as isActive: false, and start a new conversation
   */
  messageStore.clearMessages();
  await navigateTo("/lesson-content");
};

onMounted(async () => {
  await avatarStore.loadModel();
  await appStore.fetchUserInfo();
});
</script>

<style scoped>
.left-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  align-items: flex-start;
  overflow-y: auto;
}

.right-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.feedback-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 24px;
}

.feedback-title h1 {
  display: flex;
  align-items: center;
  font-weight: 700;
  font-size: 1.75rem;
  text-align: left;
  line-height: normal;
  padding: 0px;
}

.feedback-section-title {
  font-weight: 700;
  line-height: 21px;
  color: var(--rds-text-primary);
  margin-bottom: 8px;
}

.feedback-list {
  list-style: none;
  padding: 0;
  margin-bottom: 36px;
}

.feedback-item {
  display: flex;
  align-items: flex-start;
  margin-top: 10px;
  position: relative;
  padding-left: 16px;
}

.feedback-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--rds-text-primary);
  line-height: 1.5;
}

.title-icon {
  margin-left: 12px;
  width: 26px;
  height: 26px;
}

.feedback-details {
  background: var(--rds-section-bg);
}

.feedback-section {
  flex: 1;
  overflow-y: auto;
}

.feedback-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.feedback-text {
  font-size: 16px;
  line-height: 21px;
  color: var(--rds-label-color);
}

.check-icon {
  width: 22px;
  height: 22px;
  margin-top: -10px;
}

.feedback-avatar-container {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 176px;
  height: 183px;
  z-index: 1;
  pointer-events: none;
}

.success-animation {
  position: fixed;
  pointer-events: none;
  bottom: var(--footer-height);
  left: 0;
  height: 100%;
  width: 100%;
}

.animation-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.animation-section {
  flex: 1;
  width: 33.33%;
  height: 100%;
}

.full-page-animation {
  width: 100%;
  height: 100%;
}

.practice-again-button {
  transition: all 0.2s ease;
}

.practice-again-button:hover {
  background: var(--rds-dark-3);
}

.practice-again-button:hover .feedback-icon {
  animation: wiggle-right 2s ease-in-out;
}

@keyframes wiggle-right {
  0%,
  25%,
  50%,
  100% {
    transform: translateX(0);
  }
  12.5%,
  37.5% {
    transform: translateX(0.3125rem);
  }
}

:deep(.canvas-footer) {
  background: var(--rds-disclaimer-bg);
}
</style>
