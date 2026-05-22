"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

function statusClass(status) {
  if (status === "VERIFIED") return "green";
  if (status === "REVOKED") return "gold";
  return "red";
}

function resultFor(results, documentId) {
  return results?.documents?.find((document) => document.id === documentId) || null;
}

export default function SharedDocumentsPage() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [documents, setDocuments] = useState([]);
  const [verification, setVerification] = useState(null);
  const [verificationInfo, setVerificationInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "company") {
        setStatus("login");
        return;
      }
      const response = await fetch(`/api/share/${token}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to open share link.");
        setStatus(response.status === 403 ? "subscription" : "error");
        return;
      }
      setDocuments(data.documents || []);
      setVerificationInfo(data.verification || null);
      setStatus("ready");
    }
    load();
  }, [router, token]);

  const requiredCredits = useMemo(
    () => verificationInfo?.requiredCredits ?? documents.length,
    [documents.length, verificationInfo]
  );

  async function verifySharedDocuments() {
    setBusy(true);
    setError("");
    setVerification(null);
    try {
      const response = await fetch(`/api/share/${token}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403 && data.action === "subscribe") router.push("/company");
        throw new Error(data.error || "Shared document verification failed.");
      }
      setVerification(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shared document verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="page" style={{ maxWidth: 900 }}>
        {status === "loading" && <section className="panel">Loading shared documents...</section>}

        {status === "login" && (
          <section className="panel">
            <h1>Company Login Required</h1>
            <p>Only subscribed verifier companies can open shared document links.</p>
            <button className="button" onClick={() => router.push("/official-login")} style={{ marginTop: 16 }}>
              Official Login
            </button>
          </section>
        )}

        {status === "subscription" && (
          <section className="panel">
            <h1>Subscription Required</h1>
            <p>{error}</p>
            <button className="button" onClick={() => router.push("/company")} style={{ marginTop: 16 }}>
              View Plans
            </button>
          </section>
        )}

        {status === "error" && (
          <section className="panel">
            <h1>Share Link Unavailable</h1>
            <p>{error}</p>
          </section>
        )}

        {status === "ready" && (
          <>
            <div className="dashboardHeader">
              <div>
                <h1>Shared Documents</h1>
                <p className="muted">
                  Review the shared documents first. Credits are used only after verification.
                </p>
              </div>
              <span className="badge green">{documents.length} shared</span>
            </div>

            <div className="grid two" style={{ marginTop: 24 }}>
              {documents.map((document) => {
                const result = resultFor(verification, document.id);
                return (
                  <article className="card" key={document.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span className={`badge ${document.status === "active" ? "green" : "red"}`}>
                        {document.status}
                      </span>
                      {result && <span className={`badge ${statusClass(result.status)}`}>{result.status}</span>}
                    </div>
                    <h2>{document.document_type}</h2>
                    <p>{document.org_name || "Issuing organization"}</p>
                    <p>Issued {new Date(document.issue_date).toLocaleDateString()}</p>
                    <p>CID {document.cid}</p>
                    <p style={{ wordBreak: "break-all" }}>Fingerprint: {document.doc_hash}</p>
                    <p style={{ wordBreak: "break-all" }}>Tx: {document.tx_hash || "Pending chain confirmation"}</p>
                    {result && (
                      <div className={`status ${result.status === "VERIFIED" ? "ok" : "error"}`}>
                        {result.status === "VERIFIED" && "The fingerprint matched an issued document."}
                        {result.status === "REVOKED" && `Document revoked. ${result.revokedReason || ""}`}
                        {result.status === "NOT_VERIFIED" && "This fingerprint was not verified on Yigda."}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="panel" style={{ marginTop: 24, textAlign: "center" }}>
              <p>
                This will use <strong>{requiredCredits}</strong> verification credit
                {requiredCredits === 1 ? "" : "s"}.
              </p>
              {verificationInfo?.remainingCredits !== null && verificationInfo?.remainingCredits !== undefined && (
                <p className="muted">Credits remaining before verification: {verificationInfo.remainingCredits}</p>
              )}
              <button
                className="button"
                disabled={busy || !documents.length || Boolean(verification)}
                onClick={verifySharedDocuments}
                style={{ marginTop: 16 }}
              >
                {busy ? "Verifying..." : "Click to Verify"}
              </button>
              {verification && (
                <div className="status ok">
                  {verification.creditsUsed} verification credit
                  {verification.creditsUsed === 1 ? "" : "s"} used.
                  {verification.remainingCredits !== null && ` ${verification.remainingCredits} remaining.`}
                </div>
              )}
              {error && <div className="status error">{error}</div>}
            </section>
          </>
        )}
      </main>
    </>
  );
}
