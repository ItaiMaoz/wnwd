import { injectable } from 'tsyringe';
import { WeatherFetchStatus, WeatherResult } from '../../types/result.types';
import { IWeatherProvider } from './weather-provider.interface';

@injectable()
export class MockWeatherProvider implements IWeatherProvider {
  async getWeather(
    latitude: number,
    _longitude: number,
    _date: Date
  ): Promise<WeatherResult> {
    // Simple mock: return reasonable weather data
    // Temperature varies by latitude (rough approximation)
    const temperature = 20 - Math.abs(latitude) / 3;

    // Wind speed: random between 5-15 m/s
    const windSpeed = 5 + Math.random() * 10;

    // Wind direction: random
    const windDirection = Math.floor(Math.random() * 360);

    return {
      status: WeatherFetchStatus.SUCCESS,
      data: {
        temperature: Math.round(temperature * 10) / 10,
        windSpeed: Math.round(windSpeed * 10) / 10,
        windDirection
      }
    };
  }
}
