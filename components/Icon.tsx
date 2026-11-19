/** One line icon set: 18px box, 1.5 stroke, current colour. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const PATHS: Record<string, React.ReactNode> = {
  shield: <path {...P} d="M10 2.5 4 5v4.5c0 3.7 2.6 6.6 6 8 3.4-1.4 6-4.3 6-8V5l-6-2.5Z" />,
  alert: <><path {...P} d="M10 3 2.5 16h15L10 3Z" /><path {...P} d="M10 8.5v3.5M10 14.2v.1" /></>,
  receipt: <><path {...P} d="M5 2.5h10v15l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3L7 16.2l-2 1.3v-15Z" /><path {...P} d="M7.5 7h5M7.5 10h5" /></>,
  check: <path {...P} d="m5 10.5 3 3 7-7.5" />,
  link: <><path {...P} d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9" /><path {...P} d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" /></>,
};
export default function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 20 20" aria-hidden>{PATHS[name]}</svg>;
}
