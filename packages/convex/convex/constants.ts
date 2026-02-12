const ADMIN_EMAILS = ["m.masurka@gmail.com"];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export const WHITELISTED_EMAILS = [
  "ryansiegelmusic@gmail.com",
  "gmeshmusic@gmail.com",
  "m.masurka@gmail.com",
  "matt@masurka.com",
];

export function isEmailWhitelisted(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const emailList = WHITELISTED_EMAILS.map((e) => e.toLowerCase());

  if (emailList.length === 0) {
    return true;
  }

  if (emailList.includes(normalizedEmail)) {
    return true;
  }

  // Allow any Gmail address containing "test"
  if (
    normalizedEmail.endsWith("@gmail.com") &&
    normalizedEmail.includes("test")
  ) {
    return true;
  }

  return false;
}

export const PREMIUM_WHITELIST = [
  "ryansiegelmusic@gmail.com",
  "m.masurka@gmail.com",
];

/** Checks if an email is on the premium whitelist (free premium access). */
export function isPremiumWhitelisted(email: string): boolean {
  const normalized = email.toLowerCase();
  return PREMIUM_WHITELIST.some((e) => e.toLowerCase() === normalized);
}
