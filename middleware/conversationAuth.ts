import { isCanvasJWTValid, isJWTTokenValid } from "~/utils/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  const appStore = useAppStore();
  const appStoreRef = storeToRefs(appStore);
  const runtimeConfig = useRuntimeConfig();

  // Store the LTI (Canvas) token if present in URL
  if (to.query["ltik"] && typeof to.query["ltik"] === "string") {
    appStoreRef.lbCanvasJwt.value = to.query["ltik"];
  }

  // Validate the Canvas LTI JWT (for LTI auth)
  if (!isCanvasJWTValid(appStoreRef.lbCanvasJwt.value)) {
    return navigateTo("/timeout");
  }

  // Validate app's JWT (for CreateAI auth)
  if (!isJWTTokenValid(appStoreRef.lbJwt.value)) {
    // Don't automatically open ASU login when coming from Canvas
    // Let the user manually click sign in on the login page
    return navigateTo("/login");
  }
});
