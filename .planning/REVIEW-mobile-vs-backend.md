---
status: findings
depth: deep
files_reviewed: 22
date: 2026-09-02
scope: mobile/ reviewed against backend/ API contract
findings_summary:
  critical: 5
  warning: 6
  info: 5
  total: 16
---

# Code Review: mobile vs backend

Deep review of the Expo app (`mobile/`, 22 files) against the Express + Prisma API (`backend/src`). Primary axis: contract alignment. Backend files are reference-only; findings are actionable in mobile unless noted as a backend gap.

## Contract Alignment Matrix

| Mobile call (api.ts) | Backend route | Method/path | Auth | Request shape | Response shape |
|---|---|---|---|---|---|
| `getDishes` → `/dishes` | dishes GET `/` | ✅ | n/a ✅ | ✅ (`search,cuisine,categoryId,minPrice,maxPrice,page,limit` all in QueryDishSchema) | ❌ CR-01 + CR-02 |
| `getDish` → `/dishes/:id` | dishes GET `/:id` | ✅ | n/a ✅ | ✅ | ❌ CR-02 |
| `searchDishes` → `/search/dishes` | search GET `/dishes` | ✅ | n/a ✅ | ✅ (`q`,`limit`) | ❌ CR-01 + CR-02 |
| `getRecommendations` → POST `/recommendations` | recs POST `/` | ✅ | optionalAuth ✅ | ⚠️ WR-04 (NaN) | ❌ CR-03 |
| `recordInteraction` → POST `/interactions` | interactions POST `/` | ✅ | required ✅ (`requireAuth`) | ✅ enums match exactly | ⚠️ type lies (IN-03); "unsave" broken CR-05 |
| `getMyInteractions` → `/interactions/me` | interactions GET `/me` | ✅ | required ✅ | ✅ | ❌ CR-01 |
| `getMe` → `/users/me` | users GET `/me` | ✅ | required ✅ | ✅ | ✅ (extra fields incl. `preferenceProfile` ignored) |
| `updateMe` → PUT `/users/me` | users PUT `/me` | ✅ | required ✅ | ✅ | ✅ (unused: IN-03) |
| `getMyPreferences` → `/me/preferences` | preferences GET `/me/preferences` | ✅ | required ✅ | ✅ | ✅ except WR-02 (`PriceRange`) |
| `updateMyPreferences` → PUT `/me/preferences` | preferences PUT `/me/preferences` | ✅ | required ✅ | ⚠️ WR-02 if `preferredPriceRange` sent | ✅ |

Enums: `TasteAttribute`, `MealCharacteristic`, `DietaryProperty`, `InteractionType` all match the backend Zod schemas and Prisma enums exactly. ✅ Base URL `http://localhost:5000/api/v1` matches `env.PORT`/`API_PREFIX`. ✅

---

## Critical

### CR-01: ✅ FIXED — Double-unwrapping paginated responses — every list endpoint returns `undefined`

`request()` already unwraps the backend envelope: it returns `json.data` (mobile/src/lib/api.ts:126-133). For list endpoints the backend puts the **array** in `data` and pagination in `meta` (backend/src/modules/dishes/controller.ts:10-18). But `getDishes`/`searchDishes`/`getMyInteractions` are typed `Paginated<T>` and callers read `.data` again:

- mobile/src/lib/queries.ts:56-57 — `const res = await getDishes(params); return res.data;` → array `.data` is `undefined`
- mobile/src/lib/queries.ts:79 — same for `useDishSearch`
- mobile/app/(tabs)/saved.tsx:47 — `interactions?.data ?? []` → always `[]`
- mobile/app/dish/[id].tsx:35-36 — `savedInteractions?.data ?? []` → `isSaved` never true

**Impact:** Discover screen always shows "No dishes found", Saved screen is permanently empty, the heart indicator never lights up.

**Fix:** pick one convention. Simplest: type list calls as `T[]` and drop the `.data` access:

```ts
// api.ts
export function getDishes(params = {}) {
  return request<DishSummary[]>("/dishes", { query: params });
}
// queries.ts
queryFn: () => getDishes(params),
```

If `meta` is needed later (IN-01), make `request` return the full `{ data, meta }` envelope instead of unwrapping.

### CR-02: Dish shape mismatch — backend returns nested Prisma rows; mobile expects a flat DTO

`mobile/src/types/dish.ts` `DishSummary` expects `restaurantName`, `branchName`, `category`, `cuisine`, `rating`, `reviewCount`, `calories`, `prepTimeMinutes`, and flat `tasteAttributes/tags/ingredients`. The backend serializes raw Prisma includes — `attributes`, `categories[].category`, `tags[].tag`, `ingredients[].ingredient`, `menu.restaurant` (backend/src/modules/dishes/repository.ts:114-131, 134-160). None of the flat fields exist; `rating`/`reviewCount`/`calories`/`prepTimeMinutes` exist nowhere in the Prisma schema at all (backend/prisma/schema.prisma `model Dish`).

