// ─── Freemium plan definitions ───────────────────────────────────────────────
//
// Free:  PromptPay 10 QR/month  |  5 invoices/month  |  Stripe (own keys)
// Pro:   PromptPay unlimited    |  unlimited invoices |  all gateways
//
// Stripe is NOT locked behind Pro — operators connect their own Stripe keys.
// The per-month limit on Free is the primary upgrade driver.

export const PLANS = {
  free: {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    currency: 'THB',
    invoicesPerMonth: 5,
    promptpayPerMonth: 10,
    gateways: ['promptpay', 'stripe'] as string[], // Stripe OK if user has own keys
    features: {
      paypal: false,
      crypto: false,
      webhooks: false,
      apiAccess: false,
      analytics: false,
      paymentLinks: 1,
    },
    badge: { label: 'Free', class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  },
  pro: {
    id: 'pro' as const,
    name: 'Pro',
    price: 499,
    currency: 'THB',
    invoicesPerMonth: Infinity,
    promptpayPerMonth: Infinity,
    gateways: ['promptpay', 'stripe', 'paypal', 'crypto'] as string[],
    features: {
      paypal: true,
      crypto: true,
      webhooks: true,
      apiAccess: true,
      analytics: true,
      paymentLinks: Infinity,
    },
    badge: { label: 'Pro', class: 'bg-primary/15 text-primary' },
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = typeof PLANS[PlanId];

export function getPlan(planId: string | undefined | null): Plan {
  return PLANS[(planId as PlanId) ?? 'free'] ?? PLANS.free;
}
