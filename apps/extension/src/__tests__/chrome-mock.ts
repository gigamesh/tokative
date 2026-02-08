import { vi } from "vitest";

export function createMockStorage(): Record<string, unknown> {
  return {};
}

export function createMockChromeStorage(mockStorage: Record<string, unknown>) {
  return {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === "string") {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        const result: Record<string, unknown> = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          result[key] = mockStorage[key];
        });
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keysArray = typeof keys === "string" ? [keys] : keys;
        keysArray.forEach((key) => delete mockStorage[key]);
        return Promise.resolve();
      }),
    },
  };
}