**Impact:** once CR-01 is fixed, `dish.rating.toFixed(1)` throws TypeError and `dish.tasteAttributes.length` throws TypeError — app-level crash in DishCard (mobile/src/components/dish-card.tsx:60-66) and dish detail (mobile/app/dish/[id].tsx:150-152, 176, 219). `restaurantName`/`category`/`cuisine` render as blank.

**Fix (preferred):** add a presenter/serializer on the backend (`dishPresenter(dish) → { restaurantName: dish.menu.restaurant.name, rating: ..., tasteAttributes: dish.attributes?.tasteAttributes ?? [] , ...}`) so the DTO matches the documented mobile types. Mobile stopgap: map the response in `api.ts` and make DishCard defensive (`dish.rating?.toFixed(1) ?? "—"`).

### CR-03: `RecommendationResponse` shape mismatch — AI results can't render

Backend returns `{ request, interpretation, recommendations: [{ dish, restaurant, branch, distanceMeters, score, scoreBreakdown, reason }] }` (backend/src/modules/recommendations/recommendation.service.ts:220-260) — each item is **nested**, not a flat `Dish` as mobile's `types/recommendation.ts` claims. `ai.tsx:56` feeds these objects straight into `DishCard` (`recs.map((dish) => <DishCard dish={dish} />)`): `dish.id/name/price` are undefined → blank cards and a TypeError on `dish.rating.toFixed(1)`. The top-level `explanation` field never exists, so the "Why these?" block is dead code, while the real per-item `reason` is dropped.

**Fix:**

```ts
export interface RecommendationItem {
  dish: { id: string; name: string; description: string | null; price: number; currency: string; imageUrl: string | null; tasteAttributes: TasteAttribute[]; ... };
  restaurant: { id: string; name: string; priceRange: string; logoUrl: string | null; cuisines: string[] };
  branch: { id: string; name: string; address: string; latitude: number; longitude: number; isOpen: boolean };
  distanceMeters: number | null;
  score: number;
  reason: string;
}
export interface RecommendationResponse {
  request: { originalQuery: string | null; surpriseMe: boolean };
  interpretation: { maxPrice: number | null; mealTypes: string[]; tasteAttributes: string[]; preferredCuisines: string[]; dietaryRestrictions: string[]; atmosphere: string[] };
  recommendations: RecommendationItem[];
}
```

Then render `item.dish.name`, `item.dish.price`, `item.restaurant.name`, `item.reason` (adapt DishCard or add a RecommendationCard component).

### CR-04: Recommendation POST fires on mount and on every keystroke — AI rate limit and cost burn

`ai.tsx:52-54` calls `useRecommendations(payload ?? { limit: 6 })`, so the query is never given `null`; `enabled: !!payload` (mobile/src/lib/queries.ts:90) is always true for an object. Result: `POST /recommendations` runs on first mount, and again for **every keystroke** (each character changes the queryKey → new request → AI intent extraction). The backend's `aiRateLimiter` allows 20 requests/15min (backend/src/config/env.ts AI_RATE_LIMIT_MAX) — typing one sentence exhausts it, after which the screen shows the rate-limit empty state.

**Fix:** drive the query from a *submitted* request, not live input:

```ts
const [submitted, setSubmitted] = useState<RecommendationRequest | null>(null);
const { data, ... } = useRecommendations(submitted, { enabled: !!submitted });
// call setSubmitted(payload) from a "Find dishes" button / prompt tap / keyboard submit
```

`useRecommendations` should accept `RecommendationRequest | null` and set `enabled: payload != null`.

### CR-05: "Unsave" doesn't exist — heart toggle and Remove both duplicate SAVED rows

`saved.tsx:60-71` "removes" a dish by POSTing **another** `SAVED` interaction; `dish/[id].tsx:118-126` toggle-save sends `SAVED` with no way to undo. The backend has no delete/unlike endpoint (backend/src/modules/interactions/routes.ts only has POST `/` and GET `/me`), and `interactionService.recordInteraction` inserts unconditionally. After the refetch, the "removed" dish returns; `isSaved` can never go false. `removedIds` is a UI-only illusion that resets via `useEffect` (saved.tsx:58).

**Fix:** needs a backend addition — e.g. `DELETE /api/v1/interactions/saved/:dishId` (or toggle semantics + unique constraint). Mobile-side until then: use a distinct removal interaction type is not possible (enum frozen), so don't pretend it works — hide "Remove"/toggle-off until the endpoint exists, or dedupe SAVED rows in the service.

---

## Warning

### WR-01: ApiError.code never populated; AuthError uses a code the backend never emits

Backend error body is `{ success:false, error:{ code, message } }` (backend/src/middleware/error.middleware.ts:19-26). `api.ts:111` reads `errorBody?.code` (top level — absent) instead of `errorBody?.error?.code`, so `ApiError.code` is always `undefined` and code-based handling (e.g. `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`) is impossible. Additionally `AuthError` hardcodes `"UNAUTHENTICATED"` (api.ts:60) which is not in backend `ERROR_CODES` (`UNAUTHORIZED` is).

