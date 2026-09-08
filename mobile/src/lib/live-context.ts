/**
 * Live external factors for the Personality tab:
 * - current time slot (clock, refreshed each minute)
 * - weather at the user's position (Open-Meteo, no API key)
 * - locality name (BigDataCloud client reverse-geocode, no API key)
 *
 * Every source degrades to null — the UI then hides the chip or shows an
 * "off" fallback, so the screen never blocks on permissions or the network.
 */

import { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "late-night";

export interface TimeInfo {
  /** e.g. "7:42 PM" */
  clock: string;
  slot: MealSlot;
}

export interface LiveContext {
  loading: boolean;
  /** Location permission denied / fetch failed — render the "off" fallback. */
  unavailable: boolean;
  tempC: number | null;
  condition: string | null;
  emoji: string | null;
  city: string | null;
}

export function timeInfo(now: Date = new Date()): TimeInfo {
  const h = now.getHours();
  const slot: MealSlot =
    h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "late-night";
  return {
    clock: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    slot,
  };
}

/** Live clock, re-rendered every 30s so "7:42 PM" never goes stale. */
export function useClock(): TimeInfo {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => timeInfo(now), [now]);
}

/** WMO weather codes → { emoji, label } — the subset we render as chips. */
function describeWeather(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "clear" };
  if (code === 1 || code === 2) return { emoji: "🌤️", label: "mostly clear" };
  if (code === 3) return { emoji: "☁️", label: "overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "fog" };
  if (code >= 51 && code <= 67) return { emoji: "🌧️", label: "rain" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", label: "snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "showers" };
  if (code >= 95) return { emoji: "⛈️", label: "storm" };
  return { emoji: "🌡️", label: "mild" };
}

export function useLiveContext(): LiveContext {
  const [state, setState] = useState<LiveContext>({
    loading: true,
    unavailable: false,
    tempC: null,
    condition: null,
    emoji: null,
    city: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") throw new Error("permission-denied");
        const pos =
          (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
          (await Location.getCurrentPositionAsync({}));
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const [weatherRes, geoRes] = await Promise.allSettled([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
          ).then((r) => r.json()),
          fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          ).then((r) => r.json()),
        ]);

        if (cancelled) return;

        let tempC: number | null = null;
        let condition: string | null = null;
        let emoji: string | null = null;
        if (weatherRes.status === "fulfilled") {
          const current = weatherRes.value?.current;
          if (current && typeof current.temperature_2m === "number") {
            tempC = Math.round(current.temperature_2m);
            const w = describeWeather(Number(current.weather_code ?? -1));
            condition = w.label;
            emoji = w.emoji;
          }
        }
        const city =
          geoRes.status === "fulfilled"
            ? (geoRes.value?.city ||
                geoRes.value?.locality ||
                geoRes.value?.principalSubdivision ||
                null)
            : null;

        const noData = tempC === null && city === null;
        setState({
          loading: false,
          unavailable: noData,
          tempC,
          condition,
          emoji,
          city,
        });
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, unavailable: true }));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** 1200 → "1.2km", 450 → "450m". */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null || Number.isNaN(meters)) return null;
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`;
}
