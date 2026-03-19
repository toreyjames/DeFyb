export const trackEvent = (eventName, props = {}) => {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, props);
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...props });
    }
    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props });
    }
  } catch {
    // no-op
  }
};
