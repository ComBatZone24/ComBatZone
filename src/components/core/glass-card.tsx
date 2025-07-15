import type React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, interactive = false, ...props }) => {
  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 md:p-6 shadow-2xl',
        interactive && 'transition-all duration-300 hover:shadow-accent/30 hover:scale-[1.02]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
