import { useState, useEffect } from 'react';

// --- Premium Icon Components ---
const IconShield = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#049f6c' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconMail = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#049f6c' }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconFingerprint = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#1a1a1a' }}>
    <path d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12" />
    <path d="M5 15C5 11.134 8.13401 8 12 8C15.866 8 19 11.134 19 15" />
    <path d="M8 18C8 15.7909 9.79086 14 12 14C14.2091 14 16 15.7909 16 18" />
    <path d="M12 20V22" />
    <path d="M12 11V11.01" />
    <path d="M12 5V5.01" />
  </svg>
);

const IconSparkles = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffa500' }}>
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#049f6c' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default function Home() {
  const [step, setStep] = useState('login'); // login | otp | prompt | passkey | dashboard
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [formData, setFormData] = useState({ mobile: '', card: '', otp: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [accountInfo, setAccountInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000') 
                  ? "http://localhost:8000/api" 
                  : "/api";

  // Load SDK
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
      setSdkLoaded(true);
    });
  }, []);

  const getSWA = () => window.SimpleWebAuthnBrowser || window.SimpleWebAuthnBrowser_dist_bundle_index_umd_min;

  // Validation
  const validateLogin = () => {
    if (!/^\d{10}$/.test(formData.mobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    if (!/^\d{4}$/.test(formData.card)) {
      setError('Please enter the last 4 digits of your card.');
      return false;
    }
    return true;
  };

  // Step 1: Check Account
  async function handleCheckAccount(e) {
    if (e) e.preventDefault();
    if (!validateLogin()) return;

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/check-account/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: formData.mobile, card: formData.card })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Validation failed. Please try again.');
        setLoading(false);
        return;
      }

      setAccountInfo(data);
      if (data.has_passkey) {
        setStep('passkey');
        setStatus('Biometrics found! Authenticating...');
      } else {
        setStep('otp');
        setStatus('User verified. OTP required.');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (formData.otp.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: formData.otp, user_id: accountInfo.user_id })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Incorrect verification code.');
        setLoading(false);
        return;
      }

      if (data.status === 'success') {
        setAccountInfo(prev => ({ ...prev, ...data }));
        if (data.show_passkey_prompt) {
          setStep('prompt');
          setStatus('');
        } else {
          setStep('dashboard');
        }
      }
    } catch (err) {
      setError('Error verifying OTP: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2 (Alternative): Passkey Login
  async function handlePasskeyLogin() {
    setLoading(true);
    setError('');
    try {
      const swa = getSWA();
      if (!swa) throw new Error("Security module initializing...");
      
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
      if (!res.ok) throw new Error(data.message || "Authentication failed.");
      
      setStep('dashboard');
    } catch (err) {
      setError(err.message || 'Biometric login failed.');
    } finally {
      setLoading(false);
    }
  }

  // Styles
  const glassStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
    
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }

    .container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      padding: 20px;
      overflow: hidden;
      position: relative;
      background: linear-gradient(-45deg, #0f172a, #111827, #020617, #0f172a);
      background-size: 400% 400%;
      animation: gradientBG 15s ease infinite;
    }

    @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .background-mesh {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      opacity: 0.6;
      filter: blur(100px);
      z-index: 0;
    }

    .blob {
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      mix-blend-mode: screen;
      animation: moveBlobs 25s infinite alternate;
    }

    .blob-1 { background: #0ea5e9; top: -10%; left: -10%; animation-duration: 18s; }
    .blob-2 { background: #d946ef; bottom: -10%; right: -10%; animation-duration: 22s; animation-delay: -2s; }
    .blob-3 { background: #10b981; top: 40%; right: 10%; animation-duration: 15s; animation-delay: -5s; }

    @keyframes moveBlobs {
      from { transform: translate(0,0) rotate(0deg) scale(1); }
      to { transform: translate(100px, 100px) rotate(360deg) scale(1.2); }
    }

    .card {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 56px;
      border-radius: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 440px;
      text-align: center;
      position: relative;
      z-index: 10;
      color: #fff;
      animation: cardEntrance 1s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes cardEntrance {
      from { opacity: 0; transform: scale(0.9) translateY(40px); filter: blur(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
    }

    .shaker { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
      40%, 60% { transform: translate3d(4px, 0, 0); }
    }

    .logo-badge {
      width: 68px;
      height: 68px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      border: 1.5px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
    }

    .brand-name {
      font-weight: 600;
      font-size: 30px;
      color: #fff;
      letter-spacing: -1px;
      margin-bottom: 8px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }

    .brand-sub {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 44px;
      font-weight: 400;
    }

    .input-group {
      margin-bottom: 24px;
      text-align: left;
    }

    .label {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 12px;
      display: block;
      margin-left: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input {
      width: 100%;
      padding: 16px 20px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      font-size: 17px;
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      outline: none;
      box-sizing: border-box;
      color: #fff;
    }

    .input:focus {
      border-color: #10b981;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
      transform: scale(1.02);
    }

    .btn-primary {
      width: 100%;
      padding: 20px;
      background: #fff;
      color: #000;
      border: none;
      border-radius: 20px;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 30px rgba(255, 255, 255, 0.2);
      background: #f1f1f1;
    }

    .btn-primary:active { transform: translateY(0); }
    .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }

    .error-toast {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      padding: 14px 20px;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 28px;
      border: 1px solid rgba(239, 68, 68, 0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: toastEntrance 0.5s ease;
    }

    @keyframes toastEntrance {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .status-text {
      color: #10b981;
      font-size: 14px;
      margin-top: 20px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .btn-link {
      background: transparent;
      color: rgba(255, 255, 255, 0.4);
      font-size: 15px;
      font-weight: 500;
      margin-top: 32px;
      border: none;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-link:hover { color: #fff; }

    .spinner {
      width: 22px;
      height: 22px;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: #000;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .icon-wrapper {
      margin-bottom: 32px;
      filter: drop-shadow(0 0 15px rgba(255,255,255,0.2));
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
      from { transform: scale(0.5); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;

  return (
    <div className="container">
      <style>{glassStyles}</style>
      
      {/* Premium Animated Background */}
      <div className="background-mesh">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className={`card ${error ? 'shaker' : ''}`}>
        
        {step === 'login' && (
          <>
            <div className="logo-badge"><IconShield /></div>
            <div className="brand-name">FinSecure</div>
            <div className="brand-sub">Modern biometrics for your account</div>
            
            {error && (
              <div className="error-toast">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
            
            <form onSubmit={handleCheckAccount}>
              <div className="input-group">
                <span className="label">Mobile Number</span>
                <input 
                  className="input" 
                  placeholder="Enter Mobile Number" 
                  type="tel"
                  maxLength="10"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <div className="input-group">
                <span className="label">Last 4 digits of card</span>
                <input 
                  className="input" 
                  placeholder="••••" 
                  type="password"
                  maxLength="4"
                  value={formData.card}
                  onChange={e => setFormData({ ...formData, card: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <button className="btn-primary" disabled={loading} type="submit">
                {loading ? <div className="spinner"></div> : 'Confirm Identity'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="icon-wrapper"><IconMail /></div>
            <div className="brand-name">Verify it's you</div>
            <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '32px', lineHeight: '1.5' }}>
              We've sent a one-time code to <br/><span style={{ color: '#fff', fontWeight: 500 }}>+91 ••••• ••{formData.mobile.slice(-2)}</span>
            </p>
            {error && <div className="error-toast">{error}</div>}
            <form onSubmit={handleVerifyOTP}>
              <input 
                className="input" 
                style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '26px', fontWeight: 'bold', marginBottom: '24px' }}
                placeholder="000000"
                maxLength="6"
                onChange={e => setFormData({...formData, otp: e.target.value.replace(/\D/g, '')})} 
              />
              <button className="btn-primary" disabled={loading} type="submit">
                {loading ? <div className="spinner"></div> : 'Verify Code'}
              </button>
              <button className="btn-link" type="button" onClick={() => setStep('login')}>Use a different method</button>
            </form>
          </>
        )}

        {step === 'passkey' && (
          <>
            <div className="icon-wrapper"><IconFingerprint /></div>
            <div className="brand-name">Sign in instantly</div>
            <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '40px', lineHeight: '1.6' }}>
              Welcome back, <b>{accountInfo?.username}</b>.<br/>
              Access your account with your biometrics.
            </p>
            {error && <div className="error-toast">{error}</div>}
            <button onClick={handlePasskeyLogin} className="btn-primary" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Use Touch ID / Face ID'}
            </button>
            <button className="btn-link" onClick={() => setStep('otp')}>Sign in with SMS code</button>
          </>
        )}

        {step === 'prompt' && (
          <>
            <div className="icon-wrapper"><IconSparkles /></div>
            <div className="brand-name">Unlock Passkeys</div>
            <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '32px', lineHeight: '1.6' }}>
              Experience faster, safer sign-ins.<br/>
              Enable biometrics for this device.
            </p>
            {error && <div className="error-toast">{error}</div>}
            <button className="btn-primary" 
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  const swa = getSWA();
                  if (!swa) throw new Error("Initializing...");
                  const credential = await swa.startRegistration({ optionsJSON: accountInfo.passkey_options });
                  const res = await fetch(`${API_BASE}/verify-passkey/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      challenge_id: accountInfo.challenge_id, 
                      credential,
                      reg_token: accountInfo.reg_token
                    })
                  });
                  if (!res.ok) throw new Error("Registration failed.");
                  setStep('dashboard');
                } catch (err) { setError(err.message); } finally { setLoading(false); }
              }}
            >
              {loading ? <div className="spinner"></div> : 'Set Up Biometrics'}
            </button>
            <button className="btn-link" onClick={() => setStep('dashboard')}>Not right now</button>
          </>
        )}

        {step === 'dashboard' && (
          <div style={{ animation: 'cardEntrance 1s ease' }}>
            <div className="icon-wrapper" style={{ margin: '20px 0 32px' }}><IconCheckCircle /></div>
            <div className="brand-name" style={{ color: '#10b981' }}>Successfully Signed In</div>
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', marginBottom: '40px', fontSize: '16px' }}>Your session is now secure and active.</p>
            <button className="btn-primary" style={{ background: '#fff' }} onClick={() => window.location.reload()}>Sign Out</button>
          </div>
        )}

        {status && step !== 'dashboard' && <div className="status-text">{status}</div>}
        {!sdkLoaded && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '24px' }}>Loading secure environment...</div>}
      </div>
    </div>
  );
}
