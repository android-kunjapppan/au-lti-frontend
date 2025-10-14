<template>
  <NuxtLayout>
    <div class="timeout-container">
      <div
        class="timeout-card rounded-md d-flex flex-column justify-content-center align-items-center position-relative">
        <div
          class="timeout-content w-100 text-center d-flex flex-column align-items-center justify-content-center">
          <h1 class="timeout-heading m-0 fs-xl fw-bold">Page not found</h1>
          <p class="timeout-subheading m-0 fs-medium fw-normal">
            Please close this window and re-open the experience from Canvas.
          </p>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup></script>

<style>
.timeout-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.timeout-content {
  gap: 16px;
}

.timeout-card {
  width: 90vw;
  max-width: 462px;
  height: auto;
  min-height: 215px;
  padding: 32px;
  gap: 10px;
  background: var(--rds-white-bg);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  z-index: 2;
}
.timeout-heading {
  color: var(--rds-text-primary);
}
timeout-subheading {
  color: var(--rds-text-primary);
}
</style>
