import type {
  CheckResult,
  Env,
  LayerResult,
  ReachabilityResult,
  Status,
} from "./types";

const SIGAA_URL = "https://sigaa.ufpb.br/sigaa/verTelaLogin.do";
const PORTAL_URL = "https://sigaa.ufpb.br/publico/";
const PORTAL_ORIGIN = "https://sigaa.ufpb.br";
const BUNDLE_REGEX = /\/publico\/assets\/[a-zA-Z0-9._-]+\.js/;
const LOGIN_FORM_URL = "https://sigaa.ufpb.br/sigaa/logon.jsf";
const USER_AGENT = "sigaa-caiu-monitor/1.0";

const TIMEOUT_MS = 30_000;
const THRESHOLD_DEGRADED_MS = 10_000;
const RETRY_DELAY_MS = 3_000;
const MAX_RETRIES = 2;

export async function performHealthCheck(
  env: Env,
  shouldRunE2E: boolean
): Promise<CheckResult> {
  const reachability = await checkReachability();

  // Short-circuit higher layers when the host isn't even reachable — no point
  // probing the SPA/login form, and saves time/load on a degraded SIGAA.
  if (reachability.status === "offline") {
    return assemble(reachability, skipped(), skipped(), skipped());
  }

  const [portal, loginForm] = await Promise.all([
    checkPortal(),
    checkLoginForm(),
  ]);

  let loginE2e: LayerResult;
  if (!shouldRunE2E) {
    loginE2e = skipped();
  } else if (!env.SIGAA_MONITOR_USER || !env.SIGAA_MONITOR_PASS) {
    loginE2e = skipped();
  } else {
    loginE2e = await checkLoginE2E(env.SIGAA_MONITOR_USER, env.SIGAA_MONITOR_PASS);
  }

  return assemble(reachability, portal, loginForm, loginE2e);
}

function assemble(
  reachability: ReachabilityResult,
  portal: LayerResult,
  loginForm: LayerResult,
  loginE2e: LayerResult
): CheckResult {
  const overall = deriveOverall(reachability, portal, loginForm, loginE2e);

  // The top-level `error` mirrors whichever layer drove the failure, most specific wins.
  const overallError =
    reachability.status === "offline"
      ? reachability.error
      : portal.status === "offline"
        ? portal.error
        : loginForm.status === "offline"
          ? loginForm.error
          : loginE2e.status === "offline"
            ? loginE2e.error
            : reachability.error; // carries "degraded" slow-response context if any

  return {
    status: overall,
    httpCode: reachability.httpCode,
    responseTimeMs: reachability.responseTimeMs,
    error: overallError,
    reachability,
    portal,
    loginForm,
    loginE2e,
  };
}

export function deriveOverall(
  reachability: ReachabilityResult,
  portal: LayerResult,
  loginForm: LayerResult,
  loginE2e: LayerResult
): Status {
  if (reachability.status === "offline") return "offline";
  if (portal.status === "offline") return "offline";
  if (loginForm.status === "offline") return "offline";
  if (loginE2e.status === "offline") return "offline";
  if (reachability.status === "degraded") return "degraded";
  return "online";
}

// --- Layer 1: reachability ---

async function checkReachability(): Promise<ReachabilityResult> {
  let result = await singleReachability();

  if (result.status === "offline") {
    for (let i = 0; i < MAX_RETRIES; i++) {
      await sleep(RETRY_DELAY_MS);
      const retry = await singleReachability();
      if (retry.status !== "offline") return retry;
      result = retry;
    }
  }

  return result;
}

