<template>
  <div class="outer-box">
    <div class="inner-box">
      <div class="header-section">
        <div class="title-box">
          <i-custom-blacklightbulb class="icon" />
          <h1 class="title p-0">Helpful tip</h1>
        </div>
        <button class="close-btn" @click="handleClose" :disabled="disabled">
          <i-fa6-solid:xmark />
        </button>
      </div>
      <div class="content-section suggestion-scrollbar">
        <div class="content-text fs-xs">Try saying this: {{ content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  content: string;
  disabled?: boolean;
}>();

const emit = defineEmits(["close"]);

const handleClose = () => {
  if (!props.disabled) {
    emit("close");
  }
};
</script>

<style scoped>
.outer-box {
  width: 235px;
  height: 134px;
  background: var(--rds-suggestion-box);
  border-radius: 8px;
  position: relative;
  padding: 16px;
}

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-shrink: 0;
  margin-bottom: 6px;
}

.title-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon {
  background: transparent;
  fill: var(--rds-dark-3);
  font-size: 18px;
}

.title {
  font-family: "Open Sans", sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 21.63px;
  vertical-align: middle;
  color: var(--rds-label-color);
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--rds-dark-3);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn:not(:disabled):hover {
  opacity: 0.7;
}

.inner-box {
  height: 102px;
  display: flex;
  flex-direction: column;
}

.content-section {
  flex: 1;
  overflow-y: scroll;
  min-height: 0;
  padding-right: 8px;
}

.content-text {
  color: var(--rds-dark-3);
  white-space: normal;
  word-wrap: break-word;
}

/* Custom scrollbar for SuggestionBox */
.suggestion-scrollbar {
  /* width */
  &::-webkit-scrollbar {
    width: 6px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    border-radius: var(--rds-border-radius-pill);
    background: var(--rds-scrollbar-thumb);
  }
}
</style>
