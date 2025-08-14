
import { config } from 'dotenv';
config();

// Must be imported before other flows to initialize `admin` instances.
import { firebase } from '@genkit-ai/firebase';
firebase();


import '@/ai/flows/duel-flow.ts';
import '@/ai/flows/spin-wheel-flow.ts';
import '@/ai/flows/generate-event-notification-flow.ts';
import '@/ai/flows/dragon-tiger-flow.ts';
import '@/ai/flows/verify-youtube-subscription-flow.ts';
import '@/ai/flows/mining-explanation-flow.ts';
import '@/ai/flows/generate-gps-instructions-flow.ts';
import '@/ai/flows/generate-social-content-flow.ts';
import '@/ai/flows/get-trending-topics-flow.ts';
