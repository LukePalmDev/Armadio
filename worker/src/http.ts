const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "cdn-cache-control": "no-store",
};

export function json(data: unknown, status = 200, version?: string | null): Response {
  const headers = new Headers(BASE_HEADERS);
  if (version) headers.set("etag", `"${version}"`);
  return new Response(JSON.stringify(data), { status, headers });
}

export function empty(status: number): Response {
  return new Response(null, {
    status,
    headers: { "cache-control": "no-store", "cdn-cache-control": "no-store" },
  });
}
