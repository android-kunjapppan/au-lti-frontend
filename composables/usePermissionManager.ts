import { usePermission, useStorage } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { isSafari } from "~/utils/browserDetection";

/**
 * Centralized permission management for microphone access
 * Handles Safari-specific permission issues and prevents duplicate requests
 * Uses VueUse composables for better Vue/Nuxt integration
 */
export const usePermissionManager = () => {
  // Use VueUse's permission composable
  const permission = usePermission("microphone");

  // Use VueUse's storage composable for caching
  const cachedPermissionState = useStorage(
    "microphone_permission_state",
    null as string | null
  );
  const lastPermissionRequest = useStorage(
    "microphone_permission_timestamp",
    0
  );

  // Use our custom browser detection
  const isSafariBrowser = computed(() => isSafari());

  const isRequestingPermission = ref(false);

  // Safari-specific: minimum time between permission requests (5 seconds)
  const SAFARI_PERMISSION_COOLDOWN = 5000;

  // Cache duration: 30 minutes for Safari, 1 hour for other browsers
  const CACHE_DURATION = isSafariBrowser.value
    ? 30 * 60 * 1000
    : 60 * 60 * 1000;

  // Computed property for current permission state
  const permissionState = computed(() => {
    // First check if we have a valid cached state
    if (cachedPermissionState.value) {
      const now = Date.now();
      const age = now - lastPermissionRequest.value;

      // Check if cache is still valid
      if (age < CACHE_DURATION) {
        return cachedPermissionState.value as "granted" | "denied" | "prompt";
      }
    }

    // Fall back to the actual permission state
    return permission.value;
  });

  // Watch for permission changes and update cache
  watch(permission, (newPermission) => {
    if (
      newPermission &&
      (newPermission === "granted" ||
        newPermission === "denied" ||
        newPermission === "prompt")
    ) {
      cachedPermissionState.value = newPermission;
      lastPermissionRequest.value = Date.now();
    }
  });

  /**
   * Check current microphone permission status
   */
  const checkPermissionStatus = async (): Promise<
    "granted" | "denied" | "prompt"
  > => {
    // VueUse's usePermission handles the permission checking automatically
    // We just need to return the current state
    return permissionState.value as "granted" | "denied" | "prompt";
  };

  /**
   * Request microphone permission with Safari-specific handling
   */
  const requestPermission = async (): Promise<boolean> => {
    // Prevent multiple simultaneous requests
    if (isRequestingPermission.value) {
      return permissionState.value === "granted";
    }

    // Safari-specific: Check cooldown period
    if (isSafariBrowser.value) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastPermissionRequest.value;

      if (timeSinceLastRequest < SAFARI_PERMISSION_COOLDOWN) {
        return permissionState.value === "granted";
      }
    }

    // Check if we already have permission
    if (permissionState.value === "granted") {
      return true;
    }

    try {
      isRequestingPermission.value = true;
      lastPermissionRequest.value = Date.now();

      // Request permission by attempting to get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Permission granted - VueUse will automatically update the permission state
      // and our watcher will update the cache
      cachedPermissionState.value = "granted";
      lastPermissionRequest.value = Date.now();

      // Immediately stop the stream to avoid keeping it active
      stream.getTracks().forEach((track) => track.stop());

      return true;
    } catch (error) {
      console.warn("Microphone permission denied or failed:", error);
      // Permission denied - update cache
      cachedPermissionState.value = "denied";
      lastPermissionRequest.value = Date.now();
      return false;
    } finally {
      isRequestingPermission.value = false;
    }
  };

  /**
   * Check if permission is already granted
   */
  const hasPermission = computed(() => permissionState.value === "granted");

  /**
   * Check if we can request permission (not in cooldown, not already requesting)
   */
  const canRequestPermission = computed(() => {
    if (isRequestingPermission.value) return false;

    if (isSafariBrowser.value) {
      const now = Date.now();
      return now - lastPermissionRequest.value >= SAFARI_PERMISSION_COOLDOWN;
    }

    return true;
  });

  /**
   * Reset permission state (useful for testing or when user manually changes permissions)
   */
  const resetPermissionState = () => {
    isRequestingPermission.value = false;
    lastPermissionRequest.value = 0;
    cachedPermissionState.value = null;
  };

  /**
   * Initialize permission state on composable creation
   */
  const initializePermissionState = async () => {
    await checkPermissionStatus();
  };

  return {
    permissionState,
    isRequestingPermission: computed(() => isRequestingPermission.value),
    hasPermission,
    canRequestPermission,
    isSafariBrowser,
    checkPermissionStatus,
    requestPermission,
    resetPermissionState,
    initializePermissionState,
  };
};
