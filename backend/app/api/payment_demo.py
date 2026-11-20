"""
Neeva AI Payment & Subscription Demo API (/api/v1/payment-demo/*)
Persists simulated demo checkouts in local SQLite WAL (`sqlite.db`).
DEMO MODE ONLY — zero real payment gateway calls, zero real money charged.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.zk_vault_and_campus import get_sqlite_wal_connection

router = APIRouter(prefix="/api/v1/payment-demo", tags=["payment-demo"])

DEMO_PLANS: dict[str, dict[str, Any]] = {
    "student": {
        "id": "student",
        "name": "Neeva Student",
        "monthlyPrice": 49,
        "yearlyPrice": 490,
        "desc": "Campus wellness plan: unlimited AI companion, encrypted journal & student circles.",
    },
    "plus": {
        "id": "plus",
        "name": "Neeva Plus",
        "monthlyPrice": 99,
        "yearlyPrice": 990,
        "desc": "Unlimited companion chats, encrypted journaling, CBT tools & 8 peer circles.",
    },
    "supporter": {
        "id": "supporter",
        "name": "Neeva Duo Pass",
        "monthlyPrice": 149,
        "yearlyPrice": 1490,
        "desc": "2 independent private Neeva Plus memberships + sponsor a campus seat.",
    },
}

DEMO_COUPONS: dict[str, dict[str, Any]] = {
    "NEEVA50": {"code": "NEEVA50", "type": "percent", "value": 50, "label": "50% off campus launch discount"},
    "CAMPUS20": {"code": "CAMPUS20", "type": "percent", "value": 20, "label": "20% student wellness scholarship"},
    "CHAI10": {"code": "CHAI10", "type": "flat", "value": 10, "label": "₹10 chai break discount"},
}


def _ensure_demo_subscriptions_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS demo_subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            subscriber_name TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            plan_name TEXT NOT NULL,
            billing_cycle TEXT NOT NULL,
            coupon_code TEXT,
            payment_method TEXT NOT NULL,
            final_total_inr REAL NOT NULL,
            status TEXT NOT NULL,
            transaction_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_demo_sub_user ON demo_subscriptions(user_id, created_at DESC);"
    )
    conn.commit()


class DemoCheckoutRequest(BaseModel):
    userId: str = Field(default="demo_user", max_length=128)
    subscriberName: str = Field(default="Aarav Sharma (DEMO)", max_length=120)
    planId: str = Field(default="plus")
    billingCycle: str = Field(default="monthly")
    couponCode: str | None = Field(default=None)
    paymentMethod: str = Field(default="upi")
    simulateSuccess: bool = Field(default=True)


@router.get("/plans")
async def get_demo_plans():
    return {
        "demoMode": True,
        "notice": "DEMO MODE — NO REAL MONEY IS CHARGED",
        "plans": list(DEMO_PLANS.values()),
        "coupons": list(DEMO_COUPONS.values()),
    }


@router.post("/checkout", status_code=201)
async def simulate_demo_checkout(payload: DemoCheckoutRequest):
    plan = DEMO_PLANS.get(payload.planId)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown planId: {payload.planId}")
    if payload.billingCycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billingCycle must be 'monthly' or 'yearly'.")

    is_yearly = payload.billingCycle == "yearly"
    raw_subtotal = plan["monthlyPrice"] * 12 if is_yearly else plan["monthlyPrice"]
    cycle_discount = plan["monthlyPrice"] * 2 if is_yearly else 0
    after_cycle = raw_subtotal - cycle_discount

    coupon_discount = 0
    applied_code = None
    if payload.couponCode:
        code = payload.couponCode.strip().upper()
        coupon = DEMO_COUPONS.get(code)
        if coupon:
            applied_code = code
            if coupon["type"] == "percent":
                coupon_discount = round((after_cycle * coupon["value"]) / 100)
            else:
                coupon_discount = min(after_cycle, coupon["value"])

    final_total = max(0, after_cycle - coupon_discount)
    inclusive_gst = round((final_total * 18) / 118, 2)
    txn_id = f"DEMO-TXN-2026-{uuid.uuid4().hex[:6].upper()}"
    status = "active" if payload.simulateSuccess else "failed"
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_sqlite_wal_connection()
    try:
        _ensure_demo_subscriptions_table(conn)
        with conn:
            conn.execute(
                """
                INSERT INTO demo_subscriptions
                (id, user_id, subscriber_name, plan_id, plan_name, billing_cycle, coupon_code,
                 payment_method, final_total_inr, status, transaction_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    payload.userId,
                    payload.subscriberName,
                    plan["id"],
                    plan["name"],
                    payload.billingCycle,
                    applied_code,
                    payload.paymentMethod,
                    float(final_total),
                    status,
                    txn_id,
                    now_iso,
                ),
            )
    finally:
        conn.close()

    return {
        "demoMode": True,
        "status": status,
        "transactionId": txn_id,
        "planId": plan["id"],
        "planName": plan["name"],
        "billingCycle": payload.billingCycle,
        "appliedCoupon": applied_code,
        "rawSubtotal": raw_subtotal,
        "cycleDiscount": cycle_discount,
        "couponDiscount": coupon_discount,
        "inclusiveGst": inclusive_gst,
        "finalTotal": final_total,
        "paymentMethod": payload.paymentMethod,
        "createdAt": now_iso,
    }


@router.get("/subscription")
async def get_latest_demo_subscription(userId: str = "demo_user"):
    conn = get_sqlite_wal_connection()
    try:
        _ensure_demo_subscriptions_table(conn)
        row = conn.execute(
            """
            SELECT plan_id, plan_name, billing_cycle, final_total_inr, status, transaction_id, created_at
            FROM demo_subscriptions
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (userId,),
        ).fetchone()
        if not row:
            return {
                "demoMode": True,
                "active": False,
                "planId": "plus",
                "planName": "Neeva Plus",
                "billingCycle": "monthly",
                "priceLabel": "₹99/month",
            }
        price_label = (
            f"₹{int(row['final_total_inr'])}/year"
            if row["billing_cycle"] == "yearly"
            else f"₹{int(row['final_total_inr'])}/month"
        )
        return {
            "demoMode": True,
            "active": True,
            "planId": row["plan_id"],
            "planName": row["plan_name"],
            "billingCycle": row["billing_cycle"],
            "finalTotal": row["final_total_inr"],
            "priceLabel": price_label,
            "transactionId": row["transaction_id"],
            "createdAt": row["created_at"],
        }
    finally:
        conn.close()
