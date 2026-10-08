# TasteMood Personality

This context defines the language for the Personality experience: how TasteMood represents a user's enduring taste and adapts recommendations to the user's current situation.

## Profile

**Personality**:
The user's food-and-drink identity as represented by TasteMood. It is product language for a taste profile, not a psychological assessment.
*Avoid*: Psychological personality, personality type

**Taste Profile**:
The user's enduring food and drink preferences, dislikes, dietary needs, spice tolerance, budget, meal preferences, and appetite for discovery.
*Avoid*: Personality data, user settings

**Stable Preference**:
A taste-profile value expected to remain useful across recommendation sessions until the user changes it.
*Avoid*: Permanent preference

**Profile Completeness**:
The extent to which a taste profile has enough information to personalize a recommendation session: not started, in progress, or ready.
*Avoid*: Setup status, personality score

**Archetype**:
A descriptive label summarizing a user's stable taste pattern, derived from the taste profile and not edited directly by the user.
*Avoid*: Personality type, personality test result

**Taste-Discovery Scenario**:
A situation-based food-or-drink choice used to learn the user's stated taste preferences, not to assess psychological traits.
_Avoid_: Personality test, psychological profile

## Current Context

**Live Factor**:
A temporary condition that can influence recommendations for the current situation, including mood, weather, and time of day.
*Avoid*: Dynamic preference, real-time preference

**Mood**:
The user's current emotional or experiential state, supplied for the present day or recommendation session and not treated as a permanent taste preference.
*Avoid*: Personality trait, feeling profile

**Time Slot**:
The meal-oriented part of the day relevant to a recommendation, such as breakfast, lunch, dinner, or late night.
*Avoid*: Time preference, schedule

**Weather Condition**:
The current environmental condition relevant to food and drink choices, such as hot, cold, rainy, dry, or mild.
*Avoid*: Weather preference, climate profile

**Live-Factor Override**:
A user-selected value that replaces an inferred or detected live factor for the current recommendation session.
*Avoid*: Permanent override, preference change

**Contextual Taste Pattern**:
A repeated relationship between a user's food-and-drink signals and a Live Factor, used to refine recommendations in similar situations without changing a Stable Preference.
_Avoid_: Weather preference, personality trait

## Recommendations

**Recommendation Session**:
A current set of food and drink suggestions shaped by the user's taste profile and selected live factors.
*Avoid*: Personality result, recommendation state

**Recommendation Refinement**:
A set of changes to taste-profile or live-factor inputs that has not yet been used to create the next recommendation session.
*Avoid*: Stale recommendation, pending prompt

**Recommendation Signal**:
Feedback or behavior that can influence current or future recommendations without changing a stable preference by itself.
*Avoid*: Automatic profile update, personality change

**Profile Change Proposal**:
A suggested change to a stable preference that requires the user's confirmation before it becomes part of the taste profile.
*Avoid*: Inferred preference, automatic preference

**Discovery Preference**:
The user's desired balance between familiar choices and new experiences in a recommendation session.
*Avoid*: Adventure setting, novelty score

**Available Item**:
A food or drink that TasteMood can currently recommend because its factual dish and venue information is known.
*Avoid*: AI-generated item, suggestion

**Availability Gap**:
A situation where no known available item satisfies the current structured intent closely enough to recommend.
*Avoid*: Empty result, AI failure

**Structured Intent**:
A normalized description of what the user wants from a recommendation session, including taste, meal, dietary, atmosphere, price, location, and situational signals.
*Avoid*: AI prompt, recommendation prompt

## Place Data

**Place**:
A real food or drink business that TasteMood can identify and show to users.
*Avoid*: Restaurant (when the place is a cafe, bakery, juice shop, food stall, or another food-and-drink business)

**Official Name**:
The primary name supplied by the place's data source or the business owner. TasteMood displays it exactly as supplied, including Arabic, English, or another language.
*Avoid*: Translated name, normalized name, AI name

**Alternate Name**:
A source-supplied or owner-supplied name in another language. It may support search and accessibility, but it does not replace the Official Name.
*Avoid*: Replacement name, automatic translation

**Factual Description**:
A description supported by a source, the business owner, or an approved editorial review. If no supported description exists, the value is absent rather than invented.
*Avoid*: AI description, inferred description

**Source Record**:
A representation of a place, branch, menu, dish, price, or opening hour received from a named external source, owner, or approved editor, with provenance and freshness information.
*Avoid*: Scraped data presented without provenance or acquisition method


**Data Provenance**:
The source, acquisition time, source identifier, and verification state attached to a factual record.
*Avoid*: Confidence score when provenance is required

**Verified Availability**:
A place, menu item, price, or opening hour that has current supporting evidence and may be used as a factual recommendation.
*Avoid*: AI-generated availability, likely available

**Estimated Content**:
AI-generated or inferred content that has not been confirmed by a source, owner, or editor. It may assist internal workflows but must not be presented as verified menu or place data.
*Avoid*: Real menu, actual item, factual listing

**Rural Place**:
A Place discoverable by its coordinates even when it cannot be assigned to a known city. City classification is optional; governorate and coordinate coverage must not depend on an urban-city list.
*Avoid*: Unmapped place, invalid place

## Resolved Product Decisions

- TasteMood is a source-backed food-and-drink directory for Egypt, not a demo catalogue of invented restaurants and menus.
- Official names are preserved exactly. Arabic names remain Arabic; English or other-language business names remain as supplied. Translation is an alternate value, never an overwrite.
- Arabic is the default user-facing language for descriptions when a supported Arabic description exists. No description is preferable to an invented factual description.
- Exact coordinates are the primary basis for discovery, including rural areas. Missing city classification must not hide a place.
- AI may classify, translate, explain, or propose content, but only verified source/owner/editor data can be shown as an actual menu item, price, opening hour, or availability claim.
- Dishes discovery is a browse surface with three category criteria: mood, weather, and area (a markaz or the user's own position). Each criterion exposes its own categories and the selected category shows both the matching dishes and the places behind them. Mood and weather shape meal/taste intent through the recommendation engine; area selects places from the catalogue and anchors the dish matches on the area's centre.
- Feedback and pair-taste answers are **Recommendation Signals**: they update an aggregate taste-vector in `inferredPreferences`, never a stable preference silently. See ADR-001.
- Learned affinity refines scoring but never overrides declared setup answers: bounded to ±0.3 within preferenceMatch.
- A taste dimension is *measured* at ≥5 net signals; below that it is low-confidence and fair game for pair-taste targeting and one-at-a-time probes (budget ceiling first).
- Guests learn locally (on-device vector) and merge once, additively, at sign-up; no server-side guest profiles.
- Provenance is displayed: `learnedAffinity` rides in `scoreBreakdown`, why-lines are deterministic client templates, TraitBars show measured signals and their sources.
- Personality discovery uses playful food-and-drink scenarios, not psychological assessment; a short core profile precedes first recommendations, then optional targeted questions remain limited to one per day and never block recommendations.
- Only explicit recommendation feedback updates learned taste: likes, saves, dislikes, and explicit pair-taste answers; views and clicks do not imply preference. Feedback is associated with active Live Factors so recurring Contextual Taste Patterns can refine future recommendations without changing Stable Preferences.
- Guests complete discovery and receive recommendations without an account; their local taste profile and signals merge additively at sign-up without creating a server-side guest profile.

