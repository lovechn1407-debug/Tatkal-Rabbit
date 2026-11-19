// Vercel Serverless Function: Public Dynamic Pricing Endpoint
// Returns current custom subscription pricing to any unauthenticated client (Homepage, Client Portal, Extension)

let cachedPricing = {
  "2day": { discountedPrice: 49, originalPrice: 149 },
  "weekly": { discountedPrice: 119, originalPrice: 399 },
  "monthly": { discountedPrice: 299, originalPrice: 999 }
};

export default async function handler(req, res) {
  // Global CORS headers allowing Extension, Website, and localhost
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Admin updates pricing via POST
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (body && body["2day"]) {
        cachedPricing = {
          "2day": {
            discountedPrice: Number(body["2day"].discountedPrice || 49),
            originalPrice: Number(body["2day"].originalPrice || 149)
          },
          "weekly": {
            discountedPrice: Number(body["weekly"].discountedPrice || 119),
            originalPrice: Number(body["weekly"].originalPrice || 399)
          },
          "monthly": {
            discountedPrice: Number(body["monthly"].discountedPrice || 299),
            originalPrice: Number(body["monthly"].originalPrice || 999)
          }
        };
        return res.status(200).json({ ok: true, pricing: cachedPricing });
      }
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }

  // Public GET: Attempt to fetch latest from Firestore REST API, fallback to cachedPricing
  try {
    const fsRes = await fetch("https://firestore.googleapis.com/v1/projects/tatkal-rabbit/databases/(default)/documents/settings/pricing");
    if (fsRes.ok) {
      const json = await fsRes.json();
      if (json && json.fields) {
        const live = {
          "2day": {
            discountedPrice: Number(json.fields["2day"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? cachedPricing["2day"].discountedPrice),
            originalPrice: Number(json.fields["2day"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.originalPrice?.doubleValue ?? cachedPricing["2day"].originalPrice)
          },
          "weekly": {
            discountedPrice: Number(json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? cachedPricing["weekly"].discountedPrice),
            originalPrice: Number(json.fields["weekly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? cachedPricing["weekly"].originalPrice)
          },
          "monthly": {
            discountedPrice: Number(json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? cachedPricing["monthly"].discountedPrice),
            originalPrice: Number(json.fields["monthly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? cachedPricing["monthly"].originalPrice)
          }
        };
        cachedPricing = live;
        return res.status(200).json(live);
      }
    }
  } catch (err) {
    // Silent fallback to cachedPricing
  }

  return res.status(200).json(cachedPricing);
}
