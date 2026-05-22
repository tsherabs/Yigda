"use client";

import { useState } from "react";

export default function DocumentCard({ document, onShare }) {
  const [downloadState, setDownloadState] = useState("idle");
  const [downloadError, setDownloadError] = useState("");

  async function download() {
    setDownloadState("preparing");
    setDownloadError("");
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Download failed.");
      }
      setDownloadState("saving");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${document.document_type}.pdf`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadState("done");
      setTimeout(() => setDownloadState("idle"), 1800);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed.");
      setDownloadState("idle");
    }
  }

  const isDownloading = downloadState === "preparing" || downloadState === "saving";
  const downloadLabel =
    downloadState === "preparing" ? "Preparing..." : downloadState === "saving" ? "Saving..." : "Download";

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
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="button secondary" disabled={isDownloading} onClick={download} type="button">
              {downloadLabel}
            </button>
            <button className="button" disabled={isDownloading} onClick={() => onShare(document)} type="button">
              Share
            </button>
          </div>
          {downloadState !== "idle" && (
            <div className={`downloadStatus ${downloadState === "done" ? "done" : ""}`} aria-live="polite">
              <div className="downloadStatusHeader">
                <span>{downloadState === "done" ? "Download ready" : "Preparing secure download"}</span>
                <span>{downloadState === "done" ? "Complete" : "Backend"}</span>
              </div>
              <div className="downloadTrack">
                <span className="downloadBar" />
              </div>
            </div>
          )}
          {downloadError && <div className="status error">{downloadError}</div>}
        </>
      )}
    </article>
  );
}
