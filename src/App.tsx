import { useEffect } from 'react';
import { useConnectionStore } from './store/connectionStore';
import { useDataStore } from './store/dataStore';
import SetupScreen from './components/layout/SetupScreen';
import StorageBanner from './components/layout/StorageBanner';
import Sidebar from './components/layout/Sidebar';
import MainShell from './components/layout/MainShell';
import ModalRoot from './components/shared/ModalRoot';

export default function App() {
  const { status, boot } = useConnectionStore();
  const loadAll = useDataStore((s) => s.loadAll);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (status === 'ready') loadAll();
  }, [status, loadAll]);

  if (status === 'booting') return null;

  return (
    <>
      <StorageBanner />
      <ModalRoot />
      {status === 'setup' && <SetupScreen />}
      {status === 'ready' && (
        <div id="app" className="ready">
          <Sidebar />
          <MainShell />
        </div>
      )}
    </>
  );
}
