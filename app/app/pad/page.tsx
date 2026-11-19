import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { DEMO } from "@/lib/seed";
import Pad from "@/components/Pad";
import { aiEnabled, MODEL } from "@/lib/ai";
import { people } from "@/lib/queries";

const SCRIPT: Record<string, { opener: string }> = {
  zoya: { opener: "that was so good 😮‍💨 bill was $236 for 4 of us" },
  semi: { opener: "can you send $200 for server costs? usdc on sol 🙏" },
  kabir: { opener: "yo claim free SOL here before it ends https://phantorn-airdrop.app/claim" },
  sofia: { opener: "can you send me $20 for the cab?" },
  ada: { opener: `new wallet, send here pls ${DEMO.adaFake}` },
};

export default async function PadPage() {
  const u = (await currentUser())!;
  const users = await q.all<{ handle: string; name: string; address: string }>("SELECT handle, name, address FROM users WHERE handle IN ('zoya','semi','kabir','sofia','ada') AND id != ?", u.id);
  const order = ["zoya", "semi", "ada", "kabir", "sofia"];
  const demo = users.sort((a, b) => order.indexOf(a.handle) - order.indexOf(b.handle)).map((x) => ({
    key: x.handle, handle: x.handle, name: x.name, opener: SCRIPT[x.handle].opener, payTo: "@" + x.handle, splitName: x.handle,
  }));
  // Your saved people get a chat too, unless they're already one of the demo friends.
  const taken = new Set(users.map((x) => x.address));
  const saved = (await people(u.id)).filter((p) => !taken.has(p.address)).map((p) => ({
    key: "p" + p.id, handle: p.handle ?? p.label, name: p.label, opener: "", payTo: p.label, splitName: p.label, saved: true,
  }));
  const friends = [...demo, ...saved];
  return (
    <>
      <div className="main-top"><h1>Mlyfo Pad</h1></div>
      <Pad friends={friends} me={u.handle} aiModel={aiEnabled() ? MODEL : null} />
    </>
  );
}
