
"use client";

import PageTitle from "@/components/core/page-title";
import TapGame from "@/components/games/TapGame";

export default function TapGamePage() {
  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <PageTitle 
        title="Tile Tap Challenge" 
        subtitle="Tap the highlighted tile as fast as you can!"
      />
      <TapGame />
    </div>
  );
}
