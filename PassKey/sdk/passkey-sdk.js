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
     * Enroll a new Passkey
     * @param {string} token - The registration token received from the backend
     */
    async register(token) {
        // 1. Fetch challenge from backend
        const optionsRes = await fetch(`${this.baseUrl}/register/options/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const optionsData = await optionsRes.json();
        if (!optionsRes.ok) throw new Error(optionsData.error || "Failed to get registration options");
        
        const { challenge_id, options } = optionsData;

        // 2. Trigger Browser Fingerprint/FaceID prompt
        let credential;
        try {
            credential = await SimpleWebAuthnBrowser.startRegistration(options);
        } catch (err) {
            await this._cleanup(challenge_id, 'reg').catch(() => {});
            throw new Error(this._handleError(err));
        }

        // 3. Verify and save result
        const resultRes = await fetch(`${this.baseUrl}/register/result/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge_id, credential })
        });
        
        const resultData = await resultRes.json();
        if (!resultRes.ok) throw new Error(resultData.error || "Registration verification failed");
        
        return resultData;
    }

    /**
     * Login using an existing Passkey
     * @param {string|object} identifier - The user's username (string) OR an object { username, user_id }
     */
    async login(identifier) {
        let body = {};
        if (typeof identifier === 'string') {
            body.username = identifier;
        } else if (identifier && typeof identifier === 'object') {
            if (identifier.user_id) {
                body.user_id = identifier.user_id;
            } else if (identifier.username) {
                body.username = identifier.username;
            }
        }

        // 1. Fetch authentication challenge
        const optionsRes = await fetch(`${this.baseUrl}/login/options/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const optionsData = await optionsRes.json();
        if (!optionsRes.ok) throw new Error(optionsData.error || "Failed to get login options");
        
        const { challenge_id, options } = optionsData;

        // 2. Trigger Browser Biometric auth
        let assertion;
        try {
            assertion = await SimpleWebAuthnBrowser.startAuthentication(options);
        } catch (err) {
            await this._cleanup(challenge_id, 'auth').catch(() => {});
            throw new Error(this._handleError(err));
        }

        // 3. Verify signature and log in
        const resultBody = { 
            challenge_id, 
            credential: assertion 
        };
        if (body.user_id) resultBody.user_id = body.user_id;
        else if (body.username) resultBody.username = body.username;

        const resultRes = await fetch(`${this.baseUrl}/login/result/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resultBody)
        });
        
        const resultData = await resultRes.json();
        if (!resultRes.ok) throw new Error(resultData.error || "Login verification failed");
        
        return resultData;
    }

    /**
     * Check if user has passkeys and get reg_token
     */
    async getStatus() {
        const res = await fetch(`${this.baseUrl}/status/`);
        return await res.json();
    }

    /**
     * Explicitly invalidate a challenge in Redis
     */
    async _cleanup(challenge_id, type) {
        if (!challenge_id) return;
        return await fetch(`${this.baseUrl}/cleanup/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge_id, type })
        });
    }
    /**
     * Helper to transform obscure WebAuthn errors into user-friendly messages
     */
    _handleError(err) {
        // console.error("WebAuthn Error:", err);
        if (err.name === 'NotAllowedError') {
            return "Operation cancelled or blocked. Please ensure Bluetooth is ON if using a mobile device.";
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
