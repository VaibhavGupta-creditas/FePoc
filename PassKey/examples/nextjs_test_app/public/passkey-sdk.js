/**
 * Passkey Auth Core - Frontend SDK
 * A lightweight wrapper for WebAuthn operations.
 */
class PassKeySDK {
    /**
     * @param {string} baseUrl - The full URL to your Django passkey endpoints (e.g. https://api.bank.com/api/passkey)
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    /**
     * Step 2: Enroll a new Passkey using pre-fetched options
     * @param {Object} options - The publicKey options from the business API
     * @param {string} challenge_id - The internal tracker ID
     * @param {string} reg_token - The registration JWT
     */
    async completeRegistration(options, challenge_id, reg_token) {
        // 1. Trigger Browser Fingerprint/FaceID prompt
        let credential;
        try {
            credential = await SimpleWebAuthnBrowser.startRegistration(options);
        } catch (err) {
            throw new Error(this._handleError(err));
        }

        // 2. Verify and save result (using unified verification endpoint)
        const res = await fetch(`${this.baseUrl}/verify-passkey/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                challenge_id, 
                credential,
                reg_token 
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration verification failed");
        return data;
    }

    /**
     * Step 2: Login using pre-fetched options
     * @param {Object} options - The publicKey options from the business API
     * @param {string} challenge_id - The internal tracker ID
     */
    async completeLogin(options, challenge_id) {
        // 1. Trigger Browser Biometric auth
        let assertion;
        try {
            assertion = await SimpleWebAuthnBrowser.startAuthentication(options);
        } catch (err) {
            throw new Error(this._handleError(err));
        }

        // 2. Verify and log in (using unified verification endpoint)
        const res = await fetch(`${this.baseUrl}/verify-passkey/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                challenge_id, 
                credential: assertion
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login verification failed");
        return data;
    }

    /**
     * Check if user has passkeys and get reg_token
     */
    async getStatus() {
        const res = await fetch(`${this.baseUrl}/status/`);
        return await res.json();
    }

    /**
     * Helper to transform obscure WebAuthn errors into user-friendly messages
     */
    _handleError(err) {
        // console.error("WebAuthn Error:", err);
        if (err.name === 'NotAllowedError') {
            return "Operation cancelled or blocked. Please ensure biometrics are enabled.";
        }
        if (err.name === 'TimeoutError') {
            return "Authentication timed out. Please try again.";
        }
        return err.message || "An unexpected error occurred.";
    }
}

/**
 * Internal helper to interface with @simplewebauthn/browser
 */
const SimpleWebAuthnBrowser = {
    async startRegistration(options) {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded.");
        try {
            return await swa.startRegistration({ optionsJSON: options });
        } catch (err) {
            throw err;
        }
    },
    async startAuthentication(options) {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded.");
        try {
            return await swa.startAuthentication({ optionsJSON: options });
        } catch (err) {
            throw err;
        }
    }
};

// Export for modern JS or attach to window for legacy scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PassKeySDK;
} else if (typeof window !== 'undefined') {
    window.PassKeySDK = PassKeySDK;
}
