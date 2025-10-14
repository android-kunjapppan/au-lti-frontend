<template>
  <div v-if="isVisible" class="notification-container">
    <div class="notification-content bg-dark-2 fs-small">
      <span class="notification-text">{{ message }}</span>
      <button
        @click="handleClose"
        class="close-button"
        aria-label="Close notification">
        <i-fa6-solid:xmark class="close-icon" />
      </button>
    </div>

    <div class="notification-arrow">
      <div class="arrow-shape"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Props {
  message?: string;
}

const props = withDefaults(defineProps<Props>(), {
  message:
    "You've done enough for today, you can submit now, or keep chatting if you'd like!",
});

const emit = defineEmits<{
  close: [];
}>();

const isVisible = ref(true);

const handleClose = () => {
  isVisible.value = false;
  emit("close");
};
</script>

<style scoped>
.notification-container {
  position: relative;
  display: inline-block;
}

.notification-content {
  display: flex;
  padding: 12px 16px;
  gap: 16px;
  border-radius: 8px;
  color: white;
  min-width: 334px;
  position: relative;
}

.notification-text {
  padding-right: 24px;
}

.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.close-icon {
  width: 14px;
  height: 14px;
  color: white;
}

.notification-arrow {
  position: absolute;
  right: 10%;
  transform: translateX(-50%);
  top: 100%;
}

.arrow-shape {
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid var(--rds-dark-2);
}
</style>
