"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";

const NAV = [
  ["/app", "◧", "Overview"], ["/app/pad", "⌨", "Mlyfo Pad"], ["/app/splits", "⟗", "Splits"],
  ["/app/limits", "◔", "Limits"], ["/app/shield", "⛉", "Shield"], ["/app/verified", "✓", "Verified by Kane"],
] as const;

export default function SideNav({ name, handle }: { name: string; handle: string }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); };
  return (
    <>
      <aside className="side">
        <Logo href="/app" />
        {NAV.map(([href, ico, label]) => (
          <Link key={href} href={href} className={path === href ? "on" : ""}><span className="ico">{ico}</span>{label}</Link>
        ))}
        <div className="user">
          <div className="ava">🙂</div>
          <div style={{ minWidth: 0 }}><b>{name}</b><small>@{handle}</small>
            <button className="linklike" onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>
      <nav className="mobile-tabs" aria-label="Sections">
        {NAV.map(([href, , label]) => <Link key={href} href={href} className={path === href ? "on" : ""}>{label}</Link>)}
        <button className="linklike" onClick={logout} style={{ all: "unset", padding: "7px 12px", fontSize: 14, fontWeight: 600, color: "var(--mute)", cursor: "pointer" }}>Sign out</button>
      </nav>
    </>
  );
}
