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
