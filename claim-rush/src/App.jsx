import { useState, useEffect } from "react";
import ClaimRush from "./pages/ClaimRush";
import ClaimRushES from "./pages/ClaimRush_ES";

function getInitialLang() {
  const path = window.location.pathname;
  if (path === "/es" || path === "/claimrush-es") return "es";
  if (path === "/" || path === "/claimrush") return "en";
  return navigator.language?.startsWith("es") ? "es" : "en";
}

export default function App() {
  const [lang, setLang] = useState(getInitialLang);

  const switchLang = (newLang) => {
    setLang(newLang);
    window.history.replaceState(null, "", newLang === "es" ? "/es" : "/");
  };

  // Clean up legacy paths on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/claimrush") window.history.replaceState(null, "", "/");
    if (path === "/claimrush-es") window.history.replaceState(null, "", "/es");
    // If root path with no explicit lang, auto-detect and set URL
    if (path === "/") {
      const detected = navigator.language?.startsWith("es") ? "es" : "en";
      if (detected === "es") {
        setLang("es");
        window.history.replaceState(null, "", "/es");
      }
    }
  }, []);

  return lang === "es"
    ? <ClaimRushES lang="es" onSetLang={switchLang} />
    : <ClaimRush lang="en" onSetLang={switchLang} />;
}
