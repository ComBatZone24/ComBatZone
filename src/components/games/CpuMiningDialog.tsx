

"use client";

import { motion, useDragControls } from 'framer-motion';
import { Pin, PinOff, X, Cpu, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/core/glass-card';
import { useMining } from '@/context/MiningContext';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const StatDisplay: React.FC<{ label: string; value: string | number; className?: string; valueClassName?: string }> = ({ label, value, className, valueClassName }) => (
    <div className={cn("text-center", className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold text-foreground font-mono", valueClassName)}>{value}</p>
    </div>
);

export default function CpuMiningDialog() {
  const {
    isMinerOpen, closeMiner, startMining, stopMining,
    isMining, stats, coinsEarnedThisSession, totalCoinsMined,
    isPinned, togglePinned,
    position, setPosition, settings,
  } = useMining();
  
  const dragControls = useDragControls();

  if (!isMinerOpen) {
    return null;
  }
  
  const displayTotalCoins = totalCoinsMined + coinsEarnedThisSession;

  return (
    <motion.div
      drag={!isPinned}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className="fixed z-[9998] w-80 cursor-grab"
      initial={{ x: position.x, y: position.y }}
      animate={{ x: position.x, y: position.y }}
      onDragEnd={(event, info) => {
        setPosition({ x: info.offset.x, y: info.offset.y });
      }}
      whileTap={{ cursor: "grabbing" }}
    >
      <GlassCard className="p-0 flex flex-col shadow-2xl shadow-accent/20 transition-all duration-300">
        <div 
            className="flex items-center justify-between p-2 bg-card/80 border-b border-border/50"
            onPointerDown={(e) => {
                if (!isPinned) {
                    e.preventDefault(); 
                    dragControls.start(e, { snapToCursor: false });
                }
            }}
            style={{ cursor: isPinned ? 'default' : 'grab' }}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">{settings?.dialogTitle || 'CPU Mining'}</h3>
          </div>
          <div className="flex items-center">
             <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={togglePinned} title={isPinned ? "Unpin" : "Pin"}>
               {isPinned ? <PinOff className="h-4 w-4 text-accent" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={closeMiner} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <motion.div
            className="overflow-hidden"
            initial={false}
            animate={{ height: 'auto' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            <div className="p-6 text-center space-y-4">
                <h4 className="text-lg font-bold text-foreground">{settings?.dialogDescription || 'Start Earning MINTME'}</h4>
                <p className="text-xs text-muted-foreground">Use your device's spare power to earn crypto coins.</p>
                <Separator />
                <div>
                    <p className="text-sm text-yellow-400">{settings?.coinsEarnedLabel || 'Total Coins Earned'}</p>
                    <p className="text-4xl font-bold text-yellow-300 font-mono tracking-tighter">{displayTotalCoins.toFixed(6)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <StatDisplay label="Status" value={isMining ? "Running" : "Stopped"} valueClassName={isMining ? 'text-green-400' : 'text-red-400'}/>
                    <StatDisplay label="Hash/s" value={stats.hashesPerSecond.toFixed(2)} />
                    <StatDisplay label="Total Hashes" value={stats.totalHashes} />
                </div>
                <Button onClick={isMining ? stopMining : startMining} className="w-full neon-accent-bg text-lg py-3">
                    {isMining ? (settings?.stopMiningButtonText || "Stop Mining") : (settings?.startMiningButtonText || "Start Mining")}
                </Button>
            </div>
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}
