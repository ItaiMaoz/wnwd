import "reflect-metadata";
import * as path from "path";
import { container } from "tsyringe";
import { loadConfig } from "@/src/config/app.config";
import { setupDI } from "@/src/config/di.setup";
import type { IShipmentAnalyzer } from "@/src/services/shipment-analyzer.interface";

let analyzerInstance: IShipmentAnalyzer | null = null;

export function getAnalyzer(): IShipmentAnalyzer {
  if (analyzerInstance) {
    return analyzerInstance;
  }

  // Setup DI container using the exact same approach as index.ts
  const config = loadConfig();
  setupDI(config);

  analyzerInstance = container.resolve<IShipmentAnalyzer>("IShipmentAnalyzer");
  return analyzerInstance;
}
