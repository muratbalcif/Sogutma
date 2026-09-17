import { NextResponse } from "next/server";

/** Lightweight deploy health for web hosting platforms. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "web" });
}
