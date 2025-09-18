<template>
  <div class="d-flex align-items-center position-relative input-group">
    <i-custom-magnifying-glass class="w-4 h-4 magnifying-glass" />
    <input
      type="text"
      class="p-space-xxs form-control"
      :class="size === 'large' && 'p-space-xs'"
      v-model="searchQuery"
      :placeholder="dynamicPlaceholder"
      :aria-label="`Search ${placeholder || 'content'}`"
      @input="handleInput"
      @keydown.enter="handleEnterKey"
      @keydown.escape="handleEscapeKey" />

    <!-- Debounce indicator -->
    <div
      v-if="isDebouncing"
      class="debounce-indicator"
      role="status"
      aria-label="Searching...">
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Searching...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    width?: string;
    debounceMs?: number;
    enableDebounce?: boolean;
    size?: "small" | "medium" | "large";
  }>(),
  {
    width: "400px",
    debounceMs: 300, // Default 300ms debounce delay
    enableDebounce: true, // Enable debouncing by default
  }
);

const emit = defineEmits<{
  (e: "update:modelValue" | "search", value: string): void;
}>();

const searchQuery = ref(props.modelValue);
const isDebouncing = ref(false);
let debounceTimer: NodeJS.Timeout | null = null;

// Computed property for dynamic placeholder
const dynamicPlaceholder = computed(() => {
  if (isDebouncing.value && props.enableDebounce) {
    return `${props.placeholder || "Search"} (${props.debounceMs}ms delay)`;
  }
  return props.placeholder || "Search";
});

watch(
  () => props.modelValue,
  (newValue) => {
    searchQuery.value = newValue;
  }
);

const handleInput = () => {
  // Clear any existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Update the model value immediately for v-model binding
  emit("update:modelValue", searchQuery.value);

  // Don't show debouncing indicator for empty queries
  if (!searchQuery.value.trim()) {
    isDebouncing.value = false;
    emit("search", "");
    return;
  }

  // If debouncing is disabled, search immediately
  if (!props.enableDebounce) {
    isDebouncing.value = false;
    emit("search", searchQuery.value);
    return;
  }

  // Show debouncing indicator
  isDebouncing.value = true;

  // Set a new timer for the debounced search
  debounceTimer = setTimeout(() => {
    isDebouncing.value = false;
    emit("search", searchQuery.value);
  }, props.debounceMs);
};

// Method to cancel pending search
const cancelPendingSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isDebouncing.value = false;
};

// Method to trigger search immediately without debouncing
const triggerSearch = () => {
  cancelPendingSearch();
  emit("search", searchQuery.value);
};

// Handle Enter key - trigger search immediately
const handleEnterKey = () => {
  triggerSearch();
};

// Handle Escape key - clear search and cancel pending
const handleEscapeKey = () => {
  cancelPendingSearch();
  searchQuery.value = "";
  emit("update:modelValue", "");
  emit("search", "");
};

// Clean up timer on component unmount
onUnmounted(() => {
  cancelPendingSearch();
});

defineExpose({
  searchQuery,
  cancelPendingSearch,
  triggerSearch,
});
</script>

<style scoped>
.input-group {
  width: v-bind(width);
}
.magnifying-glass {
  position: absolute;
  left: 16px;
  z-index: 99;
}

.form-control {
  /* padding: 0.5rem 1rem; */
  font-size: 0.875rem;
  border-color: #dee2e6;
  padding-left: 44px !important;
}

.form-control:focus {
  box-shadow: none;
  /* border-color: #dee2e6; */
}

.form-control::placeholder {
  color: var(--rds-dark-1);
}

.debounce-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 99;
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
}

.debounce-indicator:not([style*="display: none"]) {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
  border-width: 0.125em;
}
</style>
