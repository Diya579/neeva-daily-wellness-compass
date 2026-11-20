# Neeva AI — Standalone Payment & Subscription Demonstration (`/payment-demo/`)

> **STRICT ISOLATION & DEMONSTRATION NOTICE:**  
> This project is a **standalone visual and functional demonstration** housed entirely in `/payment-demo/`.
> - **Not connected** to `/frontend/` (zero existing frontend files were modified or imported).
> - **Not connected** to Firebase Authentication or real user accounts.
> - **Not connected** to Razorpay, Stripe, PayPal, or any real payment gateway.
> - **Collects zero sensitive payment credentials** (all UPI/Card/NetBanking inputs are read-only fictional sandbox tokens).

## Features Implemented (All 13 Required States)

1. **Subscription Plan Selection:** `Neeva Student (₹49/mo)`, `Neeva Plus (₹99/mo)`, and `Neeva Duo Pass (₹149/mo)`.
2. **Plan Comparison Table:** Side-by-side comparison of companion languages, encrypted journaling, peer circles, and 24×7 crisis safety (`Tele-MANAS 14416`).
3. **Monthly / Yearly Billing Toggle:** Dynamic recalculation with **2 months free** on yearly billing.
4. **Selected Plan Summary:** Real-time update of active plan badge and description.
5. **Live Order Summary:** Base subtotal, yearly discount, coupon discount, inclusive 18% GST calculation, and final payable demo total.
6. **Discount / Coupon Demonstration:** Built-in deterministic coupon codes:
   - `NEEVA50` — 50% off launch discount
   - `CAMPUS20` — 20% student wellness discount
   - `CHAI10` — ₹10 flat discount
   - Invalid code error state validation
7. **Fictional Checkout Form:** Pre-filled with clearly fictional demo subscriber data (`Aarav Sharma (DEMO ACCOUNT)`, `aarav.demo@campus.example.edu`).
8. **Simulated Payment Method Selection:** `UPI Sandbox (neeva.demo@okaxis-sandbox)`, `Demo Card (DEMO-CARD-XXXX-4242)`, and `NetBanking Mock (NRB-DEMO)`.
9. **Simulated Payment Processing State:** Multi-step animated progress screen (`?state=processing`).
10. **Success Screen:** Confirmation screen with fictional transaction ID (`DEMO-TXN-2026-XXXX`) and downloadable JSON receipt (`?state=success`).
11. **Failed Payment Screen:** Simulated bank timeout error (`ERR_SANDBOX_BANK_TIMEOUT`) with zero-deduction reassurance (`?state=failed`).
12. **Retry Flow:** One-click *"Retry with Approved Simulation"* button and *"Change Payment Method"* button.
13. **Back Navigation & Interactive State Switcher:** Top toolbar allowing instant switching across all 5 states.

## Local Setup & Run Instructions

```bash
# Start the standalone demo HTTP server on port 4173:
python payment-demo/server.py --port 4173
```

Then open `http://127.0.0.1:4173` in your browser.

