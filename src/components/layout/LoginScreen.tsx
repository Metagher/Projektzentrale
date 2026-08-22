import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';

export default function LoginScreen() {
  const { loginEmail, linkSent, loginBusy, loginError, requestLoginLink, resetLoginStep } = useConnectionStore();
  const [email, setEmail] = useState(loginEmail);

  return (
    <div id="setup-screen">
      <div className="setup-box">
        <h1>Anmelden</h1>
        {!linkSent && (
          <>
            <p>Trag deine E-Mail-Adresse ein — du bekommst einen Anmelde-Link zugeschickt.</p>
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
            <button className="btn" disabled={loginBusy} onClick={() => requestLoginLink(email)}>
              {loginBusy ? 'Sende Link…' : 'Anmelde-Link senden'}
            </button>
          </>
        )}
        {linkSent && (
          <>
            <p>
              Link an <strong>{loginEmail}</strong> gesendet (Postfach inkl. Spam-Ordner prüfen). Klick auf den
              Link im selben Browser, um dich anzumelden — diese Seite aktualisiert sich dann automatisch.
            </p>
            <button className="btn secondary" style={{ width: '100%' }} onClick={resetLoginStep}>
              Andere E-Mail-Adresse
            </button>
          </>
        )}
      </div>
    </div>
  );
}
