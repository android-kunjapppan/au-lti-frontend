<template>
  <div class="waveform-container">
    <div class="waveform">
      <div
        v-for="(bar, index) in waveform"
        :key="`wave-bar-${index}`"
        class="wave-bar"
        :style="{ '--mic-bar-height': `${bar}px` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  waveform: number[];
}

const props = defineProps<Props>();

// Computed properties
const hasWaveform = computed(() => props.waveform.length > 0);
const waveformBars = computed(() =>
  props.waveform.map((bar, index) => ({
    height: bar,
    index,
    key: `wave-bar-${index}`,
  }))
);
</script>

<style scoped>
/* Waveform */
.waveform-container {
  width: 235px;
  height: 40px;
  border-radius: 1.5rem;
  display: flex;
  cursor: default;
  justify-content: center;
  align-items: center;
  padding: 2px;
  background: linear-gradient(
    180deg,
    var(--mic-waveform-gradient-start) 0%,
    var(--mic-waveform-gradient-end) 100%
  );
  box-shadow: 0rem -0.25rem 1rem 0rem var(--mic-waveform-shadow);
}

.waveform {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 20%;
}

.wave-bar {
  --mic-bar-height: 0px;
  background-color: var(--rds-waveform-bg);
  transition: height 0.2s ease;
  width: 2px;
  margin: 0 2px;
  height: var(--mic-bar-height);
}
</style>
