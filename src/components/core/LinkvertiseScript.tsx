"use client";

import Script from 'next/script';
import { useEffect } from 'react';

declare global {
    interface Window {
        linkvertise: (userId: number, options: any) => void;
    }
}

export default function LinkvertiseScript() {
  
  const handleScriptLoad = () => {
    if (typeof window.linkvertise === 'function') {
        window.linkvertise(1373761, {
            whitelist: ["com-bat-zone-92v2.vercel.app"],
            blacklist: [],
            ab_token: "4b7dfa10e9857318525223e5445b63b1e8fab1213edd6cbd34441abf39075ff5"
        });
    }
  };

  return (
    <Script 
      id="linkvertise-sdk"
      src="https://publisher.linkvertise.com/cdn/linkvertise.js" 
      strategy="afterInteractive"
      onLoad={handleScriptLoad}
    />
  );
}
