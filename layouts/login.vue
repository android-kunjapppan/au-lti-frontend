<template>
  <div class="min-vh-100 h-100 position-relative d-flex flex-column">
    <header class="ps-space-sm pe-space-lg py-space-sm w-100">
      <div class="container-fluid p-0">
        <div class="d-flex justify-content-between align-items-center w-100">
          <span class="language-buddy-text fs-large">Language Buddy™</span>
          <Tooltip
            :text="isFullscreen ? 'Exit full screen' : 'Full screen'"
            :position="'left'"
            :x-offset="0"
            :y-offset="8">
            <button
              class="expand-btn d-flex justify-content-center align-items-center position-absolute"
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
      <img class="environment-image" src="/images/mexico.png" alt="" />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from "@vueuse/core";
import FaCompress from "~icons/fa6-solid/compress";
import FaExpand from "~icons/fa6-solid/expand";
import Tooltip from "../components/ToolTip.vue";

const { isFullscreen, toggle } = useFullscreen();

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
  top: 20px;
  right: 20px;
}

.expand-btn:focus,
.expand-btn:active {
  outline: none;
}
</style>
