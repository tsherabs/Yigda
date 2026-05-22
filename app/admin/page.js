"use client";

import Navbar from "@/components/Navbar";
import LogoAvatar from "@/components/LogoAvatar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const docTypes = ["Degree", "Transcript", "Medical Certificate", "Birth Certificate", "Vaccination Record", "Work Permit", "National ID"];

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [tab, setTab] = useState("orgs");
  const [approving, setApproving] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "admin") return router.push("/official-login");
      setUser(me.user);
      await refresh();
    }
    load();
  }, [router]);

  async function refresh() {
    const [orgRes, companyRes] = await Promise.all([
      fetch("/api/admin/organizations").then((response) => response.json()),
      fetch("/api/admin/companies").then((response) => response.json())
    ]);
    setOrgs(orgRes.organizations || []);
    setCompanies(companyRes.companies || []);
  }

  function toggle(type) {
    setSelected((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }

  async function approve() {
    setError("");
    const response = await fetch(`/api/admin/organizations/${approving.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentTypes: selected })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Approval failed.");
    setApproving(null);
    setSelected([]);
    await refresh();
  }

  async function reject(org) {
    await fetch(`/api/admin/organizations/${org.id}/reject`, { method: "POST" });
    await refresh();
  }

  async function setCompanyStatus(company, status) {
    await fetch(`/api/admin/companies/${company.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await refresh();
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="page">
          <div className="panel">Loading admin dashboard...</div>
        </main>
      </>
    );
  }

  const pending = orgs.filter((org) => org.status === "pending");
  const approved = orgs.filter((org) => org.status === "approved");
  const rejected = orgs.filter((org) => org.status === "rejected");

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="dashboardHeader">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="muted">Approve organizations and manage verifier companies.</p>
          </div>
          <span className="badge green">{user.name}</span>
        </div>

        <div className="tabs" style={{ maxWidth: 360 }}>
          <button className={`tab ${tab === "orgs" ? "active" : ""}`} onClick={() => setTab("orgs")}>Organizations</button>
          <button className={`tab ${tab === "companies" ? "active" : ""}`} onClick={() => setTab("companies")}>Companies</button>
        </div>

        {tab === "orgs" ? (
          <div className="grid">
            <section className="panel">
              <h2>Pending Approval ({pending.length})</h2>
              <div className="tableList" style={{ marginTop: 16 }}>
                {pending.length === 0 && <p>No organizations are waiting.</p>}
                {pending.map((org) => (
                  <div className="listItem" key={org.id}>
                    <div className="identityRow">
                      <LogoAvatar src={org.logo_url} name={org.name} size="sm" />
                      <div>
                        <strong>{org.name}</strong>
                        <p>{org.type || "Organization"} in {org.country || "N/A"}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="button" onClick={() => { setApproving(org); setSelected([]); }}>Approve</button>
                      <button className="button danger" onClick={() => reject(org)}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Approved ({approved.length})</h2>
              <div className="tableList" style={{ marginTop: 16 }}>
                {approved.map((org) => (
                  <div className="listItem" key={org.id}>
                    <div className="identityRow">
                      <LogoAvatar src={org.logo_url} name={org.name} size="sm" />
                      <div>
                        <strong>{org.name}</strong>
                        <p>{(org.document_types || []).join(", ") || "No document types assigned"}</p>
                      </div>
                    </div>
                    <span className="badge green">approved</span>
                  </div>
                ))}
              </div>
            </section>

            {rejected.length > 0 && (
              <section className="panel">
                <h2>Rejected ({rejected.length})</h2>
                <div className="tableList" style={{ marginTop: 16 }}>
                  {rejected.map((org) => (
                    <div className="listItem" key={org.id}>
                      <div className="identityRow">
                        <LogoAvatar src={org.logo_url} name={org.name} size="sm" />
                        <div>
                          <strong>{org.name}</strong>
                          <p>{org.type || "Organization"}</p>
                        </div>
                      </div>
                      <span className="badge red">rejected</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="panel">
            <h2>Registered Companies ({companies.length})</h2>
            <div className="tableList" style={{ marginTop: 16 }}>
              {companies.map((company) => (
                <div className="listItem" key={company.id}>
                  <div className="identityRow">
                    <LogoAvatar src={company.logo_url} name={company.name} size="sm" />
                    <div>
                      <strong>{company.name}</strong>
                      <p>{company.country || "N/A"} - subscription {company.subscription_status || "inactive"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={`badge ${company.status === "active" ? "green" : "red"}`}>{company.status}</span>
                    <button
                      className="button secondary"
                      onClick={() => setCompanyStatus(company, company.status === "active" ? "suspended" : "active")}
                    >
                      {company.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {approving && (
        <div className="modalBackdrop">
          <div className="modal">
            <h2>Approve {approving.name}</h2>
            <p className="muted">Choose document types this organization can issue.</p>
            <div className="checkGrid">
              {docTypes.map((type) => (
                <label className="checkRow" key={type}>
                  <input type="checkbox" checked={selected.includes(type)} onChange={() => toggle(type)} />
                  <span>{type}</span>
                </label>
              ))}
            </div>
            {error && <div className="status error">{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="button" onClick={approve}>Approve</button>
              <button className="button secondary" onClick={() => setApproving(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
