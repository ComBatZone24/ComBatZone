
'use server';
/**
 * @fileOverview An AI agent to fetch and analyze trending topics for social media platforms.
 * 
 * - getTrendingTopics: Fetches a list of trending topics with detailed analysis.
 * - TrendingTopicsInput: Input for the flow.
 * - TrendingTopicsOutput: Output from the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TrendingTopicsInputSchema = z.object({
  platform: z.enum(['TikTok', 'Facebook', 'Google', 'Instagram', 'X (Twitter)', 'Crypto']),
});
export type TrendingTopicsInput = z.infer<typeof TrendingTopicsInputSchema>;

const TrendingTopicSchema = z.object({
    topic: z.string().describe("The trending topic, keyword, or cryptocurrency name."),
    reason: z.string().describe("A detailed, insightful explanation of why this topic is currently trending, referencing recent events, news, or cultural moments. For crypto, explain the market sentiment and recent news driving the price action."),
    longevity: z.string().describe("A prediction of how long the trend might last, categorized as 'Short-term (1-3 days)', 'Medium-term (1-2 weeks)', or 'Long-term (month+)'. Base this on the nature of the topic. For crypto, predict the potential for continued momentum."),
    audience: z.string().describe("A description of the primary audience or demographic most interested in this trend (e.g., 'Gamers, tech enthusiasts', 'Crypto traders, financial news followers', 'General youth')."),
    signal: z.enum(['PUMP', 'DUMP', 'NEUTRAL']).optional().describe("For 'Crypto' platform only. Provide a clear 'PUMP' (up) or 'DUMP' (down) signal based on your analysis. Use 'NEUTRAL' if the outlook is unclear."),
});
export type TrendingTopic = z.infer<typeof TrendingTopicSchema>;

const TrendingTopicsOutputSchema = z.object({
  topics: z.array(TrendingTopicSchema).describe("A list of top trending topics for the specified platform."),
});
export type TrendingTopicsOutput = z.infer<typeof TrendingTopicsOutputSchema>;


export async function getTrendingTopics(input: TrendingTopicsInput): Promise<TrendingTopicsOutput> {
  return getTrendingTopicsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'getTrendingTopicsPrompt',
    input: { schema: TrendingTopicsInputSchema },
    output: { schema: TrendingTopicsOutputSchema },
    prompt: `
        You are a world-class AI Trend Analyst and Financial Forecaster with access to real-time global data. 
        Your task is to identify the most significant trending topics for a specific platform, focusing on both the broader global context and specific regional markets like Pakistan where applicable.
        You must provide deep insights, not just surface-level keywords. Provide an extensive list of at least 20-30 diverse trends if the platform is not 'Crypto'.

        **Platform:** {{platform}}

        **Instructions:**
        1.  **Analyze the Platform:** Look at the **Platform** field.
        2.  **Crypto Analysis:** If the platform is 'Crypto', then you must act as a **Crypto Analyst**. Identify 3-5 coins that are currently trending. For each coin, provide:
            - **topic:** The name of the coin.
            - **reason:** A detailed analysis of recent news, market sentiment, and technical indicators.
            - **longevity & audience:** Provide suitable values.
            - **signal:** A clear, one-word signal: 'PUMP' if you predict the price will go up in the next 2-4 hours, or 'DUMP' if you predict it will go down. Use 'NEUTRAL' if the direction is uncertain. THIS IS THE MOST IMPORTANT FIELD.
        3.  **General Trend Analysis:** If the platform is NOT 'Crypto' (e.g., Google, TikTok, Facebook), then you must act as a **General Trend Analyst**. Identify a diverse list of trending topics covering gaming, tech, national (e.g., Pakistan), and international news. For each topic, provide a detailed 'reason', predict its 'longevity', and describe the 'audience'. The 'signal' field should not be set for these platforms.
        4.  **Platform Specificity:** Tailor your results to the platform. For **Google**, focus on high-volume search queries. For **TikTok/Instagram**, focus on viral sounds and visual trends. For **Facebook/X (Twitter)**, focus on breaking news and discussions.
        
        Generate the analysis now.
    `,
});


const getTrendingTopicsFlow = ai.defineFlow(
  {
    name: 'getTrendingTopicsFlow',
    inputSchema: TrendingTopicsInputSchema,
    outputSchema: TrendingTopicsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.topics) {
      throw new Error("AI failed to generate trending topics.");
    }
    return output;
  }
);
