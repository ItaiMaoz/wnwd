/**
 * Test script to experiment with Open-Meteo API
 * Tests both valid and invalid parameter scenarios
 */

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units?: {
    time: string;
    temperature_2m: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
  error?: boolean;
  reason?: string;
}

async function testOpenMeteoAPI() {
  const today = new Date('2025-10-27'); // From env
  console.log('=== Testing Open-Meteo Historical Weather API ===');
  console.log(`Today's date: ${today.toISOString().split('T')[0]}\n`);

  // Test 1: Valid request - Hamburg coordinates from plan.md (PAST DATE)
  console.log('Test 1: VALID REQUEST - PAST DATE (3 months ago)');
  console.log('Location: Hamburg (53.5511, 9.9937)');
  console.log('Date: 2025-07-20');

  const validUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
  validUrl.searchParams.set('latitude', '53.5511');
  validUrl.searchParams.set('longitude', '9.9937');
  validUrl.searchParams.set('start_date', '2025-07-20');
  validUrl.searchParams.set('end_date', '2025-07-20');
  validUrl.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m');
  validUrl.searchParams.set('timezone', 'UTC');

  try {
    console.log(`URL: ${validUrl.toString()}\n`);
    const response = await fetch(validUrl.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'date': response.headers.get('date')
    });
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (data.hourly && data.hourly.time.length > 0) {
      // Find data closest to 14:30 UTC (from plan.md: 2025-07-20 14:30 UTC)
      const targetHour = 14;
      const hourlyData = data.hourly;
      const targetIndex = hourlyData.time.findIndex(t => t.includes(`T${targetHour.toString().padStart(2, '0')}:`));

      if (targetIndex >= 0) {
        console.log('\n--- Weather at ~14:30 UTC ---');
        console.log('Time:', hourlyData.time[targetIndex]);
        console.log('Temperature:', hourlyData.temperature_2m[targetIndex], data.hourly_units?.temperature_2m);
        console.log('Wind Speed:', hourlyData.wind_speed_10m[targetIndex], data.hourly_units?.wind_speed_10m);
        console.log('Wind Direction:', hourlyData.wind_direction_10m[targetIndex], data.hourly_units?.wind_direction_10m);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Invalid request - missing required parameter
  console.log('Test 2: INVALID REQUEST - Missing longitude');

  const invalidUrl1 = new URL('https://archive-api.open-meteo.com/v1/archive');
  invalidUrl1.searchParams.set('latitude', '53.5511');
  // Missing longitude intentionally
  invalidUrl1.searchParams.set('start_date', '2025-07-20');
  invalidUrl1.searchParams.set('end_date', '2025-07-20');

  try {
    console.log(`URL: ${invalidUrl1.toString()}\n`);
    const response = await fetch(invalidUrl1.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Invalid request - invalid date format
  console.log('Test 3: INVALID REQUEST - Invalid date format');

  const invalidUrl2 = new URL('https://archive-api.open-meteo.com/v1/archive');
  invalidUrl2.searchParams.set('latitude', '53.5511');
  invalidUrl2.searchParams.set('longitude', '9.9937');
  invalidUrl2.searchParams.set('start_date', '2025-13-45'); // Invalid date
  invalidUrl2.searchParams.set('end_date', '2025-07-20');
  invalidUrl2.searchParams.set('hourly', 'temperature_2m');

  try {
    console.log(`URL: ${invalidUrl2.toString()}\n`);
    const response = await fetch(invalidUrl2.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Invalid request - invalid weather variable
  console.log('Test 4: INVALID REQUEST - Invalid weather variable');

  const invalidUrl3 = new URL('https://archive-api.open-meteo.com/v1/archive');
  invalidUrl3.searchParams.set('latitude', '53.5511');
  invalidUrl3.searchParams.set('longitude', '9.9937');
  invalidUrl3.searchParams.set('start_date', '2025-07-20');
  invalidUrl3.searchParams.set('end_date', '2025-07-20');
  invalidUrl3.searchParams.set('hourly', 'invalid_variable,temperature_2m');

  try {
    console.log(`URL: ${invalidUrl3.toString()}\n`);
    const response = await fetch(invalidUrl3.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 5: Recent past (yesterday)
  console.log('Test 5: VALID REQUEST - RECENT PAST (yesterday)');
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log('Location: Hamburg (53.5511, 9.9937)');
  console.log(`Date: ${yesterdayStr}`);

  const validUrl2 = new URL('https://archive-api.open-meteo.com/v1/archive');
  validUrl2.searchParams.set('latitude', '53.5511');
  validUrl2.searchParams.set('longitude', '9.9937');
  validUrl2.searchParams.set('start_date', yesterdayStr);
  validUrl2.searchParams.set('end_date', yesterdayStr);
  validUrl2.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m');
  validUrl2.searchParams.set('timezone', 'UTC');

  try {
    console.log(`URL: ${validUrl2.toString()}\n`);
    const response = await fetch(validUrl2.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body (first 3 hours):', JSON.stringify({
      ...data,
      hourly: data.hourly ? {
        time: data.hourly.time.slice(0, 3),
        temperature_2m: data.hourly.temperature_2m.slice(0, 3),
        wind_speed_10m: data.hourly.wind_speed_10m.slice(0, 3),
        wind_direction_10m: data.hourly.wind_direction_10m.slice(0, 3)
      } : undefined
    }, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 6: Near future (5 days from now)
  console.log('Test 6: NEAR FUTURE (5 days from today)');
  const nearFuture = new Date(today);
  nearFuture.setDate(nearFuture.getDate() + 5);
  const nearFutureStr = nearFuture.toISOString().split('T')[0];

  console.log('Location: Hamburg (53.5511, 9.9937)');
  console.log(`Date: ${nearFutureStr}`);

  const futureUrl1 = new URL('https://archive-api.open-meteo.com/v1/archive');
  futureUrl1.searchParams.set('latitude', '53.5511');
  futureUrl1.searchParams.set('longitude', '9.9937');
  futureUrl1.searchParams.set('start_date', nearFutureStr);
  futureUrl1.searchParams.set('end_date', nearFutureStr);
  futureUrl1.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m');
  futureUrl1.searchParams.set('timezone', 'UTC');

  try {
    console.log(`URL: ${futureUrl1.toString()}\n`);
    const response = await fetch(futureUrl1.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 7: Far future (6 months from now)
  console.log('Test 7: FAR FUTURE (6 months from today)');
  const farFuture = new Date(today);
  farFuture.setMonth(farFuture.getMonth() + 6);
  const farFutureStr = farFuture.toISOString().split('T')[0];

  console.log('Location: Hamburg (53.5511, 9.9937)');
  console.log(`Date: ${farFutureStr}`);

  const futureUrl2 = new URL('https://archive-api.open-meteo.com/v1/archive');
  futureUrl2.searchParams.set('latitude', '53.5511');
  futureUrl2.searchParams.set('longitude', '9.9937');
  futureUrl2.searchParams.set('start_date', farFutureStr);
  futureUrl2.searchParams.set('end_date', farFutureStr);
  futureUrl2.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m');
  futureUrl2.searchParams.set('timezone', 'UTC');

  try {
    console.log(`URL: ${futureUrl2.toString()}\n`);
    const response = await fetch(futureUrl2.toString());
    const data: OpenMeteoResponse = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the tests
testOpenMeteoAPI().catch(console.error);
