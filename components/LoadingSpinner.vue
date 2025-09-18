<template>
  <div class="spinner-overlay">
    <div class="spinner"></div>
    <div v-if="$slots.default" class="loading-text">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed for now
</script>

<style scoped>
.spinner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.spinner {
  border: 6px solid #f3f3f3;
  border-top: 6px solid #3498db;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.loading-text {
  margin-top: 16px;
  font-size: 1.2rem;
  color: #333;
}
</style>
