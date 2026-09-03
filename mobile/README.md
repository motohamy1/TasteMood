# TasteMood — Mobile (Expo / React Native)

React Native (Expo SDK 57) client for the TasteMood backend.

## Stack

- **Expo SDK 57** + **React Native 0.86** + **React 19**
- **expo-router** (file-based routing, Stack + Tabs)
- **NativeWind v4** + **Tailwind CSS v3** (utility-first styling)
- **TanStack React Query** (data fetching, caching, mutations)
- **expo-image** (caching, blurhashes, SF Symbols)
- **TypeScript** with `@/*` path alias → `src/*`

## Project layout

```
mobile/
├── app/                              # expo-router file routes
│   ├── _layout.tsx                   # Root Stack + QueryClient + Providers
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab bar
│   │   ├── index.tsx                 # Home (dish discovery)
│   │   ├── saved.tsx                 # Saved (placeholder)
│   │   ├── ai.tsx                    # AI chat (placeholder)
│   │   └── profile.tsx               # Profile (placeholder)
│   └── dish/[id].tsx                 # Dish details
├── src/
│   ├── components/                   # DishCard, SearchBar, Skeleton, ...
│   ├── lib/
│   │   ├── api.ts                    # fetch wrapper -> EXPO_PUBLIC_API_URL
│   │   ├── queries.ts                # React Query hooks
│   │   └── cn.ts                     # tailwind-merge helper
│   ├── types/                        # Dish, RecommendationRequest, env.d.ts
│   └── global.css                    # Tailwind directives
├── .env                              # EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
├── app.json                          # Expo config (scheme, plugins, bundle id)
├── babel.config.js                   # babel-preset-expo + nativewind
├── metro.config.js                   # withNativeWind
├── tailwind.config.js
└── tsconfig.json                     # @/* -> src/* path alias
```

## Configuration

Set the backend URL via `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
```

- **Same machine (simulator/emulator)**: `http://localhost:5000/api/v1` works as-is.
- **Real device**: use your machine's LAN IP, e.g. `http://192.168.1.10:5000/api/v1`.
- **Production**: set to your deployed backend URL, e.g. `https://api.tastemood.app/api/v1`.

`EXPO_PUBLIC_*` vars are inlined at build time, so **restart `npx expo start`** after editing `.env`.

The backend must be running and CORS must allow the mobile origin (it already accepts `*` by default; see `backend/src/config/env.ts` → `CORS_ORIGIN`).

## Run

```bash
cd mobile
npm install            # only first time
npm run start          # then scan QR with Expo Go
# or
npm run android        # requires Android emulator + prebuild
npm run ios            # requires macOS + Xcode
npm run typecheck      # tsc --noEmit
```

> Most of the app works in **Expo Go** without custom native code.

## What's included

✅ Working on Expo Go:
- Tab navigation (Home / Saved / AI / Profile)
- Home: search, category pills, dish grid, pull-to-refresh
- Dish Details: hero image, tags, ingredients, AI explanation, `VIEW_DISH` interaction, **save (heart) toggle** when signed in
- AI tab: free-text prompt + quick-craving chips + max-price filter → `POST /recommendations`
- Saved tab: lists the user's `SAVED` interactions fetched from `GET /interactions/me`, with optimistic remove
- Profile tab: shows real user + preferences (spice, dietary, cuisines) editable via `PUT /me/preferences`
- Auth modal (`/auth`): paste a Supabase JWT or use the dev `mock-user-*` / `mock-admin-*` shortcuts
- Token persisted in `expo-secure-store`, hydrated on app boot
- React Query wired to all backend endpoints
- `EXPO_PUBLIC_API_URL` env-driven
- Loading skeletons + error states + empty states

🚧 Still deferred:
- Real Supabase Auth UI (the modal accepts a JWT but doesn't generate one — drop in `supabase.auth.signInWithPassword` when the Supabase project is ready)
- Cart / checkout
- Onboarding flow
- Map view / location-based recommendations (the `lat`/`lng`/`radiusKm` fields are already supported by `useRecommendations`)

## API surface wired up

| Mobile hook | Backend route | Auth | Purpose |
|---|---|---|---|
| `useDishes(params)` | `GET /dishes` | – | List dishes with filters |
| `useDish(id)` | `GET /dishes/:id` | – | Dish details |
| `useDishSearch(q)` | `GET /search/dishes` | – | Search |
| `useRecommendations(req)` | `POST /recommendations` | optional | AI suggestions |
| `useRecordInteraction()` | `POST /interactions` | ✅ | Track views / likes / saves |
| `useMyInteractions(p)` | `GET /interactions/me` | ✅ | Current user's history |
| `useMyPreferences()` | `GET /me/preferences` | ✅ | Read preferences |
| `useUpdateMyPreferences()` | `PUT /me/preferences` | ✅ | Update preferences |
| `useAuthStore.signInWithToken(t)` | n/a (token storage) | – | Sets the Bearer token used by the above |

## Auth notes

The store keeps the token in `expo-secure-store` and pushes it into the API client via `setAuthToken(token)`. Two token shapes work today:

1. **Supabase JWT** (HS256, signed with `SUPABASE_JWT_SECRET` on the backend) — what you'll use in production.
2. **`mock-…` token** — the backend accepts these in dev/test (see `backend/src/middleware/auth.middleware.ts`). Useful for local hacking.

To wire real Supabase later, replace the body of `signInWithToken` with `supabase.auth.signInWithPassword(...)` and pass the resulting session JWT. The rest of the app is already token-agnostic.

## Adding a real Supabase Auth flow

When the Supabase project is ready:

```bash
npx expo install @supabase/supabase-js
```

Then in `src/lib/auth-store.ts`, replace the dev `signInWithToken` with the real flow — e.g.

```ts
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

signInWithEmail: async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await signInWithToken(data.session.access_token);
},
```

…and update `app/auth.tsx` to call `signInWithEmail` instead of `signInWithToken`.