async function singleReachability(): Promise<ReachabilityResult> {
  const start = Date.now();
  try {
    const res = await fetch(SIGAA_URL, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    const responseTimeMs = Date.now() - start;
    const status = determineReachabilityStatus(res.status, responseTimeMs);

    return {
      status,
      httpCode: res.status,
      responseTimeMs,
      error: null,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "offline",
      httpCode: null,
      responseTimeMs,
      error: message,
    };
  }
}

function determineReachabilityStatus(httpCode: number, responseTimeMs: number): Status {
  const isExpected = httpCode === 302 || httpCode === 200;
  if (!isExpected || httpCode >= 500) return "offline";
  if (responseTimeMs >= THRESHOLD_DEGRADED_MS) return "degraded";
  return "online";
}

// --- Layer 2: public portal SPA ---

async function checkPortal(): Promise<LayerResult> {
  try {
    const res = await fetch(PORTAL_URL, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    if (res.status !== 200) return { status: "offline", error: `portal_http_${res.status}` };

    const body = await res.text();

    if (!body.includes('id="root"')) {
      return { status: "offline", error: "portal_html_missing_root" };
    }

    const match = body.match(BUNDLE_REGEX);
    if (!match) {
      return { status: "offline", error: "portal_html_missing_bundle" };
    }

    const bundleRes = await fetch(PORTAL_ORIGIN + match[0], {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    if (bundleRes.status !== 200) {
      return { status: "offline", error: `portal_bundle_http_${bundleRes.status}` };
    }

    return { status: "online", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "offline", error: `portal_fetch_error: ${message}` };
  }
}

// --- Layer 3: JSF login form renders ---

async function checkLoginForm(): Promise<LayerResult> {
  try {
    const res = await fetch(LOGIN_FORM_URL, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    if (res.status !== 200) return { status: "offline", error: `login_form_http_${res.status}` };

    const body = await res.text();

    if (!body.includes('name="javax.faces.ViewState"')) {
      return { status: "offline", error: "login_form_missing_viewstate" };
    }

    if (!body.includes('name="form:login"') || !body.includes('name="form:senha"')) {
      return { status: "offline", error: "login_form_missing_inputs" };
    }

    if (!body.includes('action="/sigaa/logon.jsf')) {
      return { status: "offline", error: "login_form_wrong_action" };
    }

    return { status: "online", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "offline", error: `login_form_fetch_error: ${message}` };
  }
}

// --- Layer 4: end-to-end login with real credentials ---

async function checkLoginE2E(user: string, pass: string): Promise<LayerResult> {
  try {
    // Step 1: bogus login — should be rejected fast. A slow rejection
    // signals auth-backend stress even if it's technically alive.
    const bogusResult = await attemptLogin("sigaa_monitor_bogus_" + Date.now(), "wrong_password_xyz");
    if (bogusResult.error === "prelogin_failed") {
      return { status: "offline", error: `e2e_prelogin_http_${bogusResult.detail}` };
    }
    if (bogusResult.error === "prelogin_missing_viewstate") {
      return { status: "offline", error: "e2e_missing_viewstate" };
    }
    if (bogusResult.error === "prelogin_missing_action") {
      return { status: "offline", error: "e2e_missing_action" };
    }
    if (bogusResult.outcome !== "rejected") {
      // Bogus creds weren't rejected as expected — auth is broken.
      return { status: "offline", error: `e2e_bogus_unexpected: ${bogusResult.outcome}` };
    }
    if (bogusResult.durationMs > THRESHOLD_DEGRADED_MS) {
      // Auth backend took too long to reject garbage creds — stressed.
      return { status: "degraded", error: `e2e_bogus_login_slow_${bogusResult.durationMs}ms` };
    }

    // Step 2: real login — should succeed.
    const realResult = await attemptLogin(user, pass);
    if (realResult.outcome === "success") {
      return { status: "online", error: null };
    }
    if (realResult.outcome === "rejected") {
      return { status: "offline", error: "e2e_login_rejected" };
    }
    return { status: "offline", error: `e2e_login_${realResult.outcome}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { status: "offline", error: `e2e_login_fetch_error: ${message}` };
  }
}

interface LoginAttempt {
  outcome: "success" | "rejected" | string;
  durationMs: number;
  error?: string;
  detail?: string;
}

async function attemptLogin(user: string, pass: string): Promise<LoginAttempt> {
  const start = Date.now();

  // GET login page for a fresh session.
  const getRes = await fetch(LOGIN_FORM_URL, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });

  if (getRes.status !== 200) {
    return { outcome: "prelogin_failed", durationMs: Date.now() - start, error: "prelogin_failed", detail: String(getRes.status) };
  }

  const loginHtml = await getRes.text();
  const viewStateMatch = loginHtml.match(
    /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/
  );
  if (!viewStateMatch) {
    return { outcome: "prelogin_missing_viewstate", durationMs: Date.now() - start, error: "prelogin_missing_viewstate" };
  }

  const actionMatch = loginHtml.match(
    /action="(\/sigaa\/logon\.jsf[^"]*)"/
  );
  if (!actionMatch) {
    return { outcome: "prelogin_missing_action", durationMs: Date.now() - start, error: "prelogin_missing_action" };
  }

  const postUrl = PORTAL_ORIGIN + actionMatch[1];
  const setCookies = getSetCookieHeaders(getRes);
  const cookieHeader = buildCookieHeader(setCookies);

  const body = new URLSearchParams({
    form: "form",
    "form:width": "1920",
    "form:height": "1080",
    "form:login": user,
    "form:senha": pass,
    "form:entrar": "Entrar",
    "javax.faces.ViewState": viewStateMatch[1],
  });

  const postRes = await fetch(postUrl, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: LOGIN_FORM_URL,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: body.toString(),
  });

  const durationMs = Date.now() - start;

  // 302 to discente portal = success.
  if (postRes.status === 302) {
    const location = postRes.headers.get("location") || "";
    if (location.includes("/portal/discente") || location.includes("/portais/discente")) {
      return { outcome: "success", durationMs };
    }
    return { outcome: `unexpected_redirect_${location}`, durationMs };
  }

  // 200 = stayed on login page.
  if (postRes.status === 200) {
    const respBody = await postRes.text();
    if (respBody.includes("inv&#225;lidos") || respBody.includes("inválidos")) {
      return { outcome: "rejected", durationMs };
    }
    return { outcome: "unexpected_200", durationMs };
  }

  return { outcome: `unexpected_http_${postRes.status}`, durationMs };
}

function getSetCookieHeaders(res: Response): string[] {
  // Workers doesn't expose getSetCookie(); fall back to the concatenated header.
  // SIGAA sets plain session cookies without internal commas, so splitting is safe.
  const raw = res.headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
}

function buildCookieHeader(setCookies: string[]): string {
  const pairs = setCookies.map((c) => c.split(";")[0].trim()).filter(Boolean);
  return pairs.join("; ");
}

// --- Helpers ---

function skipped(): LayerResult {
  return { status: "skipped", error: null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
