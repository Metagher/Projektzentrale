const CHATBOT_URL = 'http://172.16.0.122:5259';

export default function CompanyChatbotView() {
  return <div className="company-chatbot-view">
    <header className="company-chatbot-head"><div><span className="eyebrow">Unternehmensnetzwerk</span><h2>Unternehmens-Chatbot</h2><p>Der Chatbot wird direkt vom internen Server geladen.</p></div><a className="btn secondary" href={CHATBOT_URL} target="_blank" rel="noreferrer">In neuem Fenster öffnen ↗</a></header>
    <div className="company-chatbot-frame"><iframe src={CHATBOT_URL} title="Unternehmens-Chatbot" allow="clipboard-read; clipboard-write" /><div className="company-chatbot-help">Wenn der Chatbot nicht erscheint, prüfe die Verbindung zum Unternehmensnetz oder VPN und verwende „In neuem Fenster öffnen“.</div></div>
  </div>;
}
