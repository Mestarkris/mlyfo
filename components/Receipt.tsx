const money = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type ReceiptRow = { name: string; cents: number; state: "paid" | "sent" | "you" };

/** A printed split slip. The torn, perforated edge marks money that is being settled. */
export default function Receipt({ title, totalCents, rows, size = "md" }: { title: string; totalCents: number; rows: ReceiptRow[]; size?: "sm" | "md" }) {
  const paid = rows.filter((r) => r.state !== "sent").length;
  return (
    <div className={`slip-wrap ${size}`}>
      <div className="slip perf">
        <div className="slip-head"><span>{title}</span><span className="num">{money(totalCents)}</span></div>
        <div className="slip-sub">Split {rows.length} ways</div>
        <ul className="slip-rows">
          {rows.map((r) => (
            <li key={r.name} className={r.state}>
              <span>{r.state === "you" ? "You" : r.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{money(r.cents)}</span>
              <span className="mark">{r.state === "sent" ? "link sent" : <><Tick /><span className="sr">{r.state === "you" ? "covered" : "paid"}</span></>}</span>
            </li>
          ))}
        </ul>
        <div className="slip-foot num">{paid} of {rows.length} paid</div>
      </div>
    </div>
  );
}

/** A ballpoint tick, drawn slightly by hand. */
export function Tick() {
  return <svg className="tick" width="20" height="16" viewBox="0 0 20 16" aria-hidden><path d="M2 8.6c1.6 1.2 3 2.6 4.3 4.6C9 8 12.6 4 18 1.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
