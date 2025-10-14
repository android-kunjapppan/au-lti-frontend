export default defineNuxtRouteMiddleware((to, from) => {
  const appStore = useAppStore();
  // Prevent going back to lesson-content from lesson-result for showcase assignments
  if (from.name === "lesson-result" && to.name === "lesson-content") {
    if (appStore.isTest) {
      // Show alert and prevent navigation
      appStore.addAlert(
        "Cannot go back to showcase assignment. Your results have been submitted."
      );
      return false;
    }
  }
});
