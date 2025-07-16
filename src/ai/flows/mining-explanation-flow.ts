
'use server';
/**
 * @fileOverview An AI agent to explain the Click & Earn process.
 * 
 * - getClickAndEarnExplanation: Generates a detailed, user-friendly explanation.
 * - ClickAndEarnExplanationInput: The input type for the flow.
 * - ClickAndEarnExplanationOutput: The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ClickAndEarnExplanationInputSchema = z.object({
  pointsToCurrencyRate: z.number().describe("The number of points required for conversion."),
  currencyPerRate: z.number().describe("The amount of PKR received upon conversion."),
  dailyPointsLimit: z.number().describe("The maximum number of points a user can earn in one day."),
});
export type ClickAndEarnExplanationInput = z.infer<typeof ClickAndEarnExplanationInputSchema>;

const ClickAndEarnExplanationOutputSchema = z.object({
  explanation: z.string().describe("A comprehensive but easy-to-understand explanation of the Click & Earn feature, covering how points work, conversion to currency, and daily limits."),
});
export type ClickAndEarnExplanationOutput = z.infer<typeof ClickAndEarnExplanationOutputSchema>;

export async function getClickAndEarnExplanation(input: ClickAndEarnExplanationInput): Promise<ClickAndEarnExplanationOutput> {
  return clickAndEarnExplanationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'clickAndEarnExplanationPrompt',
  input: { schema: ClickAndEarnExplanationInputSchema },
  output: { schema: ClickAndEarnExplanationOutputSchema },
  prompt: `
    You are a helpful AI assistant for a gaming app. Your task is to explain the app's "Click & Earn" feature to a user.
    The user wants to know how points work, how they convert to real money, and if there are any limits.
    
    Current Conversion Rate: {{pointsToCurrencyRate}} points = {{currencyPerRate}} PKR.
    Daily Earning Limit: {{dailyPointsLimit}} points per day.

    Structure your explanation to answer the following questions clearly and concisely in plain language.
    1.  **How do I earn points?**
        - Explain that users can earn points by clicking on available ad links on the "Earn Tasks" page.
        - Each link has a specific point reward.

    2.  **How do points convert to PKR?**
        - State the conversion rate clearly. For example: "Once you collect at least {{pointsToCurrencyRate}} points, you can convert them. For every {{pointsToCurrencyRate}} points, you get Rs {{currencyPerRate}} in your main wallet."
        - Mention that this conversion can be done on the Wallet page.

    3.  **Is there a daily limit?**
        - Explain the daily limit clearly. For example: "Yes, you can earn a maximum of {{dailyPointsLimit}} points from clicking tasks each day. This limit resets daily, so you can come back every day to earn more!"

    Format the final output as a single block of text. Use markdown for simple formatting like bolding if needed. Be encouraging and clear.
  `,
});

const clickAndEarnExplanationFlow = ai.defineFlow(
  {
    name: 'clickAndEarnExplanationFlow',
    inputSchema: ClickAndEarnExplanationInputSchema,
    outputSchema: ClickAndEarnExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.explanation) {
      throw new Error("AI failed to generate a Click & Earn explanation.");
    }
    return output;
  }
);
