import { DS } from "./tokens";

export const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
  `}</style>
);

export const GlobalStyles = () => (
  <style>{`
    * { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      background:
        radial-gradient(circle at 18% -4%, #ffffff 0%, #f6f9fc 36%, ${DS.colors.bg} 74%),
        repeating-linear-gradient(90deg, transparent 0, transparent 43px, rgba(31, 78, 112, 0.03) 44px);
      color:${DS.colors.text};
      font-family:${DS.fonts.body};
      line-height:1.6;
      -webkit-font-smoothing:antialiased;
    }
    ::selection { background:${DS.colors.shock}; color:#fff; }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:${DS.colors.bg}; }
    ::-webkit-scrollbar-thumb { background:${DS.colors.borderLight}; border-radius:3px; }
    input, textarea, select { font-family:${DS.fonts.body}; }
    button { font-family:${DS.fonts.body}; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes heartbeat { 0%,100% { transform:scale(1); } 14% { transform:scale(1.08); } 28% { transform:scale(1); } 42% { transform:scale(1.05); } 56% { transform:scale(1); } }
    @keyframes shockLine { from { stroke-dashoffset:800; } to { stroke-dashoffset:0; } }
    .fade-up { animation: fadeUp 0.5s ease both; }
    .fade-in { animation: fadeIn 0.4s ease both; }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .roi-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
      .roi-grid .roi-arrow { transform: rotate(90deg); margin: 0 auto; }
      .roi-breakdown { grid-template-columns: 1fr !important; }
      .roi-breakdown > div { grid-template-columns: 1fr !important; gap: 8px !important; text-align: left !important; }
      .bottom-stats { grid-template-columns: 1fr !important; gap: 16px !important; }
      .bottom-stats > div { border: none !important; padding: 16px 0 !important; border-bottom: 1px solid ${DS.colors.border} !important; }
      .bottom-stats > div:last-child { border-bottom: none !important; }
      .protocol-step { grid-template-columns: 48px 1fr !important; }
      .protocol-step > div:last-child { display: none; }
    }
  `}</style>
);
