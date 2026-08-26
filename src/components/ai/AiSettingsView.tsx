import { useState } from 'react';
import { useModalStore } from '../../store/modalStore';
import { useAiStore } from '../../store/aiStore';
import { getAiKey } from '../../lib/ai';

export default function AiSettingsView({ embedded = false }: { embedded?: boolean }) {
  const alert = useModalStore((s) => s.alert);
  const keyPresent = useAiStore((s) => s.keyPresent);
  const saveKey = useAiStore((s) => s.saveKey);
  const removeKey = useAiStore((s) => s.removeKey);
  const currentKey = keyPresent ? getAiKey() || '' : '';
  const masked = currentKey ? currentKey.slice(0, 10) + '…' + currentKey.slice(-4) : '';
  const [input, setInput] = useState('');

  async function handleSave() {
    const val = input.trim();
    if (!val) {
      await alert('Bitte einen API-Key eingeben.');
      return;
    }
    saveKey(val);
    setInput('');
  }

  function handleRemove() {
    removeKey();
  }

  const content = <>
      <h2>🔑 KI-Einstellungen</h2>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 18px', maxWidth: 640 }}>
        Für alle KI-Funktionen (KI-Suche, KI-Übersicht, Wissensdatenbank, Aufgaben-Erkennung, persönlicher Berater)
        wird ein eigener Anthropic API-Key benötigt, sobald die App außerhalb von Claude läuft. Den Key bekommst du
        unter{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
          console.anthropic.com
        </a>
        .
      </div>
      <div className="card">
        <div className="field">
          <label>Anthropic API-Key{currentKey ? ` (aktuell: ${masked})` : ''}</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="sk-ant-..."
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={handleSave}>
            Speichern
          </button>
          {currentKey && (
            <button className="btn secondary" onClick={handleRemove}>
              Key entfernen
            </button>
          )}
        </div>
      </div>
      <div className="an-note" style={{ maxWidth: 640 }}>
        Wichtig: Der Key wird nur lokal in diesem Browser gespeichert (localStorage) und bei KI-Anfragen direkt aus
        dem Browser an Anthropic gesendet — er ist damit über die Netzwerk-Ansicht der Browser-Entwicklertools
        einsehbar. Das ist für die persönliche Nutzung auf deinen eigenen Geräten unkritisch, teile den Key oder
        dieses Gerät aber nicht mit anderen. Achte außerdem darauf, dass das GitHub-Repository privat bleibt.
      </div>
    </>;
  return embedded ? <div className="settings-embedded-view">{content}</div> : <div className="main-inner">{content}</div>;
}
