/**
 * Passkey Utils - Helper for Fused API Integration
 * Handles Base64 translation for native navigator.credentials API.
 * This allows using Passkeys without any external SDK.
 */

const base64ToBytes = (base64) => {
    const binString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
};

const bytesToBase64 = (bytes) => {
    const binString = String.fromCodePoint(...new Uint8Array(bytes));
    return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export const passkeyUtils = {
    /**
     * Translates JSON options from Django into the Buffer format required by the browser.
     */
    parseOptions: (options) => {
        const parsed = { ...options };
        if (parsed.challenge) parsed.challenge = base64ToBytes(parsed.challenge);
        if (parsed.user && parsed.user.id) parsed.user.id = base64ToBytes(parsed.user.id);
        if (parsed.allowCredentials) {
            parsed.allowCredentials = parsed.allowCredentials.map(c => ({
                ...c,
                id: base64ToBytes(c.id)
            }));
        }
        return parsed;
    },

    /**
     * Translates the browser's credential object into a JSON-friendly format for the server.
     */
    serializeResult: (credential) => {
        return {
            id: credential.id,
            rawId: bytesToBase64(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: bytesToBase64(credential.response.clientDataJSON),
                attestationObject: credential.response.attestationObject ? bytesToBase64(credential.response.attestationObject) : undefined,
                authenticatorData: credential.response.authenticatorData ? bytesToBase64(credential.response.authenticatorData) : undefined,
                signature: credential.response.signature ? bytesToBase64(credential.response.signature) : undefined,
                userHandle: credential.response.userHandle ? bytesToBase64(credential.response.userHandle) : undefined,
            }
        };
    },

    /**
     * Triggers the native browser prompt and returns the result in one step.
     */
    performRegistration: async (options) => {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        const result = await swa.startRegistration({ optionsJSON: options });
        return result;
    },

    performLogin: async (options) => {
        const swa = window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
        const result = await swa.startAuthentication({ optionsJSON: options });
        return result;
    }
};
