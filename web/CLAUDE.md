# CLAUDE.md - Web UI

This file provides guidance to Claude Code when working with the Next.js web UI portion of the Shipment Analysis system.

## Overview

Modern web interface built with Next.js 16, React 19.2, and Tailwind CSS v4.1 for interactive shipment analysis. The UI provides an Airtable-style experience with real-time updates, caching, and bulk operations.

## Tech Stack

- **Next.js 16.0**: App Router, Server Components, API Routes
- **React 19.2**: Latest React with improved hooks and concurrent features
- **Tailwind CSS v4.1**: Oxide engine for utility-first styling
- **shadcn/ui 3.0**: Pre-built accessible components
- **TypeScript 5.9**: Full type safety across frontend and backend integration

## Architecture

### Component Structure

```
web/
├── app/
│   ├── page.tsx                    # Main UI (client component)
│   ├── layout.tsx                  # App shell
│   ├── globals.css                 # Tailwind base + custom styles
│   └── api/analyze/route.ts        # Next.js API route (proxies to Express)
├── components/ui/                  # shadcn/ui components
├── lib/
│   ├── utils.ts                    # cn() utility for className merging
│   └── analyzer-singleton.ts       # NOT USED (kept for reference)
├── src → ../src/                   # Symlink to core analysis engine
└── data → ../data/                 # Symlink to sample data files
```

### Data Flow

```
1. User Action (add/remove/search)
         ↓
2. React State Update (page.tsx)
         ↓
3. POST /api/analyze → Express API (localhost:3001)
         ↓
4. ShipmentAnalyzerService (DI container)
         ↓
5. Result → Update React State + localStorage
         ↓
6. Re-render Table with New Data
```

**Important**: The Next.js API route is a **proxy only**. All business logic runs in the Express API server (`src/api-server.ts`).

## Key Features

### localStorage Caching

**Cache Key**: `shipment_analysis_cache`

**Stored Data**:
```typescript
{
  shipmentIds: string[]  // Array of analyzed shipment IDs
}
```

**Behavior**:
- Auto-save on add/remove operations
- Auto-load on component mount (`useEffect`)
- Graceful degradation if localStorage unavailable
- Cache invalidation: user must manually clear browser data

### Inline Add with Bulk Support

**Input Parsing**:
- Accepts comma, space, or newline-separated IDs
- Paste event handler replaces newlines with spaces for better UX
- Automatic duplicate detection against existing records
- Triggers on Enter key or blur event

**Example Input**:
```
TMS0001, TMS0002
TMS0003
TMS0004 TMS0005
```

### Remove Shipment

- Trash icon button in each table row
- Removes from both `result.records` and `result.errors`
- Updates localStorage cache immediately
- Does NOT make API call (client-side only)

## State Management

### React State Variables

```typescript
const [shipmentIds, setShipmentIds] = useState("")        // Initial input (unused after first load)
const [loading, setLoading] = useState(false)            // Global loading state
const [result, setResult] = useState<AnalysisResult>()   // Current analysis results
const [error, setError] = useState<string>()             // Error message
const [searchQuery, setSearchQuery] = useState("")       // Search filter
const [newShipmentId, setNewShipmentId] = useState("")   // Inline add input
const [analyzingNewId, setAnalyzingNewId] = useState(false) // Inline loading state
```

### Data Structures

**AnalysisResult**:
```typescript
interface AnalysisResult {
  success: boolean;
  records: ShipmentAnalysisRecord[];
  errors: Array<{
    containerNumber: string;
    errorType: string;
    message: string;
  }>;
  timestamp: string;
}
```

**ShipmentAnalysisRecord** (domain model from core):
```typescript
interface ShipmentAnalysisRecord {
  sglShipmentNo: string;
  customerName: string;
  shipperName: string;
  containerNumber: string;
  scac?: string;
  initialCarrierETA?: string;
  actualArrivalAt?: string;
  delayReasons?: string;
  temperature?: number;
  windSpeed?: number;
  weatherFetchStatus?: string;
  lastUpdated: string;
  error?: string;
}
```

## UI Patterns

### Airtable-Style Design

