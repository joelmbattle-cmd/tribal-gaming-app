import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe session reader — no Prisma/bcrypt in this graph, so this can
// run in the default Edge runtime instead of requiring Node.js middleware.
const { auth } = NextAuth(authConfig);

function requiredRoleForPath(pathname: string) {
  if (pathname.startsWith("/compliance")) return "COMPLIANCE";
  if (pathname.startsWith("/licensing")) return "LICENSING";
  if (pathname.startsWith("/applicant")) return "APPLICANT";
  return null;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const role = req.auth?.user?.role;

  if (!role) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Metrics & Reporting is shared between Compliance and Licensing (R8),
  // never visible to the Applicant Portal role.
  if (pathname.startsWith("/metrics")) {
    if (role === "APPLICANT") return NextResponse.redirect(new URL("/applicant", req.url));
    return NextResponse.next();
  }

  const requiredRole = requiredRoleForPath(pathname);
  if (requiredRole && role !== requiredRole) {
    const home =
      role === "COMPLIANCE" ? "/compliance/floor" : role === "LICENSING" ? "/licensing/profiles" : "/applicant";
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
