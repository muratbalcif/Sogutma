import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/account", "/checkout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const access = request.cookies.get("fs_access_token")?.value;
  const refresh = request.cookies.get("fs_refresh_token")?.value;
  if (!access && !refresh) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/checkout", "/checkout/:path*"],
};
