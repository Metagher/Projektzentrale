import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';

export default function SetupScreen() {
  const { setupUrl, setupKey, setupError, connecting, connect } = useConnectionStore();
  const [url, setUrl] = useState(setupUrl);
  const [key, setKey] = useState(setupKey);

  return (
    <div id="setup-screen">
      <div className="setup-box">
        <h1>Projektzentrale einrichten</h1>
        <p>
          Verbinde die App einmalig mit deiner Supabase-Datenbank. Die Zugangsdaten werden nur
          lokal in diesem Browser gespeichert (localStorage), nicht im Code.
        </p>
        <div className="field">
          <label>Project URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxx.supabase.co"
          />
        </div>
        <div className="field">
          <label>anon public key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." />
        </div>
        {setupError && <div className="setup-error">{setupError}</div>}
        <button className="btn" disabled={connecting} onClick={() => connect(url, key)}>
          {connecting ? 'Verbinde…' : 'Verbinden & speichern'}
        </button>
      </div>
    </div>
  );
}