**Fix:** `if (errorBody?.error?.code) code = errorBody.error.code;` and change AuthError's code to `"UNAUTHORIZED"`.

### WR-02: `PriceRange` enum diverges from backend

`mobile/src/types/user.ts:16` — `"BUDGET" | "MID_RANGE" | "PREMIUM" | "LUXURY"` vs backend `["BUDGET","MODERATE","EXPENSIVE","LUXURY"]` (backend/src/modules/preferences/schema.ts:8, Prisma `enum PriceRange`). Any UI sending `preferredPriceRange` with mobile's values gets a 400 VALIDATION_ERROR.

**Fix:** align the union to `BUDGET | MODERATE | EXPENSIVE | LUXURY`.

### WR-03: No debounce on Discover search — one `/dishes` request per keystroke

`index.tsx:26-36` feeds raw `search` state into `useDishes` params → queryKey changes per character → a request per character (plus retry:1). With `standardRateLimiter` at 100 req/15min, browsing + typing trips 429s. `useDishSearch` (with a `/search/dishes` call) exists but is unused; `SearchBar` has no submit/`onEndEditing` handling (search-bar.tsx).

**Fix:** debounce params by ~300ms (`useDeferredValue` works well on RN/React 18), or trigger search on keyboard `returnKeyType="search"` submit.

### WR-04: `Number(maxPrice)` NaN becomes `null` in JSON → whole recommendation request rejected

`ai.tsx:42` — `maxPrice: maxPrice ? Number(maxPrice) : undefined`. `keyboardType="numeric"` doesn't prevent invalid input on all platforms; `JSON.stringify({maxPrice: NaN})` → `"maxPrice":null`, which fails `z.number().positive().optional()` (backend/src/modules/recommendations/schema.ts:7) with 400.

**Fix:** `const parsed = Number(maxPrice); maxPrice && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined`.

### WR-05: Authed queries fire for signed-out guests → guaranteed 401 noise

`saved.tsx:43` (`useMyInteractions`), `dish/[id].tsx:31` (`useMyInteractions`) and `:46-53` (`VIEW_DISH` mutate), `profile.tsx:66` (`useMyPreferences`, runs before the `!isSignedIn` early return) all execute without a token. Each is an auth-required endpoint → 401 + 1 retry each, every screen visit, for guests.

**Fix:** add `enabled: isSignedIn` options to `useMyInteractions`/`useMyPreferences` and guard the VIEW_DISH effect with `if (dish?.id && isSignedIn)` (mobile/src/lib/queries.ts:110-127).

### WR-06: No session-expiry handling — a dead token persists forever

`auth-store.ts:60-73` hydrate keeps a stored token even when `getMe` fails ("UI can prompt to re-auth"), but nothing ever prompts: all subsequent authed calls fail silently (errors unchecked in saved/profile screens) and the user appears signed in. A rotated/expired Supabase JWT puts the app in a permanent broken-signed-in state.

**Fix:** on `AuthError` (401) from authed calls, call `signOut()` — e.g. a QueryCache/MutationCache `onError` hook in `_layout.tsx`'s QueryClient that clears auth when `err instanceof AuthError`.

---

## Info

### IN-01: Pagination metadata discarded
`meta` (page/total/totalPages) never reaches callers (see CR-01 fix — return the envelope). Home is capped at `limit: 20` with no load-more; backend caps at 100 (QueryDishSchema). Wire `fetchNextPage` when the envelope is fixed.

### IN-02: `http://localhost:5000` fallback is device-hostile
`api.ts:24` — on a physical device/simulator localhost points at the phone. Type `EXPO_PUBLIC_API_URL: string` (types/env.d.ts) also claims it's always set while code treats it optional. Document/expose a LAN IP or tunnel URL; make the env type `string | undefined`.

### IN-03: Dead / lying exports
`updateMe`, `getAuthToken`, `useDishSearch` are never used. `recordInteraction` is typed `Promise<{ success: true }>` but actually resolves to the created interaction row (201 + unwrapped `data`) — fix the type. `saved.tsx:88` `dish as DishSummary` cast hides CR-02 — remove once types are honest.

### IN-04: `import type { UserPreferences }` at bottom of api.ts
api.ts:220 — hoist to the top with the other imports; the "circular import" comment doesn't apply to type-only imports.

### IN-05: Emoji-as-icons in tabs/cards
`(tabs)/_layout.tsx` and elsewhere render `🍽 ♥ ✨ 👤 🔍 ⚠️ ★` as UI icons — inconsistent glyph metrics across devices and poor a11y. Prefer `@expo/vector-icons` or `expo-symbols`. (Search-bar/tab-bar glyph rendering also can't be themed.)

---

## Suggested remediation order

1. CR-01 (envelope convention in `api.ts` + `queries.ts`) — unlocks everything else.
2. CR-02/CR-03 (dish DTO + recommendation DTO — add backend serializers, align mobile types).
3. CR-04 (submit-driven recommendations).
4. CR-05 (needs a small backend endpoint decision).
5. WR-01..06 + Info cleanup.
