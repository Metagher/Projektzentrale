import { useConnectionStore } from '../../store/connectionStore';

export default function StorageBanner() {
  const { bannerTitle, bannerBody, bannerDismissible, hideStorageBanner } = useConnectionStore();
  if (!bannerTitle) return null;
  return (
    <div id="storage-banner" className="show">
      <strong>{bannerTitle}</strong> {bannerBody}
      {bannerDismissible && (
        <button className="banner-close" onClick={hideStorageBanner}>
          Ausblenden
        </button>
      )}
    </div>
  );
}
