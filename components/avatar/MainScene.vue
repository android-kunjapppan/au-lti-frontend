<template>
  <TresCanvas preset="realistic" window-size>
    <TresPerspectiveCamera :position="cameraPos" ref="camera" />
    <OrbitControls v-if="state.enableOrbit" />
    <Suspense>
      <EnvironmentMapModel />
    </Suspense>
    <Suspense>
      <AvatarModel ref="avatarRef" />
    </Suspense>
    <EffectComposerPmndrs>
      <DepthOfFieldPmndrs
        :bokeh-scale="effectsState.bokehScale"
        :focus-range="effectsState.focusRange"
        :focus-distance="effectsState.focusDistance" />
    </EffectComposerPmndrs>
    <TresDirectionalLight
      :position="backLightPos"
      :intensity="state.backLightIntensity"
      :color="state.backLightColor"
      :look-at="avatarRef?.position ? avatarRef?.position : [0, 0, 0]" />
    <TresDirectionalLight
      :position="keyLightPos"
      :intensity="state.keyLightIntensity"
      :color="state.keyLightColor"
      :look-at="avatarRef?.position ? avatarRef?.position : [0, 0, 0]" />
    <TresDirectionalLight
      :position="fillLightPos"
      :intensity="state.fillLightIntensity"
      :color="state.fillLightColor"
      :look-at="avatarRef?.position ? avatarRef?.position : [0, 0, 0]" />
    <TresAmbientLight
      :intensity="state.ambientIntensity"
      :color="state.ambientColor" />
  </TresCanvas>
</template>

<script setup lang="ts">
import { TresCanvas, type TresCamera, type TresObject3D } from "@tresjs/core";
import { Euler } from "three";
import type { FolderApi } from "tweakpane";
import AvatarModel from "./AvatarModel.vue";
import EnvironmentMapModel from "./EnvironmentMapModel.vue";

interface Props {
  btnVariant?: "secondary" | "primary" | "success";
}

const props = withDefaults(defineProps<Props>(), {
  btnVariant: "secondary",
});

const { $pane } = useNuxtApp();

const camera = shallowRef<TresCamera>();
const avatarRef = shallowRef<TresObject3D>();

const state = reactive({
  cameraPos: { x: 0, y: 0, z: 4 },
  cameraRot: { x: 0, y: 0, z: 0 },
  backLightPos: { x: -20, y: 4, z: -20 },
  backLightColor: "#e28a08",
  backLightIntensity: 1.5,
  keyLightPos: { x: -20, y: 4, z: -20 },
  keyLightColor: "#516958",
  keyLightIntensity: 1,
  fillLightPos: { x: 20, y: 4, z: 20 },
  fillLightColor: "#ac6b30",
  fillLightIntensity: 2,
  ambientIntensity: 0.55,
  ambientColor: "#c7cadf",
  enableOrbit: false,
});

const effectsState = reactive({
  bokehScale: 1.5,
  focusRange: 0.015,
  focusDistance: 0,
  radius: 1,
  intensity: 3.5,
  luminanceThreshold: 0.1,
  luminanceSmoothing: 0.3,
});
const cameraPos = objToVec3(state.cameraPos);
const backLightPos = objToVec3(state.backLightPos);
const keyLightPos = objToVec3(state.keyLightPos);
const fillLightPos = objToVec3(state.fillLightPos);
const paneFolder = shallowRef<FolderApi>();
const effectsPaneFolder = shallowRef<FolderApi>();
const rotEuler = new Euler(
  state.cameraRot.x,
  state.cameraRot.y,
  state.cameraRot.z,
  "XYZ"
);

watch(state.cameraRot, (newValue) => {
  rotEuler.set(state.cameraRot.x, state.cameraRot.y, state.cameraRot.z);
  camera.value?.setRotationFromEuler(rotEuler);
});

watch(
  () => state.enableOrbit,
  (newValue) => {
    if (newValue == false && camera.value) {
      rotEuler.set(state.cameraRot.x, state.cameraRot.y, state.cameraRot.z);
      camera.value?.setRotationFromEuler(rotEuler);
      camera.value?.position.set(...cameraPos.value);
    }
  }
);

const setupCameraPane = () => {
  paneFolder.value = $pane.addFolder({ title: "camera", expanded: true });
  paneFolder.value.addBinding(state, "cameraPos");
  paneFolder.value.addBinding(state, "cameraRot");
  paneFolder.value.addBinding(state, "enableOrbit");
  paneFolder.value.addBinding(state, "backLightPos");
  paneFolder.value.addBinding(state, "backLightColor");
  paneFolder.value.addBinding(state, "backLightIntensity", { min: 0, max: 3 });
  paneFolder.value.addBinding(state, "keyLightPos");
  paneFolder.value.addBinding(state, "keyLightColor");
  paneFolder.value.addBinding(state, "keyLightIntensity", { min: 0, max: 3 });
  paneFolder.value.addBinding(state, "fillLightPos");
  paneFolder.value.addBinding(state, "fillLightColor");
  paneFolder.value.addBinding(state, "fillLightIntensity", { min: 0, max: 3 });
  paneFolder.value.addBinding(state, "ambientIntensity", { min: 0, max: 3 });
  paneFolder.value.addBinding(state, "ambientColor");
};

const setupEffectsPane = () => {
  effectsPaneFolder.value = $pane.addFolder({
    title: "camera effects",
    expanded: false,
  });
  effectsPaneFolder.value.addBinding(effectsState, "bokehScale", {
    min: 0,
    max: 3,
  });
  effectsPaneFolder.value.addBinding(effectsState, "focusRange", {
    min: 0,
    max: 1,
  });
  effectsPaneFolder.value.addBinding(effectsState, "focusDistance", {
    min: 0,
    max: 1,
  });
  effectsPaneFolder.value.addBinding(effectsState, "radius", {
    label: "bloom-radius",
    min: 0,
    max: 3,
  });
  effectsPaneFolder.value.addBinding(effectsState, "intensity", {
    label: "bloom-intensity",
    min: 0,
    max: 5,
  });
  effectsPaneFolder.value.addBinding(effectsState, "luminanceThreshold", {
    label: "bloom-threshold",
    min: 0,
    max: 1,
  });
  effectsPaneFolder.value.addBinding(effectsState, "luminanceSmoothing", {
    label: "bloom-luminance-Smoothing",
    min: 0,
    max: 1,
  });
};

if (import.meta.client) {
  setupCameraPane();
  setupEffectsPane();
}

onUnmounted(() => {
  paneFolder.value?.dispose();
  effectsPaneFolder.value?.dispose();
});
</script>

<style scoped lang="scss"></style>
