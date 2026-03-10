import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "defyb_session";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };

  const expectedEmail = process.env.MVP_LOGIN_EMAIL || "admin@defyb.org";
  const expectedPassword = process.env.MVP_LOGIN_PASSWORD || "defyb-demo";

  if (email !== expectedEmail || password !== expectedPassword) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const store = await cookies();
  store.set(COOKIE_NAME, "authenticated", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ ok: true });
}
