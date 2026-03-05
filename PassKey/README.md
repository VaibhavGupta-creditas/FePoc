# PassKey Platform

A secure, privacy-preserving Passkey (WebAuthn) authentication system for Django ecosystems.

> [!IMPORTANT]
> **Privacy First**: This platform uses a specialized identity masking system. Raw database IDs are never shared with the frontend or exposed over the network.

## 📦 What's Inside?

1.  **`passkey-auth-core/`**: A pluggable Django package that provides a complete WebAuthn backend with encrypted identity tokens and customizable response mapping.
2.  **`examples/django_test_app/`**: A demo integration showing how to link Passkeys to a custom `UserProfile` (Auth ID/Display Name) and a legacy OTP flow.
3.  **`examples/nextjs_test_app/`**: A high-fidelity Next.js implementation demonstrating the "Passwordless" user experience.
4.  **`sdk/`**: High-level JavaScript SDK that abstracts away the complexity of WebAuthn and handles all hardware/API communication securely.

## 🚀 Key Features

*   **🔒 Identity Masking**: Automatically encrypts and signs primary identifiers. Internal IDs (UUIDs/PKs) stay inside your database.
*   **🌐 Cross-Device Support**: Pre-configured for seamless Mobile-to-Laptop (QR Code) handshakes.
*   **🛠️ Nested Attributes**: Flexible configuration allows you to map passkeys to any user profile field (e.g., `profile.auth_id`).
*   **⚡ Rapid Handshake**: Optimized biometric discovery settings for a frictionless "One-Touch" login experience.
*   **MySQL & Redis Ready**: Production-grade storage for credentials and challenges.

## 📄 License
MIT
