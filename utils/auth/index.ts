import type { ETSessionToken } from "~/types/types";

/**
 * @returns JSON of the JWT payload
 */
export const getJWTPayload = <T extends object>(jwt: string) => {
  return JSON.parse(atob(jwt.split(".")[1])) as T;
};

/**
 * @description pulls out the expiration time from the auth token/ticket, subtracts a buffer from it returns `true` if the ticket hasn't expired and `false` if it has.
 */
export function isJWTTokenValid(jwt: string | undefined | null) {
  // buffer to make sure ticket doesn't expire mid-stream, set to 5 mins currently
  const expirationBufferMS = 300_000;
  if (!jwt) return false;

  const tokenPayload = getJWTPayload<ETSessionToken>(jwt);
  const expiryTimeMs = tokenPayload.exp * 1000;

  return Date.now() < expiryTimeMs - expirationBufferMS;
}

/**
 * @description extracts the user_id (asurite) from the JWT token
 */
export function getUserIdFromJWT(
  jwt: string | undefined | null
): string | null {
  if (!jwt) return null;

  try {
    const tokenPayload = getJWTPayload<ETSessionToken>(jwt);
    return tokenPayload.asurite;
  } catch (error) {
    console.error("Error extracting user_id from JWT:", error);
    return null;
  }
}

/**
 * @description extracts the name from the ASURITE login JWT token
 */
export function getNameFromASURITEJWT(
  jwt: string | undefined | null
): string | null {
  if (!jwt) return null;

  try {
    const tokenPayload = getJWTPayload<ETSessionToken>(jwt);
    // The name might be in a different field, adjust based on your JWT structure
    if (tokenPayload.name) {
      return tokenPayload.name;
    }

    // If no name in JWT, try to construct from asurite
    if (tokenPayload.asurite) {
      // Convert asurite to a display name (e.g., "rbarai" -> "Rbarai")
      const asurite = tokenPayload.asurite;
      return asurite.charAt(0).toUpperCase() + asurite.slice(1);
    }

    return null;
  } catch (error) {
    console.error("Error extracting name from ASURITE JWT:", error);
    return null;
  }
}

/**
 *  @description checks that JWT exists, then checks that there is a "iat" claim in the JWT and checks if it was issued more than an hour ago
 */
export function isCanvasJWTValid(jwt: string | undefined | null) {
  if (!jwt) return false;

  const tokenPayload = getJWTPayload<{ iat?: number }>(jwt);
  if (typeof tokenPayload.iat !== "number") {
    return false; // no iat claim -> invalid
  }

  const issuedAtMs = tokenPayload.iat * 1000;
  const maxAgeMs = 60 * 60 * 1000; // NOTE: For now, assuming we have LTI token expiration set to 1 hour

  return Date.now() < issuedAtMs + maxAgeMs;
}

interface CanvasOAuthErrorResponse {
  response: {
    status: number;
    data: {
      code: string;
    };
  };
}

export function isCanvasOAuthError(
  error: unknown
): error is CanvasOAuthErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    error.response !== null &&
    typeof (error as CanvasOAuthErrorResponse).response.status === "number" &&
    typeof (error as CanvasOAuthErrorResponse).response.data?.code === "string"
  );
}
