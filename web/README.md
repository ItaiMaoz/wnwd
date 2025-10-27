# Shipment Analysis Web UI

Modern web interface for the Windward Shipment Analysis service, built with the latest technologies.

## Tech Stack

- **Next.js 16.0** - Latest stable release with App Router
- **React 19.2** - Latest React with new features
- **Tailwind CSS v4.1** - Modern utility-first CSS framework with Oxide engine
- **shadcn/ui 3.0** - Component library with Tailwind v4 support
- **TypeScript 5.9** - Type-safe development

## Features

### UI/UX
- **Airtable-style Interface**: Clean, professional design inspired by Airtable
- **Responsive Design**: Works seamlessly on all screen sizes
- **Color-coded Status Badges**: Visual indicators for weather conditions and errors
- **Real-time Updates**: Instant analysis results as shipments are added

### Data Management
- **Local Storage Caching**: Automatically saves and restores your shipment analysis between sessions
- **Auto-load on Mount**: Cached shipments are loaded and analyzed on page load
- **Inline Add Functionality**: Add shipments directly in the data table
- **Bulk Operations**: Paste multiple shipment IDs at once (comma, space, or newline separated)
- **Remove Shipments**: Clean up individual entries with trash icon
- **Duplicate Detection**: Prevents adding the same shipment twice

### Analysis & Export
- **Real-time Analysis**: Submit shipment IDs and get instant enriched results
- **Data Table**: View detailed shipment information with weather data
- **Search & Filter**: Quickly find specific shipments
- **CSV Export**: Download analysis results for external use
- **Error Handling**: Clear visual indicators and messages for failed lookups

## Getting Started

### Prerequisites

The web UI requires the Express API server to be running:

```bash
# From project root, start the API server (port 3001)
npm run api
```

### Development

```bash
# Install dependencies (first time only)
npm install

# Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

**Note**: Production build with Turbopack currently has issues parsing TypeScript decorators from the parent project. Use development mode for now:

```bash
npm run dev
```

## Usage Guide

### Adding Shipments

**Method 1: Inline Add (Single or Multiple)**
1. Scroll to the bottom of the table
2. Enter shipment ID(s) in the input field
3. Multiple IDs can be separated by commas, spaces, or newlines
4. Press Enter or click away to trigger analysis
5. New shipments appear in the table immediately

**Method 2: Paste Multiple IDs**
1. Copy shipment IDs from any source (CSV, spreadsheet, etc.)
2. Paste into the inline add field
3. The system automatically parses comma, space, or newline-separated values
4. All valid, non-duplicate IDs are analyzed and added

### Managing Shipments

- **Search**: Use the search box in the toolbar to filter by any field
- **Remove**: Click the trash icon next to any shipment to remove it
- **Export**: Click "Export CSV" to download current results
- **Persistence**: All shipments are automatically saved to browser storage

### Data Persistence

The web UI uses **localStorage** to cache your shipment analysis:
- Shipments are automatically saved as you add them
- Cached data is loaded and analyzed when you revisit the page
- No server-side storage - all data stays in your browser
- Clear browser data to reset the cache

## Architecture

### Component Structure

- `/app/page.tsx` - Main UI component with state management, caching, and table logic
- `/app/layout.tsx` - App shell and global styles
- `/app/api/analyze/route.ts` - Next.js API route (proxies to Express API)
- `/components/ui/` - shadcn/ui reusable components
- `/lib/utils.ts` - Utility functions
- `/src/` - Symlink to parent project's source code
- `/data/` - Symlink to parent project's data files

### Data Flow

```
User Input → page.tsx → /api/analyze (Next.js Route)
                              ↓
                    Express API (localhost:3001)
                              ↓
                    ShipmentAnalyzerService (DI)
                              ↓
                    Analysis Result → localStorage
                              ↓
                    UI Update + Table Render
```

### State Management

The UI uses React hooks for state management:
- `shipmentIds` - Input field for new IDs
- `loading` - Loading state for analysis
- `result` - Current analysis results
- `searchQuery` - Filter text for search
- `newShipmentId` - Inline add input field

**localStorage Integration:**
- Cache key: `shipment_analysis_cache`
- Stored data: `{ shipmentIds: string[] }`
- Auto-save on add/remove operations
- Auto-load on component mount

## API Usage

The web interface communicates with the Express API server:

```typescript
POST /api/analyze
{
  "shipmentIds": ["SHIPMENT-001", "SHIPMENT-002"]
}
```

Returns enriched shipment data with tracking and weather information.

The Next.js API route (`/app/api/analyze/route.ts`) proxies requests to the Express server at `http://localhost:3001`.

## Known Issues

### Turbopack Decorator Parsing

**Issue**: Production build fails due to Turbopack's inability to parse TypeScript decorators (`@inject()`) from the parent project. This is a known limitation of Turbopack v16.0.

**Workaround**: Use `npm run dev` for development, which works correctly with Turbopack in dev mode.

### Browser Compatibility

**localStorage**: The caching feature requires browser localStorage support. Most modern browsers support this, but private/incognito mode may have limitations.

**Solution**: The app gracefully handles localStorage failures and continues to work without caching.

## Design

The UI is inspired by Airtable's clean, professional interface:

### Visual Elements
- **Blue Header**: Navigation bar with branding
- **Toolbar**: View options, filters, search, and export controls
- **Data Table**: Clean grid with:
  - Row numbers for easy reference
  - Color-coded status badges
  - Monospace fonts for IDs and codes
  - Right-aligned numeric fields
  - Inline add row at bottom
  - Trash icon for removal
- **Footer**: Record count and last updated timestamp
- **Loading States**: Skeleton rows and spinners for better UX

### Color Coding
- **Weather Status**:
  - 🟢 Green: Success
  - 🔵 Blue: No data available
  - 🟡 Yellow: Retry exhausted
  - 🔴 Red: Fatal error
- **Error Indicators**: Red badges and alert boxes for failed operations
