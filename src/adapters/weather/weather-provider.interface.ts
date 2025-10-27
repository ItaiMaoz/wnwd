import { WeatherResult } from '../../types/result.types';

export interface IWeatherProvider {
  getWeather(
    latitude: number,
    longitude: number,
    date: Date
  ): Promise<WeatherResult>;
}
