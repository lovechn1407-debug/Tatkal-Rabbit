// Vercel Serverless Function: Create Cashfree PG Order
// Creates an official Cashfree payment order and returns payment_session_id

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = (process.env.CASHFREE_ENV || "production").toLowerCase();

const CF_BASE_URL = CASHFREE_ENV === "sandbox"
  ? "https://sandbox.cashfree.com/pg"
  : "https://api.cashfree.com/pg";

const DEFAULT_PLANS = {
  "2day": { id: "2day", name: "2-Day Express Pass", discountedPrice: 49, durationDays: 2 },
  "weekly": { id: "weekly", name: "Weekly Explorer Pass", discountedPrice: 119, durationDays: 7 },
  "monthly": { id: "monthly", name: "Monthly Pro Pass", discountedPrice: 299, durationDays: 30 }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Cashfree credentials are not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in your Vercel Environment Variables."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { planId, uid, email, name, phone, returnUrl } = body;

    if (!planId || !DEFAULT_PLANS[planId]) {
      return res.status(400).json({ ok: false, error: "Invalid or missing planId (must be 2day, weekly, or monthly)" });
    }

    const plan = { ...DEFAULT_PLANS[planId] };

    // Fetch live price from Firestore if available to guarantee current admin price
    try {
      const fsRes = await fetch("https://firestore.googleapis.com/v1/projects/tatkal-rabbit/databases/(default)/documents/settings/pricing");
      if (fsRes.ok) {
        const json = await fsRes.json();
        if (json && json.fields && json.fields[planId]) {
          const livePrice = json.fields[planId]?.mapValue?.fields?.discountedPrice?.integerValue 
            ?? json.fields[planId]?.mapValue?.fields?.discountedPrice?.doubleValue;
          if (livePrice !== undefined && Number(livePrice) > 0) {
            plan.discountedPrice = Number(livePrice);
          }
        }
      }
    } catch (e) {
      // Use default price if Firestore fetch fails
    }

    const orderAmount = Number(plan.discountedPrice).toFixed(2);
    const orderId = `tr_${planId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Sanitize customer ID (Cashfree requires alphanumeric, underscores, hyphens, 3-50 chars)
    const rawUid = (uid || "guest_" + Date.now()).toString();
    const safeCustomerId = rawUid.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 45);

    // Sanitize phone (Cashfree requires 10-digit number)
    let cleanPhone = (phone || "").toString().replace(/[^0-9]/g, "");
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
    if (cleanPhone.length < 10) cleanPhone = "9999999999";

    const customerEmail = email && email.includes("@") ? email.trim() : "customer@tatkalrabbit.com";
    const customerName = name && name.trim() ? name.trim().substring(0, 50) : "Tatkal Rabbit User";

    const callbackUrl = returnUrl || "https://tatkal-rabbit.vercel.app/client?order_id={order_id}";

    const orderPayload = {
      order_id: orderId,
      order_amount: Number(orderAmount),
      order_currency: "INR",
      customer_details: {
        customer_id: safeCustomerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: cleanPhone
      },
      order_meta: {
        return_url: callbackUrl
      },
      order_note: `Tatkal Rabbit Pass: ${plan.name}`,
      order_tags: {
        plan_id: planId,
        plan_name: plan.name,
        duration_days: String(plan.durationDays),
        user_id: safeCustomerId
      }
    };

    const cfRes = await fetch(`${CF_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY
      },
      body: JSON.stringify(orderPayload)
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.payment_session_id) {
      console.error("[Cashfree Create Order Error]", cfRes.status, cfData);
      return res.status(cfRes.status || 400).json({
        ok: false,
        error: cfData.message || "Failed to initialize Cashfree checkout session",
        details: cfData
      });
    }

    return res.status(200).json({
      ok: true,
      order_id: cfData.order_id,
      cf_order_id: cfData.cf_order_id,
      payment_session_id: cfData.payment_session_id,
      order_amount: orderAmount,
      planId: plan.id,
      planName: plan.name,
      durationDays: plan.durationDays,
      environment: CASHFREE_ENV
    });

  } catch (err) {
    console.error("[Server Create Order Error]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
