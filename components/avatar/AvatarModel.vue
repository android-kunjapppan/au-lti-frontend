<template>
  <TresCanvas preset="realistic" class="z-0 avatar">
    <TresPerspectiveCamera
      :position="[cameraPosition.x, cameraPosition.y, cameraPosition.z]" />
    <TresAmbientLight
      :color="ambientLightValues.color"
      :intensity="ambientLightValues.intensity" />
    <TresDirectionalLight
      :color="directionLightValues.color"
      :position="directionalPosition"
      :intensity="directionLightValues.intensity" />
    <Suspense>
      <primitive
        v-if="isAvatarVisible"
        :position="[state.avatarPos.x, state.avatarPos.y, state.avatarPos.z]"
        :object="avatarModel?.scene"
        :scale="state.avatarScale"
        :rotation="state.avatarRotation">
      </primitive>
    </Suspense>
  </TresCanvas>
</template>

<script setup lang="ts">
const avatarStore = useAvatarStore();
const { state, avatarModel, isAvatarVisible } = storeToRefs(avatarStore);

const cameraPosition = {
  x: 0,
  y: 0,
  z: 2,
};

let paneCleanup: () => void;
const { createLightingPane } = useTweakpaneControls();
const directionLightValues = reactive({
  position: {
    x: 9.1,
    y: 7.6,
    z: 19,
  },
  intensity: 0.6,
  color: "#f7f2db",
});
const directionalPosition = objToVec3(directionLightValues.position);
const ambientLightValues = reactive({
  intensity: 0.3,
  color: "#dfe7ff",
});

onMounted(() => {
  paneCleanup = createLightingPane(ambientLightValues, directionLightValues);
});
onUnmounted(() => {
  if (paneCleanup) paneCleanup();
});
</script>

<style scoped>
.avatar {
  /* Use will-change to optimize for transforms and reduce repaints */
  will-change: transform;
  /* Use transform3d for hardware acceleration */
  transform: translate3d(0, 0, 0);
  transition: transform var(--standard-transition-duration) ease;
  /* Add containment to isolate rendering impact */
  contain: layout style paint;
}
</style>
