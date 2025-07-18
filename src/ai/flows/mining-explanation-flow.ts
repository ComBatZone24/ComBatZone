
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
  pkrPerPoint: z.number().describe("The PKR value of a single point."),
  dailyTarget: z.number().int().describe("The fixed number of clicks required per day."),
  dailyReward: z.number().describe("The number of points awarded for completing the daily target."),
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
    The user wants to know how to earn points, how they convert to real money, and what the daily goal is.
    
    Current Conversion Rate: 1 point = {{pkrPerPoint}} PKR.
    Daily Goal: Complete {{dailyTarget}} clicks to earn {{dailyReward}} points.

    Structure your explanation to answer the following questions clearly and concisely in plain language.
    1.  **How do I earn points?**
        - Explain that the main way to earn points is by completing a daily goal.
        - The goal is to click on **{{dailyTarget}}** ad links each day.
        - Once the goal is met, they will be awarded **{{dailyReward}}** points.

    2.  **How do points convert to PKR?**
        - State the conversion rate clearly. For example: "Every point you earn is worth Rs {{pkrPerPoint}}. You can convert your points to PKR in your main wallet at any time."

    3.  **Is there a daily limit?**
        - Explain the daily goal system. For example: "Yes, your daily goal is to complete {{dailyTarget}} clicks. Once you reach this target and receive your reward, you've completed the task for the day. This resets daily, so you can come back every day to earn more!"

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
