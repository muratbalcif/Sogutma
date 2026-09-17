import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/base";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    if (!body.email?.trim()) {
      return NextResponse.json({ message: "E-posta gerekli" }, { status: 400 });
    }
    const data = await apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: body.email.trim().toLowerCase() }),
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "İstek başarısız";
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json({ message }, { status });
  }
}
