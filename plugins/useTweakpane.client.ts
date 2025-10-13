import { Pane } from "tweakpane";
const pane = new Pane();

/** @description Provides a sharable instance of a tweakpane pane/ control panel. */
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  if (runtimeConfig.public.stage !== "dev") {
    pane.hidden = true;
  }
  return {
    provide: {
      pane: pane,
    },
  };
});
