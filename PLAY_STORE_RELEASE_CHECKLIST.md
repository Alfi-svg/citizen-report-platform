# 🚀 Google Play Store Release Preparation & Submission Guide

**Application:** Nirapotta (নিরাপত্তা) — Citizen Safety Platform  
**Package Name:** `com.bangladeshcitizenreport.app`  
**Version:** `1.0.0` (versionCode: `1`)  
**Target SDK:** 36 (Google Play requirement: $\ge 34$)  
**Minimum SDK:** 24 (Android 7.0+)  
**Branch:** `android-app`  
**Release Readiness:** ✅ Ready for Play Store Submission  

---

## 1. Store Listing Metadata

### 1.1 App Title
- **English:** `Nirapotta - Citizen Safety & Mutual Aid` (39 / 50 characters)
- **Bengali (bn-BD):** `নিরাপত্তা - নাগরিক সুরক্ষা ও রক্ত সহায়তা` (40 / 50 characters)

### 1.2 Short Description
- **English:** `Report civic hazards, locate emergency blood donors, and find missing persons.` (79 / 80 characters)
- **Bengali (bn-BD):** `নাগরিক সমস্যা রিপোর্ট করুন, জরুরি রক্তদাতা খুঁজুন এবং নিখোঁজ মানুষ সন্ধান করুন।` (77 / 80 characters)

### 1.3 Full Description

#### English (en-US):
```text
Nirapotta (নিরাপত্তা) is a citizen-powered platform dedicated to public safety, mutual aid, and transparent civic reporting across Bangladesh.

Together, citizens, community guardians, and emergency volunteers collaborate to build safer neighborhoods through verified information and rapid mutual assistance.

🌟 CORE FEATURES:

🛡️ CIVIC INCIDENT REPORTING
• Report road hazards, public safety risks, infrastructure breakdowns, and localized emergencies.
• Attach photographic evidence, geolocation tags, and descriptions.
• Privacy Protection: Submit sensitive incidents in Anonymous mode.
• Algorithmic location fuzzing (~110m) on public heatmaps safeguards personal residence privacy.

🩸 VERIFIED BLOOD HELP & MUTUAL AID
• Voluntary donor directory connecting patients with blood donors in real-time.
• Filter emergency requests by blood group (A+, A-, B+, B-, AB+, AB-, O+, O-), district, and urgency.
• Official verification workflow for completed blood donations.
• Donor rating and appreciation badges celebrating community heroes.

🔍 MISSING PERSONS SEARCH NETWORK
• Post and broadcast urgent missing person alerts with physical descriptors and contact information.
• Community sighting submissions to assist families and coordinators.
• Real-time notification broadcasts for high-priority alerts.

🗺️ SAFETY MAP & EMERGENCY DIRECTORY
• Interactive live safety map showing reported civic hazards and road blockages.
• One-tap emergency directory for national emergency hotlines:
  - 🚨 National Emergency: 999
  - 📞 Women & Child Helpline: 109
  - 🏛️ Citizen Services: 333
• Standard dialer integration with zero automatic background dialing.

🏅 TRUST SCORE & IMPACT POINTS
• Transparent community reputation system rewarding verified, truthful reporting.
• Tiered contributor badges: New Contributor, Active Helper, Trusted Contributor, Community Guardian, and Nirapotta Champion.
• Strict anti-spam and penalty deterrence against fabricated or harmful reports.

🌐 BILINGUAL ACCESSIBILITY
• Full Bengali (বাংলা) and English interface support with instant language switching.

🔒 PRIVACY & SECURITY COMMITMENT
• Cleartext HTTP strictly disabled; all traffic encrypted via modern TLS 1.3/HTTPS.
• Principle of least privilege: No intrusive permissions requested.
• Complete self-service account deactivation and personal data deletion supported in-app and on our web portal.

Nirapotta is a civic platform and is not a replacement for law enforcement or 999. In active life-threatening emergencies, always dial 999 directly.
```

