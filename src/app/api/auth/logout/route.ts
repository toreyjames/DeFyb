import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "defyb_session";

export async function POST() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
