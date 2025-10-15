import { ref } from "vue";

const runtimeConfig = useRuntimeConfig();

const CANVAS_URL = import.meta.env.VITE_CANVAS_URL; // Canvas URL
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID; // OAuth Client ID

if (!CANVAS_URL || !CLIENT_ID) {
  throw new Error("Missing required Canvas OAuth environment variables");
}

const buildCanvasOAuthUrl = () => {
  const authUrl = new URL(`${CANVAS_URL}/login/oauth2/auth`);
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append(
    "redirect_uri",
    runtimeConfig.public.oAuthRedirectUrl
  );
  const scopes = [
    // "url:POST|/api/v1/courses/:course_id/assignments/:assignment_id/submissions",
    "url:GET|/api/v1/courses/:course_id/assignments",
    "url:GET|/api/v1/courses/:course_id/assignments/:id",
    "url:GET|/api/v1/users/:id",
  ];
  authUrl.searchParams.append("scope", scopes.join(" "));
  return authUrl.toString();
};

export function useCanvasOAuth() {
  const isOAuthInProgress = ref(false);
  const isAuthorized = ref(false);

  // Starts the OAuth popup flow
  async function startOAuthFlow(): Promise<void> {
    if (isOAuthInProgress.value) {
      throw new Error("OAuth already in progress");
    }
    isOAuthInProgress.value = true;

    const oauthUrl = buildCanvasOAuthUrl();
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      oauthUrl,
      "CanvasOAuth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      isOAuthInProgress.value = false;
      throw new Error("Failed to open OAuth popup");
    }

    return new Promise<void>((resolve, reject) => {
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          isOAuthInProgress.value = false;
          isAuthorized.value = true;
          resolve();
        }
      }, 500);
    });
  }

  return {
    isOAuthInProgress,
    isAuthorized,
    startOAuthFlow,
  };
}