#### Bengali (bn-BD):
```text
নিরাপত্তা (Nirapotta) একটি মুক্ত নাগরিক প্ল্যাটফর্ম যা জনগণের নিরাপত্তা, পারস্পরিক মানবিক সহায়তা এবং স্বচ্ছ নাগরিক রিপোর্টিং নিশ্চিত করার উদ্দেশ্যে নির্মিত।

নাগরিক, কমিউনিটি ভলান্টিয়ার এবং সচেতন সমাজের সমন্বয়ে একটি নিরাপদ ও সচেতন বাংলাদেশ গড়ে তোলাই আমাদের লক্ষ্য।

🌟 প্রধান সেবাসমূহ:

🛡️ নাগরিক সমস্যা ও ঘটনা রিপোর্টিং
• রাস্তার গর্ত, দুর্ঘটনা, নিরাপত্তা ঝুঁকি, অবকাঠামোগত সমস্যা সরাসরি রিপোর্ট করুন।
• ছবির প্রমাণ, সুনির্দিষ্ট ম্যাপ লোকেশন এবং বিবরণ সংযুক্ত করার সুবিধা।
• পরিচয় সুরক্ষায় সংবেদনশীল ঘটনায় বেনামী (Anonymous) রিপোর্ট করার সুবিধা।
• নাগরিকের ব্যক্তিগত বাসস্থানের গোপনীয়তা রক্ষায় পাবলিক ম্যাপে আনুমানিক ১১০ মিটার ফাজি রেডিয়াস প্রযোজ্য।

🩸 জরুরি রক্ত সহায়তা (Blood Help)
• রোগী ও রক্তদাতাদের মধ্যে সরাসরি ও দ্রুত যোগাযোগের উন্মুক্ত মাধ্যম।
• রক্তের গ্রুপ (A+, A-, B+, B-, AB+, AB-, O+, O-), জেলা ও জরুরি অবস্থা অনুযায়ী ফিল্টার করার সুবিধা।
• রক্তদানের সত্যতা যাচাইকরণ (Verified Donation) এবং দাতাকে রেটিং ও সম্মাননা ব্যাজ প্রদান।
• সম্পূর্ণ অলাভজনক ও নিঃস্বার্থ মানবিক সেবা।

🔍 নিখোঁজ ব্যক্তি সন্ধান নেটওয়ার্ক
• নিখোঁজ প্রিয়জনের তথ্য, ছবি ও বিবরণ দিয়ে জরুরি সতর্কতা প্রকাশ।
• কোনো নাগরিক নিখোঁজ ব্যক্তির সন্ধান পেলে প্রত্যক্ষদর্শীর তথ্য (Sighting Report) জমা দিতে পারেন।

🗺️ নিরাপত্তা মানচিত্র ও জরুরি সেবা ডিরেক্টরি
• লাইভ সেফটি ম্যাপের মাধ্যমে আপনার এলাকার ঝুঁকি ও নোটিশ পর্যবেক্ষণ করুন।
• জাতীয় জরুরি হটলাইনে তাৎক্ষণিক ফোন ডায়াল করার সুবিধা:
  - 🚨 জাতীয় জরুরি সেবা: ৯৯৯
  - 📞 নারী ও শিশু হেল্পলাইন: ১০৯
  - 🏛️ নাগরিক সেবা ও তথ্য: ৩৩৩

🏅 ট্রাস্ট স্কোর ও ইমপ্যাক্ট পয়েন্ট
• গঠনমূলক ও সত্য রিপোর্টিংয়ের মাধ্যমে ট্রাস্ট স্কোর ও ব্যাজ অর্জন করুন।
• ভুয়া ও বিভ্রান্তিকর রিপোর্ট প্রতিরোধে কঠোর অ্যালগরিদম ও মডারেশন ব্যবস্থা।

🌐 সহজ দ্বিভাষিক ব্যবহার
• বাংলা ও ইংরেজি উভয় ভাষায় সম্পূর্ণ অ্যাপ ব্যবহারের সুবিধা।
```

---

## 2. Store Assets Inventory

All assets conform strictly to Google Play Developer Console specifications:

