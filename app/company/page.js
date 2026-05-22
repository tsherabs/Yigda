"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import LogoAvatar from "@/components/LogoAvatar";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CompanyContent() {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [showPlans, setShowPlans] = useState(false);
  const [busy, setBusy] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((response) => response.json());
      if (me.user?.type !== "company") return router.push("/official-login");
      setUser(me.user);

      if (checkoutStatus === "success" && checkoutSessionId) {
        setCheckoutMessage("Confirming your Stripe payment...");
        const syncResponse = await fetch("/api/stripe/sync-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutSessionId })
        });
        const syncData = await syncResponse.json().catch(() => ({}));
        if (!syncResponse.ok) {
          setError(syncData.error || "Payment succeeded, but subscription sync failed.");
        } else {
          setCheckoutMessage("Payment confirmed. Your verifier subscription is active.");
          window.history.replaceState({}, "", "/company");
        }
      }

      const data = await fetch("/api/company/subscription").then((response) => response.json());
      setSubscription(data.subscription);
      setPlans(data.plans || []);
      const isActive = data.subscription?.status === "active" && new Date(data.subscription.end_date) > new Date();
      setShowPlans(!isActive);
    }
    load();
  }, [router, checkoutStatus, checkoutSessionId]);

  async function subscribe(planId) {
    setBusy(planId);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy("");
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setLogoBusy(false);
    }
  }

  const active = subscription?.status === "active" && new Date(subscription.end_date) > new Date();

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="dashboardHeader">
          <div className="identityRow">
            <LogoAvatar src={user?.logoUrl} name={user?.name} />
            <div>
              <h1>Company Verifier Dashboard</h1>
              <p className="muted">Subscribe before verifying uploaded PDFs or opening citizen share links.</p>
              <label className="logoUploader">
                <span className="button secondary">{logoBusy ? "Uploading..." : "Change Logo"}</span>
                <input
                  disabled={logoBusy}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => updateLogo(event.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          {user && <span className="badge green">{user.name}</span>}
        </div>

        {checkoutStatus === "cancelled" && <div className="status error">Stripe checkout was cancelled.</div>}
        {checkoutMessage && <div className="status ok">{checkoutMessage}</div>}
        {error && <div className="status error">{error}</div>}

        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>Subscription Status</h2>
          {active ? (
            <p>
              Active {subscription.plan} plan. Used {subscription.verifications_used} / {subscription.verifications_limit || "unlimited"} verifications.
            </p>
          ) : (
            <p>No active subscription. Verification is locked until a paid plan is active.</p>
          )}
          <div style={{ marginTop: 16 }}>
            <Link className={`button ${active ? "" : "secondary"}`} href="/company/verify">
              Verify a Document
            </Link>
            {active && (
              <button className="button secondary" onClick={() => setShowPlans((visible) => !visible)} style={{ marginLeft: 10 }}>
                {showPlans ? "Hide Plans" : "Upgrade Plans"}
              </button>
            )}
          </div>
        </section>

        {showPlans && (
          <div className="grid three">
            {plans.map((plan) => (
              <section className="card" key={plan.id} style={{ borderColor: plan.popular ? "var(--green)" : "var(--line)" }}>
                {plan.popular && <span className="badge gold">Most Popular</span>}
                <h2>{plan.name}</h2>
                <p style={{ fontSize: 30, color: "var(--ink)", fontWeight: 800 }}>{plan.price}<span style={{ fontSize: 15, color: "var(--muted)" }}>/month</span></p>
                <p>{plan.limit ? `${plan.limit} verifications/month` : "Unlimited verifications"}</p>
                <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: 18 }}>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <button className="button" disabled={busy === plan.id} onClick={() => subscribe(plan.id)}>
                  {busy === plan.id ? "Redirecting..." : active ? "Upgrade" : "Subscribe"}
                </button>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function CompanyPage() {
  return (
    <Suspense>
      <CompanyContent />
    </Suspense>
  );
}
