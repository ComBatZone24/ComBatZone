
"use client"; 

import { useEffect } from 'react';
import Link from 'next/link'; 
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/core/glass-card';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'; 

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <GlassCard className="w-full max-w-lg text-center p-8 md:p-12">
        <AlertTriangle className="mx-auto h-20 w-20 text-destructive mb-6" />
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">Oops! Something Went Wrong</h1>
          <p className="text-lg text-muted-foreground">We encountered an unexpected issue. Please try again.</p>
        </div>
        
        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-destructive/10 p-4 rounded-md mb-6 text-left">
            <p className="text-sm text-destructive font-mono whitespace-pre-wrap">{error.message}</p>
            {error.digest && <p className="text-xs text-destructive/70 mt-2">Digest: {error.digest}</p>}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => reset()}
            className="neon-accent-bg text-lg py-3"
          >
            <RefreshCcw className="mr-2 h-5 w-5" />
            Try Again
          </Button>
          <Button
            variant="outline"
            asChild 
            className="border-accent text-accent hover:bg-accent/10 text-lg py-3"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" /> 
              Go to Homepage
            </Link>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
