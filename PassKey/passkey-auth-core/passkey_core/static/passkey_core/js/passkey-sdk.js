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
        const credential = await SimpleWebAuthnBrowser.startRegistration(options);

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
     * @param {string} username - The user's unique identifier (mobile, email, etc.)
     */
    async login(username) {
        // 1. Fetch authentication challenge
        const optionsRes = await fetch(`${this.baseUrl}/login/options/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const optionsData = await optionsRes.json();
        if (!optionsRes.ok) throw new Error(optionsData.error || "Failed to get login options");
        
        const { challenge_id, options } = optionsData;

        // 2. Trigger Browser Biometric auth
        const assertion = await SimpleWebAuthnBrowser.startAuthentication(options);

        // 3. Verify signature and log in
        const resultRes = await fetch(`${this.baseUrl}/login/result/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge_id, username, credential: assertion })
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
}

/**
 * Internal helper to interface with @simplewebauthn/browser
 */
const SimpleWebAuthnBrowser = {
    async startRegistration(options) {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded. Please install @simplewebauthn/browser");
        return await swa.startRegistration({ optionsJSON: options });
    },
    async startAuthentication(options) {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded. Please install @simplewebauthn/browser");
        return await swa.startAuthentication({ optionsJSON: options });
    }
};

// Export for modern JS or attach to window for legacy scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PassKeySDK;
} else if (typeof window !== 'undefined') {
    window.PassKeySDK = PassKeySDK;
}
