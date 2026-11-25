import type { InStatement } from "@libsql/client";
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
  // Ada's wallet on Ethereum and Base, a poisoned look-alike of it, and an EVM scam-list address.
  adaEvm: "0x7A3F9C2E41Bd08F6A5e19c3D7B24af60E8D1C4b9",
  adaEvmFake: "0x7a3f9cE5b801Dd3fA7426C9e0B1f8a5d3e27c4b9",
  scamEvm: "0x5cA1ab1e9D7E2A4b6C8d0E1f3A5b7C9d0E2F4B1d",
};

const people: [string, string, string][] = [
  ["Ada Okafor", "ada", DEMO.ada],
  ["Kabir Shah", "kabir", "KabR3mXc9vP2wLq7TnB4sYzH8fJe6GdN1oUa5Mk2Fy7"],
  ["Zoya Malik", "zoya", "ZoyA8nQ2vRm9xLwT4pBc7ZsY3hJfUe6GdN1oPq5Mb3G"],
  ["Sofía Ruiz", "sofia", "SofR2kP9vQm8xLwT3nBc7ZsY4hJfUe6GdN1oPq5Mc4H"],
  ["Semi Adeyemi", "semi", "SemJ5tQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Md5K"],
];

/** Demo data as one batch. The demo user is id 1, the people are 2–6 in order. */
export function seed(): InStatement[] {
  const pw = hashPassword(DEMO.password);
  const U = "INSERT INTO users (id,name,email,handle,password_hash,address,balance_cents) VALUES (?,?,?,?,?,?,?)";
  const s: InStatement[] = [{ sql: U, args: [1, "Demo Judge", DEMO.email, "demo", pw, "DemoJ7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Mz9W", 100000] }];
  people.forEach(([name, handle, addr], i) => s.push({ sql: U, args: [i + 2, name, `${handle}@mlyfo.app`, handle, pw, addr, 50000] }));
  const C = "INSERT INTO contacts (user_id,label,address,emoji) VALUES (1,?,?,?)";
  s.push({ sql: C, args: ["Ada", DEMO.ada, "🎁"] }, { sql: C, args: ["Kabir", people[1][2], "🚗"] }, { sql: C, args: ["Zoya", people[2][2], "🍝"] }, { sql: C, args: ["Semi", people[4][2], "🏆"] }, { sql: C, args: ["Ada (Base)", DEMO.adaEvm, "🎁"] });
  // A prior payment so Ada and Kabir count as known recipients.
  const P = "INSERT INTO payments (from_user,to_address,to_user,amount_cents,note,status,created_at) VALUES (1,?,?,?,?, 'sent', datetime('now','-2 days'))";
  s.push({ sql: P, args: [DEMO.ada, 2, 4000, "Birthday gift"] }, { sql: P, args: [people[1][2], 3, 1500, "Fuel"] });
  return s;
}
