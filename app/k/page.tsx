import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

/**
 * Hand-off from the Mlyfo Android keyboard. The keyboard reads what you type in any app,
 * then opens this link to finish the action in Mlyfo:
 *   /k?text=pay%20%40kabir%2010   → the Pad with that message typed, so its card shows
 *   /k?address=AdaK9z…            → Shield with that address checked
 * Signed-out users sign in first and land back on the same action.
 */
export default async function KeyboardHandoff({ searchParams }: { searchParams: Promise<{ text?: string; address?: string }> }) {
  const { text, address } = await searchParams;
  const target = address
    ? `/app/shield?address=${encodeURIComponent(address.slice(0, 64))}`
    : text
      ? `/app/pad?text=${encodeURIComponent(text.slice(0, 280))}`
      : "/app/pad";
  if (!(await currentUser())) redirect(`/signin?next=${encodeURIComponent(target)}`);
  redirect(target);
}
