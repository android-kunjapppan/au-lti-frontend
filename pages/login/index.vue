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

const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const appStoreRef = storeToRefs(appStore);

// State management for different sign-in scenarios
const currentState = ref<"loading" | "popup-prompt" | "error">("popup-prompt");

// Computed configuration for SignInCard based on current state
const cardConfig = computed(() => {
  switch (currentState.value) {
    case "popup-prompt":
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

      // Store JWT in app store (watcher will handle state change)
      appStoreRef.lbJwt.value = e.newValue;

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
  currentState.value = "popup-prompt";
};

// Watch for JWT token changes to determine state
watch(
  appStoreRef.lbJwt,
  async (newValue) => {
    if (isJWTTokenValid(newValue)) {
      // Redirect to success page instead of showing success state here
      await router.push("/login/success");
    }
  },
  { immediate: false } // Don't run immediately on page load
);

// Check for popup blocker on mount
onMounted(() => {
  // Start with the sign-in card by default
  currentState.value = "popup-prompt";

  // Check if user is coming from Canvas (has ltik token)
  const hasLtik = !!route.query.ltik;

  if (hasLtik) {
    // User is coming from Canvas, show appropriate message
    currentState.value = "popup-prompt";
  }
});

// Handle error states from the app store
watch(
  appStoreRef.alertQueue,
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
