import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="page">
        <section className="hero">
          <div>
            <span className="badge gold">Blockchain-backed document trust</span>
            <h1>Official Documents, Verified Without Guesswork</h1>
            <p>
              Yigda lets approved organizations issue tamper-resistant PDF documents, citizens keep them in a
              secure vault, and subscribed companies verify authenticity through one platform.
            </p>
            <div className="heroActions">
              <Link className="button" href="/login">
                Login with NDI
              </Link>
              <Link className="button secondary" href="/official-login">
                Official Login
              </Link>
            </div>
          </div>
          <div className="visualPanel" aria-hidden="true">
            <div className="documentPreview">
              <span className="seal">Y</span>
              <h2 style={{ marginTop: 24 }}>Verified Certificate</h2>
              <p className="muted">Issued by an approved organization</p>
              <div className="hashLine" style={{ width: "92%" }} />
              <div className="hashLine" style={{ width: "72%" }} />
              <div className="hashLine" style={{ width: "84%" }} />
              <div style={{ display: "grid", gap: 10, marginTop: 34 }}>
                <span className="badge green">Cloudinary PDF stored</span>
                <span className="badge green">Sepolia hash anchored</span>
                <span className="badge green">Same-origin download proxy</span>
              </div>
            </div>
          </div>
        </section>

        <section className="features">
          <div className="card">
            <h3>Admin</h3>
            <p>Approves organizations, assigns document types, and manages verifier companies.</p>
          </div>
          <div className="card">
            <h3>Organizations</h3>
            <p>Register first, wait for approval, then issue only the document types granted by admin.</p>
          </div>
          <div className="card">
            <h3>Citizens</h3>
            <p>Use Bhutan NDI login to access a private document vault and share selected documents.</p>
          </div>
          <div className="card">
            <h3>Companies</h3>
            <p>Subscribe before verifying PDFs or opening citizen share links. No free verification tier.</p>
          </div>
        </section>
      </main>
    </>
  );
}
