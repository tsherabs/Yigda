"use client";

export default function DocumentCard({ document, onShare }) {
  async function download() {
    const response = await fetch(`/api/documents/${document.id}/download`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Download failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.document_type}.pdf`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3>{document.document_type}</h3>
          <p>{document.org_name || "Issuing organization"}</p>
        </div>
        <span className={`badge ${document.status === "active" ? "green" : "red"}`}>{document.status}</span>
      </div>
      <p style={{ marginTop: 12 }}>Issued {new Date(document.issue_date).toLocaleDateString()}</p>
      {document.status === "revoked" && <div className="status error">Revoked: {document.revoke_reason}</div>}
      {document.status === "active" && (
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="button secondary" onClick={download} type="button">
            Download
          </button>
          <button className="button" onClick={() => onShare(document)} type="button">
            Share
          </button>
        </div>
      )}
    </article>
  );
}
