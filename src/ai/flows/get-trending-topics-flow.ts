
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
import googleTrends from 'google-trends-api';

const TrendingTopicsInputSchema = z.object({
  platform: z.enum(['TikTok', 'Facebook', 'Google', 'Instagram', 'X (Twitter)', 'Crypto']),
  topicContext: z.string().optional().describe("An optional user-provided context, which might include a topic, a region, or a specific question about trends."),
});
export type TrendingTopicsInput = z.infer<typeof TrendingTopicsInputSchema>;

const TrendingTopicSchema = z.object({
    topic: z.string().describe("The trending topic, keyword, or cryptocurrency name."),
    reason: z.string().describe("A detailed, insightful explanation of why this topic is currently trending, referencing recent events, news, or cultural moments. For crypto, explain the market sentiment and recent news driving the price action."),
    longevity: z.string().describe("A prediction of how long the trend might last, categorized as 'Short-term (1-3 days)', 'Medium-term (1-2 weeks)', or 'Long-term (month+)'. Base this on the nature of the topic. For crypto, predict the potential for continued momentum."),
    audience: z.string().describe("A description of the primary audience or demographic most interested in this trend (e.g., 'Gamers, tech enthusiasts', 'Crypto traders, financial news followers', 'General youth')."),
    signal: z.enum(['PUMP', 'DUMP', 'NEUTRAL']).nullable().optional().describe("For 'Crypto' platform only. Provide a clear 'PUMP' (up) or 'DUMP' (down) signal based on your analysis. Use 'NEUTRAL' if the outlook is unclear. Omit or set to null for other platforms."),
});
export type TrendingTopic = z.infer<typeof TrendingTopicSchema>;

const TrendingTopicsOutputSchema = z.object({
  topics: z.array(TrendingTopicSchema).describe("A list of top trending topics for the specified platform."),
});
export type TrendingTopicsOutput = z.infer<typeof TrendingTopicsOutputSchema>;


export async function getTrendingTopics(input: TrendingTopicsInput): Promise<TrendingTopicsOutput> {
  return getTrendingTopicsFlow(input);
}

const getLiveTrendsFromGoogle = ai.defineTool(
    {
        name: 'getLiveTrendsFromGoogle',
        description: 'Fetches the current top daily search trends from Google for a specific country.',
        inputSchema: z.object({
            countryCode: z.string().length(2).describe("The ISO 3166-1 alpha-2 country code (e.g., 'PK' for Pakistan, 'US' for United States, 'IN' for India)."),
        }),
        outputSchema: z.array(z.string()).describe("A list of the top trending topics."),
    },
    async (input) => {
        try {
            const trendsJson = await googleTrends.dailyTrends({ geo: input.countryCode });
            const trends = JSON.parse(trendsJson);
            const trendList = trends.default.trendingSearchesDays[0]?.trendingSearches || [];
            return trendList.map((trend: any) => trend.title.query).slice(0, 20);
        } catch (error) {
            console.error("Error fetching Google Trends:", error);
            return [];
        }
    }
);


const prompt = ai.definePrompt({
    name: 'getTrendingTopicsPrompt',
    input: { schema: TrendingTopicsInputSchema },
    output: { schema: TrendingTopicsOutputSchema },
    tools: [getLiveTrendsFromGoogle],
    retries: 5,
    backoff: {
      delay: 2000,   // Initial delay of 2 seconds
      multiplier: 2, // Double the delay for each retry
    },
    prompt: `
        You are a world-class AI Trend Analyst and Financial Forecaster with access to real-time global data. 
        Your task is to identify the most significant trending topics for a specific platform. If the user provides a region or country in their context, you MUST prioritize that region's data.

        **Platform:** {{platform}}
        **User Context:** {{topicContext}}

        **Instructions:**
        1.  **Analyze the Platform & Context:** Determine the platform and check if the user context specifies a country (e.g., "UK audience", "Indian market", "USA trends"). If no country is specified, default to Pakistan ('PK').
        2.  **Use Live Data:** You MUST use the \`getLiveTrendsFromGoogle\` tool to fetch real-time search data for the determined country. Your analysis should be primarily based on these live results.
        3.  **Crypto Analysis:** If the platform is 'Crypto', then you must act as a **Crypto Analyst**. Identify 3-5 coins that are currently trending. For each coin, provide:
            - **topic:** The name of the coin.
            - **reason:** A detailed analysis of recent news, market sentiment, and technical indicators.
            - **longevity & audience:** Provide suitable values.
            - **signal:** A clear, one-word signal: 'PUMP' if you predict the price will go up in the next 2-4 hours, or 'DUMP' if it will go down. Use 'NEUTRAL' if uncertain. THIS IS THE MOST IMPORTANT FIELD.
        4.  **General Trend Analysis:** If the platform is NOT 'Crypto', then act as a **General Trend Analyst**. Identify a diverse list of 20-30 trending topics from the live data. For each topic, provide a detailed 'reason', 'longevity', and 'audience'. The 'signal' field should be explicitly set to null or omitted.
        5.  **Platform Specificity:** Tailor your results to the platform. For **Google**, focus on high-volume search queries. For **TikTok/Instagram**, focus on viral sounds and visual trends. For **Facebook/X (Twitter)**, focus on breaking news and discussions.
        
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

