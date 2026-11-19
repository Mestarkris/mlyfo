"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import Avatar from "./Avatar";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, React.ReactNode> = {
  overview: <svg viewBox="0 0 20 20" aria-hidden><rect {...P} x="3" y="3" width="6" height="6" rx="1.5" /><rect {...P} x="11" y="3" width="6" height="6" rx="1.5" /><rect {...P} x="3" y="11" width="6" height="6" rx="1.5" /><rect {...P} x="11" y="11" width="6" height="6" rx="1.5" /></svg>,
  pad: <svg viewBox="0 0 20 20" aria-hidden><rect {...P} x="2.5" y="5" width="15" height="10" rx="2" /><path {...P} d="M6 8.5h.01M10 8.5h.01M14 8.5h.01M6.5 12h7" /></svg>,
  splits: <svg viewBox="0 0 20 20" aria-hidden><path {...P} d="M10 3v5m0 0-5 4.5V17m5-9 5 4.5V17" /></svg>,
  limits: <svg viewBox="0 0 20 20" aria-hidden><path {...P} d="M3.5 14a6.5 6.5 0 1 1 13 0" /><path {...P} d="m10 14 3-4" /></svg>,
  shield: <svg viewBox="0 0 20 20" aria-hidden><path {...P} d="M10 2.5 4 5v4.5c0 3.7 2.6 6.6 6 8 3.4-1.4 6-4.3 6-8V5l-6-2.5Z" /></svg>,
  verified: <svg viewBox="0 0 20 20" aria-hidden><circle {...P} cx="10" cy="10" r="7" /><path {...P} d="m7 10 2 2 4-4" /></svg>,
};
const NAV = [
  ["/app", "overview", "Overview"], ["/app/pad", "pad", "Mlyfo Pad"], ["/app/splits", "splits", "Splits"],
  ["/app/limits", "limits", "Limits"], ["/app/shield", "shield", "Shield"], ["/app/verified", "verified", "Verified by Kane"],
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
          <Link key={href} href={href} className={path === href ? "on" : ""}><span className="ico">{ICONS[ico]}</span>{label}</Link>
        ))}
        <div className="user">
          <Avatar name={name} />
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
