
'use server';
/**
 * @fileOverview An AI agent to play a round of Spin the Wheel.
 * 
 * - playSpinWheel: Simulates one spin, returning the multiplier and prize amount.
 * - SpinWheelInput: The input type for the playSpinWheel function.
 * - SpinWheelOutput: The return type for the playSpinWheel function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import type { GlobalSettings } from '@/types';

const SpinWheelInputSchema = z.object({
  betAmount: z.number().min(1, "Bet amount must be at least 1."),
  currency: z.enum(['pkr', 'token']),
});
export type SpinWheelInput = z.infer<typeof SpinWheelInputSchema>;

// New Segment Schema to be used in output
const SegmentSchema = z.object({
  label: z.string(),
  multiplier: z.number(),
  color: z.string(),
  weight: z.number().optional(),
});

const SpinWheelOutputSchema = z.object({
  multiplier: z.number().describe("The multiplier won on the spin."),
  prizeAmount: z.number().describe("The final prize amount calculated from the bet and multiplier."),
  segmentIndex: z.number().describe("The index of the segment the wheel landed on."),
  winningLabel: z.string().describe("The label of the winning segment, e.g., '2x' or '0x'."),
  segments: z.array(SegmentSchema).describe("The full list of segments on the wheel when the spin was calculated."),
});
export type SpinWheelOutput = z.infer<typeof SpinWheelOutputSchema>;

export async function playSpinWheel(input: SpinWheelInput): Promise<SpinWheelOutput> {
  return spinWheelFlow(input);
}

// Default fallback segments if none are configured in Firebase
const defaultSegments = [
  { label: "2x", multiplier: 2, color: "hsl(220, 80%, 60%)" },
  { label: "0x", multiplier: 0, color: "hsl(0, 80%, 60%)" },
  { label: "1.5x", multiplier: 1.5, color: "hsl(140, 80%, 60%)" },
  { label: "0.5x", multiplier: 0.5, color: "hsl(60, 80%, 60%)" },
  { label: "5x", multiplier: 5, color: "hsl(280, 80%, 60%)" },
  { label: "0x", multiplier: 0, color: "hsl(0, 80%, 60%)" },
  { label: "1x", multiplier: 1, color: "hsl(180, 80%, 60%)" },
  { label: "0.5x", multiplier: 0.5, color: "hsl(60, 80%, 60%)" },
];


const spinWheelFlow = ai.defineFlow(
  {
    name: 'spinWheelFlow',
    inputSchema: SpinWheelInputSchema,
    outputSchema: SpinWheelOutputSchema,
  },
  async ({ betAmount }) => {
    
    let segmentsFromDb;
    let winRateToUse = 40; // Default win rate

    try {
      if (database) {
        const settingsRef = ref(database, 'globalSettings/spinWheelSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const settings = snapshot.val() as NonNullable<GlobalSettings['spinWheelSettings']>;
          
          segmentsFromDb = (settings.segments && settings.segments.length >= 2) 
            ? settings.segments.map(({label, multiplier, color}) => ({label, multiplier, color})) // Ensure no weights are carried over from old DB structure
            : defaultSegments;

          // DYNAMIC WIN RATE LOGIC
          const normalWinRate = settings.winRate ?? 40;
          const largeBetThreshold = settings.largeBetThreshold ?? Infinity;
          const largeBetWinRate = settings.largeBetWinRate ?? normalWinRate;

          if (betAmount >= largeBetThreshold) {
            winRateToUse = largeBetWinRate;
          } else {
            winRateToUse = normalWinRate;
          }
        } else {
          segmentsFromDb = defaultSegments;
        }
      } else {
        segmentsFromDb = defaultSegments;
      }
    } catch (error) {
        console.error("Error fetching spin wheel settings:", error);
        segmentsFromDb = defaultSegments;
    }
    
    // DYNAMIC WEIGHT CALCULATION
    const winningSegments = segmentsFromDb.filter(s => s.multiplier > 0);
    const nonWinningSegments = segmentsFromDb.filter(s => s.multiplier <= 0);
    
    const totalWinningWeight = winRateToUse;
    const totalNonWinningWeight = 100 - winRateToUse;

    // Distribute weights evenly among winning and non-winning groups
    const perWinningWeight = winningSegments.length > 0 ? totalWinningWeight / winningSegments.length : 0;
    const perNonWinningWeight = nonWinningSegments.length > 0 ? totalNonWinningWeight / nonWinningSegments.length : 0;

    const weightedSegments = segmentsFromDb.map(segment => ({
        ...segment,
        weight: segment.multiplier > 0 ? perWinningWeight : perNonWinningWeight,
    }));
    
    const totalWeight = weightedSegments.reduce((sum, seg) => sum + (seg.weight || 0), 0);
    if (totalWeight <= 0) {
      // Fallback if weights are misconfigured (e.g., win rate of 0 and no losing segments)
      console.warn("Total segment weight is zero. Falling back to equal weights.");
      const equalWeight = 100 / weightedSegments.length;
      weightedSegments.forEach(seg => seg.weight = equalWeight);
    }

    // WEIGHTED RANDOM SELECTION
    let randomNum = Math.random() * weightedSegments.reduce((sum, seg) => sum + (seg.weight || 0), 0);
    let winningSegmentIndex = -1;

    for (let i = 0; i < weightedSegments.length; i++) {
      const segment = weightedSegments[i];
      randomNum -= (segment.weight || 0);
      if (randomNum <= 0) {
        winningSegmentIndex = i;
        break;
      }
    }
    
    if (winningSegmentIndex === -1) {
      winningSegmentIndex = weightedSegments.length - 1; // Fallback for floating point inaccuracies
    }
    
    const winningSegment = weightedSegments[winningSegmentIndex];
    const prizeAmount = betAmount * winningSegment.multiplier;

    return {
      multiplier: winningSegment.multiplier,
      prizeAmount: parseFloat(prizeAmount.toFixed(2)),
      segmentIndex: winningSegmentIndex,
      winningLabel: winningSegment.label,
      segments: weightedSegments, // Send the definitive segment list back
    };
  }
);
