<template>
  <client-only>
    <DotLottieVue autoplay :class="props.class" :src="src" ref="playerRef" />
  </client-only>
</template>

<script setup lang="ts">
import { type DotLottie, DotLottieVue } from "@lottiefiles/dotlottie-vue";
import { useTimeoutFn } from "@vueuse/core";

interface Props {
  src: string;
  timeout?: number;
  class?: string;
  loop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  timeout: 3000,
  class: "",
  loop: true,
});

const playerRef = ref<typeof DotLottieVue>();
const animationEnded = ref(true);
let lottieInstance: DotLottie;

const playAnimation = () => {
  if (lottieInstance !== undefined) lottieInstance.play();
  animationEnded.value = false;
};
const { start, stop, isPending } = useTimeoutFn(playAnimation, props.timeout);

const startTimer = () => {
  animationEnded.value = true;
};

watch(animationEnded, async (newValue) => {
  if (newValue === true && props.loop) {
    if (isPending) stop();
    start();
  }
});

watch(playerRef, async (newValue) => {
  if (newValue) {
    lottieInstance = await newValue.getDotLottieInstance();
    lottieInstance?.addEventListener("complete", startTimer);
  }
});

onUnmounted(() => {
  if (lottieInstance) {
    lottieInstance.destroy();
  }
});
</script>

<style scoped></style>
