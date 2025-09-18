<template>
  <nav aria-label="Pagination Navigation">
    <ul class="pagination justify-content-center">
      <li class="page-item" :class="{ disabled: !hasPrevious }">
        <button
          class="page-link"
          aria-label="Previous page"
          @click="onPrevious"
          :disabled="!hasPrevious">
          Previous
        </button>
      </li>
      <li class="page-item" :class="{ disabled: !hasNext }">
        <button
          class="page-link"
          aria-label="Next page"
          @click="onNext"
          :disabled="!hasNext">
          Next
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from "vue";

interface Props {
  hasPrevious: boolean;
  hasNext: boolean;
}

const props = defineProps<Props>();

const emits = defineEmits<{
  (e: "previous" | "next"): void;
}>();

function onPrevious() {
  if (props.hasPrevious) {
    emits("previous");
  }
}

function onNext() {
  if (props.hasNext) {
    emits("next");
  }
}
</script>

<style scoped>
.pagination {
  margin: 1rem 0;
}

.page-item.disabled .page-link {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
