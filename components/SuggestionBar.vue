<template>
  <button
    class="suggestion-box"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    :disabled="props.isLoading">
    <i-fa6-solid:spinner v-if="props.isLoading" class="icon spin-fast" />
    <i-custom-newlightbulb v-else-if="!isHovered && !isActive" class="icon" />
    <i-custom-lightbulb-on v-else class="icon" />
    <div class="fs-xs">
      {{ props.isLoading ? "Getting tip..." : "Get a tip" }}
    </div>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  isActive: boolean;
  isLoading?: boolean;
}>();

const isHovered = ref(false);

const emit = defineEmits(["onSuggestionClick"]);
function handleClick() {
  if (!props.isLoading) {
    emit("onSuggestionClick");
  }
}
</script>

<style scoped>
/* Button style */
.suggestion-box {
  display: flex;
  align-items: center;
  padding: 4px 16px;
  gap: 4px;
  font-weight: 700;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 1);
  color: white;
  background: transparent;
}

/* Icon inside button */
.icon {
  height: 24px;
  width: 24px;
}
</style>
