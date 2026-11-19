import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import AuthAside from "@/components/AuthAside";
import { SigninForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Sign in · Mlyfo" };
export default async function Page({ searchParams }: { searchParams: Promise<{ demo?: string; next?: string }> }) {
  const { demo, next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (await currentUser()) redirect(safeNext);
  return (
    <div className="auth">
      <div className="auth-l"><Logo /><SigninForm demo={demo === "1"} next={safeNext} /></div>
      <AuthAside />
    </div>
  );
}
