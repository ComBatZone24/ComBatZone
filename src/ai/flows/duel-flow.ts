'use server';
/**
 * @fileOverview An AI agent to play a round of a 1v1 duel.
 * 
 * - playDuelRound: Simulates one round, returning the bot's move and the outcome.
 * - DuelRoundInput: The input type for the playDuelRound function.
 * - DuelRoundOutput: The return type for the playDuelRound function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

type Action = 'Rock' | 'Paper' | 'Scissors';

// --- Zod Schemas ---
const DuelRoundInputSchema = z.object({
  playerMove: z.enum(['Rock', 'Paper', 'Scissors']).describe("The player's chosen move for the current round."),
});
export type DuelRoundInput = z.infer<typeof DuelRoundInputSchema>;

const DuelRoundOutputSchema = z.object({
  botMove: z.enum(['Rock', 'Paper', 'Scissors']).describe("The bot's move for the round."),
  roundWinner: z.enum(['Player', 'Bot', 'Draw']).describe("The winner of the individual round."),
  explanation: z.string().describe("A brief, exciting explanation of what happened in the round based on the moves."),
});
export type DuelRoundOutput = z.infer<typeof DuelRoundOutputSchema>;

// --- Exported Wrapper Function ---
export async function playDuelRound(input: DuelRoundInput): Promise<DuelRoundOutput> {
  return duelRoundFlow(input);
}

// Helper function to determine the winner
const getRoundWinner = (playerMove: Action, botMove: Action): 'Player' | 'Bot' | 'Draw' => {
  if (playerMove === botMove) return 'Draw';
  if (
    (playerMove === 'Rock' && botMove === 'Scissors') ||
    (playerMove === 'Paper' && botMove === 'Rock') ||
    (playerMove === 'Scissors' && botMove === 'Paper')
  ) {
    return 'Player';
  }
  return 'Bot';
};

const explanationPrompt = ai.definePrompt({
    name: 'duelExplanationPrompt',
    input: { schema: z.object({ playerMove: z.string(), botMove: z.string(), winner: z.string() }) },
    output: { schema: z.object({ explanation: z.string() }) },
    prompt: `
        Generate a short, exciting, one-sentence explanation for a round of a rock-paper-scissors duel.
        - Player's move: {{playerMove}}
        - Bot's move: {{botMove}}
        - Round winner: {{winner}}
        
        Example for Player winning with Rock vs Scissors: "The player's crushing Rock smashes the bot's Scissors!"
        Example for Bot winning with Paper vs Rock: "The bot's Paper smoothly covers the player's Rock!"
        Example for a Draw: "Both combatants chose {{playerMove}}, resulting in a tense standoff!"
    `
});


// --- Genkit Flow Definition ---
const duelRoundFlow = ai.defineFlow(
  {
    name: 'duelRoundFlow',
    inputSchema: DuelRoundInputSchema,
    outputSchema: DuelRoundOutputSchema,
  },
  async (input) => {
    const { playerMove } = input;
    const moves: Action[] = ['Rock', 'Paper', 'Scissors'];
    
    // Define winning and other moves from the bot's perspective
    const winningMoveMap: Record<Action, Action> = { 'Rock': 'Paper', 'Paper': 'Scissors', 'Scissors': 'Rock' };
    const botWinningMove = winningMoveMap[playerMove];
    const nonWinningMoves = moves.filter(m => m !== botWinningMove);

    let botMove: Action;
    const randomFactor = Math.random();

    // AI has a 65% chance to play the winning move, otherwise it plays a non-winning (losing or drawing) move.
    if (randomFactor < 0.65) {
      botMove = botWinningMove;
    } else {
      botMove = nonWinningMoves[Math.floor(Math.random() * nonWinningMoves.length)];
    }

    const roundWinner = getRoundWinner(playerMove, botMove);
    
    // Generate the explanation using an AI prompt
    const { output } = await explanationPrompt({
      playerMove,
      botMove,
      winner: roundWinner,
    });
    
    if (!output?.explanation) {
      throw new Error("Failed to generate round explanation.");
    }

    return {
      botMove,
      roundWinner,
      explanation: output.explanation,
    };
  }
);
