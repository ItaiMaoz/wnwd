import { z } from 'zod';

// Zod schema for OpenAI response validation
export const DelayAnalysisResponseSchema = z.object({
  isWeatherRelated: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1)
});

// TypeScript type inferred from schema
export type DelayAnalysisResult = z.infer<typeof DelayAnalysisResponseSchema>;
