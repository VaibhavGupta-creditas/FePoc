import { useState, useEffect } from 'react';

// Premium Glassmorphism UI for Passkey Flow
export default function Home() {
  const [step, setStep] = useState('login'); // login | otp | prompt | passkey | dashboard
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [formData, setFormData] = useState({ mobile: '', card: '', otp: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [accountInfo, setAccountInfo] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 5));
  };

  const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000') 
                  ? "http://localhost:8000/api" 
                  : "/api";

  // Manually ensure scripts are loaded
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadScript = (src) => {
      return new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript("https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"),
    ]).then(() => {
      console.log("WebAuthn runtime loaded");
      setSdkLoaded(true);
    });
  }, []);

  // Simplified: No SDK class needed. Just use the browser runtime.
  const getSWA = () => {
    return window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;
  };

  // Step 1: Check Account
  async function handleCheckAccount(e) {
    e.preventDefault();
    setError('');
    addLog(`>>> Checking account: ${formData.mobile}`);
    try {
      const res = await fetch(`${API_BASE}/check-account/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: formData.mobile, card: formData.card })
      });
      const data = await res.json();
      addLog(`<<< Received: ${JSON.stringify(data).substring(0, 50)}...`);

      if (!res.ok) {
        setError(data.message || 'Validation failed');
        setStatus('');
        return;
      }

      setAccountInfo(data); // Stores passkey_options and challenge_id if they exist
      if (data.has_passkey) {
        setStep('passkey');
        setStatus('Passkey found! Ready for biometric login.');
      } else {
        setStep('otp');
        setStatus('Account found. Please verify with OTP (Use 123456).');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
      setStatus('');
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setStatus('Verifying OTP...');
    try {
      const res = await fetch(`${API_BASE}/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: formData.otp, user_id: accountInfo.user_id })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'OTP Verification failed');
        setStatus('');
        return;
      }

      console.log("OTP Verification Response:", data);

      if (data.status === 'success') {
        setAccountInfo(prev => ({ ...prev, ...data })); // Merge registration options
        if (data.show_passkey_prompt) {
          setStep('prompt');
          setStatus('OTP Verified! One more step.');
        } else {
          setStep('dashboard');
          setStatus('Logged in successfully');
        }
      }
    } catch (err) {
      setError('Error: ' + err.message);
      setStatus('');
    }
  }

  // Step 2 (Alternative): Passkey Login
  async function handlePasskeyLogin() {
    addLog(`>>> Starting biometric login for ${accountInfo.username}`);
    setStatus('Authenticating...');
    setError('');
    try {
      if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
        throw new Error("This browser does not support Passkeys.");
      }

      const swa = getSWA();
      if (!swa) throw new Error("Biometric module still loading...");
      
      addLog(`Waiting for browser biometric prompt...`);
      
      const assertion = await swa.startAuthentication({ optionsJSON: accountInfo.passkey_options });
      
      const res = await fetch(`${API_BASE}/verify-passkey/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challenge_id: accountInfo.challenge_id, 
          credential: assertion
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed.");
      
      addLog(`<<< Login Success!`);
      setStep('dashboard');
      setStatus('Welcome back!');
    } catch (err) {
      const errorMsg = err.message || 'Biometric login failed.';
      setError(errorMsg);
      setStatus('');
      addLog(`!!! Error: ${errorMsg}`);
    }
  }

  // UI Styles
  const inputStyle = { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', background: 'rgba(255, 255, 255, 0.8)' };
  const buttonStyle = { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' };
  const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' };
  const cardStyle = { background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Login</h2>
        {/* <p style={{ color: '#666', fontSize: '14px' }}>Powered by Passkey Auth Core</p> */}

        {step === 'login' && (
          <form onSubmit={handleCheckAccount}>
            <input style={inputStyle} placeholder="Mobile Number" required onChange={e => setFormData({...formData, mobile: e.target.value})} />
            <input style={inputStyle} placeholder="Card Number (Last 4 digits)" required maxLength="4" onChange={e => setFormData({...formData, card: e.target.value})} />
            <button type="submit" style={buttonStyle}>Continue</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP}>
            <p style={{ color: '#444' }}>Verification code sent to {formData.mobile}</p>
            <input style={inputStyle} placeholder="Enter 123456" required onChange={e => setFormData({...formData, otp: e.target.value})} />
            <button type="submit" style={buttonStyle}>Verify & Login</button>
            <button type="button" onClick={() => setStep('login')} style={{...buttonStyle, background: 'none', color: '#666', fontSize: '14px'}}>Back</button>
          </form>
        )}

        {step === 'passkey' && (
          <div>
            <p style={{ color: '#444' }}>Hello, {accountInfo?.username}!</p>
            <p style={{ fontSize: '14px', marginBottom: '20px' }}>Your account is secured with a Passkey.</p>
            <button onClick={handlePasskeyLogin} style={buttonStyle}>Login with Fingerprint/FaceID</button>
            <p style={{ fontSize: '11px', color: '#999', marginTop: '10px' }}>
              Note: If using your phone to login, please ensure <b>Bluetooth</b> is enabled on both devices.
            </p>
            <button onClick={() => setStep('otp')} style={{...buttonStyle, background: '#eee', color: '#333'}}>Use OTP Instead</button>
          </div>
        )}

        {step === 'prompt' && (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🛡️</div>
            <h3 style={{ color: '#333' }}>Secure your account?</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Enable Fingerprint/FaceID for faster logins next time.</p>
            <button 
              onClick={async () => {
                try {
                  setStatus('Enabling Passkey...');
                  setError('');
                  
                  const swa = getSWA();
                  if (!swa) throw new Error("Biometric module still loading...");

                  // 1. Trigger Native Prompt
                  const credential = await swa.startRegistration({ optionsJSON: accountInfo.passkey_options });

                  // 2. Verify with Fused API
                  const res = await fetch(`${API_BASE}/verify-passkey/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      challenge_id: accountInfo.challenge_id, 
                      credential,
                      reg_token: accountInfo.reg_token
                    })
                  });

                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message || "Registration failed.");

                  setStep('dashboard');
                  setStatus('Passkey enabled successfully!');
                } catch (err) { 
                  setError(err.message || 'Enabling failed.');
                  setStatus('');
                }
              }} 
              style={buttonStyle}
            >
              Yes, Enable Now
            </button>
            <button onClick={() => setStep('dashboard')} style={{...buttonStyle, background: '#eee', color: '#333'}}>Maybe Later</button>
          </div>
        )}

        {step === 'dashboard' && (
          <div>
            <div style={{ fontSize: '50px', marginBottom: '20px' }}>🎉</div>
            <h3 style={{ color: '#2ecc71' }}>Success!</h3>
            <p>Welcome to your secure dashboard.</p>
            <button onClick={() => window.location.reload()} style={buttonStyle}>Sign Out</button>
          </div>
        )}

        {status && <div style={{ marginTop: '20px', color: '#2980b9', fontSize: '13px' }}>{status}</div>}
        {error && <div style={{ marginTop: '20px', color: '#e74c3c', fontSize: '13px' }}>{error}</div>}
        {!sdkLoaded && <div style={{ marginTop: '10px', color: '#aaa', fontSize: '10px' }}>Initializing security modules...</div>}
      </div>

      {/* Debugger Panel */}
      {/* <div style={{
        marginTop: '30px',
        width: '100%',
        maxWidth: '430px',
        background: '#1e1e1e',
        color: '#00ff00',
        padding: '15px',
        borderRadius: '10px',
        fontFamily: 'monospace',
        fontSize: '11px',
        textAlign: 'left',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '10px', paddingBottom: '5px', fontWeight: 'bold' }}>
          Real-time Flow Debugger
        </div>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
        ))}
        {logs.length === 0 && <div style={{ color: '#666' }}>Waiting for activity...</div>}
      </div> */}
    </div>
  );
}
