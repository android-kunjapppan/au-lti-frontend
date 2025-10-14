<template>
  <div
    class="min-vh-100 h-100 position-relative d-flex flex-column mh-100vh"
    :style="layoutStyles">
    <AlertMessage />
    <header class="ps-space-sm pe-space-lg py-space-sm w-100">
      <div class="container-fluid p-0">
        <div class="d-flex justify-content-between align-items-center w-100">
          <span class="language-buddy-text fs-large">Language Buddy™</span>
          <Tooltip
            :text="isFullscreen ? 'Exit full screen' : 'Full screen'"
            :position="'left'"
            :x-offset="0"
            :y-offset="
              isLessonContent ? (isChatbotDrawerOpen ? yOffset : 8) : 8
            ">
            <button
              class="expand-btn"
              :class="{ 'shift-left': isChatbotDrawerOpen && isLessonContent }"
              @click="onMakeFullScreen">
              <component
                :is="isFullscreen ? FaCompress : FaExpand"
                class="expand-icon fs-xl" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
    <div class="slot-container">
      <img class="environment-image" :src="`/images/mexico.png`" alt="" />
      <slot />
    </div>
    <FooterBar
      v-if="showFooter"
      :heading="heading"
      :subheading="subheading"
      ref="footer" />
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useFullscreen, useWindowSize } from "@vueuse/core";
import FaCompress from "~icons/fa6-solid/compress";
import FaExpand from "~icons/fa6-solid/expand";
import AlertMessage from "../components/AlertMessage.vue";
import FooterBar from "../components/FooterBar.vue";
import Tooltip from "../components/ToolTip.vue";

const appStore = useAppStore();
const {
  footerHeading: heading,
  footerSubheading: subheading,
  isChatbotDrawerOpen,
} = storeToRefs(appStore);
const { isFullscreen, toggle } = useFullscreen();
const footer = useTemplateRef("footer");
const route = useRoute();

const { width } = useWindowSize();

const yOffset = computed(() => width.value / 2 + 8);

// Check if current page is lesson-overview
const isLessonContent = computed(() => route.name === "lesson-content");

// Only observe footer size when footer element exists and we're not on timeout route
const isTimeoutRoute = computed(() => route.name === "timeout");
const showFooter = computed(
  () => !isTimeoutRoute.value && heading.value && subheading.value
);
const footerElement = computed(() => (showFooter.value ? footer.value : null));
const { height: footerHeight } = useElementSize(
  footerElement,
  { width: 20, height: 20 },
  { box: "border-box" }
);

const layoutStyles = computed(() => {
  // Used to subtract height of footer from other values
  // Set footer height to 0 when footer is hidden (timeout route or no data)
  return `--footer-height: ${showFooter.value ? footerHeight.value || 0 : 0}px;`;
});

const onMakeFullScreen = async () => {
  await toggle();
};
</script>

<style lang="scss">
header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.language-buddy-text {
  text-shadow: var(--trade-mark-logo-shadow);
  color: var(--rds-light-1);
  font-weight: 700;
  line-height: 16px;
}

.expand-icon {
  color: white;
}

.expand-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 20px;
  right: 20px;
}

.expand-btn.shift-left {
  right: calc(50% + 20px);
}

.expand-btn:focus,
.expand-btn:active {
  outline: none;
}
</style>
