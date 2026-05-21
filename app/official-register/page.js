"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const orgTypes = ["University", "School", "Hospital", "Ministry", "Regulatory Body", "Other"];

export default function OfficialRegisterPage() {
  const [tab, setTab] = useState("org");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState({ name: "", type: "University", country: "Bhutan", password: "", confirm: "" });
  const [company, setCompany] = useState({ name: "", country: "Bhutan", password: "", confirm: "" });
  const router = useRouter();

  async function register(url, payload) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed.");
      setMessage(tab === "org" ? "Organization submitted for admin approval." : "Company account created. You can log in now.");
      window.setTimeout(() => router.push("/official-login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  function submitOrg(event) {
    event.preventDefault();
    if (org.password !== org.confirm) return setError("Passwords do not match.");
    return register("/api/register/organization", org);
  }

  function submitCompany(event) {
    event.preventDefault();
    if (company.password !== company.confirm) return setError("Passwords do not match.");
    return register("/api/register/company", company);
  }

  return (
    <main className="authShell">
      <section className="panel authPanel">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="brandMark">Y</span>
        </div>
        <h1>Official Register</h1>
        <p>Organizations wait for approval. Companies can subscribe after login.</p>

        <div className="tabs">
          <button className={`tab ${tab === "org" ? "active" : ""}`} onClick={() => setTab("org")}>
            Organization
          </button>
          <button className={`tab ${tab === "company" ? "active" : ""}`} onClick={() => setTab("company")}>
            Company
          </button>
        </div>

        {tab === "org" ? (
          <form className="form" onSubmit={submitOrg}>
            <label className="label">
              Organization name
              <input className="input" value={org.name} onChange={(event) => setOrg({ ...org, name: event.target.value })} required />
            </label>
            <label className="label">
              Type
              <select className="select" value={org.type} onChange={(event) => setOrg({ ...org, type: event.target.value })}>
                {orgTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Country
              <input className="input" value={org.country} onChange={(event) => setOrg({ ...org, country: event.target.value })} />
            </label>
            <label className="label">
              Password
              <input className="input" type="password" minLength={8} value={org.password} onChange={(event) => setOrg({ ...org, password: event.target.value })} required />
            </label>
            <label className="label">
              Confirm password
              <input className="input" type="password" value={org.confirm} onChange={(event) => setOrg({ ...org, confirm: event.target.value })} required />
            </label>
            <button className="button" disabled={busy}>Submit for Approval</button>
          </form>
        ) : (
          <form className="form" onSubmit={submitCompany}>
            <label className="label">
              Company name
              <input className="input" value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} required />
            </label>
            <label className="label">
              Country
              <input className="input" value={company.country} onChange={(event) => setCompany({ ...company, country: event.target.value })} />
            </label>
            <label className="label">
              Password
              <input className="input" type="password" minLength={8} value={company.password} onChange={(event) => setCompany({ ...company, password: event.target.value })} required />
            </label>
            <label className="label">
              Confirm password
              <input className="input" type="password" value={company.confirm} onChange={(event) => setCompany({ ...company, confirm: event.target.value })} required />
            </label>
            <button className="button" disabled={busy}>Create Company Account</button>
          </form>
        )}

        {message && <div className="status ok">{message}</div>}
        {error && <div className="status error">{error}</div>}
        <p style={{ marginTop: 20 }}>Already registered? <Link href="/official-login">Sign in</Link></p>
      </section>
    </main>
  );
}
