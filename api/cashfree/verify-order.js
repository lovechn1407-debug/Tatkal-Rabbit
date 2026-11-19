// Vercel Serverless Function: Verify Cashfree PG Order
// Verifies order status with Cashfree official API to validate payment

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = (process.env.CASHFREE_ENV || "production").toLowerCase();

const CF_BASE_URL = CASHFREE_ENV === "sandbox"
  ? "https://sandbox.cashfree.com/pg"
  : "https://api.cashfree.com/pg";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Cashfree credentials are not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in your Vercel Environment Variables."
    });
  }

  try {
    let orderId = "";
    if (req.method === "GET") {
      orderId = req.query?.order_id || "";
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      orderId = body.order_id || req.query?.order_id || "";
    }

    if (!orderId) {
      return res.status(400).json({ ok: false, error: "Missing required parameter: order_id" });
    }

    const cfRes = await fetch(`${CF_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY
      }
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error("[Cashfree Verify Error]", cfRes.status, cfData);
      return res.status(cfRes.status || 400).json({
        ok: false,
        error: cfData.message || "Failed to fetch order from Cashfree",
        details: cfData
      });
    }

    const orderStatus = (cfData.order_status || "").toUpperCase();
    const isPaid = orderStatus === "PAID";

    // Determine plan info from tags, order_id prefix, or amount
    let planId = cfData.order_tags?.plan_id || "";
    let durationDays = Number(cfData.order_tags?.duration_days || 0);

    if (!planId) {
      if (orderId.includes("2day")) {
        planId = "2day";
        durationDays = 2;
      } else if (orderId.includes("weekly")) {
        planId = "weekly";
        durationDays = 7;
      } else if (orderId.includes("monthly")) {
        planId = "monthly";
        durationDays = 30;
      } else {
        const amt = Number(cfData.order_amount);
        if (amt < 80) { planId = "2day"; durationDays = 2; }
        else if (amt < 200) { planId = "weekly"; durationDays = 7; }
        else { planId = "monthly"; durationDays = 30; }
      }
    }

    if (!durationDays) {
      durationDays = planId === "2day" ? 2 : planId === "weekly" ? 7 : 30;
    }

    return res.status(200).json({
      ok: true,
      paid: isPaid,
      order_id: cfData.order_id,
      cf_order_id: cfData.cf_order_id,
      order_status: orderStatus,
      order_amount: cfData.order_amount,
      planId: planId,
      durationDays: durationDays,
      customerId: cfData.customer_details?.customer_id,
      customerEmail: cfData.customer_details?.customer_email,
      customerPhone: cfData.customer_details?.customer_phone,
      paidAt: cfData.created_at || new Date().toISOString()
    });

  } catch (err) {
    console.error("[Server Verify Order Error]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
