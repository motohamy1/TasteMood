import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (search input) into a slower-updating one.
 * The debounce block used to be copy-pasted in home + dishes screens with
 * slightly different trim semantics — this is its single home (WR-03).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
