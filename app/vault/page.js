"use client";

import DocumentCard from "@/components/DocumentCard";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function VaultPage() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "citizen") return router.push("/");
      setUser(me.user);
      const data = await fetch("/api/documents/vault").then((response) => response.json());
      if (data.error) setError(data.error);
      setDocuments(data.documents || []);
    }
    load();
  }, [router]);

  function share(document) {
    router.push(`/vault/share?docId=${document.id}`);
  }

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="dashboardHeader">
          <div>
            <h1>My Document Vault</h1>
            <p className="muted">Documents issued to your NDI-verified CID.</p>
          </div>
          {user && <span className="badge green">CID {user.cid}</span>}
        </div>

        {error && <div className="status error">{error}</div>}
        {documents.length === 0 ? (
          <section className="panel">
            <h2>No documents yet</h2>
            <p>Issued documents will appear here after an approved organization sends one to your CID.</p>
          </section>
        ) : (
          <div className="grid three">
            {documents.map((document) => (
              <DocumentCard key={document.id} document={document} onShare={share} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
