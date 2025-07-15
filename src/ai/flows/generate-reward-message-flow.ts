
'use server';
/**
 * @fileOverview Generates a fun message for a daily reward claim.
 *
 * - generateRewardMessage: Creates a congratulatory message.
 * - GenerateRewardMessageInput: The input type for the flow.
 * - GenerateRewardMessageOutput: The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateRewardMessageInputSchema = z.object({
  day: z.number().min(1).max(7).describe("The day of the streak (1-7)."),
  amount: z.number().describe("The amount of the reward claimed."),
});
export type GenerateRewardMessageInput = z.infer<typeof GenerateRewardMessageInputSchema>;

const GenerateRewardMessageOutputSchema = z.object({
  message: z.string().describe("A short, exciting, celebratory message for the user."),
});
export type GenerateRewardMessageOutput = z.infer<typeof GenerateRewardMessageOutputSchema>;

// Exported wrapper function for client-side use
export async function generateRewardMessage(input: GenerateRewardMessageInput): Promise<GenerateRewardMessageOutput> {
  return generateRewardMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRewardMessagePrompt',
  input: { schema: GenerateRewardMessageInputSchema },
  output: { schema: GenerateRewardMessageOutputSchema },
  prompt: `
    You are a hype-man for an eSports gaming app. A user just claimed their daily login reward.
    Generate a short, exciting, single-sentence message for them.
    
    The user is on day {{day}} of their login streak.
    They received a reward of {{amount}} PKR.

    - If it's day 7, make it extra special and mention the "Weekly Bonus".
    - If it's day 1, welcome them back or encourage them to start a new streak.
    - For other days, just be encouraging and exciting.
    - Mention the amount they won.
    - Keep it concise and celebratory.

    Example for Day 3: "Sweet! You just snagged {{amount}} PKR for your Day 3 login!"
    Example for Day 7: "JACKPOT! You've conquered the week and claimed the grand bonus of {{amount}} PKR!"
    Example for Day 1 (reset): "A new streak begins! You've earned {{amount}} PKR for logging in today!"
  `,
});

const generateRewardMessageFlow = ai.defineFlow(
  {
    name: 'generateRewardMessageFlow',
    inputSchema: GenerateRewardMessageInputSchema,
    outputSchema: GenerateRewardMessageOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      // Fallback message in case the AI fails
      return { message: `You've successfully claimed your reward of ${input.amount} PKR!` };
    }
    return output;
  }
);
