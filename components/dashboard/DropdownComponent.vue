<template>
  <div class="dropdown-component">
    <typeahead-select
      v-bind="typeaheadProps"
      v-model="selectedValue"
      @update:model-value="handleValueChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface DropdownOption {
  text: string;
  value: string | null;
}

interface Props {
  id?: string;
  options: DropdownOption[];
  disabled?: boolean;
  clearable?: boolean;
  alphaSort?: boolean;
  placeholder?: string;
  height?: string;
  highlightBgVariant?: string;
  highlightTextVariant?: string;
  actionVariant?: string;
  preselectOpacity?: string;
  preselect?: boolean;
  modelValue?: DropdownOption | null;
}

const props = withDefaults(defineProps<Props>(), {
  id: "dropdown",
  disabled: false,
  clearable: false,
  alphaSort: false,
  placeholder: "Select an option",
  height: "340px",
  highlightBgVariant: "secondary",
  highlightTextVariant: "dark-3",
  actionVariant: "dark-2",
  preselectOpacity: "0.6",
  preselect: false,
  modelValue: null,
});

const emit = defineEmits<{
  (e: "update:modelValue" | "change", value: DropdownOption | null): void;
}>();

// Initialize with first option if no modelValue is provided and preselect is true
const getInitialValue = (): DropdownOption | null => {
  if (props.modelValue) {
    return props.modelValue;
  }
  // If preselect is true and options are available, select the first option
  if (props.preselect && props.options.length > 0) {
    return props.options[0];
  }
  return null;
};

const selectedValue = ref<DropdownOption | null>(getInitialValue());

// Watch for external modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    selectedValue.value = newValue;
  }
);

// Emit initial value if auto-selected
watch(
  () => selectedValue.value,
  (newValue) => {
    if (newValue && !props.modelValue && props.preselect) {
      emit("update:modelValue", newValue);
      emit("change", newValue);
    }
  },
  { immediate: true }
);

// Computed props for typeahead-select
const typeaheadProps = computed(() => ({
  id: props.id,
  options: props.options,
  disabled: props.disabled,
  clearable: props.clearable,
  alphaSort: props.alphaSort,
  placeholder: props.placeholder,
  height: props.height,
  highlightBgVariant: props.highlightBgVariant,
  highlightTextVariant: props.highlightTextVariant,
  actionVariant: props.actionVariant,
  preselectOpacity: props.preselectOpacity,
  preselect: props.preselect,
}));

// Handle value changes
const handleValueChange = (value: DropdownOption | null) => {
  selectedValue.value = value;
  emit("update:modelValue", value);
  emit("change", value);
};

// Expose methods for parent components
defineExpose({
  selectedValue,
  clearSelection: () => {
    selectedValue.value = null;
    emit("update:modelValue", null);
    emit("change", null);
  },
  getSelectedText: () => {
    if (!selectedValue.value) return "";
    const found = props.options.find(
      (option) => option.value === selectedValue.value?.value
    );
    return found ? found.text : "";
  },
});
</script>

<style scoped>
.dropdown-component {
  position: relative;
  width: 100%;
}

/* Custom dropdown icon styling */
:deep(.typeahead__dropdown-icon) {
  width: 14px;
  height: 14px;
  color: var(--rds-dark-3);
}
</style>
