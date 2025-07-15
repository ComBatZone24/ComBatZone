
"use client";

import { useFloatingChat } from '@/context/FloatingChatContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessagesSquare } from 'lucide-react';
import TournamentChat from './TournamentChat';
import GlassCard from '../core/glass-card';

export default function FloatingChatWindow() {
  const { isOpen, tournament, closeChat } = useFloatingChat();

  return (
    <AnimatePresence>
      {isOpen && tournament && (
        <motion.div
          drag
          dragConstraints={{ left: 0, right: window.innerWidth - 320, top: 0, bottom: window.innerHeight - 400 }}
          dragMomentum={false}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 right-4 z-[99] w-80 h-[400px] cursor-grab"
          whileTap={{ cursor: "grabbing" }}
        >
          <GlassCard className="p-0 flex flex-col h-full shadow-2xl shadow-accent/20">
            <div className="flex items-center justify-between p-2 bg-card/80 border-b border-border/50 cursor-move">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-5 w-5 text-accent" />
                <h3 className="text-sm font-semibold text-foreground truncate">{tournament.name}</h3>
              </div>
              <button
                onClick={closeChat}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title="Close Chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <TournamentChat tournament={tournament} />
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
