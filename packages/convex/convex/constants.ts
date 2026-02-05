export const WHITELISTED_EMAILS = [
  "ryansiegelmusic@gmail.com",
  "gmeshmusic@gmail.com",
  "m.masurka@gmail.com",
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
  if (normalizedEmail.endsWith("@gmail.com") && normalizedEmail.includes("test")) {
    return true;
  }

  return false;
}
