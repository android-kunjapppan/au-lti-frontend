<template>
  <div
    class="canvas-container pretty-scrollbar w-100 h-100 position-relative d-flex flex-column justify-content-center align-items-center">
    <main
      class="container-sm content-container pretty-scrollbar d-flex flex-column"
      :class="[containerClasses, canvasClasses]">
      <div class="row lesson-layout flex-grow-1">
        <div
          :class="leftSideClasses"
          class="pretty-scrollbar canvas-container-left p-space-xl position-relative d-flex flex-column justify-content-center">
          <slot name="left"></slot>
        </div>
        <div
          v-if="slots.right"
          :class="rightSideClasses"
          class="pretty-scrollbar col-12 col-md-6 col-lg-5 canvas-container-right p-space-xl py-md-space-xl pe-md-space-xl ps-md-space-md position-relative d-flex flex-column justify-content-center">
          <slot name="right"></slot>
        </div>
      </div>
      <div class="row" v-if="slots.footer">
        <div
          class="col-12 py-space-xxs px-space-xl d-flex justify-content-center align-items-center canvas-footer">
          <slot name="footer"></slot>
        </div>
      </div>
      <slot></slot>
    </main>
  </div>
</template>

<script setup lang="ts">
interface Props {
  borderRadius?: "sm" | "md";
  fullHeight?: boolean;
  width?: "normal" | "small";
}

const slots = useSlots();
const props = withDefaults(defineProps<Props>(), { borderRadius: "sm" });

const canvasClasses = computed(() => {
  return props.borderRadius === "md" ? " rounded-md " : " rounded-sm ";
});

const containerClasses = computed(() => {
  return props?.fullHeight ? " flex-grow-1 my-space-lg my-lg-space-xl " : "";
});
const leftSideClasses = computed(() => {
  let classes: string = "";

  if (slots?.right) classes += " col-12 col-md-6 col-lg-7 ";
  else classes += " col-12 ";
  if (slots?.footer) classes += "";
  else classes += "no-footer";

  return classes;
});
const rightSideClasses = computed(() => {
  return slots.footer ? "" : "no-footer";
});
</script>

<style scoped lang="scss">
.canvas-container {
  flex: 1;
  max-height: calc(100vh - var(--footer-height));
}

.canvas-container-right {
  background: var(--rds-section-bg);
  border-radius: 0px 15px 0px 0px;
  overflow-y: auto;
  max-height: calc(100vh - var(--footer-height) - var(--y-container-spacing));
  &.no-footer {
    border-radius: 0px 15px 15px 0px;
  }
}

.canvas-container-left {
  border-radius: 15px 0px 0px 0px;
  max-height: calc(100vh - var(--footer-height) - var(--y-container-spacing));
  overflow-y: auto;
  &.no-footer {
    border-radius: 15px 0px 0px 15px;
  }
}

/* Container of the lesson box */
.content-container {
  border-radius: 15px;
  height: 100%;
  max-height: calc(100vh - var(--footer-height) - var(--y-container-spacing));
  flex-shrink: 1;
  background: var(--rds-background-gradient);
}

.lesson-layout {
  display: flex;
  flex-shrink: 1;
  justify-content: space-between;
  margin-top: auto;
  max-height: calc(100vh - var(--footer-height));
  overflow: hidden;
}

.canvas-footer {
  border-radius: 0 0 15px 15px;
  background: var(--rds-footer-bg);
  color: var(--rds-text-primary);
  font-size: 0.688rem;
  line-height: 21px;
}
</style>
