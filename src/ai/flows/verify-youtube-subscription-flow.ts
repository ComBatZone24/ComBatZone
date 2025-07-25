
'use server';
/**
 * @fileOverview An AI agent to verify YouTube subscription screenshots.
 * 
 * - verifyYoutubeSubscription: Analyzes a screenshot to confirm subscription.
 * - VerifySubscriptionInput: Input for the verification flow.
 * - VerifySubscriptionOutput: Output from the verification flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const VerifySubscriptionInputSchema = z.object({
  screenshotDataUri: z.string().describe(
    "A screenshot of a YouTube channel page, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  expectedChannelName: z.string().describe("The expected name of the YouTube channel."),
});
export type VerifySubscriptionInput = z.infer<typeof VerifySubscriptionInputSchema>;

const VerifySubscriptionOutputSchema = z.object({
  isSubscribed: z.boolean().describe("Whether the screenshot clearly shows the user is subscribed to the channel."),
  isCorrectChannel: z.boolean().describe("Whether the channel name in the screenshot matches the expected channel name."),
  verificationPassed: z.boolean().describe("Overall verification result. True only if both isSubscribed and isCorrectChannel are true."),
  reason: z.string().describe("A brief explanation for the verification decision, especially if it failed."),
});
export type VerifySubscriptionOutput = z.infer<typeof VerifySubscriptionOutputSchema>;

export async function verifyYoutubeSubscription(input: VerifySubscriptionInput): Promise<VerifySubscriptionOutput> {
  return verifyYoutubeSubscriptionFlow(input);
}

const verificationPrompt = ai.definePrompt({
  name: 'verifyYoutubeSubscriptionPrompt',
  input: { schema: VerifySubscriptionInputSchema },
  output: { schema: VerifySubscriptionOutputSchema },
  prompt: `You are an AI assistant designed to verify YouTube channel subscription screenshots.
Your task is to analyze the provided screenshot and determine if the user has successfully subscribed to the correct channel.

You MUST verify two things:
1.  **Subscription Status**: Look for UI elements that indicate a subscription. This is typically a button with text like "Subscribed" or "Suscrito" or a filled-in bell icon. A button saying "Subscribe" means they are NOT subscribed. Set \`isSubscribed\` to true only if you are confident the user is subscribed.
2.  **Channel Name**: Compare the channel name visible in the screenshot to the \`expectedChannelName\`. They must match, ignoring case and minor punctuation. Set \`isCorrectChannel\` to true if they match.

The final \`verificationPassed\` field should ONLY be true if BOTH \`isSubscribed\` AND \`isCorrectChannel\` are true.
Provide a clear \`reason\` for your decision, for example: "Verification failed because the 'Subscribed' button was not visible." or "Verification passed."

**Expected Channel Name:** {{{expectedChannelName}}}
**User's Screenshot:** {{media url=screenshotDataUri}}
`,
});

const verifyYoutubeSubscriptionFlow = ai.defineFlow(
  {
    name: 'verifyYoutubeSubscriptionFlow',
    inputSchema: VerifySubscriptionInputSchema,
    outputSchema: VerifySubscriptionOutputSchema,
  },
  async (input) => {
    // Adding safety settings to reduce the chance of the model refusing to process the screenshot.
    const { output } = await verificationPrompt(input, {
        config: {
            safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ]
        }
    });

    if (!output) {
      return {
        isSubscribed: false,
        isCorrectChannel: false,
        verificationPassed: false,
        reason: 'AI model failed to return a valid analysis. Please try again with a clearer screenshot.',
      };
    }
    
    // Final logic check on the server to ensure consistency
    const passed = output.isSubscribed && output.isCorrectChannel;
    
    return {
      ...output,
      verificationPassed: passed,
    };
  }
);
