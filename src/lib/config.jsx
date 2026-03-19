import { useState, useEffect, createContext, useContext } from "react";

export const ConfigContext = createContext(null);

export const DEFAULT_CONFIG = {
  aiTools: [
    { id: "coding_core", name: "DeFyb Coding Core", category: "revenue", cost: 299 },
    { id: "claims", name: "Claims AI (Optional)", category: "revenue", cost: 99 },
    { id: "prior_auth", name: "Prior Auth Automation (Optional)", category: "workflow", cost: 149 },
    { id: "dme", name: "DME Workflow (Optional)", category: "revenue", cost: 199 },
    { id: "scribe_connector", name: "Scribe Connector (Optional)", category: "integration", cost: 49 },
  ],
  pricing: {
    core: {
      platformMinimumMonthly: 599,
      implementationFee: 2500,
      tiers: [
        { min: 1, max: 5, perProviderMonthly: 299 },
        { min: 6, max: 20, perProviderMonthly: 279 },
        { min: 21, max: 999, perProviderMonthly: 249 },
      ],
    },
    addons: {
      claims: { monthlyPerProvider: 99, implementationFee: 750 },
      prior_auth: { monthlyPerProvider: 149, implementationFee: 1000 },
      dme: { monthlyPerProvider: 199, implementationFee: 1500 },
      scribe_connector: { monthlyPerProvider: 49, implementationFee: 500 },
    },
  },
  source: "defaults",
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    return { config: DEFAULT_CONFIG, loading: false };
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          setConfig({ ...DEFAULT_CONFIG, ...data });
          setLastUpdated(data.updatedAt);
        }
      } catch (error) {
        console.log("Edge Config unavailable, using defaults");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();

    const interval = setInterval(fetchConfig, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, lastUpdated, refresh: () => {} }}>
      {children}
    </ConfigContext.Provider>
  );
};
