
"use client";

import Link from "next/link";
import Image from "next/image";
import { getDisplayableBannerUrl } from "@/lib/image-helper";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  appName?: string;
  appLogoUrl?: string;
  className?: string;
  textClassName?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ appName, appLogoUrl, className, textClassName }) => {
  const displayLogoUrl = getDisplayableBannerUrl(appLogoUrl);
  const logoIsCustom = appLogoUrl && displayLogoUrl && !displayLogoUrl.includes('placehold.co');

  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      {logoIsCustom ? (
        <Image src={displayLogoUrl} alt={appName || "App Logo"} width={36} height={36} className="h-9 w-9" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9 text-accent">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
      )}
      <span className={cn("text-xl sm:text-2xl font-semibold text-foreground", textClassName)}>{appName || 'ComBatZon'}</span>
    </Link>
  );
};

export default AppLogo;
