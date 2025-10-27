# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shipment Report Automation - Forward Deployed Engineer exercise for Windward. Automates report generation by:
1. Loading customer shipment data (TMS)
2. Enriching with tracking data (Windward)
3. Adding weather context for weather-related delays
4. Returning JSON report structure

**Available Interfaces**:
- **Web UI** (`web/`): Next.js 16 interface with Airtable-style design, real-time analysis, localStorage caching
- **CLI** (`src/index.ts`): CSV batch processing for automated workflows
- **REST API** (`src/api-server.ts`): Express server exposing analysis endpoints

**Implementation Reference**:
- See `plan.md` for detailed implementation checklist (Phase 1-9), key architectural decisions, and progress tracking. Follow plan.md exactly when implementing new features.
- See `guidelines.md` for general coding exercise best practices.
- See `web/CLAUDE.md` for web UI-specific guidance when working on frontend features.

## Architecture

### System Components

The application consists of three interfaces sharing a common core:

1. **Core Analysis Engine** (`src/`): Shared business logic, adapters, and services
2. **Express API Server** (`src/api-server.ts`): REST endpoints for web UI and programmatic access
3. **Next.js Web UI** (`web/`): Modern interface with caching and interactive features
4. **CLI** (`src/index.ts`): CSV batch processing entry point

All interfaces use the same DI container and domain models, ensuring consistent behavior.

**Dependency Injection**: All components use constructor injection via tsyringe (`src/config/di.setup.ts`)
- CLI: `setupDI(config)` in `index.ts`
- API: `setupDI(config)` in `api-server.ts`
- Web UI: Calls Express API (no direct DI usage)

**Adapter Pattern** (swappable via interface registration):
- `IShipmentDataAdapter`: Customer data (TMS JSON → domain models)
- `ITrackingDataAdapter`: Tracking provider (Windward JSON → domain models)
- `IWeatherProvider`: Weather source (Open-Meteo Archive API)
- `IDelayAnalyzer`: AI-based delay classification (OpenAI + keyword fallback)

**Domain Isolation**: Adapters map external formats → `types/domain.types.ts`. No external structures leak to services.

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

**Core Development**:
- `npm install` - Install dependencies
- `npm run build` - Build TypeScript (CLI + API)
- `npm start` - Run CLI (CSV processing)
- `npm run dev` - Run CLI in dev mode (ts-node)
- `npm run api` - Start Express API server (port 3001)

**Web UI** (from `web/` directory):
- `cd web && npm install` - Install web dependencies
- `npm run dev` - Start Next.js dev server (port 3000)
- Requires API server running (`npm run api` from root)

**Code Quality**:
- `npm run lint` - ESLint
- `npm test` - Jest tests
- `npm test -- --watch` - Watch mode

### Project Structure
```
src/
├── types/              Domain models + result types
├── adapters/           External system adapters (shipment, tracking, weather)
├── services/           Business logic (delay analyzer, CSV processor)
├── utils/              Retry logic
├── config/             DI setup + app configuration
├── api-server.ts       Express REST API server
├── web-api.ts          CLI-based analysis entry point
└── index.ts            Main CLI entry point

web/                    Next.js Web UI
├── app/
│   ├── page.tsx       Main UI component
│   └── api/           Next.js API routes (proxy to Express)
├── components/ui/      shadcn/ui components
├── src → ../src/      Symlink to core source
└── data → ../data/    Symlink to data files
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

### CLI Flow
```
CSV Input → INPUT_SHIPMENT_IDS → TMSJsonAdapter → Result<Shipment>
                                         ↓
                              For each container → WindwardJsonAdapter → Result<Tracking>
                                         ↓
                              (if weather delay) → WeatherProvider → WeatherResult
                                         ↓
                              ReportGenerationResult (JSON) → CSV Output + stdout
```

### Web UI Flow
```
User Input → Next.js UI → POST /api/analyze (Next.js Route)
                                    ↓
                          Express API (localhost:3001)
                                    ↓
                          ShipmentAnalyzerService (DI)
                                    ↓
                          Same flow as CLI above
                                    ↓
                          JSON Response → localStorage → UI Update
```

## Configuration

App configuration injected via DI (`AppConfig` in `config/app.config.ts`):
- Data file paths (TMS, Windward)
- Retry options (max attempts, delays, jitter)
- OpenAI API settings (required for delay analysis)
- API server port (default: 3001)

**Environment Variables**:
- `OPENAI_API_KEY` - **Required** for delay analysis
- `OPENAI_MODEL` - Optional (default: gpt-3.5-turbo)
- `TMS_DATA_PATH` - Optional (default: ./context/tms-data.json)
- `WINDWARD_DATA_PATH` - Optional (default: ./context/windward-data.json)
- See README.md for complete list

## Web UI Specific

The web UI (`web/`) is a separate Next.js 16 application that communicates with the Express API.

**Key Features**:
- localStorage caching for shipment persistence
- Auto-load cached shipments on mount
- Inline add with bulk paste support (comma, space, newline separated)
- Remove shipments functionality
- Real-time analysis updates
- Airtable-style design

**Important Guidelines**:
- See `web/CLAUDE.md` for detailed web UI guidance
- Next.js API routes are **proxies only** - no business logic
- All analysis logic stays in core engine (`src/`)
- State management via React hooks (no external state library)
- Component styling via Tailwind CSS utilities

**Known Issue**: Production build fails due to Turbopack decorator parsing limitation. Use dev mode (`npm run dev`).

## Working with Different Interfaces

**When to modify core (`src/`)**:
- Adding new adapters
- Changing analysis logic
- Adding new domain models
- Updating services or utilities

**When to modify API server (`src/api-server.ts`)**:
- Adding new REST endpoints
- Changing API request/response formats
- Adding middleware (CORS, authentication, etc.)

**When to modify web UI (`web/`)**:
- UI/UX improvements
- Adding frontend features
- Styling changes
- Client-side caching logic

**Important**: Core business logic changes affect ALL interfaces. Test CLI, API, and Web UI after core modifications.
