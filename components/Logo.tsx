import Link from "next/link";
export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label="Mlyfo home">
      <span className="logo-mark"><i /></span>mlyfo
    </Link>
  );
}
