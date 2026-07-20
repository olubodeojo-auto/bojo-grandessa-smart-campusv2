import { useEffect, useState } from "react";

export default function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedValue(value), delay);

    return () => window.clearTimeout(handler);
  }, [delay, value]);

  return debouncedValue;
}
