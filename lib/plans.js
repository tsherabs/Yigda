export const VERIFIER_PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: "$9",
    amount: 900,
    interval: "month",
    limit: 50,
    stripePriceEnv: "STRIPE_STARTER_PRICE_ID",
    features: ["PDF upload verification", "Shareable link access", "Basic audit log"]
  },
  business: {
    id: "business",
    name: "Business",
    price: "$29",
    amount: 2900,
    interval: "month",
    limit: 500,
    stripePriceEnv: "STRIPE_BUSINESS_PRICE_ID",
    popular: true,
    features: ["PDF upload verification", "Shareable link access", "Full audit log", "Usage analytics"]
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: "$99",
    amount: 9900,
    interval: "month",
    limit: null,
    stripePriceEnv: "STRIPE_ENTERPRISE_PRICE_ID",
    features: ["Everything in Business", "API access", "Priority support", "Custom SLA"]
  }
};

export function getPlan(planId) {
  return VERIFIER_PLANS[String(planId || "").toLowerCase()] || null;
}

export function publicPlans() {
  return Object.values(VERIFIER_PLANS).map(({ stripePriceEnv, ...plan }) => plan);
}
