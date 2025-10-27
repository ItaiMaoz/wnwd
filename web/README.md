# Shipment Analysis Web UI

Modern web interface for the Windward Shipment Analysis service, built with the latest technologies.

## Tech Stack

- **Next.js 16.0** - Latest stable release with App Router
- **React 19.2** - Latest React with new features
- **Tailwind CSS v4.1** - Modern utility-first CSS framework with Oxide engine
- **shadcn/ui 3.0** - Component library with Tailwind v4 support
- **TypeScript 5.9** - Type-safe development

## Features

- **Airtable-style UI**: Clean, professional interface inspired by Airtable
- **Real-time Analysis**: Submit shipment IDs and get instant analysis
- **Data Table**: View detailed shipment information with weather data
- **Search & Filter**: Quickly find specific shipments
- **CSV Export**: Download analysis results
- **Responsive Design**: Works on all screen sizes

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

**Note**: Production build with Turbopack currently has issues parsing TypeScript decorators from the parent project. Use development mode for now:

```bash
npm run dev
```

## Architecture

- `/app/page.tsx` - Main UI with input form and results table
- `/app/api/analyze/route.ts` - API endpoint that uses the shipment analyzer service
- `/components/ui/` - shadcn/ui components
- `/src/` - Symlink to parent project's source code
- `/data/` - Symlink to parent project's data files

## API Usage

The web interface uses the same service layer as the CLI:

```typescript
POST /api/analyze
{
  "shipmentIds": ["SHIPMENT-001", "SHIPMENT-002"]
}
```

Returns enriched shipment data with tracking and weather information.

## Known Issues

- **Turbopack Build**: The production build fails due to Turbopack's inability to parse TypeScript decorators (`@inject()`) from the parent project. This is a known limitation of Turbopack v16.0.
- **Workaround**: Use `npm run dev` for development, which works correctly with Turbopack in dev mode.

## Design

The UI is inspired by Airtable's clean, professional interface:
- Blue header with navigation
- Toolbar with view options, filters, and search
- Data table with colored badges and structured columns
- Summary footer with record count and timestamp
