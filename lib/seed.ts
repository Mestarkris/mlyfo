import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./crypto";

/** Fixed demo addresses so Kane tests and the README can reference them. */
export const DEMO = {
  email: "demo@mlyfo.app",
  password: "mlyfo-demo-2026",
  ada: "AdaK7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Ma2Fx",
  // Poisoned look-alike of Ada: same first 4 and last 4 characters.
  adaFake: "AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx",
  // On the built-in scam list.
  scam: "ScAm1111DrainerXYZbad9pLmQ8rTvB3nYc7HsP4kJe6",
};

const people: [string, string, string][] = [
  ["Ada Okafor", "ada", DEMO.ada],
  ["Kabir Shah", "kabir", "KabR3mXc9vP2wLq7TnB4sYzH8fJe6GdN1oUa5Mk2Fy7"],
  ["Zoya Malik", "zoya", "ZoyA8nQ2vRm9xLwT4pBc7ZsY3hJfUe6GdN1oPq5Mb3G"],
  ["Sofía Ruiz", "sofia", "SofR2kP9vQm8xLwT3nBc7ZsY4hJfUe6GdN1oPq5Mc4H"],
  ["Semi Adeyemi", "semi", "SemJ5tQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Md5K"],
];

export function seed(d: DatabaseSync) {
  const insUser = d.prepare(
    "INSERT INTO users (name,email,handle,password_hash,address,balance_cents) VALUES (?,?,?,?,?,?)",
  );
  const pw = hashPassword(DEMO.password);
  const r = insUser.run("Demo Judge", DEMO.email, "demo", pw, "DemoJ7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Mz9W", 100000);
  const demoId = Number(r.lastInsertRowid);
  for (const [name, handle, addr] of people) {
    insUser.run(name, `${handle}@mlyfo.app`, handle, pw, addr, 50000);
  }
  const insC = d.prepare("INSERT INTO contacts (user_id,label,address,emoji) VALUES (?,?,?,?)");
  insC.run(demoId, "Ada", DEMO.ada, "🎁");
  insC.run(demoId, "Kabir", people[1][2], "🚗");
  insC.run(demoId, "Zoya", people[2][2], "🍝");
  insC.run(demoId, "Semi", people[4][2], "🏆");
  // A prior payment so Ada and Kabir count as known recipients.
  const insP = d.prepare(
    "INSERT INTO payments (from_user,to_address,to_user,amount_cents,note,status,created_at) VALUES (?,?,?,?,?, 'sent', datetime('now','-2 days'))",
  );
  insP.run(demoId, DEMO.ada, 2, 4000, "Birthday gift");
  insP.run(demoId, people[1][2], 3, 1500, "Fuel");
}
