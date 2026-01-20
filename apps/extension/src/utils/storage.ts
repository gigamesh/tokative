import {
  ScrapedUser,
  MessageTemplate,
  StorageData,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE,
} from "../types";

const STORAGE_KEYS = {
  USERS: "tiktok_buddy_users",
  TEMPLATES: "tiktok_buddy_templates",
  SETTINGS: "tiktok_buddy_settings",
  ACCOUNT_HANDLE: "tiktok_buddy_account_handle",
  COMMENT_LIMIT: "tiktok_buddy_comment_limit",
} as const;

const DEFAULT_COMMENT_LIMIT = 100;

export async function getUsers(): Promise<ScrapedUser[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USERS);
  return result[STORAGE_KEYS.USERS] || [];
}

export async function saveUsers(users: ScrapedUser[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.USERS]: users });
}

export async function addUsers(newUsers: ScrapedUser[]): Promise<number> {
  const existing = await getUsers();
  const existingIds = new Set(existing.map((u) => u.id));
  const existingKeys = new Set(existing.map((u) => `${u.handle}:${u.comment}`));

  const uniqueNew = newUsers.filter((u) => {
    const key = `${u.handle}:${u.comment}`;
    return !existingIds.has(u.id) && !existingKeys.has(key);
  });

  if (uniqueNew.length > 0) {
    await saveUsers([...existing, ...uniqueNew]);
  }

  return uniqueNew.length;
}

export async function updateUser(
  userId: string,
  updates: Partial<ScrapedUser>
): Promise<void> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === userId);

  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    await saveUsers(users);
  }
}

export async function removeUser(userId: string): Promise<void> {
  const users = await getUsers();
  await saveUsers(users.filter((u) => u.id !== userId));
}

export async function removeUsers(userIds: string[]): Promise<void> {
  const users = await getUsers();
  const idsToRemove = new Set(userIds);
  await saveUsers(users.filter((u) => !idsToRemove.has(u.id)));
}

export async function getTemplates(): Promise<MessageTemplate[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TEMPLATES);
  const templates = result[STORAGE_KEYS.TEMPLATES];

  if (!templates || templates.length === 0) {
    await saveTemplates([DEFAULT_TEMPLATE]);
    return [DEFAULT_TEMPLATE];
  }

  return templates;
}

export async function saveTemplates(
  templates: MessageTemplate[]
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: templates });
}

export async function saveTemplate(template: MessageTemplate): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex((t) => t.id === template.id);

  if (index !== -1) {
    templates[index] = template;
  } else {
    templates.push(template);
  }

  await saveTemplates(templates);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const templates = await getTemplates();
  await saveTemplates(templates.filter((t) => t.id !== templateId));
}

export async function getSettings(): Promise<StorageData["settings"]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

export async function saveSettings(
  settings: StorageData["settings"]
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

export async function getAllData(): Promise<StorageData> {
  const [users, templates, settings] = await Promise.all([
    getUsers(),
    getTemplates(),
    getSettings(),
  ]);

  return { users, templates, settings };
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.USERS,
    STORAGE_KEYS.TEMPLATES,
    STORAGE_KEYS.SETTINGS,
  ]);
}

export async function getAccountHandle(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACCOUNT_HANDLE);
  return result[STORAGE_KEYS.ACCOUNT_HANDLE] || null;
}

export async function saveAccountHandle(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, "");
  await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNT_HANDLE]: normalized });
}

export async function getCommentLimit(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COMMENT_LIMIT);
  return result[STORAGE_KEYS.COMMENT_LIMIT] ?? DEFAULT_COMMENT_LIMIT;
}

export async function saveCommentLimit(limit: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.COMMENT_LIMIT]: limit });
}
