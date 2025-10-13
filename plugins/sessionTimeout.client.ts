
// Plugin completely commented out to allow access without authentication
// export default defineNuxtPlugin((nuxtApp) => {
//   const appStore = useAppStore();
//   const { lbCanvasJwt, lbJwt } = storeToRefs(appStore);
//   const router = useRouter();
//   const route = useRoute();

//   let sessionCheckInterval: NodeJS.Timeout | null = null;
//   const isActive = ref(true);

//   const excludedRoutes = ["dashboard", "login", "deep-linking"];
//   const routeExcluded = computed(() => {
//     return excludedRoutes.some((el) => route.path.includes(el));
//   });

//   // Check if session has timed out
//   const checkSessionTimeout = () => {
//     if (!isActive.value) return;

//     try {
//       // Check Canvas LTI JWT validity
//       if (
//         !isCanvasJWTValid(lbCanvasJwt.value) &&
//         routeExcluded.value === false
//       ) {
//         clearSessionCheckInterval();
//         router.push("/timeout");
//         return;
//       }

//       // Check app JWT validity, skipping the dashboard
//       if (!isJWTTokenValid(lbJwt.value) && routeExcluded.value === false) {
//         clearSessionCheckInterval();
//         router.push("/login");
//         return;
//       }
//     } catch (error) {
//       console.error("Session timeout check failed:", error);
//     }
//   };

//   // Handle page visibility changes
//   const handleVisibilityChange = () => {
//     if (typeof document === "undefined") return;

//     isActive.value = !document.hidden;

//     // Check immediately when page becomes visible
//     if (isActive.value) {
//       checkSessionTimeout();
//     }
//   };

//   // Start the session check interval
//   const startSessionCheck = () => {
//     if (sessionCheckInterval) {
//       clearSessionCheckInterval();
//     }

//     // Check immediately
//     checkSessionTimeout();

//     // Then check every minute
//     sessionCheckInterval = setInterval(checkSessionTimeout, 60000);

//     // Add page visibility listener
//     if (typeof document !== "undefined") {
//       document.addEventListener("visibilitychange", handleVisibilityChange);
//     }
//   };

//   // Stop the session check interval
//   const clearSessionCheckInterval = () => {
//     if (sessionCheckInterval) {
//       clearInterval(sessionCheckInterval);
//       sessionCheckInterval = null;
//     }

//     // Remove page visibility listener
//     if (typeof document !== "undefined") {
//       document.removeEventListener("visibilitychange", handleVisibilityChange);
//     }
//   };

//   // Use Nuxt lifecycle hook to start session checking when app is mounted
//   nuxtApp.hook("app:mounted", async () => {
//     await nextTick();
//     startSessionCheck();
//   });

//   // Cleanup when plugin is unmounted
//   onUnmounted(() => {
//     clearSessionCheckInterval();
//   });

//   // Return the session timeout functions for use in components
//   return {
//     provide: {
//       sessionTimeout: {
//         startSessionCheck,
//         clearSessionCheckInterval,
//       },
//     },
//   };
// });

// Empty plugin to prevent errors
export default defineNuxtPlugin(() => {
  // Plugin disabled
});
