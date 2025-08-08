
"use client";

import { motion, useDragControls } from 'framer-motion';
import { Maximize, Minimize, X, Cpu, Loader2, Coins as CoinsIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/core/glass-card';
import { useMining } from '@/context/MiningContext';

export default function CpuMiningDialog() {
  const { isMinerOpen, isMinimized, toggleMinimize, closeMiner, stats, isMining, startMining, stopMining, minerInstance } = useMining();
  const dragControls = useDragControls();

  if (!isMinerOpen) {
    return null;
  }

  const renderContent = () => {
    if (isMinimized) {
      return (
        <div className="flex items-center gap-2 text-xs text-foreground p-2">
          <Cpu className="h-4 w-4 animate-pulse text-accent"/>
          <span>{stats.hashesPerSecond.toFixed(2)} H/s</span>
          <Separator orientation="vertical" className="h-4 bg-border/50"/>
          <CoinsIcon className="h-4 w-4 text-yellow-400" />
          <span>{stats.fakeCoins.toFixed(4)}</span>
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMinimize} title="Maximize">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full">
        {/* Header Bar */}
        <div 
          className="flex items-center justify-between p-2 bg-card/80 border-b border-border/50 cursor-grab"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">CPU Mining</h3>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMinimize} title="Minimize">
              <Minimize className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stopMining} title="Stop Mining & Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-4 sm:p-6 text-center flex-grow flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-bold text-foreground">Start Earning MINTME</h2>
                <p className="text-xs text-muted-foreground mt-1">Use your device's spare power to earn crypto coins.</p>
            </div>
            
            <div className="my-4 space-y-3">
                 <div className="p-3 rounded-md bg-background/50">
                    <p className="text-xs text-muted-foreground">Coins Earned</p>
                    <p className="font-bold text-3xl text-yellow-400 tracking-wider">
                        {stats.fakeCoins.toFixed(6)}
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <StatBox label="Status" value={isMining ? 'Running' : 'Stopped'} isRunning={isMining} />
                    <StatBox label="Hash/s" value={isMining ? stats.hashesPerSecond.toFixed(2) : '0.00'} />
                    <StatBox label="Total Hashes" value={stats.totalHashes.toLocaleString()} />
                </div>
            </div>

            <Button onClick={isMining ? stopMining : startMining} variant={isMining ? "destructive" : "default"} className="w-full neon-accent-bg" disabled={!minerInstance}>
                {!minerInstance ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                {isMining ? 'Stop Mining' : 'Start Mining'}
            </Button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className="fixed z-[99] cursor-grab"
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ 
          opacity: 1, y: 0, scale: 1, 
          width: isMinimized ? 'auto' : 320,
          height: isMinimized ? 'auto' : 'auto',
          minHeight: isMinimized ? 0 : 400
      }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ bottom: 20, right: 20 }}
      whileTap={{ cursor: "grabbing" }}
    >
      <GlassCard className="p-0 shadow-2xl shadow-accent/20 overflow-hidden">
        {renderContent()}
      </GlassCard>
    </motion.div>
  );
}

const StatBox = ({ label, value, isRunning }: { label: string, value: string | number, isRunning?: boolean }) => (
    <div className="p-2 rounded-md bg-background/50">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-bold text-lg ${isRunning ? 'text-green-400' : 'text-foreground'}`}>{value}</p>
    </div>
);

const Separator = ({ orientation, className }: { orientation: 'horizontal' | 'vertical', className?: string }) => (
    <div className={`bg-border ${orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full'} ${className}`} />
);
