<template>
  <div
    class="btn rounded-3 d-flex justify-center align-center"
    :class="dropZoneClasses">
    <div ref="dropZoneRef">Drop avatar model file here</div>
  </div>
</template>

<script setup lang="ts">
/** Used to swap the mode on the dev version */
import type { GLTFResult } from "@tresjs/cientos";
import { useDropZone } from "@vueuse/core";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const avatarStore = useAvatarStore();
const dropZoneRef = ref<HTMLDivElement>();

/** @description onDrop handler, gets the model file, loads it using a GLTFLoader instance using loader.parse, then updates the model in the store  */
const onDrop = async (files: File[] | null) => {
  if (files && files[0]) {
    const loader = new GLTFLoader();
    // called when files are dropped on zone
    console.log("file data: ", await files[0].arrayBuffer());
    loader.parse(await files[0].arrayBuffer(), "/", (object) => {
      console.log("Loaded", object);
      avatarStore.updateAvatarModel(object as unknown as GLTFResult);
    });
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
