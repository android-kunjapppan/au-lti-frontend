<template>
  <th
    scope="col"
    @click="handleSortClick"
    @mousedown.prevent
    @keydown.enter="handleSortClick"
    @keydown.space.prevent="handleSortClick"
    style="cursor: pointer"
    class="text-white"
    tabindex="0">
    <div class="d-flex align-items-center">
      <!-- add header-label -->
      <span>{{ label }}</span>
      <span class="ms-space-xxs">
        <i-custom-arrow-up
          v-if="sortColumn === column && sortDirection === 'asc'"
          class="w-4 h-4" />
        <i-custom-arrow-down
          v-else-if="sortColumn === column && sortDirection === 'desc'"
          class="w-4 h-4" />
        <i-custom-arrows-up-down v-else class="w-4 h-4" />
      </span>
    </div>
  </th>
</template>

<script setup>
const props = defineProps({
  column: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  sortColumn: {
    type: String,
    default: null,
  },
  sortDirection: {
    type: String,
    default: "asc",
  },
});

const emit = defineEmits(["sort"]);

const handleSortClick = (event) => {
  // Prevent default focus behavior
  event.preventDefault();

  // If this column is not currently sorted, start with ascending
  if (props.sortColumn !== props.column) {
    emit("sort", { column: props.column, direction: "asc" });
  }
  // If this column is currently ascending, switch to descending
  else if (props.sortDirection === "asc") {
    emit("sort", { column: props.column, direction: "desc" });
  }
  // If this column is currently descending, return to unsorted state
  else {
    emit("sort", { column: null, direction: null });
  }
};
</script>

<style scoped>
.sortable-header {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
