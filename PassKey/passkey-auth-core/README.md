# Passkey Auth Core v1.1.0

A professional, plug-and-play Django application for implementing WebAuthn (Passkey) authentication with **Identity Masking** and **Flexible Payload Support**.

## 🚀 Key Features

- **🔐 Identity Masking**: Never expose raw database IDs. Uses signed/encrypted `auth_id` for all API and Hardware Handshakes.
- **✨ Nested Attribute Support**: Map user identity to any field or nested relationship (e.g., `profile.auth_id`, `employee.external_id`).
- **⚡ Fast Hybrid Flows**: Optimized for QR Code scanning and Cross-Device (Mobile) logins with "Ready-to-Scan" discovery.
- **🛠 Dynamic Parameter Support**: Configurable JSON keys for both request payloads and success responses.
- **🛡️ Secure-by-Default**: Hardware-level user IDs are limited to 64 chars (standard compliant) while API IDs remain long-form encrypted tokens.

---

## 📦 Installation

```bash
pip install git+https://github.com/creditas-in/passkey-auth-core.git
```

## 🛠 Setup

### 1. Register Application
Add to your Django `settings.py`:
```python
INSTALLED_APPS = [
    ...,
    'rest_framework',
    'passkey_core',
]
```

### 2. Configure URLs
Extend your project's `urls.py`:
```python
urlpatterns = [
    path('api/passkey/', include('passkey_core.urls')),
]
```

### 3. Apply Migrations
```bash
python manage.py migrate
```

---

## ⚙️ Configuration (Advanced Settings)

Add these to your `settings.py` to customize the identity flow:

```python
# == 1. Identity Mapping ==
PASSKEY_USER_ID_FIELD = "profile.auth_id"   # Field used for identification (supports dot notation)
PASSKEY_USERNAME_FIELD = "profile.display_name" # Field used for biometric prompt labels

# == 2. API Key Naming (Payload Standardization) ==
PASSKEY_ID_REQUEST_KEY = "user_id"          # Key name for encrypted ID in request body
PASSKEY_ID_JSON_KEY = "user_id"             # Key name for encrypted ID in success response
PASSKEY_NAME_JSON_KEY = "username"          # Key name for Display Name in success response

# == 3. RP Settings (Required for Cross-Device/Mobile) ==
PASSKEY_RP_ID = "localhost"                 # Your domain (No http/https) 
PASSKEY_RP_NAME = "My Bank Platform"
PASSKEY_ORIGIN = "http://localhost:3000"    # Full URL of your frontend
```

### 🔒 Security Note: Identity Masking
The core package automatically signs and encrypts the value retrieved from `PASSKEY_USER_ID_FIELD`. This ensures that internal database IDs or UUIDs are never exposed in JSON payloads or browser logs.

---

## 🧪 Testing Locally

The package includes a demo environment in the `/examples` folder.
1. Run `python manage.py runserver` in the demo folder.
2. The API will be available at `http://localhost:8000/api/passkey/`.

## 📜 License
MIT License.
