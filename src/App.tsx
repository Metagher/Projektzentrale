import { useEffect } from 'react';
import { useConnectionStore } from './store/connectionStore';
import { useDataStore } from './store/dataStore';
import { useInboxStore } from './store/inboxStore';
import SetupScreen from './components/layout/SetupScreen';
import LoginScreen from './components/layout/LoginScreen';
import StorageBanner from './components/layout/StorageBanner';
import MainShell from './components/layout/MainShell';
import ModalRoot from './components/shared/ModalRoot';
import ToastHost from './components/shared/ToastHost';

export default function App() {
  const { status, boot } = useConnectionStore();
  const loadAll = useDataStore((s) => s.loadAll);
  const ensureInboxStarted = useInboxStore((s) => s.ensureStarted);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (status === 'ready') {
      // Erst Projekte laden, dann den Posteingang starten — sonst läuft dessen erster Durchlauf
      // gegen eine noch leere Projektliste und markiert jede Zeile fälschlich als "nicht gefunden".
      loadAll().then(ensureInboxStarted);
    }
  }, [status, loadAll, ensureInboxStarted]);

  if (status === 'booting') return null;

  return (
    <>
      <StorageBanner />
      <ModalRoot />
      <ToastHost />
      {status === 'setup' && <SetupScreen />}
      {status === 'login' && <LoginScreen />}
      {status === 'ready' && (
        <div id="app" className="ready">
          <MainShell />
        </div>
      )}
    </>
  );
}
