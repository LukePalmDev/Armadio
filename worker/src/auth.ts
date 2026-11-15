import { createRemoteJWKSet, jwtVerify } from "jose";
import { json } from "./http";

export const TEAM_DOMAIN = "https://empty-pond-1e04.cloudflareaccess.com";
export const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;

// createRemoteJWKSet caches fetched keys in memory and refreshes on an unknown kid.
const JWKS = createRemoteJWKSet(new URL(CERTS_URL), {
  cacheMaxAge: 60 * 60 * 1000,
  cooldownDuration: 30_000,
  timeoutDuration: 5_000,
});

export interface AccessIdentity {
  email: string;
  sub: string;
}

/** Empty or whitespace means "no email allowlist". */
export function parseAllowlist(raw: string | undefined): Set<string> | null {
  const emails = (raw ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  return emails.length > 0 ? new Set(emails) : null;
}

function forbidden(reason: string): Response {
  return json({ error: "forbidden", reason }, 403);
}

/**
 * Verify the Cloudflare Access assertion. Returns the identity, or a 403 Response.
 * Checks RS256 against the team certs, issuer, expiry, and ACCESS_AUD.
 */
export async function authenticate(request: Request, env: Env): Promise<AccessIdentity | Response> {
  const audience = (env.ACCESS_AUD ?? "").trim();
  if (!audience) {
    console.error(JSON.stringify({ message: "jwt rejected", reason: "audience_unconfigured" }));
    return forbidden("audience_unconfigured");
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return forbidden("missing_token");

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: TEAM_DOMAIN,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 0,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const allow = parseAllowlist(env.ALLOWED_EMAILS);
    if (allow && !allow.has(email)) {
      console.error(JSON.stringify({ message: "jwt rejected", reason: "email_not_allowed" }));
      return forbidden("email_not_allowed");
    }
    return { email, sub: typeof payload.sub === "string" ? payload.sub : "" };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    let reason = "invalid_token";
    if (code === "ERR_JWT_EXPIRED") reason = "expired";
    else if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || code === "ERR_JWS_INVALID") reason = "forged";
    else if (code.startsWith("ERR_JWT_CLAIM") || code === "ERR_JWT_INVALID") reason = "bad_claims";
    console.error(JSON.stringify({ message: "jwt rejected", reason, code }));
    return forbidden(reason);
  }
}
