import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SideNav from "@/components/SideNav";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/signin");
  return (
    <div className="dash">
      <SideNav name={u.name} handle={u.handle} />
      <main className="main">{children}</main>
    </div>
  );
}
