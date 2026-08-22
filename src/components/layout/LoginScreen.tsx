import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';

export default function LoginScreen() {
  const { loginBusy, loginError, login } = useConnectionStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit() {
    if (!loginBusy) login(email, password);
  }

  return (
    <div id="setup-screen">
      <div className="setup-box">
        <h1>Anmelden</h1>
        <p>Mit deinem Supabase-Account anmelden.</p>
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
        <div className="field">
          <label>Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {loginError && <div className="setup-error">{loginError}</div>}
        <button className="btn" disabled={loginBusy} onClick={submit}>
          {loginBusy ? 'Prüfe…' : 'Anmelden'}
        </button>
      </div>
    </div>
  );
}