| Asset | File Location | Specifications | Status |
| :--- | :--- | :--- | :--- |
| **App Icon** | `frontend/android/store-assets/icon-512x512.png` | 512 x 512 px, 32-bit PNG, 244 KB | ✅ Verified |
| **Feature Graphic** | `frontend/android/store-assets/feature-graphic-1024x500.png` | 1024 x 500 px, 24-bit PNG (no alpha), 141 KB | ✅ Verified |
| **Phone Screenshot 1** | `frontend/android/store-assets/screenshots/01-home-screen.png` | 1080 x 1920 px, Home feed & emergency cards | ✅ Verified |
| **Phone Screenshot 2** | `frontend/android/store-assets/screenshots/02-incident-reporting.png` | 1080 x 1920 px, Incident reports stream | ✅ Verified |
| **Phone Screenshot 3** | `frontend/android/store-assets/screenshots/03-safety-center.png` | 1080 x 1920 px, Safety Center hotlines | ✅ Verified |
| **Phone Screenshot 4** | `frontend/android/store-assets/screenshots/04-blood-help-mutual-aid.png` | 1080 x 1920 px, Blood Help donor search | ✅ Verified |
| **Phone Screenshot 5** | `frontend/android/store-assets/screenshots/05-missing-persons-search.png` | 1080 x 1920 px, Missing persons network | ✅ Verified |
| **Phone Screenshot 6** | `frontend/android/store-assets/screenshots/06-create-report-evidence.png` | 1080 x 1920 px, Incident submission & proof | ✅ Verified |

---

## 3. Mandatory URLs & Legal Compliance

| Requirement | Published URL | In-App Access | Policy Requirement |
| :--- | :--- | :--- | :--- |
| **Privacy Policy** | `https://frontend-ten-delta-a5irgspmf7.vercel.app/privacy` | Footer & Dashboard | Google Play User Data Policy |
| **Terms of Service** | `https://frontend-ten-delta-a5irgspmf7.vercel.app/terms` | Footer & Dashboard | Community Guidelines |
| **Account Deletion Web URL** | `https://frontend-ten-delta-a5irgspmf7.vercel.app/account-deletion` | Footer & Dashboard | Google Play Account Deletion Policy |
| **Support Email** | `support@nirapotta.app` | Footer & Policy Pages | Store Listing Contact |
| **Developer / Organization** | Nirapotta Safety Team | Web & App About | Store Listing Developer |

---

## 4. Google Play Account Deletion Policy Compliance

Google Play requires that if an app allows account creation, users must be able to delete their account:
1. **In-App Path:**
   - Open Nirapotta App
   - Go to Profile / Dashboard (`/dashboard`)
   - Scroll down to the **Account & Data Privacy** section
   - Tap **Deactivate Account** $\rightarrow$ Confirm modal
   - Account is deactivated immediately via `POST /api/v1/auth/deactivate`, sessions invalidated, and personal data queued for erasure.
2. **Web URL Path:**
   - Accessible to any user (even if app is uninstalled): `https://frontend-ten-delta-a5irgspmf7.vercel.app/account-deletion`
   - Direct self-service deactivation if logged in, or web form submission if app uninstalled.
   - Clarifies data erased (email, hash, contact numbers, push tokens) vs anonymized public safety records.

---

## 5. Google Play Data Safety Section Form Guide

Fill out the Google Play Console **Data Safety** questionnaire with these exact answers:

### 5.1 Data Collection & Sharing Overview
- **Does your app collect or share any of the required user data types?**  
  $\rightarrow$ **YES**
- **Is all of the user data collected by your app encrypted in transit?**  
  $\rightarrow$ **YES** (TLS 1.3 / HTTPS across all public endpoints)
- **Do you provide a way for users to request that their data be deleted?**  
  $\rightarrow$ **YES** (Via in-app button and web URL `https://frontend-ten-delta-a5irgspmf7.vercel.app/account-deletion`)

### 5.2 Specific Data Types
1. **Location:**
   - *Approximate location:* Collected (Yes), Shared (Yes, on public safety map with ~110m fuzzing), Ephemeral (No), Required (No, optional for reports), Purpose: **App functionality**.
   - *Precise location:* Collected (Yes, when filing an incident report), Shared (No, obfuscated before public display), Purpose: **App functionality**.
