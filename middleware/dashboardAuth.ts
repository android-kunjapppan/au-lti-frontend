import { defineNuxtRouteMiddleware } from "#app";
import { isCanvasJWTValid } from "~/utils/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  console.log("Dashboard AUTH running");
  const appStore = useAppStore();
  const appStoreRef = storeToRefs(appStore);

  // Save the LTI token if present in URL query param
  if (to.query["ltik"] && typeof to.query["ltik"] === "string") {
    appStoreRef.lbCanvasJwt.value = to.query["ltik"];
    delete to.query["ltik"];
    return navigateTo(to);
  }

  // Validate the Canvas LTI JWT
  if (!isCanvasJWTValid(appStoreRef.lbCanvasJwt.value)) {
    return navigateTo("/timeout");
  }
});
