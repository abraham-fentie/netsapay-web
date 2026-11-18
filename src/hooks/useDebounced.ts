"use client";
import { useEffect, useState } from "react";

/** The value, once it stopped changing for `ms` (search boxes: one request per pause, not per key). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
