<template>
  <div class="min-vh-100 h-100 position-relative d-flex flex-column">
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
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from "@vueuse/core";
import FaCompress from "~icons/fa6-solid/compress";
import FaExpand from "~icons/fa6-solid/expand";
import Tooltip from "../components/ToolTip.vue";

const { isFullscreen, toggle } = useFullscreen();

const onMakeFullScreen = () => {
  toggle();
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
