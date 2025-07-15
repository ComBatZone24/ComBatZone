
'use server';
/**
 * @fileOverview An AI agent to explain the mining process.
 * 
 * - getMiningExplanation: Generates a detailed, user-friendly explanation.
 * - MiningExplanationInput: The input type for the flow.
 * - MiningExplanationOutput: The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MiningExplanationInputSchema = z.object({
  rewardRate: z.number().describe("The number of tokens awarded per hash."),
});
export type MiningExplanationInput = z.infer<typeof MiningExplanationInputSchema>;

const MiningExplanationOutputSchema = z.object({
  explanation: z.string().describe("A comprehensive but easy-to-understand explanation of the mining process, covering potential earnings, how multiple users affect mining, and any limits."),
});
export type MiningExplanationOutput = z.infer<typeof MiningExplanationOutputSchema>;

export async function getMiningExplanation(input: MiningExplanationInput): Promise<MiningExplanationOutput> {
  return miningExplanationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'miningExplanationPrompt',
  input: { schema: MiningExplanationInputSchema },
  output: { schema: MiningExplanationOutputSchema },
  prompt: `
    You are a helpful AI assistant for a gaming app. Your task is to explain the app's crypto mining feature to a user.
    The user wants to know about potential earnings, how many users can mine, and how multiple users affect performance.
    
    The current reward rate is {{rewardRate}} tokens per hash.

    Structure your explanation to answer the following questions clearly and concisely in plain language.
    1.  **How many tokens will I mine and how long will it take?**
        - Explain that it depends on their device's "hashrate" (hashes per second).
        - Give a simple, hypothetical example. For instance: "If your device achieves a hashrate of 50 H/s, you would be computing 50 hashes every second. Based on the current rate of {{rewardRate}} tokens/hash, you would earn approximately (50 * 60 * {{rewardRate}}) tokens per minute." Do the math for the example.
    
    2.  **How do multiple users mining at once affect my earnings?**
        - Clarify that this is individual mining, not pooled mining.
        - Explain that other users mining does NOT affect their personal hashrate or earnings. Each user earns based on their own device's performance. More users means more tokens are distributed by the system overall, but an individual's earnings remain independent.

    3.  **How many users can mine at once?**
        - Explain that there is no technical limit from the app's side. The system is designed to handle many users mining simultaneously.

    Format the final output as a single block of text. Use markdown for simple formatting like bolding if needed. Be encouraging and clear.
  `,
});

const miningExplanationFlow = ai.defineFlow(
  {
    name: 'miningExplanationFlow',
    inputSchema: MiningExplanationInputSchema,
    outputSchema: MiningExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.explanation) {
      throw new Error("AI failed to generate a mining explanation.");
    }
    return output;
  }
);
