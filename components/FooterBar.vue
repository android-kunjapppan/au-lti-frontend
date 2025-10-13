<template>
  <footer v-if="!isTimeoutRoute" class="footer-container footer">
    <!-- Footer Content Section -->
    <div class="footer-content px-space-sm py-space-xs">
      <div class="footer-left-content">
        <button
          v-if="isLessonContent && !isTest"
          class="arrow btn"
          @click="toggleConfirmCard">
          <i-fa6-solid:chevron-left />
        </button>
        <Teleport to="body" v-if="isConfirmCardVisible">
          <ConfirmCard
            title="Are you sure you want to go back?"
            :message="'You can continue this conversation anytime from where you left off.'"
            @confirm="handleConfirm"
            @cancel="handleCancel" />
        </Teleport>

        <div v-if="isLessonContent && !isTest" class="separator"></div>

        <div class="footer-text">
          <h3 class="h3-small">{{ props.heading }}</h3>
          <span>{{ props.subheading }}</span>
        </div>
      </div>
      <div class="footer-right-content">
        <div v-if="isLessonContent" class="settings-container">
          <button
            :class="['setting-btn', { active: showSettings }]"
            @click="appStore.toggleSettings">
            <span class="setting">Settings</span>
            <i-fa6-solid:gear class="gear-icon" />
          </button>

          <!-- Speed Modal -->
          <div v-if="showSettings" class="speed-modal" ref="settings-modal">
            <h1 class="fs-xs px-space-xs">Audio playback speed</h1>
            <div class="speed-options">
              <button
                v-for="speed in appStore.speedOptions"
                :key="speed"
                @click="appStore.selectAudioPlaybackSpeed(speed)"
                class="speed-btn fs-xs px-space-xs"
                :class="{ selected: speed === audioPlaybackSpeed }">
                <i-fa6-solid:check
                  class="check-icon"
                  :class="{ visible: speed === audioPlaybackSpeed }" />
                {{ speed }}x
              </button>
            </div>
          </div>
        </div>
        <button
          v-if="
            isLessonContent &&
            responsePairCount === minRequiredPair &&
            !isSubmitted &&
            !isBotResponding &&
            !isMaxAttemptsReached
          "
          class="py-space-xxs px-space-sm fs-medium view-result-btn"
          @click="handleSubmit"
          :disabled="isSubmitting">
          <i-fa6-solid:spinner
            v-if="isSubmitting"
            class="icon-style spin-fast"
            aria-hidden="true" />
          <span class="button-text">{{
            isSubmitting ? "Submitting..." : "Submit"
          }}</span>
        </button>
      </div>
    </div>
    <div
      v-if="isLessonContent || isLessonResult"
      class="progress-bar"
      @mouseenter="isHoveringProgress = true"
      @mouseleave="isHoveringProgress = false">
      <div class="progress" :style="{ width: `${progress}%` }">
        <span v-if="isHoveringProgress" class="progress-text fs-small">{{
          `${responsePairCount}/${minRequiredPair} responses`
        }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

interface Props {
  heading?: string;
  subheading?: string;
}
const props = defineProps<Props>();

const route = useRoute();
const messageStore = useMessageStore();
const {
  responsePairCount,
  isSubmitted,
  minRequiredPair,
  isBotResponding,
  submitSuccess,
} = storeToRefs(messageStore);

const appStore = useAppStore();
const { showSettings, audioPlaybackSpeed, progress, isTest } =
  storeToRefs(appStore);
const { endConversation } = useConversationManager();

const { isMaxAttemptsReached } = storeToRefs(appStore);
const { isSubmitting } = storeToRefs(messageStore);

const isConfirmCardVisible = ref(false);
const isHoveringProgress = ref(false);
let submitTimeout: NodeJS.Timeout | null = null;

const isLessonContent = computed(() => route.name === "lesson-content");
const isLessonResult = computed(() => route.name === "lesson-result");
const isTimeoutRoute = computed(() => route.name === "timeout");

const settingsModal = useTemplateRef<HTMLElement>("settings-modal");
const handleClickOutside = (event: PointerEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest(".setting-btn")) {
    return;
  }
  showSettings.value = false;
};
onClickOutside(settingsModal, handleClickOutside);

const handleConfirm = async () => {
  isConfirmCardVisible.value = false;
  await navigateTo("/");
};

