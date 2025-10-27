# Shipment Report Automation

Automated shipment report generation system that aggregates data from TMS (customer internal system), Windward tracking, and weather services to produce enriched shipment reports.

## Features

- **CSV-based batch processing**: Read shipment IDs from CSV input, generate enriched CSV output
- **Multi-source data aggregation**: Combines TMS shipment data with Windward tracking information
- **AI-powered delay analysis**: OpenAI-based classification of weather-related delays with keyword fallback
- **Weather enrichment**: Real-time historical weather data from Open-Meteo API for weather-related delays
- **Comprehensive error tracking**: All shipments included in output with error details for failed lookups
- **Intelligent retry logic**: Exponential backoff with jitter for transient API failures
- **Extensible architecture**: Dependency injection with swappable adapters for different data sources
- **Dual output formats**: Both CSV (for viewing) and JSON (for programmatic use)

## Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- OpenAI API key (for AI-based delay analysis)

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables (required)
export OPENAI_API_KEY=your_openai_api_key_here
```

See [Configuration](#configuration) for all available environment variables.

## Usage

### Input Setup

Create an input CSV file at `data/input-shipments.csv` with shipment IDs to process:

```csv
shipmentId
TMS0001
TMS0002
TMS0003
```

### Build and Run

```bash
# Build the TypeScript project
npm run build

# Run the compiled application
npm start
```

### Development Mode

```bash
# Run directly with ts-node (no build step)
npm run dev
```

### Output

The application generates two outputs:

1. **CSV file** (`data/output-shipments.csv`): Human-readable enriched data with all shipments
2. **JSON to stdout**: Structured report data for programmatic use

JSON output structure:

```json
{
  "success": true,
  "records": [
    {
      "sglShipmentNo": "TMS0001",
      "customerName": "Alpha Co",
      "shipperName": "Zeta Ltd",
      "containerNumber": "UACU5855346",
      "scac": "MAEU",
      "initialCarrierETA": "2025-07-16T03:00:00.000Z",
      "actualArrivalAt": "2025-07-20T14:30:00.000Z",
      "delayReasons": "Due to heavy fog conditions...; Customs inspection delay",
      "temperature": 15.2,
      "windSpeed": 8.5,
      "weatherFetchStatus": "SUCCESS",
      "lastUpdated": "2025-10-27T16:51:32.090Z"
    },
    {
      "sglShipmentNo": "TMS0010",
      "customerName": "",
      "shipperName": "",
      "containerNumber": "",
      "lastUpdated": "2025-10-27T16:51:32.090Z",
      "error": "SHIPMENT_NOT_FOUND: Shipment TMS0010 not found in TMS system"
    }
  ],
  "errors": [
    {
      "containerNumber": "TMS0010",
      "errorType": "SHIPMENT_NOT_FOUND",
      "message": "Shipment TMS0010 not found in TMS system"
    }
  ]
}
```

### Output Fields

| Field | Description |
|-------|-------------|
| `sglShipmentNo` | Shipment identifier from TMS |
| `customerName` | Customer name (empty for failed lookups) |
| `shipperName` | Shipper name (empty for failed lookups) |
| `containerNumber` | Container number (empty for failed lookups) |
| `scac` | Standard Carrier Alpha Code |
| `initialCarrierETA` | Initial estimated arrival (ISO 8601) |
| `actualArrivalAt` | Actual arrival time (ISO 8601) |
| `delayReasons` | Semicolon-separated delay reasons |
| `temperature` | Temperature in Celsius (only for weather-related delays) |
| `windSpeed` | Wind speed in m/s (only for weather-related delays) |
| `weatherFetchStatus` | Weather fetch result status |
| `lastUpdated` | ISO 8601 timestamp when analysis was performed |
| `error` | Error message for failed shipment lookups (empty for successful ones) |

**Note**: All shipments from the input CSV are included in the output. Failed lookups appear with empty data fields and populated `error` field.

## Configuration

Configure the application via environment variables:

```bash
# Required: OpenAI API key for delay analysis
export OPENAI_API_KEY=your_openai_api_key_here

# Optional: OpenAI model configuration
export OPENAI_MODEL=gpt-3.5-turbo        # Default: gpt-3.5-turbo
export OPENAI_MAX_TOKENS=150             # Default: 150

# Optional: Data file paths
export TMS_DATA_PATH=./context/tms-data.json
export WINDWARD_DATA_PATH=./context/windward-data.json

