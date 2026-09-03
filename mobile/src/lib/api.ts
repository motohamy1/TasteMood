/**
 * TasteMood API client.
 *
 * Base URL is read from `EXPO_PUBLIC_API_URL` at build time (inlined by Metro).
 * If unset, we fall back to http://localhost:5000/api/v1 so dev still works.
 *
 * The auth layer is pluggable: call `setAuthToken(null | "mock-..." | "<jwt>")`
 * to inject a Bearer token into every request. The API client doesn't import
 * the auth store directly to keep this module side-effect-free and easy to test.
 */

import type {
  Dish,
  DishSummary,
  UserProfile,
} from "@/types/dish";
import type {
  RecommendationRequest,
  RecommendationResponse,
} from "@/types/recommendation";
import type { InteractionType } from "@/types/interaction";

const DEFAULT_BASE_URL = "http://localhost:5000/api/v1";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL;

if (!process.env.EXPO_PUBLIC_API_URL && __DEV__) {
  console.warn(
    `[api] EXPO_PUBLIC_API_URL is not set, falling back to ${DEFAULT_BASE_URL}`
  );
}

// ----- Token plumbing -----------------------------------------------------

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

// ----- Errors -------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends ApiError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHENTICATED");
    this.name = "AuthError";
  }
}

// ----- Core request -------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** When true, throw AuthError instead of generic ApiError on 401. */
  requireAuth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, query, headers, requireAuth, ...rest } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (_authToken) {
    requestHeaders.Authorization = `Bearer ${_authToken}`;
  }

  const response = await fetch(url.toString(), {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    let code: string | undefined;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) message = errorBody.message;
      if (errorBody?.error?.message) message = errorBody.error.message;
      if (errorBody?.code) code = errorBody.code;
    } catch {
      // body wasn't JSON; keep default message
    }
    if (response.status === 401 && requireAuth) {
      throw new AuthError(message);
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;

  // Backend wraps responses as { success, data, meta? } for many endpoints.
  // We unwrap `data` to make the client ergonomic.
  const json = (await response.json()) as unknown;
  if (
    json !== null &&
    typeof json === "object" &&
    "data" in (json as Record<string, unknown>) &&
    (json as { success?: boolean }).success !== false
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

// ----- Endpoints ----------------------------------------------------------

/**
 * List endpoints. NOTE: `request()` already unwraps the backend
 * `{ success, data, meta }` envelope, so these resolve to plain arrays
 * (CR-01). The `meta` pagination block is currently discarded (IN-01).
 */
export function getDishes(params: {
  page?: number;
  limit?: number;
  search?: string;
  cuisine?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
} = {}) {
  return request<DishSummary[]>("/dishes", { query: params });
}

export function getDish(id: string) {
  return request<Dish>(`/dishes/${encodeURIComponent(id)}`);
}

export function searchDishes(query: string, limit = 20) {
  return request<DishSummary[]>("/search/dishes", {
    query: { q: query, limit },
  });
}

export function getRecommendations(payload: RecommendationRequest) {
  return request<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: payload,
  });
}

export function recordInteraction(input: {
  dishId?: string;
  restaurantId?: string;
  branchId?: string;
  interactionType: InteractionType;
  metadata?: Record<string, unknown>;
}) {
  return request<{ success: true }>("/interactions", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export function getMyInteractions(params: {
  page?: number;
  limit?: number;
  interactionType?: InteractionType;
} = {}) {
  return request<
    {
      id: string;
      dishId?: string;
      restaurantId?: string;
      branchId?: string;
      interactionType: InteractionType;
      createdAt: string;
    }[]
  >("/interactions/me", { query: params, requireAuth: true });
}

// ----- User / Auth --------------------------------------------------------

export function getMe() {
  return request<UserProfile>("/users/me", { requireAuth: true });
}

export function updateMe(input: { displayName?: string; avatarUrl?: string }) {
  return request<UserProfile>("/users/me", {
    method: "PUT",
    body: input,
    requireAuth: true,
  });
}

export function getMyPreferences() {
  return request<UserPreferences>("/me/preferences", { requireAuth: true });
}

export function updateMyPreferences(input: Partial<UserPreferences>) {
  return request<UserPreferences>("/me/preferences", {
    method: "PUT",
    body: input,
    requireAuth: true,
  });
}

// Type import left here to avoid circular import in api.ts
import type { UserPreferences } from "@/types/user";
