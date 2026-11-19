import Icon from "@/components/Icon";
import { currentUser } from "@/lib/auth";
import { contacts, linkScans } from "@/lib/queries";
import Link from "next/link";
import { AddressCheck, LinkScan } from "@/components/ShieldTools";

export default async function Shield() {
  const u = (await currentUser())!;
  const [cs, scans] = await Promise.all([contacts(u.id), linkScans(u.id)]);
  return (
    <>
      <div className="main-top"><h1>Shield</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "62ch" }}>Shield checks every address and link before money moves. Saved contacts are how it spots a look-alike, so save the people you pay often.</p>
      <div className="grid">
        <div className="c span2"><h3>Check an address</h3><AddressCheck /></div>
        <div className="c"><h3>Try these</h3>
          <div className="sub" style={{ marginTop: 8 }}>A look-alike of Ada (demo account):</div>
          <div className="addr">AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx</div>
          <div className="sub" style={{ marginTop: 8 }}>A scam-list address:</div>
          <div className="addr">ScAm1111DrainerXYZbad9pLmQ8rTvB3nYc7HsP4kJe6</div>
        </div>
        <div className="c span2" style={{ gridColumn: "1 / -1" }}><h3>Scan a link</h3>
          <p className="sub" style={{ marginTop: 6 }}>Quick check looks at the address. Deep scan has Kane open the page in a real browser and report whether it asks for your seed phrase or wallet.</p>
          <LinkScan enabled={!!u.shield_links} />
          {scans.length > 0 && <div className="list" style={{ marginTop: 16 }}>
            {scans.map((s) => (
              <div className="li" key={s.id}><span className="ava"><Icon name="link" /></span>
                <div className="addr" style={{ fontFamily: "inherit" }}>{s.url}<small>{s.source === "kane" ? "Deep scan by Kane" : "Quick check"}</small></div>
                <span className={`verdict ${s.verdict}`}>{s.verdict}</span></div>
            ))}
          </div>}
        </div>
        <div className="c" style={{ gridColumn: "1 / -1" }}><h3>Saved people <Link href="/app/people">Manage people</Link></h3>
          <p className="sub" style={{ marginTop: 6 }}>Shield compares every new address with the {cs.length} {cs.length === 1 ? "person" : "people"} you’ve saved to catch look-alikes. Add and check people on the People page.</p>
        </div>
      </div>
    </>
  );
}
