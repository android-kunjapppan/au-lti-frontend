<template>
  <div
    class="min-vh-100 h-100 position-relative d-flex flex-column mh-100vh"
    :style="layoutStyles">
    <AlertMessage />
    <header class="py-space-md py-lg-space-lg px-space-lg">
      <div class="container-fluid">
        <div class="row">
          <div class="d-flex justify-content-start align-items-start">
            <Tooltip
              :text="isFullscreen ? 'Exit full screen' : 'Full screen'"
              position="left"
              :x-offset="-13">
              <button class="expand-btn" @click="onMakeFullScreen">
                <component
                  :is="isFullscreen ? FaCompress : FaExpand"
                  class="expand-icon fs-xl" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
    <div class="slot-container">
      <img class="environment-image" src="/images/environment.png" alt="" />
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
import { useElementSize, useFullscreen } from "@vueuse/core";
import FaCompress from "~icons/fa6-solid/compress";
import FaExpand from "~icons/fa6-solid/expand";
import AlertMessage from "../components/AlertMessage.vue";
import FooterBar from "../components/FooterBar.vue";
import Tooltip from "../components/ToolTip.vue";

const appStore = useAppStore();
const { footerHeading: heading, footerSubheading: subheading } =
  storeToRefs(appStore);
const { isFullscreen, toggle } = useFullscreen();
const footer = useTemplateRef("footer");
const route = useRoute();

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
  right: 0;
  z-index: 100;
  width: fit-content;
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

.expand-btn:focus,
.expand-btn:active {
  outline: none;
}
</style>
