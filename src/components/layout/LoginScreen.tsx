import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';

export default function LoginScreen() {
  const { loginStep, loginEmail, loginBusy, loginError, requestLoginCode, verifyLoginCode, resetLoginStep } =
    useConnectionStore();
  const [email, setEmail] = useState(loginEmail);
  const [code, setCode] = useState('');

  return (
    <div id="setup-screen">
      <div className="setup-box">
        <h1>Anmelden</h1>
        {loginStep === 'email' && (
          <>
            <p>Trag deine E-Mail-Adresse ein — du bekommst einen 6-stelligen Anmeldecode zugeschickt.</p>
            <div className="field">
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.de"
                autoFocus
              />
            </div>
            {loginError && <div className="setup-error">{loginError}</div>}
            <button className="btn" disabled={loginBusy} onClick={() => requestLoginCode(email)}>
              {loginBusy ? 'Sende Code…' : 'Code anfordern'}
            </button>
          </>
        )}
        {loginStep === 'code' && (
          <>
            <p>
              Code an <strong>{loginEmail}</strong> gesendet. Bitte eintragen (Postfach inkl. Spam-Ordner prüfen).
            </p>
            <div className="field">
              <label>Anmeldecode</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoFocus
              />
            </div>
            {loginError && <div className="setup-error">{loginError}</div>}
            <button className="btn" disabled={loginBusy} onClick={() => verifyLoginCode(code)}>
              {loginBusy ? 'Prüfe…' : 'Anmelden'}
            </button>
            <button className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={resetLoginStep}>
              Andere E-Mail-Adresse
            </button>
          </>
        )}
      </div>
    </div>
  );
}
