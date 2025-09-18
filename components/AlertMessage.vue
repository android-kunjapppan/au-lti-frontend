<template>
  <div class="alert-message-container">
    <transition-group name="alert-fade" tag="div">
      <div v-for="msg in appStore.alertQueue" :key="msg.id" class="alert">
        <div class="alert-wrapper">
          <div class="d-flex align-items-start alert-content">
            <i-custom-error-alert-icon class="alert-icon" />
            <span class="alert-text fs-xs" v-html="msg.text"></span>
          </div>
          <button
            type="button"
            class="close-btn"
            @click="appStore.removeAlert(msg.id)"
            aria-label="Close">
            <i-custom-close class="close-btn-icon" />
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
const appStore = useAppStore();
</script>

<style scoped>
.alert-message-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: var(--rds-z-index-footer);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert {
  width: 280px;
  border-radius: 8px;
  border-width: 1px;
  box-shadow: 0px 4px 4px 0px var(--rds-alert-box-shadow);
  word-break: break-word;
  transition: all 0.3s;
  background-color: var(--dsl-alert-bg);
  border-color: var(--dsl-red);
  padding: 16px;
}

.alert-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  gap: 6px;
}

.alert-content {
  gap: 10px;
  flex: 1;
  align-items: flex-start;
}

.alert-icon {
  margin-top: 1px;
}

.alert-text {
  color: var(--rds-dark-3);
  line-height: 18px;
  letter-spacing: 0%;
  vertical-align: middle;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: break-word;
  flex: 1;
}

.close-btn {
  flex-shrink: 0;
  transition: opacity 0.2s;
  border: none;
  outline: none;
  box-shadow: none;
  background: none;
  padding: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.close-btn:hover {
  opacity: 0.75;
}

.close-btn:focus {
  border: none;
  outline: none;
  box-shadow: none;
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: all 0.3s ease-out;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.alert-fade-leave-active {
  transition: all 0.6s ease-out;
}
</style>
