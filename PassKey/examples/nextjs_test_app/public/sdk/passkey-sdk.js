/**
 * PassKey Platform Frontend SDK
 */
class PassKeySDK {
    /**
     * @param {string} baseUrl - The base URL of your Django API (different for Dev/UAT/Prod)
     */
    constructor(baseUrl) {
        // Ensure no trailing slash
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    /**
     * Start the registration process
     */
    async register(token) {
        // 1. Get options from Passkey Core
        const optionsRes = await fetch(`${this.baseUrl}/register/options/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        if (!optionsRes.ok) throw new Error("Failed to get registration options");
        const { challenge_id, options } = await optionsRes.json();

        // 2. Browser WebAuthn Call
        const credential = await SimpleWebAuthnBrowser.startRegistration(options);

        // 3. Send result back
        const resultRes = await fetch(`${this.baseUrl}/register/result/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge_id, credential })
        });
        return await resultRes.json();
    }

    /**
     * Start the login process
     */
    async login(username) {
        // 1. Get options
        const optionsRes = await fetch(`${this.baseUrl}/login/options/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (!optionsRes.ok) throw new Error("Failed to get login options");
        const { challenge_id, options } = await optionsRes.json();

        // 2. Browser WebAuthn Call
        const assertion = await SimpleWebAuthnBrowser.startAuthentication(options);

        // 3. Send result back
        const resultRes = await fetch(`${this.baseUrl}/login/result/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge_id, username, credential: assertion })
        });
        return await resultRes.json();
    }
}

// Helper for WebAuthn browser calls (using @simplewebauthn/browser v10+)
const SimpleWebAuthnBrowser = {
    async startRegistration(options) {
        const swa = typeof SimpleWebAuthnBrowser_dist_bundle_index_umd_min !== 'undefined' 
            ? SimpleWebAuthnBrowser_dist_bundle_index_umd_min 
            : window.SimpleWebAuthnBrowser;

        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded");
        
        return await swa.startRegistration({ optionsJSON: options });
    },
    async startAuthentication(options) {
        const swa = typeof SimpleWebAuthnBrowser_dist_bundle_index_umd_min !== 'undefined' 
            ? SimpleWebAuthnBrowser_dist_bundle_index_umd_min 
            : window.SimpleWebAuthnBrowser;

        if (!swa) throw new Error("SimpleWebAuthnBrowser library not loaded");

        return await swa.startAuthentication({ optionsJSON: options });
    }
};
