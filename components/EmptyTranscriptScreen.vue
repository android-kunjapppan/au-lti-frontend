<template>
  <div
    class="empty-transcript-container w-100 h-100 d-flex align-items-center justify-content-center p-space-md">
    <div
      class="empty-transcript-inner d-flex flex-column align-items-center text-center w-100">
      <!-- Icon holder -->
      <div class="icon-holder d-flex align-items-end justify-content-center">
        <i-custom-transcribe-icon class="empty-transcript-icon" />
      </div>

      <!-- Text content -->
      <div class="text-content d-flex flex-column">
        <h2 class="title fw-semibold text-center">
          You have no transcripts yet
        </h2>
        <p class="description fw-normal text-center m-0">
          To start a conversation, click the mic icon and begin speaking with
          {{ avatarName }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/stores/appStore";

const appStore = useAppStore();
const { avatarName } = storeToRefs(appStore);
</script>

<style scoped>
.empty-transcript-inner {
  max-width: 480px;
}

.icon-holder {
  width: 100px;
  height: 100px;
  margin-bottom: 10px;
  margin-left: 10px;
}

.empty-transcript-icon {
  width: 80px;
  height: 90px;
  color: var(--rds-text-primary);
}

.text-content {
  gap: 12px;
}

.title {
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: 0.5px;
  color: var(--rds-text-primary);
}

.description {
  font-size: 18px;
  line-height: 1.4;
  letter-spacing: 0.5px;
  color: var(--rds-text-primary);
}
</style>
