import "reflect-metadata";
import { container } from "tsyringe";
import { loadConfig } from "./config/app.config";
import { setupDI } from "./config/di.setup";
import { IShipmentAnalyzer } from "./services/shipment-analyzer.interface";
import { ReportGenerationResult, ShipmentAnalysisRecord } from "./types/result.types";

async function main() {
  try {
    // Get shipment IDs from command line arguments
    const shipmentIds = process.argv.slice(2);

    if (shipmentIds.length === 0) {
      console.error("Error: No shipment IDs provided");
      process.exit(1);
    }

    const config = loadConfig();
    setupDI(config);

    const shipmentAnalyzer = container.resolve<IShipmentAnalyzer>("IShipmentAnalyzer");

    // Run analysis
    const analysisResult = await shipmentAnalyzer.analyzeShipments(shipmentIds);

    // Add timestamp and map errors to records
    const timestamp = new Date().toISOString();
    const enrichedRecords = enrichRecordsWithErrors(
      analysisResult.records,
      analysisResult.errors,
      timestamp
    );

    // Output JSON to console
    const result: ReportGenerationResult = {
      success: true,
      records: enrichedRecords,
      errors: analysisResult.errors,
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

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

main();
