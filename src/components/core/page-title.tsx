
import type React from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle, className }) => {
  return (
    <div className={`mb-8 ${className}`}>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{title}</h1>
      {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
    </div>
  );
};

export default PageTitle;
