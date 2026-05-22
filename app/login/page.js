"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function LoginPage() {
  const [proof, setProof] = useState(null);
  const [mode, setMode] = useState("mock");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startLogin();
  }, []);

  async function post(url, body = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function startLogin() {
    setBusy(true);
    setError("");
    setStatus("Preparing your NDI login QR code.");
    try {
      const data = await post("/api/ndi/proof-request");
      setProof(data.proof);
      setMode(data.mode);
      setStatus("Scan the QR code with Bhutan NDI Wallet. This page will update after approval.");
      void fetchResult(data.proof);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NDI login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function fetchResult(activeProof = proof) {
    if (!activeProof) return;
    setBusy(true);
    try {
      const data = await post("/api/ndi/proof-result", {
        threadId: activeProof.proofRequestThreadId
      });
      setStatus("NDI login verified. Opening your vault.");
      router.push(data.redirectTo || "/vault");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Proof result is not ready.";
      if (message.includes("not received") || message.includes("timeout")) {
        setStatus("Still waiting for the NDI wallet share. Keep this page open.");
        window.setTimeout(() => fetchResult(activeProof), 1600);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="panel" style={{ maxWidth: 760, margin: "40px auto" }}>
          <span className="badge green">{mode === "live" ? "Live NDI" : "Mock NDI"}</span>
          <h1>Login with NDI</h1>
          <p>Authenticate with Bhutan NDI to open your citizen document vault.</p>

          {!proof ? (
            <button className="button" disabled={busy} onClick={startLogin} style={{ marginTop: 24 }}>
              {busy ? "Preparing NDI login..." : "Create NDI QR Code"}
            </button>
          ) : (
            <div className="grid two" style={{ alignItems: "center", marginTop: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div className="qrFrame">
                  <img src={proof.qrCodeDataUrl} alt="NDI proof request QR code" width="260" height="260" />
                </div>
                <p style={{ marginTop: 14 }}>
                  <a className="button secondary" href={proof.deepLinkURL}>
                    Open NDI Wallet
                  </a>
                </p>
              </div>
              <div>
                <h2>Complete in your wallet</h2>
                <ol className="muted" style={{ lineHeight: 1.8 }}>
                  <li>Open Bhutan NDI Wallet.</li>
                  <li>Scan the QR code or open the wallet link.</li>
                  <li>Approve the requested identity proof.</li>
                  <li>Return here for automatic redirect.</li>
                </ol>
                {mode !== "live" && (
                  <button className="button secondary" disabled={busy} onClick={() => fetchResult(proof)}>
                    Fetch Mock Proof Result
                  </button>
                )}
              </div>
            </div>
          )}

          {status && <div className="status ok">{status}</div>}
          {error && <div className="status error">{error}</div>}
        </section>
      </main>
    </>
  );
}
