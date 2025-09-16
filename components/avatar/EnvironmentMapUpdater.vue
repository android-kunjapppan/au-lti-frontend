<template>
  <div
    class="btn rounded-3 d-flex justify-center align-center"
    :class="dropZoneClasses">
    <div ref="dropZoneRef">Drop Environment Map file(.hdr) here</div>
  </div>
</template>

<script setup lang="ts">
/** Used to swap the mode on the dev version */
import { useDropZone } from "@vueuse/core";

const environmentStore = useEnvironmentStore();
const environmentStoreRef = storeToRefs(environmentStore);
const environmentMap = environmentStoreRef.environmentMap;
const dropZoneRef = ref<HTMLDivElement>();

/** @description onDrop handler, gets the environment map file, loads it using a RGBELoader instance using loader.parse, then updates the model in the store  */
const onDrop = async (files: File[] | null) => {
  if (files && files[0]) {
    try {
      if (environmentMap.value) {
        URL.revokeObjectURL(environmentMap.value);
      }
      const dataUrl = URL.createObjectURL(files[0]);
      environmentStore.updateEnvironmentMap(dataUrl);
    } catch (error) {
      console.error("Error processing file:", error);
    }
  }
};

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop,
  // glb /glt aren't standard formats so we leave the dataTypes empty
  dataTypes: [],
  // Disable multiple since it should be only one model
  multiple: false,
  // whether to prevent default behavior for unhandled events
  preventDefaultForUnhandled: false,
});

/** @description Classes used to indicate if the user has dragged a model over the dropzone */
const dropZoneClasses = computed(() => {
  let classes = "";
  if (isOverDropZone.value === true) {
    classes += "btn-dark";
  } else {
    classes += "btn-secondary";
  }
  return classes;
});
</script>

<style scoped></style>
