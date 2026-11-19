export async function api<T = any>(url: string, method = "POST", data?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  let j: any = {};
  try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data: j };
}
