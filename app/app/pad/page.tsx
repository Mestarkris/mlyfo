import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { DEMO } from "@/lib/seed";
import Pad from "@/components/Pad";

const SCRIPT: Record<string, { emoji: string; opener: string }> = {
  zoya: { emoji: "🍝", opener: "that was so good 😮‍💨 bill was $236 for 4 of us" },
  semi: { emoji: "🏆", opener: "can you send $200 for server costs? usdc on sol 🙏" },
  kabir: { emoji: "🚗", opener: "yo claim free SOL here before it ends https://phantorn-airdrop.app/claim" },
  sofia: { emoji: "🌊", opener: "can you send me $20 for the cab?" },
  ada: { emoji: "🎁", opener: `new wallet, send here pls ${DEMO.adaFake}` },
};

export default async function PadPage() {
  const u = (await currentUser())!;
  const users = await q.all<{ handle: string; name: string }>("SELECT handle, name FROM users WHERE handle IN ('zoya','semi','kabir','sofia','ada') AND id != ?", u.id);
  const order = ["zoya", "semi", "ada", "kabir", "sofia"];
  const friends = users.sort((a, b) => order.indexOf(a.handle) - order.indexOf(b.handle)).map((x) => ({ ...x, ...SCRIPT[x.handle] }));
  return (
    <>
      <div className="main-top"><h1>Mlyfo Pad</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "64ch" }}>This is the Mlyfo keyboard running in your browser. Pick a chat, and the keyboard suggests an action from what they sent or what you type. Every action is real: it moves demo USDC, creates links and runs Shield.</p>
      <Pad friends={friends} me={u.handle} />
    </>
  );
}
