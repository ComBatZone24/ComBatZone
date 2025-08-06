
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

const GenerateSocialContentOutputSchema = z.object({
  title: z.string().describe("A catchy, SEO-friendly title suitable for the platform. For Google, this should be an SEO Title Tag (under 60 characters)."),
  description: z.string().describe("A detailed and engaging description for the post. For Google, this should be a Meta Description (under 160 characters)."),
  tags: z.array(z.string()).describe("A list of 3-5 relevant and trending hashtags or keywords, without the '#' symbol. For Google, these are focus keywords."),
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
    You are an expert Social Media and SEO strategist for a gaming platform called "Arena Ace".
    Your task is to generate compelling content for a specific platform based on a given topic.
    You must analyze the latest trends, news, and search data related to the topic to create content that is timely, engaging, and has a high potential for virality.

    **Platform:** {{platform}}
    **Topic:** {{topic}}

    **Your Task:**
    Generate content based on the platform specified. Adhere to the following rules:

    1.  **Analyze Trends:** Consider what is currently trending today in the gaming community, especially in Pakistan. Think about recent game updates, popular memes, or news.
    2.  **Predictive Content:** Based on current signals, suggest content that is likely to become popular.
    3.  **Tags/Keywords:** Provide a list of 3-5 trending, relevant hashtags (without the '#') or SEO keywords.
    4.  **Image Prompt:** Generate a DALL-E or Midjourney style prompt to create a stunning, high-quality image for the post. The prompt should be creative, descriptive, and evoke a professional gaming aesthetic. It should be related to the topic and universally usable.

    **Platform-Specific Customization:**
    -   If the platform is **Google**, create an SEO-optimized Title Tag (under 60 characters) and a Meta Description (under 160 characters). Tags should be "Focus Keywords".
    -   If the platform is **TikTok** or **Instagram**, create a very short, punchy title and use relevant emojis in the description.
    -   If the platform is **Facebook** or **X (Twitter)**, create a slightly more descriptive but still engaging title and a concise description.

    Generate the content now based on the Topic and Platform.
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
    return output;
  }
);
