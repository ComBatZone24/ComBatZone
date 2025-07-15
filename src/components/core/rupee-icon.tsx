
import { cn } from '@/lib/utils';
import type React from 'react';

interface RupeeIconProps {
  className?: string;
}

const RupeeIcon: React.FC<RupeeIconProps> = ({ className }) => {
  return (
    <span className={cn('font-normal flex items-center justify-center', className)}>
      PKR
    </span>
  );
};

export default RupeeIcon;