**Header**:
- Blue background (#2563eb)
- White text with logo/branding
- Navigation placeholder for future features

**Toolbar**:
- View toggle (list/grid icons)
- Search input with magnifying glass
- Export CSV button
- Summary text (record count)

**Table**:
- Row numbers (1-indexed for user-facing display)
- Monospace fonts for IDs/codes
- Right-aligned numeric fields
- Color-coded badges for status
- Hover effects on rows
- Inline add row always visible at bottom

**Loading States**:
- Skeleton rows during initial load
- Spinner in inline add row during analysis
- Disabled buttons with spinner during operations

### Color Coding

**Weather Status Badges**:
```typescript
SUCCESS → green (bg-green-100, text-green-800)
NO_DATA_AVAILABLE → blue (bg-blue-100, text-blue-800)
RETRY_EXHAUSTED → yellow (bg-yellow-100, text-yellow-800)
FATAL_ERROR → red (bg-red-100, text-red-800)
```

**Error Records**:
- Red badge with "ERROR" text
- Error message displayed in delay reasons column
- Empty fields for missing data

## API Integration

### Express API Server

**Base URL**: `http://localhost:3001`

**Endpoint**: `POST /api/shipments/analyze`

**Request**:
```typescript
{
  shipmentIds: string[]
}
```

**Response**: `AnalysisResult`

### Next.js API Route

**Location**: `app/api/analyze/route.ts`

**Purpose**: Proxy requests to Express API (avoids CORS, keeps frontend simple)

**IMPORTANT**: Do NOT add business logic here. All analysis logic belongs in the core engine.

## Development Guidelines

### Component Best Practices

**Client Components** (`"use client"`):
- All interactive components must use this directive
- Required for useState, useEffect, event handlers
- page.tsx is a client component

**Server Components** (default):
- layout.tsx can remain a server component
- Better performance for static content

### State Updates

**Always update cache after state changes**:
```typescript
// Add shipment
const updatedResult = { ...result, records: [...result.records, ...newRecords] };
setResult(updatedResult);
localStorage.setItem(CACHE_KEY, JSON.stringify({
  shipmentIds: updatedResult.records.map(r => r.sglShipmentNo)
}));
```

**Prevent duplicates**:
```typescript
const existingIds = new Set(result?.records.map(r => r.sglShipmentNo) || []);
const ids = [...new Set(parsedIds)].filter(id => !existingIds.has(id));
```

### Error Handling

**API Errors**:
- Display in Alert component (destructive variant)
- Keep previous results visible
- Show specific error messages

**localStorage Errors**:
- Try-catch around JSON.parse
- Silently ignore cache failures
- App continues to work without caching

### Styling

**Tailwind Utilities**:
- Use `cn()` helper for conditional classes
- Consistent spacing with Tailwind scale (p-6, gap-4, etc.)
- Responsive breakpoints when needed

**Custom CSS**:
- Minimal - only in globals.css
- Use Tailwind utilities whenever possible

## Testing Considerations

### Manual Testing Checklist

- [ ] Add single shipment via inline input
- [ ] Add multiple shipments (comma-separated)
- [ ] Paste CSV data with newlines
- [ ] Remove shipment
- [ ] Search/filter functionality
- [ ] Export CSV
- [ ] Refresh page (cache persistence)
- [ ] Clear browser data (cache reset)
- [ ] Handle API errors gracefully
- [ ] Duplicate detection works

### Edge Cases

- Empty input (should be ignored)
- Duplicate IDs (should be filtered)
- Invalid shipment IDs (show error in table)
- API server down (show error alert)
- localStorage disabled (app still works)

## Known Limitations

### Turbopack Decorator Parsing

**Issue**: Production build fails parsing `@injectable()` decorators from parent project

**Root Cause**: Turbopack v16.0 limitation with TypeScript decorators in symlinked code

**Workaround**: Use development mode (`npm run dev`) - works correctly

**Future**: Consider:
1. Webpack instead of Turbopack for production
2. API-only approach (no symlinks)
3. Wait for Turbopack fix in future Next.js releases

### No Server-Side Storage

**Current**: All data in browser localStorage

**Implications**:
- Data tied to single browser
- Clearing browser data loses history
- No multi-device sync
- No user accounts/authentication

**Future Enhancement**: Database + authentication

## Adding New Features

### Adding a New Column

1. Update `ShipmentAnalysisRecord` type (core)
2. Update table headers in page.tsx
3. Add new `<TableCell>` in map function
4. Update CSV export logic
5. Test with real data

### Adding Search/Filter Options

1. Add new state variable for filter
2. Update `filteredRecords` logic
3. Add UI controls in toolbar
4. Persist filter state if needed

### Adding Sorting

1. Add sort state (field + direction)
2. Implement comparator function
3. Apply to filteredRecords
4. Add sort UI (column headers with icons)

## Related Documentation

- **Core Engine**: See main `CLAUDE.md` in project root
- **API Server**: See `src/api-server.ts` implementation
- **Component Library**: [shadcn/ui docs](https://ui.shadcn.com)
- **Next.js**: [Next.js 16 docs](https://nextjs.org/docs)
