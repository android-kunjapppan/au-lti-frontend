<template>
  <button :class="buttonClasses" @click="handleClick" :aria-label="ariaLabel">
    <div class="button-content">
      <slot :is-active="isActive" />
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

const props = withDefaults(
  defineProps<{
    ariaLabel?: string;
    active?: boolean;
    hasToggle?: boolean;
    autoResetDuration?: number;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    autoResetDuration: 3000,
    disabled: false,
    loading: false,
  }
);

const isActive = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

function handleClick() {
  // Don't handle click if button is disabled or loading
  if (props.disabled || props.loading) {
    return;
  }

  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  if (props.hasToggle) {
    isActive.value = !isActive.value;

    if (isActive.value && props.autoResetDuration) {
      resetTimer = setTimeout(() => {
        isActive.value = false;
      }, props.autoResetDuration);
    }
  } else {
    isActive.value = !isActive.value;
  }

  props.onClick?.();
}

// Function to reset the active state (called from parent components)
const resetActiveState = () => {
  isActive.value = false;
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
};

// Expose the resetActiveState function to parent components
defineExpose({
  resetActiveState,
});

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer);
});

const buttonClasses = computed(() => ({
  "base-button": true,
  "active-state": isActive.value,
  "disabled-state": props.disabled,
  "loading-state": props.loading,
}));
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px 4px 8px;
  margin: 0 2px;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 8px;
  height: 32px;
  transition: background-color 0.3s ease;
}

.base-button:hover {
  background-color: var(--rds-translate-border);
}

.base-button.active-state {
  background-color: var(--rds-translate-border);
}

.base-button.disabled-state {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}

.base-button.disabled-state:hover {
  background-color: transparent;
}

.base-button.loading-state {
  cursor: not-allowed;
  pointer-events: none;
}

.base-button.loading-state:hover {
  background-color: transparent;
}

.button-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.active-text {
  color: var(--rds-dark);
}
</style>
