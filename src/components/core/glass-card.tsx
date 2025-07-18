import type React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, interactive = false, ...props }) => {
  const cardVariants = {
    rest: { scale: 1, rotateY: 0, rotateX: 0 },
    hover: { scale: 1.05, rotateY: 5, rotateX: -5 },
  };

  if (interactive) {
    return (
      <motion.div
        variants={cardVariants}
        initial="rest"
        whileHover="hover"
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'glass-card rounded-xl p-4 md:p-6 shadow-2xl',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 md:p-6 shadow-2xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
