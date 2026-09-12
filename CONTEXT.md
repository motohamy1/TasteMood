# TasteMood Personality

This context defines the language for the Personality experience: how TasteMood represents a user's enduring taste and adapts recommendations to the user's current situation.

## Profile

**Personality**:
The user's food-and-drink identity as represented by TasteMood. It is product language for a taste profile, not a psychological assessment.
_Avoid_: Psychological personality, personality type

**Taste Profile**:
The user's enduring food and drink preferences, dislikes, dietary needs, spice tolerance, budget, meal preferences, and appetite for discovery.
_Avoid_: Personality data, user settings

**Stable Preference**:
A taste-profile value expected to remain useful across recommendation sessions until the user changes it.
_Avoid_: Permanent preference

**Profile Completeness**:
The extent to which a taste profile has enough information to personalize a recommendation session: not started, in progress, or ready.
_Avoid_: Setup status, personality score

**Archetype**:
A descriptive label summarizing a user's stable taste pattern, derived from the taste profile and not edited directly by the user.
_Avoid_: Personality type, personality test result

## Current Context

**Live Factor**:
A temporary condition that can influence recommendations for the current situation, including mood, weather, and time of day.
_Avoid_: Dynamic preference, real-time preference

**Mood**:
The user's current emotional or experiential state, supplied for the present day or recommendation session and not treated as a permanent taste preference.
_Avoid_: Personality trait, feeling profile

**Time Slot**:
The meal-oriented part of the day relevant to a recommendation, such as breakfast, lunch, dinner, or late night.
_Avoid_: Time preference, schedule

**Weather Condition**:
The current environmental condition relevant to food and drink choices, such as hot, cold, rainy, dry, or mild.
_Avoid_: Weather preference, climate profile

**Live-Factor Override**:
A user-selected value that replaces an inferred or detected live factor for the current recommendation session.
_Avoid_: Permanent override, preference change

## Recommendations

**Recommendation Session**:
A current set of food and drink suggestions shaped by the user's taste profile and selected live factors.
_Avoid_: Personality result, recommendation state

**Recommendation Refinement**:
A set of changes to taste-profile or live-factor inputs that has not yet been used to create the next recommendation session.
_Avoid_: Stale recommendation, pending prompt

**Recommendation Signal**:
Feedback or behavior that can influence current or future recommendations without changing a stable preference by itself.
_Avoid_: Automatic profile update, personality change

**Profile Change Proposal**:
A suggested change to a stable preference that requires the user's confirmation before it becomes part of the taste profile.
_Avoid_: Inferred preference, automatic preference

**Discovery Preference**:
The user's desired balance between familiar choices and new experiences in a recommendation session.
_Avoid_: Adventure setting, novelty score

**Available Item**:
A food or drink that TasteMood can currently recommend because its factual dish and venue information is known.
_Avoid_: AI-generated item, suggestion

**Availability Gap**:
A situation where no known available item satisfies the current structured intent closely enough to recommend.
_Avoid_: Empty result, AI failure

**Structured Intent**:
A normalized description of what the user wants from a recommendation session, including taste, meal, dietary, atmosphere, price, location, and situational signals.
_Avoid_: AI prompt, recommendation prompt

## Place Data

**Place**:
A real food or drink business that TasteMood can identify and show to users.
_Avoid_: Restaurant (when the place is a cafe, bakery, juice shop, food stall, or another food-and-drink business)

**Official Name**:
The primary name supplied by the place's data source or the business owner. TasteMood displays it exactly as supplied, including Arabic, English, or another language.
_Avoid_: Translated name, normalized name, AI name

**Alternate Name**:
A source-supplied or owner-supplied name in another language. It may support search and accessibility, but it does not replace the Official Name.
_Avoid_: Replacement name, automatic translation

**Factual Description**:
A description supported by a source, the business owner, or an approved editorial review. If no supported description exists, the value is absent rather than invented.
_Avoid_: AI description, inferred description

**Source Record**:
A representation of a place, branch, menu, dish, price, or opening hour received from a named external source, owner, or approved editor, with provenance and freshness information.
_Avoid_: Scraped data (unless the acquisition method is explicitly authorized)

**Authorized Source**:
A source TasteMood is permitted to use through an official API, licensed feed, written partnership, owner submission, or another documented permission. Public visibility alone does not make a source authorized.
_Avoid_: Free-to-scrape source, public data by default

**Data Provenance**:
The source, acquisition time, source identifier, and verification state attached to a factual record.
_Avoid_: Confidence score when provenance is required

**Verified Availability**:
A place, menu item, price, or opening hour that has current supporting evidence and may be used as a factual recommendation.
_Avoid_: AI-generated availability, likely available

**Estimated Content**:
AI-generated or inferred content that has not been confirmed by a source, owner, or editor. It may assist internal workflows but must not be presented as verified menu or place data.
_Avoid_: Real menu, actual item, factual listing

**Rural Place**:
A Place discoverable by its coordinates even when it cannot be assigned to a known city. City classification is optional; governorate and coordinate coverage must not depend on an urban-city list.
_Avoid_: Unmapped place, invalid place

## Resolved Product Decisions

- TasteMood is a source-backed food-and-drink directory for Egypt, not a demo catalogue of invented restaurants and menus.
- `prisma db seed` data is development/reference data only. Real place data enters through authorized source records and must not be erased by routine seeding.
- Google Maps/Places, Talabat, Waffarha, and similar services may be used only through an official API, license, partnership, owner-provided data, or another documented permission. Lack of app-store deployment does not remove their terms of service, database rights, privacy duties, or access restrictions.
- Official names are preserved exactly. Arabic names remain Arabic; English or other-language business names remain as supplied. Translation is an alternate value, never an overwrite.
- Arabic is the default user-facing language for descriptions when a supported Arabic description exists. No description is preferable to an invented factual description.
- Exact coordinates are the primary basis for discovery, including rural areas. Missing city classification must not hide a place.
- AI may classify, translate, explain, or propose content, but only verified source/owner/editor data can be shown as an actual menu item, price, opening hour, or availability claim.
