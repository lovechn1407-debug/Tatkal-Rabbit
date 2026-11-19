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
 * Sign in with Google Popup
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await syncUserRecord(user);
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
  const snap = await getDoc(userRef);

  const now = new Date();
  if (!snap.exists()) {
    // New user default record
    const newUserData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split("@")[0],
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      isAdmin: user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      subscription: {
        status: "inactive", // 'active' | 'expired' | 'suspended' | 'inactive'
        plan: "none",
        validUntil: null,
        activatedAt: null,
        isSuspended: false
      },
      bookingHistory: []
    };
    await setDoc(userRef, newUserData);
    return newUserData;
  } else {
    // Update login timestamp
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      photoURL: user.photoURL || snap.data().photoURL || "",
      displayName: user.displayName || snap.data().displayName || ""
    });
    return snap.data();
  }
}

/**
 * Check if a subscription is currently valid
 */
export function isSubscriptionActive(sub) {
  if (!sub) return false;
  if (sub.isSuspended) return false;
  if (sub.status !== "active") return false;
  if (!sub.validUntil) return false;

  const expiry = sub.validUntil.toDate ? sub.validUntil.toDate() : new Date(sub.validUntil);
  return expiry.getTime() > Date.now();
}

/**
 * Get days/hours remaining in active subscription
 */
export function getSubscriptionTimeRemaining(sub) {
  if (!isSubscriptionActive(sub)) return null;
  const expiry = sub.validUntil.toDate ? sub.validUntil.toDate() : new Date(sub.validUntil);
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalHours, expiryDate: expiry };
}
