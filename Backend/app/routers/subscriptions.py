from datetime import datetime, timedelta, timezone

try:
    import stripe
except ModuleNotFoundError:  # Keep non-Stripe API routes available in incomplete dev environments.
    stripe = None
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.database.database import get_db
from app.models.subscription import Payment, Subscription
from app.models.user import User
from app.schemas.subscription import (
    ManualPaymentRequest,
    PaymentHistoryResponse,
    PaymentReviewRequest,
    PlanRequest,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
PLANS = {"premium": {"name": "Premium", "amount": 999}, "business": {"name": "Business", "amount": 4999}}


def _require_customer(user: User):
    if user.role == "superadmin":
        raise HTTPException(status_code=403, detail="Le superadmin ne peut pas souscrire à une offre")


def _history_item(payment: Payment, subscription: Subscription, user: User, reviewer: User | None):
    return PaymentHistoryResponse(
        payment_id=payment.id,
        subscription_id=subscription.id,
        user_id=user.id,
        user_email=user.email,
        plan=subscription.plan,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        method=payment.method,
        status=payment.status,
        reference=payment.reference or payment.provider_reference,
        created_at=payment.created_at,
        verified_at=payment.verified_at,
        verified_by=reviewer.email if reviewer else None,
        subscription_status=subscription.status,
    )


def _payment_rows(db: Session, user_id: int | None):
    query = (
        db.query(Payment, Subscription, User)
        .join(Subscription, Subscription.id == Payment.subscription_id)
        .join(User, User.id == Payment.user_id)
    )
    if user_id is not None:
        query = query.filter(Payment.user_id == user_id)
    rows = query.order_by(Payment.created_at.desc(), Payment.id.desc()).all()
    result = []
    for payment, subscription, user in rows:
        reviewer = db.query(User).filter(User.id == payment.verified_by_id).first() if payment.verified_by_id else None
        result.append(_history_item(payment, subscription, user, reviewer))
    return result


def _stripe_datetime(value):
    return datetime.fromtimestamp(value, timezone.utc).replace(tzinfo=None) if value else None


@router.get("/history", response_model=list[PaymentHistoryResponse])
def payment_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _payment_rows(db, None if current_user.role == "superadmin" else current_user.id)


@router.post("/admin/sync-stripe")
def sync_stripe_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Accès réservé au superadmin")
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe n’est pas configuré")
    if stripe is None:
        raise HTTPException(status_code=503, detail="La dépendance Stripe n’est pas installée")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    imported = 0
    customers: dict[str, User | None] = {}
    try:
        for stripe_sub in stripe.Subscription.list(status="all", limit=100).auto_paging_iter():
            customer_id = stripe_sub.get("customer")
            customer_id = customer_id if isinstance(customer_id, str) else (customer_id or {}).get("id")
            if not customer_id:
                continue
            if customer_id not in customers:
                customer = stripe.Customer.retrieve(customer_id)
                email = (customer.get("email") or "").strip().lower()
                customers[customer_id] = db.query(User).filter(User.email == email).first() if email else None
            user = customers[customer_id]
            if user is None:
                continue

            stripe_sub_id = stripe_sub.get("id")
            subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == stripe_sub_id).first()
            items = (stripe_sub.get("items") or {}).get("data", [])
            price = (items[0].get("price") or {}) if items else {}
            amount = price.get("unit_amount") or 999
            metadata = stripe_sub.get("metadata") or {}
            plan = metadata.get("plan") if metadata.get("plan") in PLANS else ("business" if amount == 4999 else "premium")
            if subscription is None:
                subscription = Subscription(user_id=user.id, plan=plan, method="stripe", status=stripe_sub.get("status", "pending"), amount_cents=amount, stripe_subscription_id=stripe_sub_id, period_start=_stripe_datetime(items[0].get("current_period_start")) if items else None, period_end=_stripe_datetime(items[0].get("current_period_end")) if items else None, created_at=_stripe_datetime(stripe_sub.get("created")) or datetime.utcnow())
                db.add(subscription)
                db.flush()
            else:
                subscription.status = stripe_sub.get("status", subscription.status)
                subscription.period_start = _stripe_datetime(items[0].get("current_period_start")) if items else subscription.period_start
                subscription.period_end = _stripe_datetime(items[0].get("current_period_end")) if items else subscription.period_end

            invoices = stripe.Invoice.list(subscription=stripe_sub_id, limit=100)
            for invoice in invoices.auto_paging_iter():
                invoice_id = invoice.get("id")
                payment = db.query(Payment).filter(Payment.provider_reference == invoice_id).first()
                if payment is None and invoice.get("billing_reason") == "subscription_create":
                    payment = db.query(Payment).filter(Payment.subscription_id == subscription.id, Payment.method == "stripe", Payment.status.in_(["pending", "paid"])).order_by(Payment.id.asc()).first()
                invoice_status = invoice.get("status")
                status = "paid" if invoice_status == "paid" else "failed" if invoice_status in {"void", "uncollectible"} else "pending"
                if payment is None:
                    payment = Payment(subscription_id=subscription.id, user_id=user.id, amount_cents=invoice.get("amount_paid") if status == "paid" else invoice.get("amount_due", 0), currency=invoice.get("currency", "eur"), method="stripe", status=status, provider_reference=invoice_id, reference=invoice.get("number") or invoice_id, created_at=_stripe_datetime(invoice.get("created")) or datetime.utcnow())
                    db.add(payment)
                    imported += 1
                else:
                    payment.provider_reference = invoice_id
                    payment.reference = invoice.get("number") or invoice_id
                    payment.status = status
                    payment.amount_cents = invoice.get("amount_paid") if status == "paid" else invoice.get("amount_due", payment.amount_cents)
                paid_at = ((invoice.get("status_transitions") or {}).get("paid_at"))
                if status == "paid":
                    payment.verified_at = _stripe_datetime(paid_at) or payment.verified_at
            db.flush()
        db.commit()
    except stripe.StripeError as error:
        db.rollback()
        raise HTTPException(status_code=502, detail="Impossible de synchroniser l’historique Stripe") from error
    return {"imported": imported}


