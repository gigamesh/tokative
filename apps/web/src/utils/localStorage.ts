export function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getStorageBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const item = localStorage.getItem(key);
  if (item === null) return fallback;
  return item === "true";
}

export function setStorageBoolean(key: string, value: boolean): void {
  localStorage.setItem(key, String(value));
}
