# PassKey Integration Guide

This guide provides a step-by-step approach to integrating the **Passkey Auth Core** into your existing Django application ecosystem.

## 🏗️ Architecture Overview

The system consists of three main parts:
1. **Passkey Auth Core (Django Package)**: A pluggable app that manages WebAuthn logic and credential storage.
2. **Main Application**: Your existing project where users are managed.
3. **Frontend SDK**: A lightweight JavaScript library that orchestrates the browser-backend handshake.

---

## 🔐 Step 1: Identity Mapping

Passkeys are bound to a "User Handle". To prevent leaking database IDs, we use **Identity Masking**.

### 1.1 Update Your User Profile
Your `UserProfile` (or equivalent) should hold a unique, non-sequential identifier.
```python
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    auth_id = models.CharField(max_length=64, unique=True) # Used for Passkeys
    display_name = models.CharField(max_length=100)        # Shown in Biometric Prompts
```

### 1.2 Configure the Core
In your `settings.py`, tell the Passkey core where to find these fields:
```python
PASSKEY_USER_ID_FIELD = "profile.auth_id"   # Dot-notation supported
PASSKEY_USERNAME_FIELD = "profile.display_name"
```

---

## 📝 Step 2: Registration Flow

Registration should only happen *after* a user has established their identity (e.g., via OTP or Password).

### 2.1 Issue a Registration Token
After successful login, generate a short-lived token:
```python
from passkey_core.services import PasskeyService

def login_view(request):
    # ... your login logic ...
    if login_success:
        reg_token = PasskeyService.generate_registration_token(user)
        return JsonResponse({
            "status": "success",
            "reg_token": reg_token,
            "user_id": PasskeyService.get_user_id(user) # Encrypted Masked ID
        })
```

### 2.2 Frontend Registration
Use the SDK to complete the registration:
```javascript
const sdk = new PassKeySDK("/api/passkey");
await sdk.register(reg_token);
```

---

## 🔑 Step 3: Authentication Flow

Authentication is designed to be "ID-first" for privacy.

### 3.1 Check Account
First, resolve the user's masked ID:
```python
# Your endpoint
def check_account(request):
    user = User.objects.get(username=request.POST['username'])
    return JsonResponse({
        "user_id": PasskeyService.get_user_id(user), # The Masked ID
        "has_passkey": PasskeyService.check_user_has_passkeys(user)
    })
```

### 3.2 Frontend Login
Trigger the biometric prompt:
```javascript
await sdk.login({ user_id: masked_id });
```
The SDK will send `{"user_id": "..."}` to the `/api/passkey/login/options/` endpoint.

---

## ⚙️ Configuration Cheat Sheet

| Setting | Description | Default |
|---------|-------------|---------|
| `PASSKEY_RP_ID` | Domain (e.g., `prod.bank.com`) | `localhost` |
| `PASSKEY_ORIGIN` | Full Frontend URL | `http://localhost:8000` |
| `PASSKEY_ID_REQUEST_KEY` | Key name for incoming IDs | `"user_id"` |
| `PASSKEY_USER_ID_FIELD` | User model field for raw ID | `"id"` |

---

## 🚀 Optimization for Mobile
To ensure the fastest QR-code scan experience, the core service uses:
- `user_verification: DISCOURAGED` (Reduces redundant prompts)
- `resident_key: REQUIRED` (Enables one-touch discovery)

For production environments requiring the highest security, you can toggle these to `REQUIRED` in your settings.
