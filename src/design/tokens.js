export const DS = {
  colors: {
    bg: "#f0f4f7",
    bgCard: "#ffffff",
    bgHover: "#e8edf3",
    border: "#ccd6e2",
    borderLight: "#b8c7d8",
    text: "#132332",
    textMuted: "#4e6276",
    textDim: "#75889b",
    shock: "#1f4e70",
    shockGlow: "#1f4e701f",
    shockLight: "#2f6e99",
    vital: "#1f7a58",
    vitalDim: "#1f7a581f",
    warn: "#8f5b14",
    warnDim: "#8f5b141f",
    danger: "#a03636",
    dangerDim: "#a036361f",
    blue: "#2f678f",
    blueDim: "#2f678f1f",
    white: "#ffffff",
  },
  fonts: {
    display: "'Fraunces', Georgia, serif",
    body: "'Manrope', 'Segoe UI', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  radius: { sm: "6px", md: "10px", lg: "16px", xl: "24px" },
  shadow: {
    card: "0 10px 26px rgba(19, 35, 50, 0.08)",
    glow: "0 0 30px rgba(31, 78, 112, 0.15)",
    deep: "0 16px 40px rgba(19, 35, 50, 0.15)",
  },
};

export const TAGS = {
  time: { label: "Time", color: DS.colors.blue, bg: DS.colors.blueDim, icon: "⏱" },
  staffing: { label: "Staffing", color: DS.colors.warn, bg: DS.colors.warnDim, icon: "👥" },
  revenue: { label: "Revenue", color: DS.colors.vital, bg: DS.colors.vitalDim, icon: "💰" },
};
