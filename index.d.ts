import type { Pane } from "tweakpane";

declare module "#app" {
  interface NuxtApp {
    $pane: Pane;
  }
}
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
