import { useEffect } from 'react';
import { useConnectionStore } from './store/connectionStore';
import SetupScreen from './components/layout/SetupScreen';
import StorageBanner from './components/layout/StorageBanner';
import Sidebar from './components/layout/Sidebar';
import MainShell from './components/layout/MainShell';

export default function App() {
  const { status, boot } = useConnectionStore();

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'booting') return null;

  return (
    <>
      <StorageBanner />
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