@router.post("/checkout")
def create_checkout(payload: PlanRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_customer(current_user)
    if not settings.STRIPE_SECRET_KEY or not settings.FRONTEND_URL:
        raise HTTPException(status_code=503, detail="Le paiement Stripe n’est pas configuré")
    if stripe is None:
        raise HTTPException(status_code=503, detail="La dépendance Stripe n’est pas installée")
    active = db.query(Subscription).filter(Subscription.user_id == current_user.id, Subscription.status == "active").first()
    if active:
        raise HTTPException(status_code=409, detail="Vous avez déjà un abonnement actif")
    plan = PLANS[payload.plan]
    subscription = Subscription(user_id=current_user.id, plan=payload.plan, method="stripe", status="pending", amount_cents=plan["amount"])
    db.add(subscription)
    db.flush()
    payment = Payment(subscription_id=subscription.id, user_id=current_user.id, amount_cents=plan["amount"], currency="eur", method="stripe", status="pending")
    db.add(payment)
    db.flush()
    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=current_user.email,
            line_items=[{"price_data": {"currency": "eur", "unit_amount": plan["amount"], "product_data": {"name": f"CyberShield {plan['name']}"}, "recurring": {"interval": "month"}}, "quantity": 1}],
            metadata={"subscription_id": str(subscription.id), "payment_id": str(payment.id), "user_id": str(current_user.id)},
            subscription_data={"metadata": {"subscription_id": str(subscription.id), "user_id": str(current_user.id)}},
            success_url=f"{settings.FRONTEND_URL.rstrip('/')}/#dashboard",
            cancel_url=f"{settings.FRONTEND_URL.rstrip('/')}/#dashboard",
        )
        payment.provider_reference = session.id
        db.commit()
        return {"checkout_url": session.url}
    except stripe.StripeError as error:
        db.rollback()
        raise HTTPException(status_code=502, detail="Stripe n’a pas pu démarrer le paiement") from error


