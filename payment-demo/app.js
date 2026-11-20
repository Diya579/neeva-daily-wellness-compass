/* ============================================================================
 * Neeva AI — Standalone Payment Demonstration Controller
 * Deterministic local simulation of plan selection, billing cycle switch,
 * coupon validation, checkout processing, success receipt, failure & retry.
 * Zero external payment gateway calls.
 * ============================================================================ */
(function () {
  "use strict";

  const PLANS = {
    student: {
      id: "student",
      name: "Neeva Student",
      monthlyPrice: 49,
      yearlyPrice: 490, // 2 months free (10 * 49)
      desc: "Campus wellness plan: unlimited AI companion, encrypted journal & student circles.",
    },
    plus: {
      id: "plus",
      name: "Neeva Plus",
      monthlyPrice: 99,
      yearlyPrice: 990, // 2 months free (10 * 99)
      desc: "Unlimited companion chats, encrypted journaling, CBT tools & 8 peer circles.",
    },
    supporter: {
      id: "supporter",
      name: "Neeva Duo Pass",
      monthlyPrice: 149,
      yearlyPrice: 1490, // 2 months free (10 * 149)
      desc: "2 independent private Neeva Plus memberships + sponsor a campus seat.",
    },
  };

  const COUPONS = {
    NEEVA50: { code: "NEEVA50", type: "percent", value: 50, label: "50% off campus launch discount" },
    CAMPUS20: { code: "CAMPUS20", type: "percent", value: 20, label: "20% student wellness scholarship" },
    CHAI10: { code: "CHAI10", type: "flat", value: 10, label: "₹10 chai break discount" },
  };

  const state = {
    selectedPlanId: "plus",
    billingCycle: "monthly", // "monthly" | "yearly"
    appliedCoupon: null,
    paymentMethod: "upi", // "upi" | "card" | "netbanking"
    currentView: "plans", // "plans" | "checkout" | "processing" | "success" | "failed"
    lastTransactionId: "DEMO-TXN-2026-8841",
  };

  function calculatePricing() {
    const plan = PLANS[state.selectedPlanId];
    const isYearly = state.billingCycle === "yearly";
    const rawSubtotal = isYearly ? plan.monthlyPrice * 12 : plan.monthlyPrice;
    const cycleDiscount = isYearly ? plan.monthlyPrice * 2 : 0;
    const afterCycle = rawSubtotal - cycleDiscount;

    let couponDiscount = 0;
    if (state.appliedCoupon) {
      if (state.appliedCoupon.type === "percent") {
        couponDiscount = Math.round((afterCycle * state.appliedCoupon.value) / 100);
      } else {
        couponDiscount = Math.min(afterCycle, state.appliedCoupon.value);
      }
    }

    const finalTotal = Math.max(0, afterCycle - couponDiscount);
    const inclusiveGst = (finalTotal * 18) / 118;

    return {
      plan,
      rawSubtotal,
      cycleDiscount,
      couponDiscount,
      finalTotal,
      inclusiveGst,
    };
  }

  function renderPricingAndSummary() {
    const isYearly = state.billingCycle === "yearly";

    // Update plan cards price text & active state
    Object.values(PLANS).forEach((p) => {
      const priceEl = document.querySelector(`[data-price-display="${p.id}"]`);
      const periodEl = document.querySelector(`[data-period-display="${p.id}"]`);
      const cardEl = document.getElementById(`card-plan-${p.id}`);
      const btnEl = document.querySelector(`[data-select="${p.id}"]`);

      if (priceEl) priceEl.textContent = `₹${isYearly ? p.yearlyPrice : p.monthlyPrice}`;
      if (periodEl) periodEl.textContent = isYearly ? "/year (2 mo free)" : "/month";

      if (cardEl && btnEl) {
        if (p.id === state.selectedPlanId) {
          cardEl.classList.add("selected");
          btnEl.classList.add("btn-zest");
          btnEl.textContent = "Selected · Continue to Checkout";
        } else {
          cardEl.classList.remove("selected");
          btnEl.classList.remove("btn-zest");
          btnEl.textContent = `Select ${p.name}`;
        }
      }
    });

    // Update billing cycle toggle buttons
    document.getElementById("btn-cycle-monthly").classList.toggle("active", !isYearly);
    document.getElementById("btn-cycle-yearly").classList.toggle("active", isYearly);

    // Update order summary
    const calc = calculatePricing();
    document.getElementById("summary-plan-title").textContent = `${calc.plan.name} · ${isYearly ? "Yearly" : "Monthly"}`;
    document.getElementById("summary-plan-desc").textContent = calc.plan.desc;
    document.getElementById("sum-subtotal").textContent = `₹${calc.rawSubtotal.toFixed(2)}`;
    document.getElementById("sum-cycle-discount").textContent = `-₹${calc.cycleDiscount.toFixed(2)}`;
    document.getElementById("sum-coupon-code").textContent = state.appliedCoupon ? state.appliedCoupon.code : "NONE";
    document.getElementById("sum-coupon-discount").textContent = `-₹${calc.couponDiscount.toFixed(2)}`;
    document.getElementById("sum-tax").textContent = `₹${calc.inclusiveGst.toFixed(2)}`;
    document.getElementById("sum-total").textContent = `₹${calc.finalTotal.toFixed(2)}`;
    document.getElementById("btn-pay-amount").textContent = `₹${calc.finalTotal}`;

    // Also update receipt preview values
    const nameInput = document.getElementById("demo-name");
    document.getElementById("rec-subscriber").textContent = nameInput ? nameInput.value : "Aarav Sharma (DEMO)";
    document.getElementById("rec-plan").textContent = `${calc.plan.name} (${isYearly ? "Yearly" : "Monthly"})`;
    const methodLabels = {
      upi: "UPI Sandbox (neeva.demo@okaxis-sandbox)",
      card: "Demo Card (DEMO-CARD-XXXX-4242)",
      netbanking: "NetBanking Mock (NRB-DEMO)",
    };
    document.getElementById("rec-method").textContent = methodLabels[state.paymentMethod];
    document.getElementById("rec-amount").textContent = `₹${calc.finalTotal.toFixed(2)} (FICTIONAL DEMO)`;
    document.getElementById("rec-txn-id").textContent = state.lastTransactionId;
  }

  function switchView(viewName) {
    state.currentView = viewName;
    const mainEl = document.getElementById("view-main");
    const procEl = document.getElementById("view-processing");
    const succEl = document.getElementById("view-success");
    const failEl = document.getElementById("view-failed");
    const badgeEl = document.getElementById("current-step-badge");

    mainEl.classList.add("hidden");
    procEl.classList.add("hidden");
    succEl.classList.add("hidden");
    failEl.classList.add("hidden");

    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-goto") === viewName);
    });

    if (viewName === "plans" || viewName === "checkout") {
      mainEl.classList.remove("hidden");
      badgeEl.textContent = viewName === "plans" ? "/subscription-demo/plans" : "/subscription-demo/checkout";
      if (viewName === "checkout") {
        const chk = document.getElementById("checkout-section");
        if (chk && chk.scrollIntoView) chk.scrollIntoView({ behavior: "smooth" });
      }
    } else if (viewName === "processing") {
      procEl.classList.remove("hidden");
      badgeEl.textContent = "/subscription-demo/processing";
    } else if (viewName === "success") {
      renderPricingAndSummary();
      succEl.classList.remove("hidden");
      badgeEl.textContent = "/subscription-demo/success";
    } else if (viewName === "failed") {
      failEl.classList.remove("hidden");
      badgeEl.textContent = "/subscription-demo/failed";
    }
  }

  async function runSimulatedPayment(forceSuccess) {
    switchView("processing");
    const stepText = document.getElementById("processing-step-text");
    stepText.textContent = "Step 1/3: Connecting to Neeva FastAPI Demo Checkout (SQLite WAL)…";

    const shouldSucceed =
      forceSuccess === true ||
      (forceSuccess === undefined && document.getElementById("radio-sim-success").checked);

    const nameInput = document.getElementById("demo-name");
    const subscriberName = nameInput ? nameInput.value : "Aarav Sharma (DEMO)";
    const storedSession = (() => {
      try {
        return JSON.parse(window.localStorage.getItem("neeva:local-auth:session") || "null");
      } catch {
        return null;
      }
    })();
    const userId = storedSession?.user?.id || "demo_user";

    setTimeout(() => {
      if (state.currentView !== "processing") return;
      stepText.textContent = "Step 2/3: Recording demo subscription in local SQLite WAL vault…";
    }, 300);

    let backendReceipt = null;
    try {
      const res = await fetch("/api/v1/payment-demo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subscriberName,
          planId: state.selectedPlanId,
          billingCycle: state.billingCycle,
          couponCode: state.appliedCoupon ? state.appliedCoupon.code : null,
          paymentMethod: state.paymentMethod,
          simulateSuccess: shouldSucceed,
        }),
      });
      if (res.ok) {
        backendReceipt = await res.json();
      }
    } catch {
      /* standalone fallback if opened without backend */
    }

    setTimeout(() => {
      if (state.currentView !== "processing") return;
      state.lastTransactionId =
        backendReceipt?.transactionId ||
        "DEMO-TXN-2026-" + Math.floor(1000 + Math.random() * 9000);

      if (shouldSucceed) {
        try {
          const calc = calculatePricing();
          window.localStorage.setItem(
            "neeva:demo-subscription",
            JSON.stringify({
              active: true,
              planId: calc.plan.id,
              planName: calc.plan.name,
              billingCycle: state.billingCycle,
              finalTotal: backendReceipt?.finalTotal ?? calc.finalTotal,
              priceLabel:
                state.billingCycle === "yearly"
                  ? `₹${backendReceipt?.finalTotal ?? calc.finalTotal}/year`
                  : `₹${backendReceipt?.finalTotal ?? calc.finalTotal}/month`,
              transactionId: state.lastTransactionId,
              syncedToBackend: Boolean(backendReceipt),
            })
          );
        } catch {
          /* ignore storage errors */
        }
        switchView("success");
      } else {
        switchView("failed");
      }
    }, 850);
  }

  // Event Listeners
  document.addEventListener("DOMContentLoaded", () => {
    // Support URL query param `?state=plans|checkout|processing|success|failed` for deterministic screenshot testing
    const params = new URLSearchParams(window.location.search);
    const initialCoupon = params.get("coupon");
    if (initialCoupon && COUPONS[initialCoupon.toUpperCase()]) {
      state.appliedCoupon = COUPONS[initialCoupon.toUpperCase()];
      document.getElementById("coupon-input").value = state.appliedCoupon.code;
      document.getElementById("coupon-feedback").textContent = `✓ Applied: ${state.appliedCoupon.label}`;
      document.getElementById("coupon-feedback").style.color = "#1E3F2B";
    }

    renderPricingAndSummary();

    const initialState = params.get("state");
    if (initialState && ["plans", "checkout", "processing", "success", "failed"].includes(initialState)) {
      switchView(initialState);
    }

    // State switcher buttons
    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.getAttribute("data-goto")));
    });

    // Billing cycle toggle
    document.querySelectorAll("[data-cycle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.billingCycle = btn.getAttribute("data-cycle");
        renderPricingAndSummary();
      });
    });

    // Plan cards
    document.querySelectorAll(".plan-card").forEach((card) => {
      card.addEventListener("click", () => {
        state.selectedPlanId = card.getAttribute("data-plan-id");
        renderPricingAndSummary();
      });
    });

    // Coupon application
    document.getElementById("btn-apply-coupon").addEventListener("click", () => {
      const code = (document.getElementById("coupon-input").value || "").trim().toUpperCase();
      const fb = document.getElementById("coupon-feedback");
      if (COUPONS[code]) {
        state.appliedCoupon = COUPONS[code];
        fb.textContent = `✓ Applied ${code}: ${COUPONS[code].label}`;
        fb.style.color = "#1E3F2B";
      } else {
        state.appliedCoupon = null;
        fb.textContent = "✕ Unknown demo code. Try NEEVA50, CAMPUS20, or CHAI10.";
        fb.style.color = "#D94E34";
      }
      renderPricingAndSummary();
    });

    // Payment method tabs
    document.querySelectorAll("[data-method]").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.paymentMethod = tab.getAttribute("data-method");
        document.querySelectorAll("[data-method]").forEach((t) =>
          t.classList.toggle("active", t.getAttribute("data-method") === state.paymentMethod)
        );
        ["upi", "card", "netbanking"].forEach((m) => {
          document.getElementById(`method-panel-${m}`).classList.toggle("hidden", m !== state.paymentMethod);
        });
        renderPricingAndSummary();
      });
    });

    // Form submission
    document.getElementById("demo-checkout-form").addEventListener("submit", (e) => {
      e.preventDefault();
      runSimulatedPayment();
    });

    // Processing cancel
    document.getElementById("btn-cancel-processing").addEventListener("click", () => switchView("checkout"));

    // Success screen actions
    document.getElementById("btn-back-from-success").addEventListener("click", () => switchView("plans"));
    document.getElementById("btn-download-receipt").addEventListener("click", () => {
      const calc = calculatePricing();
      const receipt = {
        demonstration_only: true,
        real_payment_processed: false,
        transaction_id: state.lastTransactionId,
        plan: calc.plan.name,
        billing_cycle: state.billingCycle,
        coupon: state.appliedCoupon ? state.appliedCoupon.code : null,
        simulated_total_inr: calc.finalTotal,
        timestamp: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.lastTransactionId.toLowerCase()}-receipt.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Failed screen retry & change method
    document.getElementById("btn-retry-payment").addEventListener("click", () => {
      document.getElementById("radio-sim-success").checked = true;
      runSimulatedPayment(true);
    });
    document.getElementById("btn-change-method").addEventListener("click", () => switchView("checkout"));
  });
})();

