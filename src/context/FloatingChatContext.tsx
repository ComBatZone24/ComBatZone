
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { Tournament } from '@/types';

interface FloatingChatContextType {
  isOpen: boolean;
  tournament: Tournament | null;
  openChat: (tournament: Tournament) => void;
  closeChat: () => void;
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);

export const FloatingChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const openChat = useCallback((tourney: Tournament) => {
    setTournament(tourney);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Delay clearing tournament to allow for fade-out animations
    setTimeout(() => setTournament(null), 300);
  }, []);

  return (
    <FloatingChatContext.Provider value={{ isOpen, tournament, openChat, closeChat }}>
      {children}
    </FloatingChatContext.Provider>
  );
};

export const useFloatingChat = () => {
  const context = useContext(FloatingChatContext);
  if (context === undefined) {
    throw new Error('useFloatingChat must be used within a FloatingChatProvider');
  }
  return context;
};
