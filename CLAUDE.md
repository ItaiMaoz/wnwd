# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shipment Report Automation - Forward Deployed Engineer exercise for Windward. Automates report generation by:
1. Loading customer shipment data (TMS)
2. Enriching with tracking data (Windward)
3. Adding weather context for weather-related delays
4. Returning JSON report structure

**Implementation Reference**:
- See `plan.md` for detailed implementation checklist (Phase 1-9), key architectural decisions, and progress tracking. Follow plan.md exactly when implementing new features.
- See `guidelines.md` for general coding exercise best practices.

## Architecture

**Dependency Injection**: All components use constructor injection via tsyringe (`src/config/di.setup.ts`)

**Adapter Pattern** (swappable via interface registration):
- `IShipmentDataAdapter`: Customer data (TMS JSON → domain models)
- `ITrackingDataAdapter`: Tracking provider (Windward JSON → domain models)
- `IWeatherProvider`: Weather source (mock → Open-Meteo planned)

**Domain Isolation**: Adapters map external formats → `types/domain.types.ts`. No external structures leak to services.

**Services**: `IDelayAnalyzer` (detects weather-related delays)

## Error Handling

**Result Pattern**: Adapters return `Result<T>` instead of nullable types
- Success with data: `{ success: true, data: T, message: "..." }`
- Success without data (not found): `{ success: true, message: "Not found..." }`
- Failure: `{ success: false, message: "Error: ..." }`
- Never return null - caller always gets clear status + user-friendly message

**General Approach**:
- Minimal try-catch - let critical operations fail fast
- Non-fatal errors (weather fetch) recorded in `errors[]`, don't fail entire report
- Retry with exponential backoff + jitter (see `utils/retry.util.ts`)
  - Retryable: network timeouts, 5xx, 429
  - Non-retryable: 4xx (except 429), validation errors

## Code Quality & Testing

**Validation & Safety**:
- Validate external data at adapter boundaries before mapping to domain models
- Handle empty arrays, null fields, missing optional data gracefully
- Use TypeScript type guards when working with external JSON data
- Ensure JSON output matches `ReportGenerationResult` type exactly (strict mode)

**Testing**:
- Unit tests for adapters (verify domain mapping)
- Integration tests with mock dependencies
- Test retry logic with simulated failures
- Edge cases: empty input, null/undefined, missing fields, malformed JSON, boundary conditions
- Common pitfalls: null handling, 0-indexed vs 1-indexed arrays, integer overflow, mutability

## Commands

**Development**: `npm install` • `npm run dev` • `npm run build` • `npm start`
**Code Quality**: `npm run lint` • `npm test` • `npm test -- --watch`

### Project Structure
```
src/
├── types/              Domain models + result types
├── adapters/           External system adapters (shipment, tracking, weather)
├── services/           Business logic (delay analyzer)
├── utils/              Retry logic
└── config/             DI setup + app configuration
```

## Adding Components

**New Customer Adapter**:
1. Implement `IShipmentDataAdapter`, map customer format → `Shipment` domain model
2. Register in `di.setup.ts`: `container.register('IShipmentDataAdapter', { useClass: NewAdapter })`

**Real Weather Integration**:
1. Implement `IWeatherProvider`, use `retryWithBackoff` for transient errors
2. Return `WeatherResult` with status (SUCCESS/NO_DATA_AVAILABLE/RETRY_EXHAUSTED/FATAL_ERROR)
3. Register in `di.setup.ts` replacing `MockWeatherProvider`

## Data Flow

```
INPUT_SHIPMENT_IDS → TMSJsonAdapter → Result<Shipment>
                              ↓
                   For each container → WindwardJsonAdapter → Result<Tracking>
                              ↓
                   (if weather delay) → WeatherProvider → WeatherResult
                              ↓
                   ReportGenerationResult (JSON)
```

## Configuration

App configuration injected via DI (`AppConfig` in `config/app.config.ts`):
- Data file paths
- Retry options (max attempts, delays, jitter)
- Weather API settings
