import { NextResponse, type NextRequest } from "next/server";

const SAMPLE_COOKIE = "cleave_session";
const AUTH_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Keeps signed-out visitors out of /app and signed-in visitors off /login.
 * A visitor is signed in with either a GitHub session (Auth.js) or the sample
 * workspace cookie. Pages still check the session itself; this only redirects early.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession =
    Boolean(request.cookies.get(SAMPLE_COOKIE)?.value) || AUTH_COOKIES.some((name) => request.cookies.get(name)?.value);

  if (pathname.startsWith("/app") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
