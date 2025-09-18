<template>
  <div class="confirm-card-overlay" @click.self="handleOverlayClick">
    <div class="custom-box">
      <h1 class="confirm-card-title mb-space-xs">{{ title }}</h1>
      <p class="confirm-card-text">{{ message }}</p>
      <div class="button-container mt-space-xs">
        <button class="confirm-btn yes" @click="onConfirm">
          {{ confirmText }}
        </button>
        <button class="confirm-btn no" @click="onCancel">
          {{ cancelText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  title: { type: String, default: "Are you sure?" },
  message: {
    type: String,
    default: "This will erase your progress. Are you sure you want to exit?",
  },
  confirmText: { type: String, default: "Yes" },
  cancelText: { type: String, default: "No" },
});

const emit = defineEmits<(e: "confirm" | "cancel" | "close") => void>();

const onConfirm = () => {
  emit("confirm");
  emit("close");
};

const onCancel = () => {
  emit("cancel");
  emit("close");
};

const handleOverlayClick = () => {
  emit("close");
};
</script>

<style scoped>
.confirm-card-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.custom-box {
  width: 417px;
  min-height: 235px;
  border-radius: 32px;
  background: var(--rds-white-bg);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 40px 32px;
}

.confirm-card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--rds-label-color);
  text-align: left;
  width: 100%;
}

.confirm-card-text {
  width: 100%;
  font-size: 16px;
  line-height: 24px;
}

.button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 16px;
}

.confirm-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 40px;
  border-radius: 103px;
  background: var(--rds-confirm-button);
  color: white;
  border: none;
  font-size: 14px;
  cursor: pointer;
  font-weight: 700;
  line-height: 27px;
}

.yes {
  background-color: var(--rds-dark-2);
  color: white;
  transition: background-color 0.2s ease;
}

.yes:hover {
  background-color: var(--dsl-black);
}

.no {
  border: 1px solid var(--rds-dark-2);
  color: var(--rds-label-color);
}
.no:hover {
  border: 2px solid var(--rds-dark-2);
}
</style>
