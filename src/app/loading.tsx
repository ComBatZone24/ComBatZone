import { Gamepad2 } from 'lucide-react';

export default function Loading() {
  // This loader is visually identical to the one in AppShell.tsx
  // to prevent layout shifts or flashes during initial load.
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="relative flex items-center justify-center h-40 w-40">
        {/* Outer rings */}
        <div className="absolute h-full w-full rounded-full border-2 border-accent/20 animate-spin [animation-duration:4s] [animation-timing-function:linear]"></div>
        <div className="absolute h-32 w-32 rounded-full border-t-2 border-t-accent border-l-2 border-l-accent/50 border-r-2 border-r-accent/50 border-b-2 border-b-accent/50 animate-spin [animation-duration:2s] [animation-direction:reverse]"></div>
        
        {/* Central Icon */}
        <Gamepad2 className="h-16 w-16 text-accent neon-accent-text" />
      </div>
      <p className="mt-6 text-xl font-bold text-foreground tracking-widest animate-pulse">
        ENTERING THE ARENA...
      </p>
    </div>
  );
}
