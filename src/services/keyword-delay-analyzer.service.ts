import { injectable } from 'tsyringe';
import { DelayAnalysisResult } from '../types/delay-analysis.types';
import { IDelayAnalyzer } from './delay-analyzer.interface';

@injectable()
export class KeywordDelayAnalyzerService implements IDelayAnalyzer {
  private readonly weatherKeywords = [
    'fog',
    'mist',
    'visibility',
    'storm',
    'thunderstorm',
    'hurricane',
    'typhoon',
    'cyclone',
    'wind',
    'gale',
    'breeze',
    'wave',
    'swell',
    'sea state',
    'rain',
    'precipitation',
    'downpour',
    'snow',
    'ice',
    'freeze',
    'weather',
    'meteorological',
    'atmospheric'
  ];

  async analyzeDelay(delayReason: string): Promise<DelayAnalysisResult> {
    const lowerReason = delayReason.toLowerCase();
    const isWeatherRelated = this.weatherKeywords.some(keyword =>
      lowerReason.includes(keyword)
    );

    const matchedKeywords = this.weatherKeywords.filter(keyword =>
      lowerReason.includes(keyword)
    );

    return {
      isWeatherRelated,
      reasoning: isWeatherRelated
        ? `Matched weather keywords: ${matchedKeywords.join(', ')}`
        : 'No weather keywords found',
      confidence: isWeatherRelated ? 0.7 : 0.9
    };
  }
}
