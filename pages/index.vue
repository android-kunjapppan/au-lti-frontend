<template>
  <div class="">
    <ClientOnly>
      <template v-if="runtimeConfig.public.stage == 'dev'">
        <div class="position-absolute top-0 left-0 z-3 container">
          <rds-dropdown id="test-menu" text="Testing Menu">
            <AvatarUpdater />
            <rds-dropdown-divider />
            <EnvironmentMapUpdater />
          </rds-dropdown>
        </div>
      </template>
    </ClientOnly>
    <MainScene class="h-100 w-100 z-0"></MainScene>
    <div
      class="position-absolute bottom-0 left-0 z-1 w-100 d-flex justify-content-end align-items-center flex-column mx-auto"></div>
  </div>
</template>

<script setup lang="ts">
import MainScene from "~/components/avatar/MainScene.vue";
import AvatarUpdater from "~/components/avatar/AvatarUpdater.vue";
import EnvironmentMapUpdater from "~/components/avatar/EnvironmentMapUpdater.vue";
const runtimeConfig = useRuntimeConfig();
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: fit-content;
  padding: 0.5rem;
}
</style>
