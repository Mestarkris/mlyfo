import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export async function withUser(fn: (u: User) => Promise<Response> | Response): Promise<Response> {
  const u = await currentUser();
  if (!u) return bad("Sign in to continue.", 401);
  return fn(u);
}

export const cents = (v: unknown) => Math.round(Number(String(v ?? "").replace(/[,$]/g, "")) * 100);
