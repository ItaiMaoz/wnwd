import "reflect-metadata";
import * as path from "path";
import { container } from "tsyringe";
import { loadConfig } from "./config/app.config";
import { setupDI } from "./config/di.setup";
import { ICsvProcessor } from "./services/csv-processor.interface";
import { IShipmentAnalyzer } from "./services/shipment-analyzer.interface";
import { ReportGenerationResult, ShipmentAnalysisRecord } from "./types/result.types";

const INPUT_CSV_PATH = path.join(__dirname, "../data/input-shipments.csv");
const OUTPUT_CSV_PATH = path.join(__dirname, "../data/output-shipments.csv");

async function main() {
  try {
    const config = loadConfig();
    setupDI(config);

    const csvProcessor = container.resolve<ICsvProcessor>("ICsvProcessor");
    const shipmentAnalyzer = container.resolve<IShipmentAnalyzer>(
      "IShipmentAnalyzer",
    );

    // Read shipment IDs from CSV
    const shipmentIds = await csvProcessor.readShipmentIds(INPUT_CSV_PATH);
    console.log(`Processing ${shipmentIds.length} shipments from CSV...`);

    // Run analysis
    const analysisResult = await shipmentAnalyzer.analyzeShipments(shipmentIds);

    // Add timestamp and map errors to records
    const timestamp = new Date().toISOString();
    const enrichedRecords = enrichRecordsWithErrors(
      analysisResult.records,
      analysisResult.errors,
      timestamp
    );

    // Write enriched CSV
    await csvProcessor.writeEnrichedCsv(OUTPUT_CSV_PATH, enrichedRecords);
    console.log(`Enriched CSV written to: ${OUTPUT_CSV_PATH}`);

    // Output JSON to console for debugging
    const result: ReportGenerationResult = {
      success: true,
      records: enrichedRecords,
      errors: analysisResult.errors,
    };

    console.log("\nAnalysis Result (JSON):");
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
  // Create error map by shipmentId or containerNumber
  const errorMap = new Map<string, string>();
  for (const error of errors) {
    const existingError = errorMap.get(error.containerNumber);
    const errorMsg = `${error.errorType}: ${error.message}`;
    errorMap.set(
      error.containerNumber,
      existingError ? `${existingError}; ${errorMsg}` : errorMsg
    );
  }

  // Enrich records with timestamp and errors
  return records.map((record) => ({
    ...record,
    lastUpdated: timestamp,
    error: errorMap.get(record.sglShipmentNo) || errorMap.get(record.containerNumber) || undefined,
  }));
}

main();
