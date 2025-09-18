<template>
  <NuxtLayout name="login">
    <div class="sign-in-container">
      <SignInCard
        :heading="cardConfig.heading"
        :subheading="cardConfig.subheading"
        :show-proceed-button="cardConfig.showProceedButton"
        :show-try-again-button="cardConfig.showTryAgainButton"
        :is-success-state="cardConfig.isSuccessState"
        :proceed-button-text="cardConfig.proceedButtonText"
        @proceed="cardConfig.onProceed"
        @try-again="cardConfig.onTryAgain" />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { isJWTTokenValid } from "~/utils/auth";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const appStore = useAppStore();
const appStoreRef = storeToRefs(appStore);
const { lbJwt } = storeToRefs(appStore);

const tokenIsValid = computed(() => {
  return isJWTTokenValid(lbJwt.value);
});

const handleLoginClick = () => {
  // Navigate back to the main login page to use the modal
  navigateTo("/login");
};

const handleGoToLesson = async () => {
  // Navigate to the home page
  await navigateTo("/");
};

// Computed configuration for SignInCard based on token validity
const cardConfig = computed(() => {
  if (tokenIsValid.value) {
    return {
      heading: "Sign in successful",
      subheading: "You're all set! Please proceed to your lesson.",
      showProceedButton: true,
      showTryAgainButton: false,
      isSuccessState: true,
      proceedButtonText: "Go to lesson",
      onProceed: handleGoToLesson,
      onTryAgain: undefined,
    };
  } else {
    return {
      heading: "Sign in error",
      subheading:
        "We ran into an issue. Allow pop-ups for this site in your browser settings and try again.",
      showProceedButton: false,
      showTryAgainButton: true,
      isSuccessState: false,
      proceedButtonText: undefined,
      onProceed: undefined,
      onTryAgain: handleLoginClick,
    };
  }
});

onMounted(async () => {
  if (
    route.query["projectWebToken"] &&
    typeof route.query["projectWebToken"] === "string" &&
    window
  ) {
    const asuriteJWT = route.query["projectWebToken"];

    // Store ASURITE JWT in Pinia store
    appStoreRef.lbJwt.value = asuriteJWT;

    try {
      // Validate JWT token and fetch user info directly
      if (!isJWTTokenValid(asuriteJWT)) {
        appStore.addAlert("Invalid or expired JWT token");
        throw new Error("Invalid or expired JWT token");
      }

      // Fetch user info to ensure the user is properly authenticated
      await appStore.fetchUserInfo();

      // Close the popup window after successful authentication
      window.close();
    } catch (error) {
      console.error("Failed to authenticate user:", error);
      appStore.addAlert("Authentication failed. Please try again.");
      // Don't close the window if authentication failed
      return;
    }
  }
});
</script>

<style scoped>
.sign-in-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
</style>
