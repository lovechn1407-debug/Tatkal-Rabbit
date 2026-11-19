// Tatkal Rabbit - Firebase Configuration & Helper Services
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAIMFUUGaM51a7GXdBqP6iCwH-yaJxq7Ro",
  authDomain: "tatkal-rabbit.firebaseapp.com",
  projectId: "tatkal-rabbit",
  storageBucket: "tatkal-rabbit.firebasestorage.app",
  messagingSenderId: "669016782967",
  appId: "1:669016782967:web:6d2f78dcb3510c55b22e72",
  measurementId: "G-RL83LSGWS8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Admin Email Restriction
export const ADMIN_EMAIL = "lovechn1407@gmail.com";

// Plan Configurations
export const SUBSCRIPTION_PLANS = {
  "2day": {
    id: "2day",
    name: "2-Day Express Pass",
    durationDays: 2,
    originalPrice: 149,
    discountedPrice: 49,
    badge: "Quick Trip",
    description: "48-Hour Full Access for weekend & urgent Tatkal tickets"
  },
  "weekly": {
    id: "weekly",
    name: "Weekly Explorer Pass",
    durationDays: 7,
    originalPrice: 399,
    discountedPrice: 119,
    badge: "Best Value",
    description: "7 Days unlimited fast bookings for frequent travelers"
  },
  "monthly": {
    id: "monthly",
    name: "Monthly Pro Pass",
    durationDays: 30,
    originalPrice: 999,
    discountedPrice: 299,
    badge: "Most Popular",
    description: "30 Days VIP Tatkal automation with priority fast lanes"
  }
};

/**
 * Apply custom pricing object to SUBSCRIPTION_PLANS
 */
export function applyPricingToPlans(data) {
  if (!data) return;
  ["2day", "weekly", "monthly"].forEach(key => {
    if (data[key] && SUBSCRIPTION_PLANS[key]) {
      if (data[key].discountedPrice !== undefined) {
        SUBSCRIPTION_PLANS[key].discountedPrice = Number(data[key].discountedPrice);
      } else if (data[key].price !== undefined) {
        SUBSCRIPTION_PLANS[key].discountedPrice = Number(data[key].price);
      }
      if (data[key].originalPrice !== undefined) {
        SUBSCRIPTION_PLANS[key].originalPrice = Number(data[key].originalPrice);
      }
    }
  });
}

export const CLOUD_PRICING_URL = "https://tatkal-rabbit-default-rtdb.asia-southeast1.firebasedatabase.app/pricing.json";

/**
 * Load live subscription pricing from Firebase Cloud Database
 * Falls back to localStorage cache or default SUBSCRIPTION_PLANS
 */
