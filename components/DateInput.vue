<template>
  <div class="w-100">
    <label
      v-if="label"
      :for="inputId"
      class="fw-semibold mb-space-xs fw-semibold text-dark-2">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    <div class="date-input-wrapper">
      <!-- Text input for display -->
      <input
        :id="`${inputId}-display`"
        type="text"
        class="p-space-xxs"
        :class="inputClasses"
        :value="displayValue"
        :disabled="disabled"
        :required="required"
        :aria-describedby="hasError ? `${inputId}-error` : undefined"
        :aria-invalid="hasError"
        readonly
        placeholder="mm/dd/yyyy"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown" />

      <!-- Invisible date input for calendar -->
      <input
        :id="inputId"
        ref="dateInput"
        type="date"
        :value="modelValue"
        :min="minDate"
        :max="maxDate"
        :disabled="disabled"
        :required="required"
        class="date-picker-overlay"
        @input="handleDateInput" />

      <div
        v-if="shouldShowError"
        :id="`${inputId}-error`"
        class="d-flex align-items-center gap-space-xxs fs-small mt-space-xxs text-danger"
        role="alert">
        <i class="fs-medium">⚠</i>
        {{ localError }}
      </div>
      <div v-else-if="helperText" class="fs-small mt-space-xxs">
        {{ helperText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

/**
 * DateInput component props
 *
 * Note: This component only allows date selection via the calendar popup.
 * Manual text entry is prevented, and the browser handles date format validation.
 * The calendar opens when clicking anywhere on the input field.
 */
interface DateInputProps {
  modelValue?: string;
  label?: string;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  disabled?: boolean;

  helperText?: string;
  validateOnChange?: boolean;
  customValidation?: (value: string) => string | null;

  disableErrorMessages?: boolean;
}

const props = withDefaults(defineProps<DateInputProps>(), {
  modelValue: "",
  label: "",
  minDate: "",
  maxDate: "",
  required: true,
  disabled: false,

  helperText: "",
  validateOnChange: true,

  disableErrorMessages: true,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "validation-change": [isValid: boolean, error: string | null];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
}>();

const isFocused = ref(false);
const isTouched = ref(false);
const localError = ref<string | null>(null);
const dateInput = ref<HTMLInputElement | null>(null);

const inputId = computed(
  () => `date-input-${Math.random().toString(36).slice(2, 11)}`
);

// Format the display value
const displayValue = computed(() => {
  if (!props.modelValue) return "";
  const date = new Date(props.modelValue);
  return isNaN(date.getTime()) ? props.modelValue : date.toLocaleDateString();
});

const validateDate = (value: string): string | null => {
  if (props.required && !value) return "This field is required";
  if (!value) return null;

  if (props.minDate && value < props.minDate) {
    return `Date must be on or after ${new Date(props.minDate).toLocaleDateString()}`;
  }
  if (props.maxDate && value > props.maxDate) {
    return `Date must be on or before ${new Date(props.maxDate).toLocaleDateString()}`;
  }

  return props.customValidation?.(value) || null;
};

const hasError = computed(() => !!localError.value && isTouched.value);
const shouldShowError = computed(
  () => !props.disableErrorMessages && hasError.value
);

const inputClasses = computed(() =>
  [
    "date-input",
    hasError.value && "is-invalid",
    props.disabled && "is-disabled",
  ].filter(Boolean)
);

// Handles date selection from calendar
const handleDateInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", value);

  if (props.validateOnChange) {
    localError.value = validateDate(value);
    emit("validation-change", !localError.value, localError.value);
  }
};

// Handles blur events and validation
const handleBlur = (event: FocusEvent) => {
  isFocused.value = false;
  isTouched.value = true;
  if (props.validateOnChange) {
    localError.value = validateDate(props.modelValue);
    emit("validation-change", !localError.value, localError.value);
  }
  emit("blur", event);
};

// Handles focus events
const handleFocus = (event: FocusEvent) => {
  isFocused.value = true;
  emit("focus", event);
};

// Handles keyboard events - opens calendar on Enter/Space, blocks other input
const handleKeydown = (event: KeyboardEvent) => {
  const allowedKeys = [
    "Tab",
    "Escape",
    "Enter",
    " ",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ];

  if (allowedKeys.includes(event.key)) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dateInput.value?.click();
    }
    return;
  }

  event.preventDefault();
};

watch(
  () => props.modelValue,
  (newValue) => {
    if (isTouched.value) {
      localError.value = validateDate(newValue);
      emit("validation-change", !localError.value, localError.value);
    }
  }
);

defineExpose({
  validate: () => {
    isTouched.value = true;
    localError.value = validateDate(props.modelValue);
    const isValid = !localError.value;
    emit("validation-change", isValid, localError.value);
    return isValid;
  },
  reset: () => {
    isTouched.value = false;
    localError.value = null;
    emit("validation-change", true, null);
  },
});
</script>

<style scoped>
.date-input-wrapper {
  position: relative;
  width: 100%;
}

.date-input {
  border-radius: 6px;
  border: 1px solid var(--rds-dark-1);
  color: var(--rds-dark-1);
  transition: border-color 0.2s ease-in-out;
  cursor: pointer;
  width: 100%;
}

.date-input.is-invalid {
  border-color: var(--rds-danger);
}

.date-input.is-disabled {
  cursor: not-allowed;
}

.date-picker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
  border: none;
  background: transparent;
}

.date-picker-overlay::-webkit-calendar-picker-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;
}
</style>
