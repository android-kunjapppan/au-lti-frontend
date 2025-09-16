<template>
  <Suspense>
    <primitive
      v-if="avatarModel?.scene"
      :position="[state.avatarPos.x, state.avatarPos.y, state.avatarPos.z]"
      :object="avatarModel.scene"
      :scale="state.avatarScale">
    </primitive>
  </Suspense>
</template>

<script setup lang="ts">
const { onLoop } = useRenderLoop();

const avatarStore = useAvatarStore();
const { state, avatarModel } = storeToRefs(avatarStore);

onLoop(({ elapsed }) => {});
</script>
