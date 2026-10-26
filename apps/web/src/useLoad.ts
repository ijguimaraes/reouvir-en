import { useEffect, useState } from "react";

export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && (setData(d), setError("")))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Falha"));
    return () => {
      alive = false;
    };
  }, [load, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
