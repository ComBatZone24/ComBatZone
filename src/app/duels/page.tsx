
"use client";

import DuelGame from "@/components/duels/DuelGame";
import PageTitle from "@/components/core/page-title";

export default function DuelsPage() {
  return (
    <div className="container mx-auto py-8">
      <PageTitle title="Cybernetic Duels" subtitle="Enter the Arena. Challenge an opponent in a high-stakes duel." />
      <DuelGame />
    </div>
  );
}