@router.post("/manual", response_model=PaymentHistoryResponse, status_code=201)
def submit_manual_payment(payload: ManualPaymentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_customer(current_user)
    plan = PLANS[payload.plan]
    subscription = Subscription(user_id=current_user.id, plan=payload.plan, method="manual", status="pending", amount_cents=plan["amount"])
    db.add(subscription)
    db.flush()
    payment = Payment(subscription_id=subscription.id, user_id=current_user.id, amount_cents=plan["amount"], currency="eur", method="manual", status="pending", reference=payload.reference.strip())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    db.refresh(subscription)
    return _history_item(payment, subscription, current_user, None)


@router.post("/payments/{payment_id}/review", response_model=PaymentHistoryResponse)
def review_manual_payment(payment_id: int, payload: PaymentReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Accès réservé au superadmin")
    payment = db.query(Payment).filter(Payment.id == payment_id).with_for_update().first()
    if payment is None:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    if payment.method != "manual" or payment.status != "pending":
        raise HTTPException(status_code=409, detail="Seuls les paiements manuels en attente peuvent être vérifiés")
    subscription = db.query(Subscription).filter(Subscription.id == payment.subscription_id).with_for_update().first()
    payment.status = "paid" if payload.approved else "rejected"
    payment.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    payment.verified_by_id = current_user.id
    if payload.approved:
        subscription.status = "active"
        subscription.period_start = payment.verified_at
        subscription.period_end = payment.verified_at + timedelta(days=30)
    else:
        subscription.status = "rejected"
    db.commit()
    db.refresh(payment)
    db.refresh(subscription)
    owner = db.query(User).filter(User.id == payment.user_id).first()
    return _history_item(payment, subscription, owner, current_user)


@router.post("/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"), db: Session = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Le webhook Stripe n’est pas configuré")
    if stripe is None:
        raise HTTPException(status_code=503, detail="La dépendance Stripe n’est pas installée")
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Signature Stripe manquante")
    try:
        event = stripe.Webhook.construct_event(await request.body(), stripe_signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as error:
        raise HTTPException(status_code=400, detail="Signature ou événement Stripe invalide") from error

    event_type = event["type"]
    obj = event["data"]["object"]
    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"}:
        metadata = obj.get("metadata") or {}
        subscription = db.query(Subscription).filter(Subscription.id == metadata.get("subscription_id"), Subscription.method == "stripe").first()
        if subscription:
            stripe_subscription = obj.get("subscription")
            subscription.stripe_subscription_id = stripe_subscription if isinstance(stripe_subscription, str) else (stripe_subscription or {}).get("id")
            payment = db.query(Payment).filter(Payment.id == metadata.get("payment_id"), Payment.method == "stripe").first()
            if payment and obj.get("payment_status") == "paid":
                payment.status = "paid"
                payment.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
                subscription.status = "active"
                subscription.period_start = payment.verified_at
                subscription.period_end = payment.verified_at + timedelta(days=30)
            elif payment and event_type in {"checkout.session.async_payment_failed", "checkout.session.expired"}:
                payment.status = "failed"
                subscription.status = "failed"
            db.commit()
    elif event_type in {"invoice.paid", "invoice.payment_failed"}:
        stripe_subscription = obj.get("subscription")
        stripe_subscription_id = stripe_subscription if isinstance(stripe_subscription, str) else (stripe_subscription or {}).get("id")
        subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == stripe_subscription_id).first()
        if subscription:
            invoice_id = obj.get("id")
            is_paid = event_type == "invoice.paid"
            payment = db.query(Payment).filter(Payment.provider_reference == invoice_id).first()
            if payment is None and obj.get("billing_reason") == "subscription_create":
                payment = (
                    db.query(Payment)
                    .filter(Payment.subscription_id == subscription.id, Payment.method == "stripe", Payment.status.in_(["pending", "paid"]))
                    .order_by(Payment.id.asc())
                    .first()
                )
                if payment:
                    payment.provider_reference = invoice_id
            if payment is None:
                payment = Payment(subscription_id=subscription.id, user_id=subscription.user_id, amount_cents=obj.get("amount_paid", obj.get("amount_due", 0)), currency=obj.get("currency", "eur"), method="stripe", status="pending", provider_reference=invoice_id)
                db.add(payment)
            payment.status = "paid" if is_paid else "failed"
            if is_paid:
                payment.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
            if is_paid:
                subscription.status = "active"
            elif subscription.status == "active":
                subscription.status = "past_due"
            db.commit()
    elif event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == obj.get("id")).first()
        if subscription:
            subscription.status = "canceled" if event_type.endswith("deleted") else obj.get("status", subscription.status)
            db.commit()
    return {"received": True}
