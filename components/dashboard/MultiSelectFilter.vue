<template>
  <div
    class="border border-light-4 p-space-xs d-flex flex-column gap-space-xxs">
    <SearchComponent v-model="search" :placeholder="placeholder" width="100%" />
    <div class="d-flex align-items-center justify-content-between">
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="select-all-checkbox"
          :checked="selectAllState === true"
          :indeterminate="selectAllState === 'indeterminate'"
          @change="handleSelectAll" />
        <label class="fs-small fw-bold" for="select-all-checkbox">
          Select All
        </label>
      </div>
      <button
        class="btn btn-link fs-small fw-bold p-0"
        @click="clearAllFiltered">
        Clear
      </button>
    </div>
    <div class="separator"></div>
    <div class="checkbox-list">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="form-check mb-space-xxxs">
        <input
          class="form-check-input"
          type="checkbox"
          :id="'item-' + item.id"
          :value="item.id"
          :checked="modelValue.includes(item.id)"
          @change="toggleItem(item.id)" />
        <label class="form-check-label" :for="'item-' + item.id">
          {{ item.title }}
        </label>
      </div>
      <div
        v-if="filteredItems.length === 0"
        class="text-muted small py-space-xxs text-center">
        No items found.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends FilterItem[]">
import { computed, ref } from "vue";
import SearchComponent from "./SearchComponent.vue";

export interface FilterItem {
  id: string;
  title: string;
  [key: string]: boolean | string | number;
}

interface Props {
  items: T;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Search...",
});

const modelValue = defineModel<string[]>({ default: [] });

const search = ref("");

// Computed property to determine Select All checkbox state
const selectAllState = computed(() => {
  const filteredIds = filteredItems.value.map((item) => item.id);
  const selectedFilteredIds = modelValue.value.filter((id) =>
    filteredIds.includes(id)
  );

  if (selectedFilteredIds.length === 0) {
    return false; // unchecked
  } else if (selectedFilteredIds.length === filteredIds.length) {
    return true; // checked
  } else {
    return "indeterminate"; // indeterminate
  }
});

const filteredItems = computed(() => {
  if (!search.value) return props.items;
  const s = search.value.toLowerCase();
  return props.items.filter(
    (item) =>
      item.title.toLowerCase().includes(s) ||
      (item.studentName &&
        item.studentName.toString().toLowerCase().includes(s))
  );
});

function toggleItem(id: string) {
  const selected = [...modelValue.value];
  const idx = selected.indexOf(id);
  if (idx === -1) {
    selected.push(id);
  } else {
    selected.splice(idx, 1);
  }
  modelValue.value = selected;
}

function handleSelectAll() {
  if (selectAllState.value === true) {
    // If all are selected, clear all
    clearAll();
  } else {
    // If none or some are selected, select all
    selectAll();
  }
}

function selectAll() {
  const allIds = filteredItems.value.map((item) => item.id);
  modelValue.value = Array.from(new Set([...modelValue.value, ...allIds]));
}

function clearAll() {
  const filteredIds = filteredItems.value.map((item) => item.id);
  modelValue.value = modelValue.value.filter((id) => !filteredIds.includes(id));
}

function clearAllFiltered() {
  const filteredIds = filteredItems.value.map((item) => item.id);
  modelValue.value = modelValue.value.filter((id) => !filteredIds.includes(id));
}

// Method to clear all selected items (for external use)
function clearAllSelected() {
  modelValue.value = [];
}

// Expose methods for external use
defineExpose({
  clearAllSelected,
});
</script>

<style scoped>
.separator {
  height: 1px;
  background-color: var(--rds-light-4);
}
.checkbox-list {
  max-height: 220px;
  overflow-y: auto;
}

/* Custom styling for indeterminate checkbox state */
.form-check-input:indeterminate {
  background-color: var(--rds-primary);
  border-color: var(--rds-primary);
}
</style>
