
'use server';
/**
 * @fileOverview Generates engaging messages for various app events.
 *
 * - generateEventNotification: Creates a context-aware message for different events.
 * - GenerateEventNotificationInput: The input type for the flow.
 * - GenerateEventNotificationOutput: The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateEventNotificationInputSchema = z.object({
  eventType: z.enum(['newTournament', 'dailyReward']),
  // Fields for daily reward
  day: z.number().min(1).max(7).optional().describe("The day of the streak (1-7)."),
  amount: z.number().optional().describe("The amount of the reward claimed."),
  // Fields for new tournament
  tournamentName: z.string().optional().describe("The name of the new tournament."),
  prize: z.string().optional().describe("The prize pool for the new tournament."),
});
export type GenerateEventNotificationInput = z.infer<typeof GenerateEventNotificationInputSchema>;

const GenerateEventNotificationOutputSchema = z.object({
  heading: z.string().describe("A short, catchy headline for the notification."),
  content: z.string().describe("The main body of the notification message."),
});
export type GenerateEventNotificationOutput = z.infer<typeof GenerateEventNotificationOutputSchema>;

// Exported wrapper function for client-side use
export async function generateEventNotification(input: GenerateEventNotificationInput): Promise<GenerateEventNotificationOutput> {
  return generateEventNotificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEventNotificationPrompt',
  input: { schema: GenerateEventNotificationInputSchema },
  output: { schema: GenerateEventNotificationOutputSchema },
  prompt: `
    You are a hype-man for an eSports gaming app. A user needs a notification.
    Generate a short, exciting, single-sentence message based on the eventType.

    Event Type: {{eventType}}

    {{#if (eq eventType "dailyReward")}}
    You are generating a daily login reward message.
    The user is on day {{day}} of their login streak.
    They received a reward of {{amount}} PKR.
    - If it's day 7, make it extra special and mention the "Weekly Bonus".
    - If it's day 1, welcome them back or encourage them to start a new streak.
    - For other days, just be encouraging and exciting.
    - Mention the amount they won.
    - Keep it concise and celebratory.
    - Your response should be just the content, not the heading. The heading will be "Day {{day}} Reward Claimed!".

    Example for Day 3: "Sweet! You just snagged {{amount}} PKR for your Day 3 login!"
    Example for Day 7: "JACKPOT! You've conquered the week and claimed the grand bonus of {{amount}} PKR!"
    {{/if}}

    {{#if (eq eventType "newTournament")}}
    You are generating a notification for a NEW tournament announcement.
    Tournament Name: {{tournamentName}}
    Prize Pool: Rs {{prize}}
    - Create a catchy, short heading.
    - Create an exciting content message to announce the tournament. Mention the name and prize.
    - Use words like "ARENA ALERT!", "CHALLENGE ACCEPTED?", "GET READY!".

    Example Heading: "New Tournament Added!"
    Example Content: "The '{{tournamentName}}' is here with a massive prize of Rs {{prize}}! Are you ready to compete?"
    {{/if}}
  `,
});

const generateEventNotificationFlow = ai.defineFlow(
  {
    name: 'generateEventNotificationFlow',
    inputSchema: GenerateEventNotificationInputSchema,
    outputSchema: GenerateEventNotificationOutputSchema,
  },
  async (input) => {
    // If the event is 'dailyReward', we manually create a heading.
    if (input.eventType === 'dailyReward') {
        // Since we are only generating content for daily reward, we'll manually set a heading.
        const promptResult = await prompt(input);
        const content = promptResult.output?.content || `You've successfully claimed your reward of ${input.amount} PKR!`;
        return {
            heading: `Day ${input.day} Reward Claimed!`,
            content: content
        };
    }
    
    // For other events like 'newTournament', we let the AI generate both heading and content.
    const { output } = await prompt(input);
    if (!output) {
      // Fallback message in case the AI fails
      return { 
          heading: "New Tournament!",
          content: `A new tournament named "${input.tournamentName}" is available with a prize of Rs ${input.prize}. Check it out!` 
      };
    }
    return output;
  }
);
