"use client";

import Navbar from "@/components/Navbar";
import VerifyResult from "@/components/VerifyResult";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CompanyVerifyPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data.user?.type !== "company") router.push("/official-login");
      });
  }, [router]);

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("pdf", file);
      const response = await fetch("/api/verify", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) router.push("/company");
        throw new Error(data.error || "Verification failed.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="page" style={{ maxWidth: 760 }}>
        <h1>Verify a Document</h1>
        <p className="muted">Upload a PDF. Yigda hashes it and checks the issued record.</p>
        <form className="panel" onSubmit={verify} style={{ marginTop: 24 }}>
          <label className="fileDrop">
            <input
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: "none" }}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <span>{file ? file.name : "Click to choose a PDF"}</span>
          </label>
          <button className="button" disabled={!file || busy} style={{ marginTop: 18 }}>
            {busy ? "Verifying..." : "Verify Document"}
          </button>
        </form>
        {error && <div className="status error">{error}</div>}
        <div style={{ marginTop: 20 }}>
          <VerifyResult result={result} />
        </div>
      </main>
    </>
  );
}
