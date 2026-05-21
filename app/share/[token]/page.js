"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SharedDocumentsPage() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
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
      setStatus("ready");
    }
    load();
  }, [token]);

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
            <h1>Shared Documents</h1>
            <p className="muted">This access consumed one verification credit.</p>
            <div className="grid two" style={{ marginTop: 24 }}>
              {documents.map((document) => (
                <article className="card" key={document.id}>
                  <span className={`badge ${document.status === "active" ? "green" : "red"}`}>{document.status}</span>
                  <h2>{document.document_type}</h2>
                  <p>{document.org_name || "Issuing organization"}</p>
                  <p>Issued {new Date(document.issue_date).toLocaleDateString()}</p>
                  <p style={{ wordBreak: "break-all" }}>Tx: {document.tx_hash || "Pending chain confirmation"}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
