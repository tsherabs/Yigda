"use client";

import Navbar from "@/components/Navbar";
import LogoAvatar from "@/components/LogoAvatar";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function shortHash(value) {
  if (!value) return "Pending";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function OrgPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("single");
  const [documentTypes, setDocumentTypes] = useState([]);
  const [issuedDocs, setIssuedDocs] = useState([]);
  const [form, setForm] = useState({ cid: "", documentType: "", issueDate: "" });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [bulkForm, setBulkForm] = useState({ documentType: "", issueDate: "" });
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "org") return router.push("/official-login");
      setUser(me.user);
      await Promise.all([loadPermissions(), loadIssuedDocs()]);
    }
    load();
  }, [router]);

  async function loadPermissions() {
    const data = await fetch("/api/org/permissions").then((response) => response.json());
    setDocumentTypes(data.documentTypes || []);
  }

  async function loadIssuedDocs() {
    const data = await fetch("/api/org/documents").then((response) => response.json());
    setIssuedDocs(data.documents || []);
  }

  async function updateLogo(file) {
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("logo", file);
      const response = await fetch("/api/auth/official/logo", {
        method: "POST",
        body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Logo upload failed.");
      setUser(data.user);
      setMessage("Logo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setLogoBusy(false);
    }
  }

  const selectedType = useMemo(() => {
    if (form.documentType) return form.documentType;
    return documentTypes[0] || "";
  }, [documentTypes, form.documentType]);

  const selectedBulkType = useMemo(() => {
    if (bulkForm.documentType) return bulkForm.documentType;
    return documentTypes[0] || "";
  }, [documentTypes, bulkForm.documentType]);

  async function issueDocument(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!file) return setError("Choose a PDF file first.");
    if (!selectedType) return setError("No permitted document types are assigned to this organization.");

    setBusy(true);
    try {
      const body = new FormData();
      body.append("cid", form.cid);
      body.append("document_type", selectedType);
      body.append("issue_date", form.issueDate);
      body.append("pdf", file);

      const response = await fetch("/api/documents/issue", {
        method: "POST",
        body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Document issue failed.");

      setMessage(
        `Document issued. Fingerprint ${data.document.doc_hash} was recorded for CID ${data.document.cid}. Blockchain confirmation will update shortly.`
      );
      setForm({ cid: "", documentType: "", issueDate: "" });
      setFile(null);
      await loadIssuedDocs();
      setTab("issued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document issue failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeDocument() {
    if (!revokeReason.trim()) return setError("Enter a revocation reason.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${revokeTarget.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Revocation failed.");
      setMessage("Document revoked. Blockchain revocation will update shortly.");
      setRevokeTarget(null);
      setRevokeReason("");
      await loadIssuedDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revocation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function issueBulk(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBulkResults(null);
    if (!bulkFile) return setError("Choose a ZIP file first.");
    if (!selectedBulkType) return setError("No permitted document types are assigned to this organization.");

    setBusy(true);
    try {
      const body = new FormData();
      body.append("document_type", selectedBulkType);
      body.append("issue_date", bulkForm.issueDate);
      body.append("zip", bulkFile);

      const response = await fetch("/api/documents/issue/bulk", {
        method: "POST",
        body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bulk issue failed.");
      setBulkResults(data);
      setMessage(`${data.success.length} documents issued. ${data.errors.length} files need attention.`);
      await loadIssuedDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk issue failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="orgPage">
        <div className="orgHeader">
          <div className="identityRow">
            <LogoAvatar src={user?.logoUrl} name={user?.name} />
            <div>
              <h1>Organization Portal</h1>
              {user && <p>{user.name}</p>}
              <label className="logoUploader">
                <span className="orgSecondaryButton">{logoBusy ? "Uploading..." : "Change Logo"}</span>
                <input
                  disabled={logoBusy}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => updateLogo(event.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="orgTabs">
          <button className={tab === "single" ? "active" : ""} onClick={() => setTab("single")}>
            Issue Single
          </button>
          <button className={tab === "bulk" ? "active" : ""} onClick={() => setTab("bulk")}>
            Bulk Issue (ZIP)
          </button>
          <button className={tab === "issued" ? "active" : ""} onClick={() => setTab("issued")}>
            Issued Documents
          </button>
        </div>

        {message && <div className="orgStatus ok">{message}</div>}
        {error && <div className="orgStatus error">{error}</div>}

        {tab === "single" && (
          <form className="orgIssuePanel" onSubmit={issueDocument}>
            <label>
              Student CID
              <input
                value={form.cid}
                onChange={(event) => setForm({ ...form, cid: event.target.value })}
                placeholder="11001234567"
                required
              />
            </label>

            <label>
              Document Type
              <select
                value={selectedType}
                onChange={(event) => setForm({ ...form, documentType: event.target.value })}
                required
              >
                <option value="">Select type...</option>
                {documentTypes.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Issue Date
              <input
                type="date"
                value={form.issueDate}
                onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                required
              />
            </label>

            <label>
              PDF File
              <input
                key={file ? "file-selected" : "file-empty"}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </label>

            <button className="orgPrimaryButton" disabled={busy || !documentTypes.length}>
              {busy ? "Issuing..." : "Issue Document"}
            </button>

            {!documentTypes.length && (
              <p className="orgHint">Admin must assign document types before this organization can issue documents.</p>
            )}
          </form>
        )}

        {tab === "bulk" && (
          <form className="orgIssuePanel" onSubmit={issueBulk}>
            <p className="orgHint">
              Put PDF files inside a ZIP. Each PDF filename must be the citizen CID, for example <code>11001234567.pdf</code>.
            </p>

            <label>
              Document Type
              <select
                value={selectedBulkType}
                onChange={(event) => setBulkForm({ ...bulkForm, documentType: event.target.value })}
                required
              >
                <option value="">Select type...</option>
                {documentTypes.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Issue Date
              <input
                type="date"
                value={bulkForm.issueDate}
                onChange={(event) => setBulkForm({ ...bulkForm, issueDate: event.target.value })}
                required
              />
            </label>

            <label>
              ZIP File
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(event) => setBulkFile(event.target.files?.[0] || null)}
                required
              />
            </label>

            <button className="orgPrimaryButton" disabled={busy || !documentTypes.length}>
              {busy ? "Processing ZIP..." : "Bulk Issue Documents"}
            </button>

            {bulkResults && (
              <div className="orgBulkResults">
                <strong>Results</strong>
                <p>{bulkResults.success.length} issued successfully</p>
                {bulkResults.errors.length > 0 && (
                  <div>
                    <p>{bulkResults.errors.length} errors</p>
                    {bulkResults.errors.map((item, index) => (
                      <p key={`${item.file}-${index}`}>
                        <code>{item.file}</code>: {item.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}

        {tab === "issued" && (
          <section className="orgIssuedPanel">
            {issuedDocs.length === 0 ? (
              <div className="orgEmpty">
                <h2>No documents issued yet</h2>
                <p>Issued documents will appear here with their fingerprint and blockchain transaction status.</p>
              </div>
            ) : (
              issuedDocs.map((doc) => (
                <article className="orgDocRow" key={doc.id}>
                  <div>
                    <div className="orgDocTitle">
                      <strong>{doc.document_type}</strong>
                      <span className={doc.status === "active" ? "orgBadge green" : "orgBadge red"}>{doc.status}</span>
                    </div>
                    <p>CID: {doc.cid} · Issued {new Date(doc.issue_date).toLocaleDateString()}</p>
                    <p>Fingerprint: <code>{shortHash(doc.doc_hash)}</code></p>
                    <p>Blockchain: <code>{doc.tx_hash ? shortHash(doc.tx_hash) : "Pending Sepolia confirmation"}</code></p>
                  </div>
                  <div className="orgDocActions">
                    <a className="orgSecondaryButton" href={`/api/documents/${doc.id}/download`}>
                      Download PDF
                    </a>
                    {doc.status === "active" && (
                      <button className="orgDangerButton" onClick={() => setRevokeTarget(doc)}>
                        Revoke
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </main>

      {revokeTarget && (
        <div className="modalBackdrop">
          <div className="modal">
            <h2>Revoke {revokeTarget.document_type}</h2>
            <p className="muted">This marks the document as revoked immediately and sends a revocation transaction in the background.</p>
            <label className="label" style={{ marginTop: 16 }}>
              Reason
              <textarea
                className="textarea"
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                placeholder="Reason for revocation"
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="button danger" disabled={busy} onClick={revokeDocument}>
                Revoke
              </button>
              <button className="button secondary" onClick={() => setRevokeTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
