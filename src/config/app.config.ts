import 'dotenv/config';
import { RetryOptions } from '../utils/retry.util';

export interface AppConfig {
  data: {
    tmsPath: string;
    windwardPath: string;
  };
  batchSize: number;
  retry: RetryOptions;
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
}

export function loadConfig(): AppConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const batchSize = parseInt(process.env.BATCH_SIZE || '5', 10);
  if (batchSize < 1 || batchSize > 50) {
    throw new Error('BATCH_SIZE must be between 1 and 50');
  }

  return {
    data: {
      tmsPath: process.env.TMS_DATA_PATH || './context/tms-data.json',
      windwardPath: process.env.WINDWARD_DATA_PATH || './context/windward-data.json'
    },
    batchSize,
    retry: {
      maxRetries: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10),
      maxDelay: parseInt(process.env.RETRY_MAX_DELAY_MS || '10000', 10),
      jitterFactor: parseFloat(process.env.RETRY_JITTER_FACTOR || '0.1')
    },
    openai: {
      apiKey: openaiApiKey,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '150', 10)
    }
  };
}
