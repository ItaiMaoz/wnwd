import { DelayAnalysisResult } from '../types/delay-analysis.types';

export interface IDelayAnalyzer {
  analyzeDelay(delayReason: string): Promise<DelayAnalysisResult>;
}