2. **Personal Info:**
   - *Name:* Collected (Optional profile name), Shared (No, except author display on non-anonymous public reports), Purpose: **Account management, App functionality**.
   - *Email address:* Collected (Yes, for login & security alerts), Shared (No), Purpose: **Account management**.
   - *User IDs:* Collected (Internal UUID), Shared (No), Purpose: **Account management**.
   - *Phone number:* Collected (Optional, only for voluntary Blood Help donor contact), Shared (Visible only to authorized citizens requesting blood aid), Purpose: **App functionality**.
3. **Photos and Videos:**
   - *Photos:* Collected (User-uploaded evidence for reports or missing person alerts), Shared (Publicly displayed on verified reports), Purpose: **App functionality**.
   - *Videos:* Collected (Optional evidence), Shared (Public reports), Purpose: **App functionality**.
4. **Health & Fitness:**
   - *Health info:* Blood group collected (Voluntary, for Blood Help matching), Purpose: **App functionality**.
5. **Messages:**
   - *Other in-app messages:* Public comments on civic reports, Purpose: **App functionality**.
6. **Device or other IDs:**
   - *Device or other IDs:* Firebase Cloud Messaging push token, Purpose: **App functionality, Push notifications**.

---

## 6. Android Permissions & Least Privilege Verification

The app requests only 5 standard permissions in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

- **`CALL_PHONE` check:** Prohibited permission `CALL_PHONE` is **NOT** present. All emergency calls use Android's native `Intent.ACTION_DIAL` (`tel:999`), which hands off to the user's phone dialer.
- **Cleartext Traffic check:** Cleartext traffic is strictly forbidden (`cleartextTrafficPermitted="false"` in `network_security_config.xml`).
- **Target SDK:** 36 (Android 16), which satisfies and exceeds Google Play's requirement ($\ge 34$).

---

## 7. App Access Instructions for Play Store Reviewers

In Google Play Console $\rightarrow$ **App Content** $\rightarrow$ **App Access**:

- Select: **"All or some functionality is restricted"**
- Provide review credentials:
  - **Account name / Username:** `citizen_review`
  - **Password:** `ReviewerSafety2026!`
  - **Explanation text:**
    > "Nirapotta allows public browsing of civic incident reports, safety maps, and emergency hotlines without an account. Reviewers may sign in using the test account above to evaluate authenticated features, including incident report submission, Blood Help donor search, and user dashboard deactivation."

---

## 8. Build & Release Artifacts

To produce the official release artifacts signed with the production keystore:

```bash
cd frontend
# 1. Build optimized web distribution and sync Capacitor
npm run build
npx cap sync android

# 2. Build Release Android App Bundle (AAB for Google Play Console)
cd android
./gradlew bundleRelease

# 3. Build Release APK (for local testing / direct install verification)
./gradlew assembleRelease
```

### Artifact Locations:
- **AAB (Upload to Google Play Console):**  
  `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- **APK (Local device verification):**  
  `frontend/android/app/build/outputs/apk/release/app-release.apk`

---

## 9. Submission Step-by-Step Flow

1. **Google Play Console:** Log in at `play.google.com/console`.
2. **Create App:** Title `Nirapotta`, Default language `English (United States)`, Free app.
3. **App Content:**
   - Complete Privacy Policy URL: `https://frontend-ten-delta-a5irgspmf7.vercel.app/privacy`.
   - Complete Data Safety section following Section 5 above.
   - Complete Account Deletion section: Web URL `https://frontend-ten-delta-a5irgspmf7.vercel.app/account-deletion`.
   - Complete Target Audience (18+).
   - Complete IARC Content Rating questionnaire.
4. **Main Store Listing:**
   - Fill Short & Full descriptions (English & Bengali from Section 1).
   - Upload Icon: `frontend/android/store-assets/icon-512x512.png`.
   - Upload Feature Graphic: `frontend/android/store-assets/feature-graphic-1024x500.png`.
   - Upload Screenshots: `frontend/android/store-assets/screenshots/*.png`.
5. **Release Track:**
   - Create new release in **Internal testing** or **Production**.
   - Upload `app-release.aab`.
   - Rollout for review!
