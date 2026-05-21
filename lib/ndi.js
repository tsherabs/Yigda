import QRCode from "qrcode";
import * as nats from "nats";

let cachedToken = null;

export async function createNDIProofRequest() {
  if (process.env.NDI_MODE !== "live") {
    const threadId = `mock-thread-${Date.now()}`;
    const proofRequestURL = `https://mock-ndi.local/yigda-proof/${threadId}`;
    const deepLinkURL = `bhutanndidemo://data?url=${encodeURIComponent(proofRequestURL)}`;
    return {
      proofRequestName: "Yigda Citizen Login",
      proofRequestThreadId: threadId,
      deepLinkURL,
      proofRequestURL,
      qrCodeDataUrl: await QRCode.toDataURL(proofRequestURL, { margin: 1, width: 260 })
    };
  }

  const token = await getNDIAccessToken();
  const endpoint = process.env.NDI_PROOF_REQUEST_URL || "https://demo-client.bhutanndi.com/verifier/v1/proof-request";
  const foundationalSchema =
    process.env.NDI_FOUNDATIONAL_ID_SCHEMA || "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076";

  const payload = {
    proofName: "Yigda Citizen Login",
    proofAttributes: [
      { name: "ID Number", restrictions: [{ schema_name: foundationalSchema }] },
      { name: "Full Name", restrictions: [{ schema_name: foundationalSchema }] },
      { name: "Date of Birth", restrictions: [{ schema_name: foundationalSchema }] }
    ],
    purpose: process.env.NDI_PROOF_PURPOSE || "login",
    authenticationLevel: process.env.NDI_AUTHENTICATION_LEVEL || "Strong",
    isShortenUrl: true
  };

  let json = {};
  let lastError = "NDI proof request failed.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }
    if (response.ok) break;
    lastError = json?.message || json?.error || `NDI proof request failed with HTTP ${response.status}.`;
    if (attempt === 3 || response.status < 500) throw new Error(lastError);
    await new Promise((resolve) => setTimeout(resolve, attempt * 900));
  }

  const data = json.data || json;
  if (!data?.proofRequestThreadId || !data?.proofRequestURL || !data?.deepLinkURL) {
    throw new Error("NDI proof request response did not include a QR/deep-link payload.");
  }

  return {
    proofRequestName: data.proofRequestName || "Yigda Citizen Login",
    proofRequestThreadId: data.proofRequestThreadId,
    deepLinkURL: data.deepLinkURL,
    proofRequestURL: data.proofRequestURL,
    qrCodeDataUrl: await QRCode.toDataURL(data.proofRequestURL, { margin: 1, width: 260 })
  };
}

export async function getNDIProofResult(threadId) {
  if (process.env.NDI_MODE !== "live") {
    if (!String(threadId || "").startsWith("mock-thread-")) {
      throw new Error("Unknown mock proof request thread.");
    }
    return {
      cid: process.env.MOCK_NDI_CID || "11001234567",
      fullName: process.env.MOCK_NDI_FULL_NAME || "Demo Citizen",
      dateOfBirth: process.env.MOCK_NDI_DATE_OF_BIRTH || "",
      raw: { mode: "mock", threadId }
    };
  }

  const payload = await waitForNATSProofResult(threadId);
  return claimsFromProofPayload(payload);
}

async function getNDIAccessToken() {
  if (process.env.NDI_ACCESS_TOKEN) return process.env.NDI_ACCESS_TOKEN;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;

  const tokenUrl = process.env.NDI_TOKEN_URL || "https://staging.bhutanndi.com/authentication/v1/authenticate";
  const clientId = process.env.NDI_CLIENT_ID;
  const clientSecret = process.env.NDI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set NDI_ACCESS_TOKEN or NDI_CLIENT_ID and NDI_CLIENT_SECRET.");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.message || "NDI token request failed.");

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Math.max(Number(json.expires_in || 86400) - 300, 60) * 1000
  };
  return cachedToken.accessToken;
}

async function waitForNATSProofResult(threadId) {
  const servers = [process.env.NDI_NATS_URL || "wss://natsdemoclient.bhutanndi.com"];
  const seed = process.env.NDI_NATS_NKEY_SEED;
  if (!seed) throw new Error("NDI_NATS_NKEY_SEED is required for live NDI proof results.");

  const timeoutMs = Number(process.env.NDI_PROOF_RESULT_TIMEOUT_MS || 45000);
  const nc = await nats.connect({
    servers,
    authenticator: nats.nkeyAuthenticator(new TextEncoder().encode(seed))
  });

  try {
    const sub = nc.subscribe(">");
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.unsubscribe();
        reject(new Error("NDI proof result was not received before timeout."));
      }, timeoutMs);

      void (async () => {
        try {
          for await (const msg of sub) {
            const raw = msg.string();
            let wrap;
            try {
              wrap = JSON.parse(raw);
            } catch {
              continue;
            }

            const inner = wrap?.data?.data || wrap?.data || wrap;
            const pattern = String(wrap.pattern || msg.subject || "");
            const eventThreadId = String(
              inner.thid ||
                inner.threadId ||
                inner.proofRequestThreadId ||
                wrap.thid ||
                wrap.threadId ||
                wrap.proofRequestThreadId ||
                ""
            );
            const matchesThread =
              pattern.includes(threadId) ||
              eventThreadId.includes(threadId) ||
              msg.subject.includes(threadId) ||
              raw.includes(threadId);

            if (
              process.env.NDI_DEBUG_NATS === "true" &&
              (inner.type || pattern.includes("VERIFIER_SERVICE") || matchesThread)
            ) {
              console.log("[NDI NATS]", {
                subject: msg.subject,
                pattern,
                type: inner.type,
                thid: inner.thid,
                verification: inner.verification_result,
                attrKeys: Object.keys(inner?.requested_presentation?.revealed_attrs || {})
              });
            }

            if (!matchesThread) continue;
            if (String(inner.type || "").includes("presentation-result")) {
              const verification = inner.verification_result || inner.verificationResult;
              if (verification && verification !== "ProofValidated") {
                throw new Error(`NDI proof was not validated: ${verification}`);
              }
              clearTimeout(timer);
              sub.unsubscribe();
              resolve(inner);
              return;
            }
          }
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      })();
    });
  } finally {
    await nc.drain();
  }
}

function claimsFromProofPayload(payload) {
  const attrs = payload?.requested_presentation?.revealed_attrs || {};
  const get = (name) => {
    const key = Object.keys(attrs).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    const attr = key ? attrs[key] : undefined;
    const value = Array.isArray(attr) ? attr[0]?.value : attr?.value;
    return String(value || "").trim();
  };

  const cid = get("ID Number");
  if (!cid) throw new Error("NDI proof result did not contain ID Number.");

  return {
    cid,
    fullName: get("Full Name"),
    dateOfBirth: get("Date of Birth"),
    raw: payload
  };
}
