import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const dest = new URL("/", _request.url);
  if (/^TOK-[a-z2-9]{8}$/.test(code)) {
    dest.searchParams.set("ref", code);
  }

  return NextResponse.redirect(dest);
}