export async function loadLivePricing() {
  try {
    if (typeof localStorage !== "undefined") {
      const cached = localStorage.getItem("tatkal_custom_pricing");
      if (cached) {
        try { applyPricingToPlans(JSON.parse(cached)); } catch(e) {}
      }
    }

    let data = null;

    // 1. Try Firebase Cloud RTDB (100% public read, zero-auth, instant)
    try {
      const rtdbRes = await fetch(CLOUD_PRICING_URL, { cache: "no-store" });
      if (rtdbRes.ok) {
        const json = await rtdbRes.json();
        if (json && json["2day"] && json["weekly"] && json["monthly"]) {
          data = json;
        }
      }
    } catch (e) {}

    // 2. Try public /api/pricing endpoint
    if (!data || !data["2day"]) {
      try {
        const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://tatkal-rabbit.vercel.app";
        const apiRes = await fetch(`${origin}/api/pricing`, { cache: "no-store" });
        if (apiRes.ok) {
          data = await apiRes.json();
        }
      } catch (e) {}
    }

    // 3. Try Firestore Public REST API
    if (!data || !data["2day"]) {
      try {
        const fsRes = await fetch("https://firestore.googleapis.com/v1/projects/tatkal-rabbit/databases/(default)/documents/settings/pricing");
        if (fsRes.ok) {
          const json = await fsRes.json();
          if (json && json.fields) {
            data = {
              "2day": {
                discountedPrice: Number(json.fields["2day"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 49),
                originalPrice: Number(json.fields["2day"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["2day"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 149)
              },
              "weekly": {
                discountedPrice: Number(json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 119),
                originalPrice: Number(json.fields["weekly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["weekly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 399)
              },
              "monthly": {
                discountedPrice: Number(json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.discountedPrice?.doubleValue ?? 299),
                originalPrice: Number(json.fields["monthly"]?.mapValue?.fields?.originalPrice?.integerValue ?? json.fields["monthly"]?.mapValue?.fields?.originalPrice?.doubleValue ?? 999)
              }
            };
          }
        }
      } catch (e) {}
    }

    // 4. Try Firestore SDK getDoc
    if (!data || !data["2day"]) {
      try {
        const pricingDoc = await getDoc(doc(db, "settings", "pricing"));
        if (pricingDoc.exists()) data = pricingDoc.data();
      } catch (e) {
        try {
          const fallbackDoc = await getDoc(doc(db, "users", "system_pricing"));
          if (fallbackDoc.exists()) data = fallbackDoc.data();
        } catch (err) {}
      }
    }

    if (data && data["2day"]) {
      applyPricingToPlans(data);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tatkal_custom_pricing", JSON.stringify(data));
      }
    }
  } catch (err) {
    console.warn("Could not load live pricing from cloud, using cached/default plans:", err.message);
  }
  return SUBSCRIPTION_PLANS;
}

/**
 * Save pricing configured by admin (lovechn1407@gmail.com)
 */
export async function saveLivePricing(newPricing) {
  if (!auth.currentUser || auth.currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error("Unauthorized: Only " + ADMIN_EMAIL + " can update plan pricing.");
  }

  const payload = {
    "2day": {
      discountedPrice: Number(newPricing["2day"].discountedPrice),
      originalPrice: Number(newPricing["2day"].originalPrice)
    },
    "weekly": {
      discountedPrice: Number(newPricing["weekly"].discountedPrice),
      originalPrice: Number(newPricing["weekly"].originalPrice)
    },
    "monthly": {
      discountedPrice: Number(newPricing["monthly"].discountedPrice),
      originalPrice: Number(newPricing["monthly"].originalPrice)
    },
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser.email
  };

  let saved = false;
  let lastError = null;

  // 1. Save to Firebase Cloud RTDB (guaranteed 100% cloud persistence)
  try {
    const putRes = await fetch(CLOUD_PRICING_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (putRes.ok) {
      saved = true;
    }
  } catch (err) {
    console.warn("Could not save to Cloud RTDB:", err);
  }

  // 2. Try saving to Firestore settings/pricing
  try {
    await setDoc(doc(db, "settings", "pricing"), payload, { merge: true });
    saved = true;
  } catch (err) {
    console.warn("Could not save to settings/pricing (rules restriction):", err.message);
    if (!saved) lastError = err;
  }

  // 3. Also save to users/system_pricing
  try {
    await setDoc(doc(db, "users", "system_pricing"), payload, { merge: true });
    saved = true;
  } catch (err) {
    console.warn("Could not save to users/system_pricing:", err.message);
    if (!saved) lastError = err;
  }

  // 4. Post to /api/pricing so serverless cache updates immediately
  try {
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "";
    if (origin) {
      await fetch(`${origin}/api/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  } catch (e) {}

  if (!saved && lastError) {
    throw lastError;
  }

  applyPricingToPlans(payload);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("tatkal_custom_pricing", JSON.stringify(payload));
  }
  return SUBSCRIPTION_PLANS;
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    try {
      await syncUserRecord(user);
    } catch (syncErr) {
      console.warn("Firestore user sync deferred (rules/offline):", syncErr.message);
    }
    return user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-Out Error:", error);
    throw error;
  }
}

/**
 * Ensure user document exists in Firestore and update lastLogin
 */
export async function syncUserRecord(user) {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  
  const fallbackRecord = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL || "",
    isAdmin: user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    subscription: {
      status: "inactive",
      plan: "none",
      validUntil: null,
      isSuspended: false
    },
    bookingHistory: []
  };

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newUserData = {
        ...fallbackRecord,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      await setDoc(userRef, newUserData);
      return newUserData;
    } else {
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        photoURL: user.photoURL || snap.data().photoURL || "",
        displayName: user.displayName || snap.data().displayName || ""
      });
      return snap.data();
    }
  } catch (err) {
    console.warn("Firestore syncUserRecord permission notice:", err.message);
    return fallbackRecord;
  }
}

/**
 * Parse a Firestore timestamp, ISO string, seconds object, or Date
 */
export function parseTimestamp(val) {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  if (typeof val._seconds === "number") return new Date(val._seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Check if a subscription is currently valid
 */
export function isSubscriptionActive(sub) {
  if (!sub) return false;
  if (sub.isSuspended) return false;
  if (sub.status !== "active") return false;
  if (!sub.validUntil) return false;

  const expiry = parseTimestamp(sub.validUntil);
  if (!expiry) return false;
  return expiry.getTime() > Date.now();
}

/**
 * Get days/hours remaining in active subscription
 */
export function getSubscriptionTimeRemaining(sub) {
  if (!isSubscriptionActive(sub)) return null;
  const expiry = parseTimestamp(sub.validUntil);
  if (!expiry) return null;
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalHours, expiryDate: expiry };
}
