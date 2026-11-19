import { currentUser } from "@/lib/auth";
import { people, openAsks, type Person } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { AddPerson, AskForAddress, RemovePerson } from "@/components/PeopleTools";

function trust(p: Person): { tone: "mlyfo" | "confirmed" | "saved"; text: string } {
  if (p.source === "confirmed") return { tone: "confirmed", text: p.handle ? `Confirmed by them as @${p.handle}` : "Confirmed by them" };
  if (p.handle) return { tone: "mlyfo", text: `On Mlyfo as @${p.handle}` };
  return { tone: "saved", text: p.created_at ? `Saved by you on ${new Date(p.created_at + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Saved by you" };
}

export default async function People() {
  const u = (await currentUser())!;
  const [list, asks] = await Promise.all([people(u.id), openAsks(u.id)]);
  return (
    <>
      <div className="main-top"><h1>People</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "64ch" }}>The people you pay, and how Mlyfo knows each wallet. Paying by name only ever goes to someone on this list. Shield compares every new address against it to catch look-alikes.</p>

      <div className="people-grid">
        <div className="c">
          <h3>Your people <span className="meta">{list.length}</span></h3>
          <div className="list" data-testid="people-list">
            {list.length === 0 && <div className="empty">No one yet. Add someone by their @username, or ask them for their wallet with a link</div>}
            {list.map((p) => {
              const t = trust(p);
              return (
                <div className="li person-row" key={p.id}>
                  <Avatar name={p.label} />
                  <div>
                    <span className="person-name">{p.label}</span>
                    <small><span className={`trust ${t.tone}`}>{t.text}</span>{p.paid_count > 0 ? ` · paid ${p.paid_count} ${p.paid_count === 1 ? "time" : "times"}` : " · never paid"}</small>
                    <small className="addr">{p.address}</small>
                    {p.changed_days !== null && <small className="changed">Changed their wallet {p.changed_days === 0 ? "today" : `${p.changed_days} days ago`}. Payments to them need your confirmation for now</small>}
                  </div>
                  <RemovePerson id={p.id} name={p.label} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="people-side">
          <div className="c">
            <h3>Add someone</h3>
            <AddPerson />
          </div>
          <div className="c">
            <h3>Ask for their address</h3>
            <p className="sub" style={{ marginTop: 6 }}>The safest way to get someone’s wallet. Send them the link, they confirm their own wallet, and it lands here marked confirmed by them. No one pastes an address into a chat.</p>
            <AskForAddress />
            {asks.length > 0 && <div className="list" style={{ marginTop: 12 }}>
              {asks.map((a) => <div className="li ask-row" key={a.token}><Avatar name={a.label} /><div>{a.label}<small className="addr">/ask/{a.token}</small></div><span className="meta">waiting</span></div>)}
            </div>}
          </div>
        </div>
      </div>
    </>
  );
}
