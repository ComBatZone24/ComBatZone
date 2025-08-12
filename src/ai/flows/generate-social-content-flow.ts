
'use server';
/**
 * @fileOverview An AI agent to generate trending social media content.
 * 
 * - generateSocialContent: Creates titles, descriptions, tags, and image prompts.
 * - GenerateSocialContentInput: Input for the generation flow.
 * - GenerateSocialContentOutput: Output from the generation flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const platformTypes = z.enum(['TikTok', 'Facebook', 'Google', 'Instagram', 'X (Twitter)']);

const GenerateSocialContentInputSchema = z.object({
  platform: platformTypes,
  topic: z.string().describe("The main topic or keyword for the content, e.g., 'New PUBG Tournament'."),
});
export type GenerateSocialContentInput = z.infer<typeof GenerateSocialContentInputSchema>;

const RankedItemSchema = z.object({
    value: z.string().describe("The content itself (e.g., the title text, the keyword)."),
    rank: z.number().int().describe("The rank of the item from 1 (best) to N."),
    audienceReachPercentage: z.number().min(0).max(100).describe("The estimated potential audience reach for this item, as a percentage (0-100)."),
});

const GenerateSocialContentOutputSchema = z.object({
  titles: z.array(RankedItemSchema).describe("A ranked list of 3-5 catchy, SEO-friendly title suggestions suitable for the platform. For Google, these should be SEO Title Tags (under 60 characters)."),
  descriptions: z.array(RankedItemSchema).describe("A ranked list of 2-3 detailed and engaging description suggestions for the post. For Google, these should be Meta Descriptions (under 160 characters)."),
  tags: z.array(RankedItemSchema).describe("A comprehensive, ranked list of 30-45 relevant and trending hashtags or keywords, without the '#' symbol. For Google, these are focus keywords."),
  scripts: z.array(RankedItemSchema).describe("A ranked list of 2-3 short, conversational, and engaging social media post scripts in Roman Urdu/Hindi, complete with relevant emojis. These should be ready to copy and paste."),
  imagePrompt: z.string().describe("A creative, detailed prompt for an AI image generator to create a visually stunning and relevant image for the post. This should be universal enough for any AI image tool.")
});
export type GenerateSocialContentOutput = z.infer<typeof GenerateSocialContentOutputSchema>;

export async function generateSocialContent(input: GenerateSocialContentInput): Promise<GenerateSocialContentOutput> {
  return generateSocialContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSocialContentPrompt',
  input: { schema: GenerateSocialContentInputSchema },
  output: { schema: GenerateSocialContentOutputSchema },
  prompt: `
    You are a world-class AI Trend Analyst and Predictive Content Strategist.
    Your task is to generate compelling content for a specific platform based on a given topic.
    You must analyze the latest live and past trends, news, and search data related to the topic to create content that is timely, engaging, and has a high potential for virality.
    Your response should be generic and not tied to any specific brand unless the topic itself is brand-specific.

    **Platform:** {{platform}}
    **Topic:** {{topic}}

    **Your Task:**
    Generate content based on the platform specified. Adhere to the following rules:

    1.  **Analyze Trends:** Consider what is currently trending. Think about recent game updates, popular memes, news, or cultural shifts related to the topic.
    2.  **Predictive Content & Ranking:** Based on current signals, suggest content that is likely to become popular. For titles, descriptions, tags, and scripts you MUST provide a ranked list. The best item should have rank 1.
    3.  **Audience Reach:** For each item in the ranked lists (titles, descriptions, tags, scripts), you MUST provide an estimated 'audienceReachPercentage'. This is your expert prediction of the potential audience reach for that specific item, from 0 to 100.
    4.  **Extensive Tags/Keywords:** Provide a large, ranked list of **30 to 45** trending, relevant hashtags (without the '#') or SEO keywords.
    5.  **Conversational Scripts:** Generate a ranked list of 2-3 short, conversational, and highly engaging social media post scripts in **Roman Urdu/Hindi**, complete with relevant emojis. These scripts should be in a casual, easy-to-read tone suitable for social media.
    6.  **Image Prompt:** Generate a DALL-E or Midjourney style prompt to create a stunning, high-quality image for the post. The prompt should be creative, descriptive, and evoke a professional aesthetic. It should be related to the topic and universally usable.

    **Platform-Specific Customization:**
    -   If the platform is **Google**, create SEO-optimized Title Tags (under 60 characters) and Meta Descriptions (under 160 characters). Tags should be "Focus Keywords". Scripts for Google should be more formal.
    -   If the platform is **TikTok** or **Instagram**, create very short, punchy titles and use relevant emojis in the descriptions and scripts.
    -   If the platform is **Facebook** or **X (Twitter)**, create slightly more descriptive but still engaging titles and concise descriptions. Scripts should be engaging and encourage discussion.

    Generate the ranked and detailed content now based on the Topic and Platform.
  `,
});

const generateSocialContentFlow = ai.defineFlow(
  {
    name: 'generateSocialContentFlow',
    inputSchema: GenerateSocialContentInputSchema,
    outputSchema: GenerateSocialContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate social media content.");
    }
    // Ensure arrays are sorted by rank, as the model might not always do it perfectly.
    output.titles.sort((a, b) => a.rank - b.rank);
    output.descriptions.sort((a, b) => a.rank - b.rank);
    output.tags.sort((a, b) => a.rank - b.rank);
    output.scripts.sort((a, b) => a.rank - b.rank);
    
    return output;
  }
);
