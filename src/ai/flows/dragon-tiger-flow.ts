
'use server';
/**
 * @fileOverview An AI agent to play a round of Dragon vs Tiger with a full 52-card deck.
 * 
 * - playDragonTigerRound: Simulates one round, returning the winner and cards.
 * - DragonTigerRoundInput: The input type for the playDragonTigerRound function.
 * - DragonTigerRoundOutput: The return type for the playDragonTigerRound function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import type { GlobalSettings } from '@/types';

export type DragonTigerBetType = 'Dragon' | 'Tiger' | 'Tie';

// --- Card Logic ---
const SUITS = ['S', 'C', 'D', 'H']; // Spades, Clubs, Diamonds, Hearts
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const CARD_VALUES: { [key: string]: number } = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

interface Card {
  value: string;
  suit: string;
  key: string;
}

const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ value, suit, key: `${value}${suit}` });
        }
    }
    return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

const drawTwoCards = (): [Card, Card] => {
    const deck = shuffleDeck(createDeck());
    return [deck[0], deck[1]];
};

// --- Zod Schemas ---
const DragonTigerRoundInputSchema = z.object({
  bets: z.object({
    Dragon: z.number().min(0),
    Tiger: z.number().min(0),
    Tie: z.number().min(0),
  }).describe("An object containing the player's bets on each outcome."),
});
export type DragonTigerRoundInput = z.infer<typeof DragonTigerRoundInputSchema>;

const CardSchema = z.object({
    value: z.string().describe("The card's rank (e.g., 'A', 'K', '7')."),
    suit: z.string().describe("The card's suit (S, C, D, H)."),
    key: z.string().describe("Unique card identifier (e.g., 'AS', 'KH').")
});

const DragonTigerRoundOutputSchema = z.object({
  dragonCard: CardSchema,
  tigerCard: CardSchema,
  winner: z.enum(['Dragon', 'Tiger', 'Tie']).describe("The winning outcome of the round."),
  payout: z.number().describe("The total amount returned to the player (bet + winnings)."),
  winnings: z.number().describe("The net profit for the player (payout - total bet)."),
});
export type DragonTigerRoundOutput = z.infer<typeof DragonTigerRoundOutputSchema>;

// --- Default Settings ---
const defaultDragonTigerSettings: NonNullable<GlobalSettings['dragonTigerSettings']> = {
    enabled: true,
    title: 'Dragon vs Tiger',
    description: 'A simple, fast-paced game of high card. Bet on Dragon, Tiger, or a Tie.',
    imageUrl: '',
    buttonText: 'Play Now',
    chips: [
        { value: 20, winRate: 48.5 },
        { value: 100, winRate: 45 },
        { value: 500, winRate: 40 },
        { value: 1000, winRate: 25 },
        { value: 5000, winRate: 5 },
    ],
    dragonTotalReturnMultiplier: 1.95,
    tigerTotalReturnMultiplier: 1.95,
    tieTotalReturnMultiplier: 9,
    tieFrequency: 10,
    roundTimer: 8,
};

// --- Exported Wrapper Function ---
export async function playDragonTigerRound(input: DragonTigerRoundInput): Promise<DragonTigerRoundOutput> {
  return dragonTigerFlow(input);
}

// --- Genkit Flow Definition ---
const dragonTigerFlow = ai.defineFlow(
  {
    name: 'dragonTigerFlow',
    inputSchema: DragonTigerRoundInputSchema,
    outputSchema: DragonTigerRoundOutputSchema,
  },
  async (input) => {
    // 1. Fetch settings from Firebase and merge with robust defaults.
    // Any value saved in the admin panel (`dbSettings`) will overwrite the `defaultDragonTigerSettings`.
    const settingsSnapshot = await get(ref(database, 'globalSettings/dragonTigerSettings'));
    const dbSettings = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
    const settings: NonNullable<GlobalSettings['dragonTigerSettings']> = {
      ...defaultDragonTigerSettings,
      ...dbSettings,
      chips: dbSettings.chips && dbSettings.chips.length > 0 ? dbSettings.chips : defaultDragonTigerSettings.chips,
    };

    // 2. Extract configuration from the merged settings object
    const winRateTiers = [...settings.chips!].sort((a, b) => b.value - a.value);
    // These are TOTAL RETURN multipliers. E.g., a multiplier of 1.95 on a 100 bet returns 195.
    const dragonMultiplier = settings.dragonTotalReturnMultiplier!;
    const tigerMultiplier = settings.tigerTotalReturnMultiplier!;
    const tieMultiplier = settings.tieTotalReturnMultiplier!; // Also a TOTAL RETURN multiplier now.
    const tieFrequency = settings.tieFrequency!;
    
    // 3. Process player's bet
    const { bets } = input;
    const totalBet = bets.Dragon + bets.Tiger + bets.Tie;
    const totalMainBet = bets.Dragon + bets.Tiger;

    // 4. Determine the correct Win Rate based on the bet amount and configured tiers
    let winRateToUse = winRateTiers[winRateTiers.length - 1].winRate;
    for (const tier of winRateTiers) {
      if (totalMainBet >= tier.value) {
        winRateToUse = tier.winRate;
        break;
      }
    }
    
    // 5. Determine Programmed Outcome (Win, Loss, or Tie)
    let dragonCard: Card, tigerCard: Card;
    const randomFactor = Math.random() * 100;

    if (randomFactor < tieFrequency) { // Programmed for a TIE
        let drawnCards;
        do {
            drawnCards = drawTwoCards();
        } while (CARD_VALUES[drawnCards[0].value] !== CARD_VALUES[drawnCards[1].value]);
        [dragonCard, tigerCard] = drawnCards;
    } else { // Programmed for Dragon or Tiger win (respecting the win rate)
        let playerShouldWin = (Math.random() * 100) < winRateToUse;
        const playerBetOn = totalMainBet > 0 ? (bets.Dragon > bets.Tiger ? 'Dragon' : 'Tiger') : 'None';
        
        if (playerBetOn !== 'None' && bets.Dragon === bets.Tiger) {
             playerShouldWin = Math.random() < 0.5;
        }

        let drawnCards;
        let dragonWins;
        do {
            drawnCards = drawTwoCards();
            if (CARD_VALUES[drawnCards[0].value] === CARD_VALUES[drawnCards[1].value]) continue; // Avoid ties in this branch
            
            dragonWins = CARD_VALUES[drawnCards[0].value] > CARD_VALUES[drawnCards[1].value];
            
            // If player didn't bet, any non-tie result is fine
            if (playerBetOn === 'None') break;

            // Check if the natural outcome matches the desired programmed outcome
            if ((playerBetOn === 'Dragon' && playerShouldWin === dragonWins) ||
                (playerBetOn === 'Tiger' && playerShouldWin !== dragonWins)) {
                break; // Outcome matches, exit loop
            }
        } while (true);

        [dragonCard, tigerCard] = drawnCards;
    }

    // 6. Calculate Winner and Payout based on card results and multipliers
    const dragonValue = CARD_VALUES[dragonCard.value];
    const tigerValue = CARD_VALUES[tigerCard.value];
    let winner: 'Dragon' | 'Tiger' | 'Tie';
    let payout = 0;

    if (dragonValue > tigerValue) {
        winner = 'Dragon';
        payout += bets.Dragon * dragonMultiplier;
    } else if (tigerValue > dragonValue) {
        winner = 'Tiger';
        payout += bets.Tiger * tigerMultiplier;
    } else {
        winner = 'Tie';
        payout += bets.Tie * tieMultiplier; // This is now a direct total return multiplier.
    }

    // 7. Return final result object
    return {
      dragonCard,
      tigerCard,
      winner,
      payout,
      winnings: payout - totalBet,
    };
  }
);
