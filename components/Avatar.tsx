/** Initials on a quiet circle. Replaces emoji avatars. */
export default function Avatar({ name, size }: { name: string; size?: number }) {
  const clean = name.replace(/[^\p{L}\s]/gu, "").trim();
  const initials = clean ? clean.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "?";
  return <span className="ava" aria-hidden style={size ? { width: size, height: size, fontSize: size * 0.38 } : undefined}>{initials}</span>;
}
