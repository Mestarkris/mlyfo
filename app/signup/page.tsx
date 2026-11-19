import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import AuthAside from "@/components/AuthAside";
import { SignupForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Create account · Mlyfo" };
export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await currentUser()) redirect("/app");
  const { email } = await searchParams;
  return (
    <div className="auth">
      <div className="auth-l"><Logo /><SignupForm email={email ?? ""} /></div>
      <AuthAside />
    </div>
  );
}