const handleCancel = () => {
  isConfirmCardVisible.value = false;
};

const toggleConfirmCard = () => {
  isConfirmCardVisible.value = !isConfirmCardVisible.value;
};

const handleSubmit = async () => {
  if (isSubmitting.value) return; // Prevent multiple submissions
  isSubmitting.value = true;
  submitSuccess.value = false; // Reset submit success state

  // Set 2-minute timeout for submit operation
  submitTimeout = setTimeout(
    () => {
      isSubmitting.value = false;
      submitSuccess.value = false;
      appStore.addAlert("Submit request timed out. Please try again.");
    },
    2 * 60 * 1000
  ); // 2 minutes

  try {
    await endConversation();
    submitSuccess.value = true; // Mark submit as successful

    // Clear timeout on success
    if (submitTimeout) {
      clearTimeout(submitTimeout);
      submitTimeout = null;
    }

    // Wait for navigation to lesson-result
    const unwatch = watch(
      () => route.name,
      (newName) => {
        if (newName === "lesson-result") {
          isSubmitting.value = false;
          unwatch();
        }
      },
      { immediate: true }
    );
  } catch (error) {
    // Clear timeout on error
    if (submitTimeout) {
      clearTimeout(submitTimeout);
      submitTimeout = null;
    }

    isSubmitting.value = false;
    submitSuccess.value = false; // Mark submit as failed
    appStore.addAlert("Submit failed. Please try again.");
  }
};
</script>

<style scoped>
.footer-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--rds-blue);
  color: var(--rds-white-bg);
  height: auto;
  z-index: var(--rds-z-index-footer);
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

.footer-left-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 16px;
}

.separator {
  width: 1px;
  height: 44px;
  background-color: var(--rds-light-4);
}

.arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  cursor: pointer;
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
}

.arrow:focus,
.arrow:active {
  outline: none;
  border: none;
  box-shadow: none;
}

.footer-right-content {
  display: flex;
  align-items: center;
  gap: 24px;
}

.settings-container {
  position: relative;
  margin-left: auto;
  display: flex;
  align-items: center;
}

.setting-btn {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--rds-white-bg);
  cursor: pointer;
  border-radius: 100px;
  padding: 10px 24px;
  border: none;
  background-color: transparent;
  gap: 10px;
  justify-content: center;
}

.setting-btn:hover,
.setting-btn.active {
  background-color: var(--rds-secondary);
  color: var(--rds-blue);
}

.setting-btn:focus,
.setting-btn:active {
  outline: none;
  border: none;
}

.view-result-btn {
  display: flex;
  border-radius: 103px;
  border: none;
  font-weight: 700;
  color: var(--rds-dark-3);
  white-space: nowrap;
  background: var(--rds-success-light);
  text-decoration: none;
}

.view-result-btn:hover {
  background: var(--rds-success-light-hover);
}

.view-result-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--rds-light-3);
}

.view-result-btn:disabled:hover {
  background: var(--rds-light-3);
}

.icon-style {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.spin-fast {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.button-text {
  display: inline-flex;
  align-items: center;
}

.speed-modal {
  position: absolute;
  bottom: 60px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 156px;
  min-height: 136px;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.16);
  padding-top: 12px;
  padding-bottom: 16px;
  z-index: 101;
}

.check-icon {
  width: 16px;
  min-width: 16px; /* Ensures fixed spacing */
  text-align: center;
  visibility: hidden;
  display: inline-block; /* Keep space even if hidden */
}

.check-icon.visible {
  visibility: visible;
}

.speed-btn {
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 24px;
  padding: 0;
  line-height: 24px;
  width: 100%;
}
.speed-btn:hover {
  background-color: var(--rds-label-hover-bg);
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  background-color: var(--rds-light-3);
  margin: 0;
  position: relative;
  cursor: pointer;
  border-radius: 4px;
  overflow: visible;
}

.progress {
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(29, 228, 132, 1),
    rgba(24, 180, 105, 1)
  );
  transition: width 0.3s ease-in-out;
  position: relative;
  border-radius: 4px;
  min-width: 0.5rem;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: -25px;
  transform: translateY(-50%);
  color: white;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.2s ease;
  background-color: var(--rds-dark-2);
  padding: 8px;
  border-radius: 8px;
}

.progress:hover .progress-text {
  opacity: 1;
}

.progress:hover {
  filter: brightness(1.1);
}
</style>
