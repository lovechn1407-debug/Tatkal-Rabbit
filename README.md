# ⚡ Tatkal Rabbit – IRCTC High-Speed Tatkal Auto-Fill & Cloud Subscription Suite

<div align="center">
  <img src="web/assets/tatkal-rabbit-brand.png" alt="Tatkal Rabbit" width="480"/>
  <p><b>Atomic Speed IRCTC Automation • Dual Old/New Site Support • Google Auth & Real-Time Cloud Subscriptions</b></p>
</div>

---

## 🌟 Overview

**Tatkal Rabbit** is an advanced Chrome Extension and web portal ecosystem engineered to solve the 10:00 AM & 11:00 AM IRCTC Tatkal ticket scramble. By eliminating human lag with millisecond-precision NTP server synchronization, sub-second passenger auto-filling, auto-selection of instant UPI QR gateways (Paytm, Google Pay, PhonePe, BHIM), and automated site failover between Old (`/nget`) and New (`/eticket`) IRCTC interfaces, Tatkal Rabbit guarantees the fastest possible checkout path.

---

## 🚀 Key Features

### 1. 🚄 Chrome Extension (V4.0.0 Material Design 3)
- **Atomic NTP Clock Sync:** Real-time synchronization with Indian Standard Time (IST) down to milliseconds.
- **Auto-Start Scheduler:** Schedules auto-launch precisely 30 seconds before Tatkal window opens (10:00 AM for AC, 11:00 AM for Non-AC).
- **Sub-Second Autofill:** Injects passenger details, age, berth preference, meal choices, and contact info in under 400ms.
- **Dual Site Switcher:** Toggle between Old IRCTC (`/nget`) and New IRCTC (`/eticket`) with one click to bypass server bottlenecks.
- **Fast-Lane UPI Checkout:** Auto-selects instant UPI QR payment, completely avoiding bank SMS OTP delays.
- **Visual Progress Stepper:** Live visual timeline tracking the 6 automation steps (Launch &rarr; Search &rarr; Select &rarr; Fill &rarr; Captcha Chime &rarr; Pay).
- **Google Profile Integration:** Profile avatar displayed directly in the header bar with subscription validity info and single-click account management.
- **Subscription Protection:** Non-intrusive paywall overlay locking automation until a valid pass is authenticated.

### 2. 🌐 Web Portal (`/web`) – Vercel & Cloud Ready
- **Marketing Homepage (`/` or `index.html`):** Modern Material 3 showcase, live IST clock, features breakdown, interactive extension mockup, step-by-step installation instructions, and FAQ.
- **Client Portal (`/client` or `client.html`):**
  - Sign in with Google (Firebase Authentication).
  - Live subscription status badge and real-time countdown timer (Days, Hours, Minutes, Seconds).
  - 3-tier pass selector:
    - **2-Day Express Pass:** ~~₹149~~ **₹49**
    - **Weekly Explorer Pass:** ~~₹399~~ **₹119**
    - **Monthly Pro Pass:** ~~₹999~~ **₹299**
  - Interactive simulated checkout dialog supporting Paytm UPI, Google Pay, PhonePe, and BHIM UPI with instant Firestore cloud synchronization.
  - Automatic cross-tab sync with the Chrome Extension via `chrome.storage.local`.
- **Admin Panel (`/admin` or `admin.html`):**
  - **Strict Access Control:** Enforces Google Sign-In strictly restricted to **`lovechn1407@gmail.com`**. All other accounts are instantly blocked and signed out.
  - **KPI Metrics:** Total registered users, active passes, expired passes, and total revenue calculation.
  - **Real-Time User Table:** Live Firestore stream displaying all users, display names, emails, avatars, UIDs, and pass statuses.
  - **Subscription Controls:**
    - Quick extension: `+2 Days`, `+7 Days`, `+30 Days`.
    - Custom days grant modal (e.g., +15, +60, +90, +365 days).
    - Instant Suspend / Unsuspend toggle.
    - Transaction and booking audit history modal.

---

## 🛠️ Architecture & Tech Stack

- **Front-end:** HTML5, CSS3 (Material Design 3 tokens, Poppins typography, Glassmorphism, Responsive CSS Grid & Flexbox).
- **Extension:** Manifest V3, Web Components (`@material/web`), Chrome Storage API, Chrome Alarms, AES-GCM crypto.
- **Cloud & Database:** Firebase Auth (Google OAuth), Google Cloud Firestore v10 modular SDK.
- **Hosting:** Vercel configuration (`vercel.json`) with clean URL rewrites.

---

## 📦 Chrome Extension Installation Guide

1. Clone or download this repository as a `.zip` file:
   ```bash
   git clone https://github.com/lovechn1407-debug/Tatkal-Rabbit.git
   ```
2. Open Google Chrome (or any Chromium browser like Brave, Edge, Opera).
3. In the URL address bar, enter `chrome://extensions/` and press Enter.
4. Enable **"Developer mode"** via the toggle switch in the top-right corner.
5. Click the **"Load unpacked"** button in the top-left corner.
6. Select the root folder of this repository.
7. Click the Tatkal Rabbit icon in your browser toolbar, sign in with Google, activate your pass, and enjoy lightning-speed Tatkal bookings!

---

## ☁️ Deploying the Web Portal to Vercel

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com).
3. Click **"Add New Project"** &rarr; select `Tatkal-Rabbit`.
4. Leave root directory as default. The included `vercel.json` automatically configures routes:
   - `/` &rarr; `web/index.html`
   - `/client` &rarr; `web/client.html`
   - `/admin` &rarr; `web/admin.html`
5. Click **Deploy**. Your website and client/admin portals are live instantly!

---

## 🔒 Security & Privacy

- **Zero Remote Storage of IRCTC Passwords:** User IRCTC login credentials and passenger details are saved only in the local Chrome extension sandbox, encrypted using client-side AES-GCM.
- **Strict Admin Email Verification:** Admin endpoints verify `auth.currentUser.email === "lovechn1407@gmail.com"`.
- **Firebase Security:** Firestore queries restrict modification and enforce secure schema bindings.

---

## 📄 License & Credits

Designed & Developed by **Love Chauhan** (`lovechn1407@gmail.com`).  
Official GitHub Repository: [https://github.com/lovechn1407-debug/Tatkal-Rabbit](https://github.com/lovechn1407-debug/Tatkal-Rabbit)
