import { isCanvasJWTValid, isJWTTokenValid } from "~/utils/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  const appStore = useAppStore();
  const { lbCanvasJwt, lbJwt } = storeToRefs(appStore);

  // Store the LTI (Canvas) token if present in URL
  if (to.query["ltik"] && typeof to.query["ltik"] === "string") {
    lbCanvasJwt.value = to.query["ltik"];
  }

  // Validate the Canvas LTI JWT (for LTI auth)
  if (!isCanvasJWTValid(lbCanvasJwt.value)) {
    return navigateTo("/timeout");
  }

  // Validate app's JWT (for CreateAI auth)
  if (!isJWTTokenValid(lbJwt.value)) {
    // Don't automatically open ASU login when coming from Canvas
    // Let the user manually click sign in on the login page
    return navigateTo("/login");
  }
});
