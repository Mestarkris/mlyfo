"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "./api";

export function SignupForm({ email: initialEmail = "" }: { email?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: initialEmail, handle: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [handleState, setHandleState] = useState<"" | "free" | "taken" | "invalid">("");

  useEffect(() => {
    const h = f.handle.trim();
    if (!h) return setHandleState("");
    const t = setTimeout(async () => {
      const r = await fetch(`/api/handle?h=${encodeURIComponent(h)}`).then((x) => x.json());
      setHandleState(!r.valid ? "invalid" : r.free ? "free" : "taken");
    }, 250);
    return () => clearTimeout(t);
  }, [f.handle]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await api("/api/auth/register", "POST", f);
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Something went wrong. Try again.");
    router.push("/app?welcome=1"); router.refresh();
  }
  return (
    <form className="auth-form" onSubmit={submit} data-testid="signup-form">
      <h1>Create your account</h1>
      <p>Already have one? <Link href="/signin" style={{ color: "var(--teal-ink)", fontWeight: 600 }}>Sign in</Link></p>
      <div className="f"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" value={f.name} onChange={set("name")} required /></div>
      <div className="f"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} required /></div>
      <div className="f"><label htmlFor="handle">Username</label>
        <div className="handle"><input id="handle" name="handle" autoComplete="username" value={f.handle} onChange={set("handle")} required /></div>
        {handleState === "free" && <div className="ok-line">@{f.handle.toLowerCase()} is free. Friends can pay you with it.</div>}
        {handleState === "taken" && <div className="err">@{f.handle.toLowerCase()} is taken. Try another.</div>}
        {handleState === "invalid" && <div className="hint">Use 3 to 20 letters, numbers or underscores.</div>}
      </div>
      <div className="f"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={10} /><div className="hint">At least 10 characters.</div></div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-ink btn-full" style={{ marginTop: 24 }} disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function SigninForm({ demo, next = "/app" }: { demo?: boolean; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(demo ? "demo@mlyfo.app" : "");
  const [password, setPassword] = useState(demo ? "mlyfo-demo-2026" : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await api("/api/auth/login", "POST", { email, password });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Couldn’t sign in. Try again.");
    router.push(next); router.refresh();
  }
  return (
    <form className="auth-form" onSubmit={submit} data-testid="signin-form">
      <h1>Sign in</h1>
      <p>New to Mlyfo? <Link href="/signup" style={{ color: "var(--teal-ink)", fontWeight: 600 }}>Create an account</Link></p>
      <div className="f"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="f"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-ink btn-full" style={{ marginTop: 24 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="or">or</div>
      <button type="button" className="btn btn-ghost btn-full" onClick={() => { setEmail("demo@mlyfo.app"); setPassword("mlyfo-demo-2026"); }}>Use the demo account</button>
    </form>
  );
}
