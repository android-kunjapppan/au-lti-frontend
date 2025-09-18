<template>
  <div class="min-vh-100 h-100 position-relative d-flex flex-column">
    <div class="slot-container">
      <img class="environment-image" src="/images/environment.png" alt="" />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss"></style>
