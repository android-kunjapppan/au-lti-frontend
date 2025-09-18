<template>
  <NuxtLayout>
    <div class="dashboard-prompt-container">
      <div
        class="dashboard-prompt-card rounded-md d-flex flex-column justify-content-center align-items-center position-relative">
        <div
          class="dashboard-prompt-content w-100 text-center d-flex flex-column align-items-center justify-content-center">
          <p class="dashboard-prompt-message m-0 fs-medium fw-normal">
            Please navigate to the Language Buddy Dashboard section on Canvas to
            view the submission.
          </p>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup></script>

<style>
.dashboard-prompt-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.dashboard-prompt-content {
  gap: 16px;
}

.dashboard-prompt-card {
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

.dashboard-prompt-message {
  color: var(--rds-text-primary);
}
</style>
