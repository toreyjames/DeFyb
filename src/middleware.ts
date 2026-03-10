import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "defyb_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/defyb-logo.svg");

  if (isPublic) return NextResponse.next();

  const isAuthed = request.cookies.get(COOKIE_NAME)?.value === "authenticated";

  if (!isAuthed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/encounter", "/billing-review", "/final-output"],
};
