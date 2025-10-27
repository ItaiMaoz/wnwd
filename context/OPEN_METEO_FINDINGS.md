# Open-Meteo API Testing Findings

## API Endpoint
- **Base URL**: `https://archive-api.open-meteo.com`
- **Endpoint**: `/v1/archive`
- **Method**: GET
- **Documentation**: https://open-meteo.com/en/docs/historical-weather-api
- **⚠️ CRITICAL**: This endpoint ONLY works for **historical data** (past dates)
- **Date Range**: 1940-01-01 to TODAY (inclusive)

## Required Parameters
- `latitude` (float): WGS84 latitude
- `longitude` (float): WGS84 longitude
- `start_date` (string): YYYY-MM-DD format
- `end_date` (string): YYYY-MM-DD format

## Optional Parameters
- `hourly` (string): Comma-separated weather variables (e.g., "temperature_2m,wind_speed_10m,wind_direction_10m")
- `timezone` (string): Timezone for time values (default: GMT, use "UTC" or "auto")

## Positive Response (HTTP 200)

**Structure:**
```json
{
  "latitude": 53.532513,
  "longitude": 9.980879,
  "generationtime_ms": 3.44,
  "utc_offset_seconds": 0,
  "timezone": "GMT",
  "timezone_abbreviation": "GMT",
  "elevation": 3,
  "hourly_units": {
    "time": "iso8601",
    "temperature_2m": "°C",
    "wind_speed_10m": "km/h",
    "wind_direction_10m": "°"
  },
  "hourly": {
    "time": ["2025-07-20T00:00", "2025-07-20T01:00", ...],
    "temperature_2m": [19.6, 19.5, 19.1, ...],
    "wind_speed_10m": [13.1, 13.3, 13.4, ...],
    "wind_direction_10m": [111, 115, 118, ...]
  }
}
```

**Key Characteristics:**
- Returns 24 hourly data points per day
- All arrays have parallel indices (time[0] corresponds to temperature_2m[0], etc.)
- Data is deterministic and consistent across requests
- Response time: 0.35ms - 3.44ms

**Units:**
- Temperature: °C (already in correct format ✓)
- Wind Speed: km/h (**must convert to m/s**: divide by 3.6)
- Wind Direction: degrees (0-360)
- Time: ISO 8601 format with timezone

## Negative Responses (HTTP 400)

### Missing Required Parameter
```json
{
  "error": true,
  "reason": "Parameter 'latitude' and 'longitude' must have the same number of elements"
}
```

### Invalid Date Format
```json
{
  "error": true,
  "reason": "Invalid date"
}
```

### Invalid Weather Variable
```json
{
  "error": true,
  "reason": "Data corrupted at path ''. Cannot initialize ... from invalid String value ..."
}
```

### Future Date (Out of Range)
```json
{
  "error": true,
  "reason": "Parameter 'start_date' is out of allowed range from 1940-01-01 to 2025-10-27"
}
```

**Key Characteristics:**
- Always returns `"error": true` field
- Provides descriptive `"reason"` string
- HTTP status: 400 (Bad Request)
- **Future dates are REJECTED** - archive API only works for historical data

## Implementation Considerations

### 1. Error Detection
```typescript
// Check HTTP status
if (response.status !== 200) {
  // Handle 4xx/5xx errors
}

// Check response body
if (data.error === true) {
  // Handle API error with data.reason
}
```

### 2. Unit Conversion
```typescript
// Wind speed: km/h → m/s
const windSpeedMs = windSpeedKmh / 3.6;
```

### 3. Finding Closest Hour
```typescript
// Target: 2025-07-20 14:30 UTC
// Find closest hour (14:00) in hourly.time array
const targetHour = date.getUTCHours();
const hourlyData = response.hourly;
const index = hourlyData.time.findIndex(t =>
  t.includes(`T${targetHour.toString().padStart(2, '0')}:`)
);

if (index >= 0) {
  const temp = hourlyData.temperature_2m[index];
  const windSpeed = hourlyData.wind_speed_10m[index] / 3.6; // Convert to m/s
  const windDir = hourlyData.wind_direction_10m[index];
}
```

### 4. Handling Missing Data
```typescript
// Arrays might contain null values
const temp = hourlyData.temperature_2m[index];
if (temp === null || temp === undefined) {
  // Handle missing data - return NO_DATA_AVAILABLE
}
```

### 5. Retry Strategy
- **Retryable errors**: HTTP 5xx, network timeouts, 429 (rate limit)
- **Non-retryable errors**: HTTP 4xx (except 429), `error: true` in response
- Use exponential backoff with jitter (see `utils/retry.util.ts`)

### 6. Date Formatting
```typescript
// Format Date to YYYY-MM-DD for API
const dateStr = date.toISOString().split('T')[0];
```

## Test Results

### Historical Data (Works ✅)
- **Past (3 months ago)**: Hamburg @ 2025-07-20 → 24.6°C, 10.7 km/h wind
- **Recent Past (yesterday)**: Hamburg @ 2025-10-26 → 6.9°C, 21.6 km/h wind
- Data is **deterministic** and **consistent** across multiple requests

### Future Data (Fails ❌)
- **Near Future (5 days ahead)**: 2025-11-01 → Error 400: "out of allowed range"
- **Far Future (6 months ahead)**: 2026-04-26 → Error 400: "out of allowed range"
- **Conclusion**: Archive API strictly rejects ANY future dates

### API Date Constraint
- **Allowed Range**: 1940-01-01 to **TODAY** (2025-10-27 as of testing)
- The "TODAY" cutoff updates daily to match current date
- No forecast capability - purely historical/archival data

## Implementation Implications

### Critical Decision Required
The archive API **cannot provide weather data for future dates**. This affects our shipment report system:

**Option 1: Historical Data Only (Recommended for MVP)**
- ✅ Use archive API for all weather-related delays (they occurred in the past)
- ✅ If delay date > today: return `NO_DATA_AVAILABLE` status
- ✅ Simple, reliable implementation
- ❌ Cannot support future shipment analysis

**Option 2: Hybrid Approach (Future Enhancement)**
- Use archive API for dates ≤ today
- Use forecast API (`https://api.open-meteo.com/v1/forecast`) for dates > today
- Requires two separate API integrations
- Forecast API has different response structure and limitations (max 16 days ahead)

### Recommended Implementation Path

**Phase 1: Archive API Only**
1. Create `OpenMeteoWeatherProvider` implementing `IWeatherProvider`
2. Validate date ≤ today; if not, return `NO_DATA_AVAILABLE`
3. Use `retryWithBackoff` for HTTP requests
4. Map API response → `WeatherResult` with proper error handling
5. Convert wind speed km/h → m/s
6. Find closest hour to target timestamp
7. Return appropriate `WeatherFetchStatus` based on response

**Phase 2 (Future): Add Forecast Support**
- Only if business needs future shipment analysis
- Requires separate forecast API integration
- Document limitations (max 16 days, forecast uncertainty)
