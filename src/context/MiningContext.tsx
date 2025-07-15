// This context has been removed as the mining feature was deprecated.
// This file can be safely deleted from the project.
"use client";

import React, { createContext, useContext, ReactNode } from 'react';

const MiningContext = createContext<any>(undefined);

export const MiningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value = {}; // Empty value as the provider is now a no-op

  return (
    <MiningContext.Provider value={value}>
      {children}
    </MiningContext.Provider>
  );
};

export const useMining = () => {
  const context = useContext(MiningContext);
  if (context === undefined) {
    // Return a dummy object to prevent crashes in components that might still use this hook
    return {
      isMining: false,
      isLoading: false,
      isMinerReady: false,
      hashrate: "0.00",
      totalHashes: 0,
      earnedTokens: "0.0000",
      rewardRate: 0,
      startMining: () => console.warn("Mining feature removed."),
      stopMining: () => console.warn("Mining feature removed."),
    };
  }
  return context;
};
