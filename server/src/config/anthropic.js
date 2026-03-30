/**
 * Anthropic SDK singleton
 * Creates a single shared Anthropic client instance for the entire server.
 * Centralising it here ensures only one client is created regardless of how many
 * controllers import it, and makes it easy to swap the API key source.
 *
 * All six AI features in aiController.js import { anthropic } from this file.
 */
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
