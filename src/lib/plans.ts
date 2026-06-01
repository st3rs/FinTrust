// ─── Freemium plan definitions ───────────────────────────────────────────────
// Free: PromptPay forever + 5 invoices/month — enough for a micro-business
// Pro:  All gateways + unlimited invoices — needed for card/international payments

export const PLANS = {
  free: {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    currency: 'THB',
    invoicesPerMonth: 5,
    gateways: ['promptpay'] as string[],
    features: {
      stripe: false,
      paypal: false,
      crypto: false,
      webhooks: false,
      apiAccess: false,
      analytics: false,
      paymentLinks: 1,       // max active payment links
    },
    badge: { label: 'Free', class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  },
  pro: {
    id: 'pro' as const,
    name: 'Pro',
    price: 499,
    currency: 'THB',
    invoicesPerMonth: Infinity,
    gateways: ['promptpay', 'stripe', 'paypal', 'crypto'] as string[],
    features: {
      stripe: true,
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

export function canUseGateway(planId: string | undefined | null, gateway: string): boolean {
  return getPlan(planId).gateways.includes(gateway);
}
