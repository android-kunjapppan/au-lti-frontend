<template>
  <div ref="reference">
    <slot></slot>
    <Transition name="fade">
      <div
        v-if="isHovered"
        ref="floating"
        class="tool-tip border-1 z-100 p-space-sm"
        :style="floatingStyles">
        <div ref="floatingArrow" class="arrow" :style="arrowStyles"></div>
        <slot name="tooltip-text">
          {{ props.text }}
        </slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { arrow, offset, shift, useFloating } from "@floating-ui/vue";
import { useElementHover } from "@vueuse/core";
import type { StyleValue } from "vue";

interface Props {
  text?: string;
  xOffset?: number;
  yOffset?: number;
  position?: "top" | "bottom";
}

const props = withDefaults(defineProps<Props>(), {
  position: "top",
  yOffset: 32,
  xOffset: 0,
});

const reference = ref<HTMLElement | null>(null);
const floating = ref(null);
const floatingArrow = ref(null);

const { floatingStyles, middlewareData } = useFloating(reference, floating, {
  strategy: "absolute",
  placement: props.position,
  middleware: [
    shift({ padding: 48 }),
    arrow({ element: floatingArrow, padding: { right: props.xOffset } }),
    offset({ mainAxis: props.yOffset, crossAxis: props.xOffset }),
  ],
});

const isHovered = useElementHover(reference, { delayEnter: 500 });

const arrowY = toRef(() => middlewareData.value.arrow?.y);
const arrowX = toRef(() => middlewareData.value.arrow?.x);

const arrowStyles = computed(() => {
  const styles: StyleValue = {
    position: "absolute",
    left: arrowX.value != null ? `${arrowX.value}px` : "",
    "border-top": "10px",
    "--arrow-outline-style-top": props.position == "top" ? "10px" : "0px",
    "--arrow-outline-style-bottom": props.position == "top" ? "0px" : "10px",
  };
  if (arrowY.value != null) {
    if (props.position == "top") styles.top = `${arrowY.value}px`;
    else styles.bottom = `${arrowY.value}px`;
  } else {
    if (props.position == "top") styles.top = "100%";
    else styles.bottom = `calc(100% + (var(--arrow-outline-style-bottom) * 2))`;
  }
  return styles;
});
</script>

<style scoped>
.tool-tip {
  font-size: 24px;
  border-radius: 16px;
  color: white;
  background: linear-gradient(180deg, var(--rds-primary) 0%, #0070b1 100%);
}
.arrow:after {
  content: "";
  height: 20px;
  width: 20px;
  z-index: -1;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-left: 10px transparent solid;
  border-right: 10px transparent solid;
  border-top: var(--arrow-outline-style-top) #0070b1 solid;
  border-bottom: var(--arrow-outline-style-bottom) var(--rds-primary) solid;
}
</style>
