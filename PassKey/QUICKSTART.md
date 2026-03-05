# 🚀 Passkey Auth Core Quickstart Guide

Build a secure, passwordless authentication system in under 5 minutes.

## 📋 Prerequisites
- **Python 3.10+** (Django backend)
- **Node.js 20+** (Next.js frontend)
- **MySQL & Redis** (Default storage)

## 🛠️ Backend Setup (Django)

1. **Configure Database**:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS passkey_db;"
   ```

2. **Install core & project dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install -e ./passkey-auth-core
   ```

3. **Migrate & Start**:
   ```bash
   cd examples/django_test_app
   python manage.py migrate
   python manage.py runserver 0.0.0.0:8000
   ```

## 🌐 Frontend Setup (Next.js)

1. **Install and Start**:
   ```bash
   cd examples/nextjs_test_app
   npm install
   npm run dev
   ```

## 🧪 Testing the Flow
1. Open `http://localhost:3000`.
2. **First Login**: Use the "Login with OTP" flow (Simulated).
   - Use any Mobile # and Card #.
   - **Mock OTP Code**: `123456`.
3. **Register**: Accept the biometric prompt to "Enable Passkey".
4. **Instant Access**: Logout and enjoy the "Login with Passkey" experience!

---

### 💡 Troubleshooting
- **CORS Errors**: Ensure `PASSKEY_ORIGIN` in the backend `settings.py` matches your frontend URL (including the port).
- **Mobile QR Problem**: Passkeys require HTTPS or `localhost`. For mobile testing, use `ngrok` and update `PASSKEY_RP_ID` to your ngrok domain.
