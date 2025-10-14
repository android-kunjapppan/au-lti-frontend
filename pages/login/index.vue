<template>
  <NuxtLayout name="login">
    <LoadingSpinner v-if="isLoadingUserInfo" />
    <div class="sign-in-container" v-else>
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

const { startOAuthFlow } = useCanvasOAuth();
const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const appStore = useAppStore();
const { lbJwt, userInfo, alertQueue, isLoadingUserInfo } =
  storeToRefs(appStore);

// State management for different sign-in scenarios
const currentState = ref<"loading" | "login-prompt" | "oauth-prompt" | "error">(
  "login-prompt"
);

// Computed configuration for SignInCard based on current state
const cardConfig = computed(() => {
  switch (currentState.value) {
    case "login-prompt":
      return {
        heading: "Let's get you signed in",
        subheading:
          "Make sure you have pop-ups allowed for this site, so everything works properly.",
        showProceedButton: true,
        showTryAgainButton: false,
        isSuccessState: false,
        proceedButtonText: "Sign in",
        onProceed: handleLoginClick,
        onTryAgain: undefined,
      };
    case "oauth-prompt":
      return {
        heading: "One last step",
        subheading:
          "Make sure you have pop-ups allowed for this site, so everything works properly.",
        showProceedButton: true,
        showTryAgainButton: false,
        isSuccessState: false,
        proceedButtonText: "Grant Canvas Access",
        onProceed: handleOAuthClick,
        onTryAgain: undefined,
      };
    case "error":
      return {
        heading: "Sign in error",
        subheading:
          "We ran into an issue. Allow pop-ups for this site in your browser settings and try again.",
        showProceedButton: false,
        showTryAgainButton: true,
        isSuccessState: false,
        proceedButtonText: undefined,
        onProceed: undefined,
        onTryAgain: handleTryAgain,
      };
    default: // loading
      return {
        heading: "Attempting to sign in...",
        subheading:
          "Make sure you have pop-ups allowed for this site, so everything works properly.",
        showProceedButton: true,
        showTryAgainButton: false,
        isSuccessState: false,
        proceedButtonText: "Sign in",
        onProceed: handleLoginClick,
        onTryAgain: undefined,
      };
  }
});

const handleLoginClick = () => {
  // Open ASU login in a popup window
  const popup = window.open(
    runtimeConfig.public.signInUrl,
    "asu-login",
    "width=500,height=600,scrollbars=yes,resizable=yes,centerscreen=yes"
  );

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    alert(
      "Please allow pop-ups for this site to continue with the login process."
    );
    return;
  }

  // Start polling to check if login was successful
  startPollingForLogin(popup);
};

const handleOAuthClick = async () => {
  try {
    await startOAuthFlow(); // Show OAuth popup
    await appStore.fetchUserInfo(); // Try again

    if (!userInfo.value) {
      appStore.addAlert("User info not found after OAuth");
      throw new Error("User info not found after OAuth");
    }
  } catch (oauthError) {
    console.warn("OAuth popup cancelled or failed:", oauthError);
    return; // Exit gracefully – don't proceed
  }
};

// Polling mechanism to detect successful login
const pollingInterval = ref<NodeJS.Timeout | null>(null);

const startPollingForLogin = (popup: Window) => {
  // Clear any existing polling
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
  }

  // Poll every 2 seconds for up to 5 minutes
  let attempts = 0;
  const maxAttempts = 150; // 5 minutes

  pollingInterval.value = setInterval(() => {
    attempts++;

    // Check if popup is closed (user completed login)
    if (popup.closed) {
      clearInterval(pollingInterval.value!);
      pollingInterval.value = null;
      return;
    }

    // Try to access popup location (may fail due to cross-origin)
    try {
      if (popup.location.href.includes("/login")) {
        // Popup has navigated to login page, try to close it
        popup.close();
      }
    } catch (error) {
      // Cross-origin error, can't access popup location
      // This is expected when popup is on ASU domain
    }

    // Stop polling after max attempts
    if (attempts >= maxAttempts) {
      clearInterval(pollingInterval.value!);
      pollingInterval.value = null;
    }
  }, 2000);

  // Also listen for storage events (when JWT is stored by popup)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "lb-jwt" && e.newValue) {
      // JWT was stored, close popup
      if (!popup.closed) {
        popup.close();
      }

      // ✅ lbJwt.value is already updated automatically!
      // No manual assignment needed

      // Clear polling
      clearInterval(pollingInterval.value!);
      pollingInterval.value = null;

      // Remove storage event listener
      window.removeEventListener("storage", handleStorageChange);
    }
  };

  window.addEventListener("storage", handleStorageChange);
};

const handleTryAgain = () => {
  // Simply show the sign-in card when "Try again" is clicked
  // Let the user decide if popups are working by clicking "Sign in"
  if (!userInfo.value) currentState.value = "oauth-prompt";
  else currentState.value = "login-prompt";
};

// Watch for JWT token changes to determine state
watch(
  lbJwt,
  async (newValue) => {
    if (isJWTTokenValid(newValue)) {
      await appStore.fetchUserInfoWithOAuth();
      if (userInfo.value) await navigateTo("/login/success");
      else currentState.value = "oauth-prompt";
    }
  },
  { immediate: false } // Don't run immediately on page load
);

// watch for userInfo change indicating that the user has granted OAuth access
watch(
  userInfo,
  async (newValue) => {
    if (newValue && isJWTTokenValid(lbJwt.value)) {
      await navigateTo("/login/success");
    }
  },
  { immediate: false, deep: false }
);

// Handle error states from the app store
watch(
  alertQueue,
  (alerts) => {
    if (alerts.length > 0) {
      const lastAlert = alerts[alerts.length - 1];
      if (lastAlert.type === "error" && lastAlert.text.includes("login")) {
        currentState.value = "error";
      }
    }
  },
  { deep: true }
);

// Check for popup blocker on mount
onMounted(async () => {
  // Start with the sign-in card by default
  currentState.value = "login-prompt";

  // Check if user is coming from Canvas (has ltik token)
  const hasLtik = !!route.query.ltik;

  if (hasLtik) {
    // User is coming from Canvas, show appropriate message
    currentState.value = "login-prompt";
  }
});

// Clean up polling on component unmount
onUnmounted(() => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
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
