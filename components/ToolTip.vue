<template>
  <div
    ref="trigger"
    class="tooltip-wrapper"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <slot></slot>
    <Transition name="fade">
      <div
        v-if="isHovered"
        ref="floating"
        class="tool-tip border-1 z-100"
        :style="floatingStyles">
        <div
          v-if="props.showArrow"
          ref="floatingArrow"
          class="arrow"
          :style="arrowStyles"></div>
        <slot name="tooltip-text">
          {{ props.text }}
        </slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { arrow, offset, shift, useFloating } from "@floating-ui/vue";
import { useWindowSize } from "@vueuse/core";
import type { StyleValue } from "vue";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  toRef,
  watch,
} from "vue";

interface Props {
  text?: string;
  xOffset?: number;
  yOffset?: number;
  position?: "top" | "bottom" | "left" | "right";
  showArrow?: boolean;
  triggerElement?: HTMLElement | null;
}

const props = withDefaults(defineProps<Props>(), {
  position: "top",
  yOffset: 8,
  xOffset: 0,
  showArrow: false,
});

// Refs
const trigger = ref<HTMLElement | null>(null);
const floating = ref<HTMLElement | null>(null);
const floatingArrow = ref<HTMLElement | null>(null);

// ResizeObserver for position changes
const resizeObserver = new ResizeObserver(() => {
  // When button position changes, hide tooltip if it's showing
  // But only if it's being controlled externally (not using internal hover)
  if (isHovered.value && isExternallyControlled.value) {
    isHovered.value = false;
  }
});

// Simple hover detection
const isHovered = ref(false);
const isClickDisabled = ref(false);
const isExternallyControlled = ref(false);

// Expose hover control
const setHovered = (value: boolean) => {
  isExternallyControlled.value = true;

  if (!isClickDisabled.value || !value) {
    isHovered.value = value;
  }
};

// Expose methods to parent
defineExpose({
  setHovered,
  isHovered: readonly(isHovered),
});

// Simple click handler to hide tooltip
const handleClick = () => {
  isHovered.value = false;
  isClickDisabled.value = true;

  // Reset click disabled after a short delay
  setTimeout(() => {
    isClickDisabled.value = false;
  }, 100);
};

// Mouse enter handler
const handleMouseEnter = (event: MouseEvent) => {
  // Don't handle internal hover if externally controlled
  if (isExternallyControlled.value) {
    return;
  }

  if (!isClickDisabled.value) {
    isHovered.value = true;
  }
};

// Mouse leave handler
const handleMouseLeave = (event: MouseEvent) => {
  // Don't handle internal hover if externally controlled
  if (isExternallyControlled.value) {
    return;
  }

  isHovered.value = false;
  isClickDisabled.value = false;
};

// Tooltip positioning
const placement = computed(() => props.position);

const { width } = useWindowSize();

const xOffset = computed(() => {
  if (width.value < 480) return props.xOffset ?? -4; // small screen
  if (width.value < 768) return props.xOffset ?? -8; // medium screen
  return props.xOffset ?? -12; // large screen
});

const yOffset = computed(() => {
  if (width.value < 480) return props.yOffset ?? -8;
  if (width.value < 768) return props.yOffset ?? -10;
  return props.yOffset ?? -14;
});

const { floatingStyles, middlewareData, update } = useFloating(
  trigger,
  floating,
  {
    strategy: "absolute",
    placement,
    middleware: [
      shift({ padding: 4 }),
      offset(() => ({
        mainAxis: yOffset.value,
        crossAxis: xOffset.value,
      })),
      arrow({ element: floatingArrow }),
    ],
  }
);

// Recalculate position when props change
watch([xOffset, yOffset, placement], () => {
  update(); // forces recomputation of tooltip position
});

// Mount lifecycle to handle position changes
onMounted(() => {
  if (trigger.value) {
    resizeObserver.observe(trigger.value);
  }
});

// Cleanup observer on unmount
onBeforeUnmount(() => {
  if (trigger.value) {
    resizeObserver.unobserve(trigger.value);
  }
  resizeObserver.disconnect();
});

// Arrow positioning
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
    if (props.position === "top") styles.top = `${arrowY.value}px`;
    else styles.bottom = `${arrowY.value}px`;
  }
  return styles;
});
</script>

<style scoped>
.tool-tip {
  font-size: 12px;
  border-radius: 8px;
  padding: 6px 10px;
  color: white;
  background: rgba(72, 72, 72, 1);
  white-space: nowrap;
  gap: 6px;
}

.arrow:after {
  content: "";
  height: 10px;
  width: 10px;
  z-index: -1;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-left: 10px transparent solid;
  border-right: 10px transparent solid;
  border-top: var(--arrow-outline-style-top) rgba(72, 72, 72, 1) solid;
  border-bottom: var(--arrow-outline-style-bottom) rgba(72, 72, 72, 1) solid;
}
</style>