# Optional: Retry configuration
export RETRY_MAX_ATTEMPTS=3              # Default: 3
export RETRY_BASE_DELAY_MS=1000          # Default: 1000
export RETRY_MAX_DELAY_MS=10000          # Default: 10000
export RETRY_JITTER_FACTOR=0.1           # Default: 0.1
```

**Note**: `OPENAI_API_KEY` is required. The application will fail to start without it.

## Architecture

### Dependency Injection

The application uses `tsyringe` for dependency injection. All components are registered in `src/config/di.setup.ts`:

```typescript
setupDI(config);
const generator = container.resolve(ReportGeneratorService);
```

### Adapters

The system uses adapter pattern to isolate external data formats:

- **IShipmentDataAdapter**: Customer shipment data (currently TMS JSON files)
- **ITrackingDataAdapter**: Tracking provider data (currently Windward JSON files)
- **IWeatherProvider**: Weather data source (currently Open-Meteo Archive API)
- **IDelayAnalyzer**: Delay classification service (currently OpenAI-based with keyword fallback)

### Extending with New Adapters

#### Adding a New Customer Adapter

1. Create a new adapter implementing `IShipmentDataAdapter`:

```typescript
@injectable()
export class NewCustomerAdapter implements IShipmentDataAdapter {
  async loadShipments(): Promise<Shipment[]> {
    // Map customer format → Shipment domain model
  }
}
```

2. Register in `di.setup.ts`:

```typescript
container.register<IShipmentDataAdapter>('IShipmentDataAdapter', {
  useClass: NewCustomerAdapter
});
```

#### Switching Weather Providers

The default implementation uses Open-Meteo Archive API. To use a different provider:

1. Implement `IWeatherProvider` interface:

```typescript
@injectable()
export class CustomWeatherProvider implements IWeatherProvider {
  async getWeather(lat: number, lon: number, date: Date): Promise<WeatherResult> {
    // Fetch from your weather API
    // Use retryWithBackoff for transient errors
  }
}
```

2. Register in `di.setup.ts`:

```typescript
container.register<IWeatherProvider>('IWeatherProvider', {
  useClass: CustomWeatherProvider
});
```

## Error Handling

The application follows a fail-fast philosophy with comprehensive error tracking:

- **Critical errors** (CSV read failures): Application exits with code 1
- **Shipment lookup failures**: Placeholder records created with error details in `error` field and `errors` array
- **Non-critical errors** (weather fetch failures): Recorded in `errors` array, report generation continues
- **Minimal try-catch**: Only where recovery is possible

All shipments from the input CSV are guaranteed to appear in the output, either with full data or with error information.

Weather fetch statuses:
- `SUCCESS`: Weather data retrieved successfully
- `NO_DATA_AVAILABLE`: No data for location/date (valid response)
- `RETRY_EXHAUSTED`: Transient errors, retries failed
- `FATAL_ERROR`: Non-retryable error

Error types:
- `SHIPMENT_NOT_FOUND`: Shipment ID not found in TMS system
- `SHIPMENT_FETCH_ERROR`: Failed to load shipment data
- `TRACKING_FETCH_ERROR`: Failed to load tracking data
- `WEATHER_FETCH_ERROR`: Failed to fetch weather data

## Development

### Project Structure

```
src/
├── types/                              # Domain models and result types
│   ├── domain.types.ts                # Shipment, Tracking, Weather models
│   ├── result.types.ts                # Result<T>, WeatherResult types
│   └── delay-analysis.types.ts        # DelayAnalysisResult with Zod schema
├── adapters/                           # External system adapters
│   ├── shipment/                      # Customer data adapters
│   │   ├── shipment-adapter.interface.ts
│   │   └── tms-json.adapter.ts        # TMS JSON → Shipment
│   ├── tracking/                      # Tracking provider adapters
│   │   ├── tracking-adapter.interface.ts
│   │   └── windward-json.adapter.ts   # Windward JSON → Tracking
│   └── weather/                       # Weather provider adapters
│       ├── weather-provider.interface.ts
│       ├── open-meteo.provider.ts     # Open-Meteo Archive API
│       └── mock-weather.provider.ts   # Mock for testing
├── services/                           # Business logic
│   ├── csv-processor.service.ts       # CSV I/O handling
│   ├── shipment-analyzer.service.ts   # Core analysis orchestration
│   ├── openai-delay-analyzer.service.ts  # AI-based delay classification
│   └── keyword-delay-analyzer.service.ts # Keyword-based fallback
├── utils/                              # Shared utilities
│   └── retry.util.ts                  # Exponential backoff with jitter
└── config/                             # Configuration and DI
    ├── app.config.ts                  # Environment-based config
    └── di.setup.ts                    # Dependency injection setup

data/
├── input-shipments.csv                # Input: Shipment IDs to process
└── output-shipments.csv               # Output: Enriched analysis results
```

### Running Tests

```bash
npm test

# Watch mode
npm test -- --watch

# Single test file
npm test -- path/to/test.test.ts
```

### Linting

```bash
npm run lint
```

## Sample Data

Sample data files are located in:
- `context/tms-data.json`: 5 sample TMS shipments
- `context/windward-data.json`: 5 matching Windward tracked shipments
- `data/input-shipments.csv`: Example input CSV with 10 shipment IDs (5 valid, 5 invalid for error testing)

## Future Enhancements

- Additional customer and tracking adapters (SAP, Oracle TMS, etc.)
- Alternative AI providers (Anthropic Claude, local models)
- Real-time tracking updates (webhooks, polling)
- REST API endpoints for programmatic access
- Web UI for interactive report viewing and filtering
- Advanced analytics (delay trends, carrier performance)
- Notification system (email, Slack alerts for critical delays)

## License

ISC
