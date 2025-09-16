<template>
  <div class="min-vh-100 h-100 position-relative d-flex flex-column">
    <header
      class="py-space-md py-lg-space-lg px-space-lg w-100 d-flex justify-content-end align-items-center z-1">
      <div class="container-fluid">
        <div class="row">
          <div class="col-6 d-flex align-items-center"></div>
          <div
            class="col-6 px-0 d-flex justify-content-end align-items-start z-3"></div>
        </div>
      </div>
    </header>
    <slot />
    <div class="flex-grow-1"></div>
    <div class="d-flex align-items-end">
      <footer class="position-relative w-100">
        <div class="container">
          <div class="row">
            <div
              class="col-12 d-flex justify-content-center align-items-center py-space-xxs"></div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isErrorPage?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  isErrorPage: false,
});
</script>

<style lang="scss"></style>
