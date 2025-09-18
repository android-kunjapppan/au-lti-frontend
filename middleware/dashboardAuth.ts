import { defineNuxtRouteMiddleware } from "#app";
import { isCanvasJWTValid } from "~/utils/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  console.log("Dashboard AUTH running");
  const appStore = useAppStore();
  const appStoreRef = storeToRefs(appStore);

  // Save the LTI token if present in URL query param
  if (to.query["ltik"] && typeof to.query["ltik"] === "string") {
    appStoreRef.lbCanvasJwt.value = to.query["ltik"];
  }

  // Validate the Canvas LTI JWT
  if (!isCanvasJWTValid(appStoreRef.lbCanvasJwt.value)) {
    // Instead of redirecting to an error page, just throwing an error for now
    throw new Error(
      "Invalid or expired LTI token. Please re-launch the LTI tool from Canvas."
    );
  }
});
