<template>
  <Suspense>
    <Environment
      :background="state.background"
      :blur="state.blur"
      :near="state.near"
      :far="state.far"
      :files="environmentMap"
      :resolution="64">
    </Environment>
  </Suspense>
</template>

<script lang="ts" setup>
import type { FolderApi } from "tweakpane";

const { $pane } = useNuxtApp();
const paneFolder = shallowRef<FolderApi>();
const environmentStore = useEnvironmentStore();
const environmentStoreRef = storeToRefs(environmentStore);
const environmentMap = environmentStoreRef.environmentMap;

const state = reactive({
  background: false,
  blur: 0,
  near: 0.1,
  far: 100,
});

onMounted(async () => {
  if (!environmentMap.value) {
    console.log("loading default environment map");
    environmentStore.restoreDefaultEnvironmentMap();
  }
});

if (import.meta.client) {
  paneFolder.value = $pane.addFolder({
    title: "Environment Map",
    expanded: false,
  });
  paneFolder.value.addBinding(state, "background");
  paneFolder.value.addBinding(state, "blur", {
    min: 0,
    max: 1,
    step: 0.01,
  });
  paneFolder.value.addBinding(state, "near");
  paneFolder.value.addBinding(state, "far");
}
onUnmounted(() => {
  paneFolder.value?.dispose();
});
</script>

<style></style>
