"use client";

import Navbar from "@/components/Navbar";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ShareContent() {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "citizen") return router.push("/");
      const data = await fetch("/api/documents/vault").then((response) => response.json());
      const active = (data.documents || []).filter((document) => document.status === "active");
      setDocuments(active);
      const docId = searchParams.get("docId");
      if (docId) setSelected([docId]);
    }
    load();
  }, [router, searchParams]);

  function toggle(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function generate() {
    setError("");
    const response = await fetch("/api/share/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: selected, expiresInDays })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Failed to create link.");
    setLink(data.link);
  }

  return (
    <>
      <Navbar />
      <main className="page" style={{ maxWidth: 820 }}>
        <h1>Share Documents</h1>
        <p className="muted">Choose exactly which active documents a subscribed company can view.</p>

        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Select Documents</h2>
          <div className="checkGrid">
            {documents.length === 0 && <p>No active documents available to share.</p>}
            {documents.map((document) => (
              <label className="checkRow" key={document.id}>
                <input type="checkbox" checked={selected.includes(document.id)} onChange={() => toggle(document.id)} />
                <span>{document.document_type} from {document.org_name || "organization"}</span>
              </label>
            ))}
          </div>
          <label className="label">
            Link expires in
            <select className="select" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button className="button" disabled={!selected.length} onClick={generate} style={{ marginTop: 18 }}>
            Generate Share Link
          </button>
        </section>

        {error && <div className="status error">{error}</div>}
        {link && (
          <section className="panel" style={{ marginTop: 18 }}>
            <h2>Share link ready</h2>
            <p style={{ wordBreak: "break-all" }}>{link}</p>
            <button className="button secondary" style={{ marginTop: 14 }} onClick={() => navigator.clipboard.writeText(link)}>
              Copy Link
            </button>
          </section>
        )}
      </main>
    </>
  );
}

export default function VaultSharePage() {
  return (
    <Suspense>
      <ShareContent />
    </Suspense>
  );
}
