<template>
  <div>
    <NuxtLayout name="default" is-error-page> Something broke </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps({
  error: Object as () => NuxtError,
});
</script>

<style scoped></style>
