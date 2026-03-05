# Multi-Framework Demo Project

This directory contains reference implementations for integrating the **Passkey Auth Core** into a real-world application stack.

## 📂 Project Structure

- **`django_test_app/`**: A Django project serving as the backend.
  - Demonstrates integration with a MySQL database.
  - Implements a legacy "OTP-first" flow that transitions to Passkeys.
  - Shows how to use the `UserProfile` as an Identity Holder (`auth_id`, `display_name`).
- **`nextjs_test_app/`**: A modern Next.js 15 frontend.
  - Integrates the `PassKeySDK` for biometric triggers.
  - Demonstrates a "Glassmorphism" UI for various authentication states (Login, OTP, Passkey, Dashboard).

## 🚀 Running the Full Stack

### 1. Backend (Django)
```bash
cd django_test_app
pip install -e ../../passkey-auth-core
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
*Note: Ensure you have a MySQL database named `passkey_db` configured.*

### 2. Frontend (Next.js)
```bash
cd nextjs_test_app
npm install
npm run dev
```

## 🔐 Key Integration Highlights

1. **Identity Masking**: Observe the `/api/check-account/` response. It returns an encrypted `user_id`, which is the only identifier used by the Next.js app.
2. **Flexible Mapping**: The Django app maps user identity to `profile.auth_id` and display labels to `profile.display_name` via `settings.py`.
3. **Hybrid Readiness**: The system is optimized for **Cross-Device** (QR Scan) logins. To test on a mobile phone, ensure `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` are set to your local network IP or an `ngrok` domain.

## 🧪 Demonstration Flow
1. Open `http://localhost:3000`.
2. Enter mobile/card details for a new user.
3. Complete the OTP step (use code `123456`).
4. On first login, you will be prompted to "Secure your account with Biometrics".
5. Register your face/fingerprint.
6. Refresh and use the "Passkey" button for instant, passwordless access!
