<template>
  <div
    class="sign-in-card rounded-md d-flex flex-column justify-content-center align-items-center position-relative"
    :class="{ 'success-state': isSuccessState }">
    <div
      class="sign-in-content w-100 text-center d-flex flex-column align-items-center justify-content-center">
      <i-fa6-solid:circle-check
        v-if="isSuccessState"
        class="success-icon rounded-circle d-flex align-items-center justify-content-center"
        aria-label="Success checkmark" />
      <h1 class="sign-in-heading m-0 fs-xl fw-bold">{{ heading }}</h1>
      <p class="sign-in-subheading m-0 fs-medium fw-normal">{{ subheading }}</p>

      <div class="sign-in-actions d-flex flex-column align-items-center">
        <button
          v-if="showProceedButton"
          class="btn sign-in-btn"
          @click="$emit('proceed')">
          {{ proceedButtonText }}
        </button>

        <button
          v-if="showTryAgainButton"
          class="btn sign-in-btn"
          @click="$emit('tryAgain')">
          Try again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  heading: string;
  subheading: string;
  showProceedButton?: boolean;
  showTryAgainButton?: boolean;
  isSuccessState?: boolean;
  proceedButtonText?: string;
}

defineProps<Props>();
defineEmits<{
  proceed: [];
  tryAgain: [];
}>();
</script>

<style scoped>
.sign-in-card {
  width: 90vw;
  max-width: 462px;
  height: auto;
  min-height: 215px;
  padding: 32px;
  gap: 10px;
  background: var(--rds-white-bg);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  z-index: 2;
}

.sign-in-card.success-state .sign-in-heading {
  color: var(--rds-success);
}

.sign-in-card.success-state .sign-in-subheading {
  color: var(--rds-text-primary);
}

.success-icon {
  width: 32px;
  height: 32px;
  color: var(--rds-success);
}

.sign-in-content {
  gap: 16px;
}

.sign-in-heading {
  line-height: 1.2;
}

.sign-in-subheading {
  line-height: 1.4;
}

.sign-in-btn {
  padding: 10px 24px;
  background: var(--rds-dark-2);
  color: var(--rds-light-1);
  transition: background-color 0.2s ease;
}

.sign-in-btn:hover {
  background: var(--rds-dark-3);
}

.sign-in-btn:active {
  background: var(--rds-dark-3);
}
</style>
