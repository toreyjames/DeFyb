import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if (typeof window !== "undefined") {
  const path = (window.location.pathname || "").toLowerCase();
  const normalizedPath = path === "/app" ? "/tool" : path;
  const isDeepLink = normalizedPath === "/tool" || normalizedPath === "/team";
  if (isDeepLink && window.history.length <= 1) {
    // Seed a homepage entry so browser Back from direct deep-links stays on site.
    window.history.replaceState({ defyb: true, view: "public" }, "", "/");
    window.history.pushState(
      { defyb: true, view: normalizedPath === "/team" ? "team-login" : "practice-login" },
      "",
      normalizedPath,
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
