import { inject, injectable } from 'tsyringe';
import OpenAI from 'openai';
import { AppConfig } from '../config/app.config';
import { DelayAnalysisResponseSchema, DelayAnalysisResult } from '../types/delay-analysis.types';
import { IDelayAnalyzer } from './delay-analyzer.interface';
import { KeywordDelayAnalyzerService } from './keyword-delay-analyzer.service';
import { retryWithBackoff } from '../utils/retry.util';

@injectable()
export class OpenAIDelayAnalyzerService implements IDelayAnalyzer {
  private readonly client: OpenAI;
  private readonly fallbackAnalyzer: KeywordDelayAnalyzerService;

  constructor(@inject('AppConfig') private config: AppConfig) {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.fallbackAnalyzer = new KeywordDelayAnalyzerService();
  }

  async analyzeDelay(delayReason: string): Promise<DelayAnalysisResult> {
    try {
      return await retryWithBackoff(
        () => this.callOpenAI(delayReason),
        this.config.retry,
        this.isRetryableError
      );
    } catch (error) {
      console.error('OpenAI delay analysis failed, using fallback:', error);
      return this.fallbackAnalyzer.analyzeDelay(delayReason);
    }
  }

  private async callOpenAI(delayReason: string): Promise<DelayAnalysisResult> {
    const response = await this.client.responses.create({
      model: this.config.openai.model,
      instructions: this.buildSystemInstructions(),
      input: delayReason
    });

    return this.parseResponse(response.output_text);
  }

  private buildSystemInstructions(): string {
    return `You are a shipping delay classifier. Analyze delay reasons and determine if they are weather-related.

Weather-related factors include:
- Meteorological conditions (fog, mist, visibility)
- Storms (thunderstorm, hurricane, typhoon, cyclone)
- Wind conditions (strong winds, gale, breeze)
- Sea conditions (high waves, rough seas, sea state)
- Precipitation (rain, snow, ice, freeze, downpour)
- Any atmospheric or weather-related events

Respond ONLY with a valid JSON object in this exact format:
{
  "isWeatherRelated": true or false,
  "reasoning": "Brief explanation of your decision",
  "confidence": 0.0 to 1.0 (your confidence in the decision)
}`;
  }

  private parseResponse(outputText: string): DelayAnalysisResult {
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return DelayAnalysisResponseSchema.parse(parsed);
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry on network errors
    if (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network')
    ) {
      return true;
    }

    // Retry on OpenAI rate limits and server errors
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      return status === 429 || (status !== undefined && status >= 500);
    }

    return false;
  }
}
