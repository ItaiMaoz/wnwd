# Implementation Plan

## Project Goal
Automate shipment report generation by aggregating data from TMS (customer internal), Windward (tracking), and weather services, returning structured JSON output.

## Key Decisions Log

### Architecture
- **DI Framework**: tsyringe (lightweight, decorator-based)
- **Output Format**: JSON (not CSV - CSV generation will be separate client)
- **Error Handling**: Fail-fast with minimal try-catch; weather failures returned in response
- **Domain Isolation**: Adapters map external formats to clean domain models

### Adapter Design
- **Separate Adapters**: IShipmentDataAdapter (customer data), ITrackingDataAdapter (Windward), IWeatherProvider (weather)
- **Swappable**: Each customer may have different adapter; tracking providers replaceable
- **Domain Models Only**: No TMS/Windward internals exposed outside adapters

### Service Design
- **DelayAnalyzer**: Service (not utility) - keyword-based now, LLM integration planned soon
- **Weather API**: `getWeather(lat, lon, date)` - service handles historical vs current internally
- **Mock Weather**: Simple mock for now, real Open-Meteo integration later

### Retry Strategy
- **Exponential backoff with jitter**
- **Retryable**: Network timeouts, 5xx, 429
- **Non-retryable**: 4xx (except 429)
- **Config**: maxRetries: 3, baseDelay: 1000ms, maxDelay: 10000ms, jitter: 10%

### Error Handling Details
- Weather fetch distinguishes: SUCCESS, NO_DATA_AVAILABLE, RETRY_EXHAUSTED, FATAL_ERROR
- Report generation never fails due to weather errors
- ReportGenerationResult includes errors array for non-fatal issues

## Implementation Checklist

### Phase 1: Foundation ✅
- [x] Project structure
- [x] TypeScript config (strict, decorators)
- [x] Dependencies (tsyringe, reflect-metadata)
- [x] ESLint + Jest setup

### Phase 2: Types & Interfaces
- [ ] Domain types (Shipment, Container, Tracking, Weather, GeoLocation)
- [ ] Result types (WeatherResult, ReportRecord, ReportGenerationResult, ReportError)
- [ ] IShipmentDataAdapter interface
- [ ] ITrackingDataAdapter interface
- [ ] IWeatherProvider interface
- [ ] IDelayAnalyzer interface

### Phase 3: Utilities
- [ ] Retry utility with exponential backoff + jitter
  - retryWithBackoff<T>() function
  - RetryOptions type
  - isRetryableError() logic

### Phase 4: Adapters
- [ ] TMSJsonAdapter (implements IShipmentDataAdapter)
  - Load from context/tms-data.json
  - Map TMS structure → Shipment domain model
  - Extract: sglShipmentNo, customer.name, shipper.name, containers[]

- [ ] WindwardJsonAdapter (implements ITrackingDataAdapter)
  - Load from context/windward-data.json
  - Map Windward structure → Tracking domain model
  - Return Map<containerNumber, Tracking>
  - Extract: containerNumber, scac, ETAs, delays, destinationPort (lat/lon)

- [ ] MockWeatherProvider (implements IWeatherProvider)
  - Return mock weather data (temperature, windSpeed)
  - Simulate NO_DATA_AVAILABLE for some locations (test error handling)
  - No artificial delays/failures in mock

### Phase 5: Services
- [ ] DelayAnalyzerService (implements IDelayAnalyzer)
  - Weather keywords: fog, mist, storm, thunderstorm, hurricane, typhoon, wind, gale, wave, rain, snow, ice, weather
  - isWeatherRelated(delayReason: string): boolean
  - Case-insensitive matching

- [ ] ReportGeneratorService
  - Constructor: inject all adapters + DelayAnalyzer
  - generate(): Promise<ReportGenerationResult>
  - Load shipments and tracking
  - Join on containerNumber
  - For weather-related delays: fetch weather with retry
  - Build ReportRecord[] with all required fields
  - Collect non-fatal errors (weather fetch failures)
  - Return structured result

### Phase 6: Configuration & DI
- [ ] AppConfig type
  - Data file paths
  - Retry configuration
  - Weather API settings (for later)

- [ ] DI setup (config/di.setup.ts)
  - setupDI(config: AppConfig)
  - Register IShipmentDataAdapter → TMSJsonAdapter
  - Register ITrackingDataAdapter → WindwardJsonAdapter
  - Register IWeatherProvider → MockWeatherProvider
  - Register IDelayAnalyzer → DelayAnalyzerService
  - Register ReportGeneratorService as singleton

### Phase 7: Entry Point
- [ ] index.ts
  - Load config (from file/env)
  - Call setupDI(config)
  - Resolve ReportGeneratorService
  - Call generate()
  - Output JSON to stdout

### Phase 8: Testing & Validation
- [ ] Test with sample data (5 shipments)
- [ ] Verify container matching (TMS ↔ Windward)
- [ ] Verify weather detection (3 weather-related delays in samples)
- [ ] Verify output fields: sglShipmentNo, customerName, shipperName, containerNumber, scac, initialCarrierETA, actualArrivalAt, delayReasons, temperature, windSpeed
- [ ] Test missing Windward data (TMS9999/ZZZZ0000000 has match, should verify edge cases)
- [ ] Verify error handling (weather fetch failures recorded but don't fail report)

### Phase 9: Documentation
- [ ] README.md
  - Setup instructions
  - How to run
  - Output format
  - How to swap adapters
  - Configuration options

## Required Output Fields
Per requirements (section 3.1):
- sglShipmentNo
- customer.name (→ customerName in output)
- shipper.name (→ shipperName in output)
- containerNumber
- scac
- initialCarrierETA
- actualArrivalAt (→ actualArrivalAt from Windward)
- delay.reasons (→ delayReasons, joined with '; ')
- temperature (only if weather-related delay)
- wind (→ windSpeed, only if weather-related delay)

## Sample Data Analysis

### TMS Data (context/tms-data.json)
- 5 shipments: TMS0001, TMS0002, TMS0003, TMS0004, TMS9999
- Each has: sglShipmentNo, customer, shipper, containers[], routing, milestones

### Windward Data (context/windward-data.json)
- 5 tracked shipments matching TMS containers
- UACU5855346 (TMS0001): Delays - "heavy fog", "Customs inspection" → 1 weather-related
- FFAU2384633 (TMS0002): Delays - "strong thunderstorm" → weather-related
- NYKU7778881 (TMS0003): Delays - "Port congestion" → NOT weather-related
- TEMU1234567 (TMS0004): No delays
- ZZZZ0000000 (TMS9999): No delays

### Expected Weather Fetches
- UACU5855346: Hamburg (53.5511, 9.9937) on 2025-07-20 14:30 UTC
- FFAU2384633: Haifa (32.8167, 34.9896) on 2025-08-01 15:00 UTC

## Future Enhancements
- Real Open-Meteo weather integration
- LLM-based delay analysis (replacing keywords)
- Additional customer adapters
- UI for report viewing
- Real-time API endpoints (not just batch JSON files)

## Progress Tracking
Use this document to verify implementation matches design decisions. Update checklist as tasks complete.
