# Product

## Register

product

## Users

Thai SME operators and accountants — small business owners or in-house accounting staff in Thailand and ASEAN who manage invoices, collect payments via PromptPay QR, track who has and hasn't paid, and reconcile across PromptPay, USDT, and card channels. They are not developers. They open the dashboard with a specific task: send an invoice, mark a payment, check outstanding receivables. Sessions are short and task-driven.

Secondary surface: ASEAN merchants needing multi-currency payment links they can share with customers directly.

## Product Purpose

FinTrust is a full-stack invoicing and payment collection platform built for operators in Thailand and ASEAN. It handles the full invoice lifecycle (DRAFT → UNPAID → PAID → VOID/OVERDUE), native PromptPay QR generation, USDT TRC-20, and card payments — all scoped per operator with real-time activity visibility.

Success looks like: an operator can send an invoice and get paid within three taps, without reading a manual.

## Brand Personality

Solid. Warm. Human.

Like a trusted local accountant who happens to be very good with software. Confident without being corporate. Precise without being cold. The interface should feel like it was built for this market specifically — not adapted from a Western SaaS template and translated.

Voice: Direct, clear, occasionally friendly. Never formal to the point of distance. Multi-lingual (Thai / English / Chinese) is a first-class feature, not an afterthought.

Reference: Lemon Squeezy — merchant-focused, warmer than Stripe, approachable for non-technical owners without sacrificing clarity.

## Anti-references

- **Trendy SaaS template aesthetic**: shadcn defaults out of the box, indigo everywhere, card grids with icon + heading + text repeated endlessly, eyebrow labels above every section, numbered section markers as structural scaffolding. FinTrust should feel distinctly itself, not like a Tailwind starter kit.
- The design should not read as "Western fintech adapted for Asia" — it should feel native to the ASEAN operator context.

## Design Principles

1. **Data before decoration.** Financial information — amounts, statuses, dates — must be the highest-contrast, most immediate thing on every screen. Visual treatment exists to serve the data, not compete with it.

2. **Warmth is precision.** The UI earns trust not through coldness but through consistency, legibility, and the small signs that it was made with care. A warm palette and human typography reinforce reliability rather than undermining it.

3. **Built for Thailand, not adapted.** Multi-lingual layout, PromptPay as a first-class feature (not a plugin), date and currency formats that feel native — these are not edge cases, they are the product.

4. **Frictionless task completion.** The primary loop (create invoice → share → receive payment → mark paid) should be achievable with minimal navigation. Every feature earns its place in the nav by answering a real operator need.

5. **Quiet confidence.** The interface should not announce itself. Operators should notice their data, not the UI. Motion and color are purposeful signals, not decoration.

## Accessibility & Inclusion

WCAG 2.1 AA minimum, targeting AA compliance throughout. Full contrast on body and muted text. Reduced motion support required on all transitions and entrance animations. Color-blind-safe status indicators (never rely on color alone — pair with icon or label). Thai, English, and Chinese i18n are first-class features, not add-ons.
