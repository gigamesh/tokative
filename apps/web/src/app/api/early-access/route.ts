import { NextRequest, NextResponse } from "next/server";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_LIST_ID = 2;
const BREVO_DOI_TEMPLATE_ID = 1;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectionUrl = `${origin}/verified`;
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
      {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          includeListIds: [BREVO_LIST_ID],
          templateId: BREVO_DOI_TEMPLATE_ID,
          redirectionUrl,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.code === "duplicate_parameter") {
        return NextResponse.json({ success: true });
      }
      console.error("Brevo API error:", res.status, body);
      return NextResponse.json(
        { error: "Failed to subscribe. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
