import "reflect-metadata";
import express from "express";
import cors from "cors";
import { container } from "tsyringe";
import { loadConfig } from "./config/app.config";
import { setupDI } from "./config/di.setup";
import { IShipmentAnalyzer } from "./services/shipment-analyzer.interface";
import { ShipmentAnalysisRecord } from "./types/result.types";

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DI container (same as index.ts)
const config = loadConfig();
setupDI(config);

// POST /api/analyze - Analyze shipments
app.post("/api/analyze", async (req, res) => {
  try {
    const { shipmentIds } = req.body;

    if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid request. shipmentIds array is required.",
      });
    }

    // Get analyzer from DI container (same as index.ts)
    const shipmentAnalyzer = container.resolve<IShipmentAnalyzer>("IShipmentAnalyzer");

    // Analyze only the requested shipment IDs
    const analysisResult = await shipmentAnalyzer.analyzeShipments(shipmentIds);

    // Enrich records with timestamp and errors
    const timestamp = new Date().toISOString();
    const enrichedRecords = enrichRecordsWithErrors(
      analysisResult.records,
      analysisResult.errors,
      timestamp
    );

    res.json({
      success: true,
      records: enrichedRecords,
      errors: analysisResult.errors,
      timestamp,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      records: [],
      errors: [],
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function enrichRecordsWithErrors(
  records: ShipmentAnalysisRecord[],
  errors: Array<{ containerNumber: string; errorType: string; message: string }>,
  timestamp: string
): ShipmentAnalysisRecord[] {
  const errorMap = new Map<string, string>();
  for (const error of errors) {
    const existingError = errorMap.get(error.containerNumber);
    const errorMsg = `${error.errorType}: ${error.message}`;
    errorMap.set(
      error.containerNumber,
      existingError ? `${existingError}; ${errorMsg}` : errorMsg
    );
  }

  return records.map((record) => ({
    ...record,
    lastUpdated: timestamp,
    error: errorMap.get(record.sglShipmentNo) || errorMap.get(record.containerNumber) || undefined,
  }));
}

app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
