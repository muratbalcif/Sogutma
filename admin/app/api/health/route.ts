import { NextResponse } from "next/server";

/** Lightweight deploy health for admin hosting platforms. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "admin" });
}
