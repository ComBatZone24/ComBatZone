
"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const AdSenseDisplayAd = () => {
  const adRef = useRef<HTMLModElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (adRef.current && window.adsbygoogle) {
        // Clear previous ad content and status attributes to force re-initialization
        adRef.current.innerHTML = "";
        adRef.current.removeAttribute("data-adsbygoogle-status");
        adRef.current.removeAttribute("data-ad-status");
        
        console.log("Pushing new ad for path:", pathname);
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } else {
        console.warn("adsbygoogle is not available or ad ref is not set.");
      }
    } catch (e) {
      console.error("Error pushing to adsbygoogle:", e);
    }
  }, [pathname]); // Re-run whenever the path changes

  return (
    <ins
      key={pathname} // Using key is still good practice for React reconciliation
      ref={adRef}
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-8948652329924345"
      data-ad-slot="5706955300"
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
};

export default AdSenseDisplayAd;
