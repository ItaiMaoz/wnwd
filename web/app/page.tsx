"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ship,
  Filter,
  Download,
  Search,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
} from "lucide-react";

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

interface AnalysisResult {
  success: boolean;
  records: ShipmentAnalysisRecord[];
  errors: Array<{ containerNumber: string; errorType: string; message: string }>;
  timestamp: string;
}

export default function Home() {
  const [shipmentIds, setShipmentIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newShipmentId, setNewShipmentId] = useState("");
  const [analyzingNewId, setAnalyzingNewId] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const ids = shipmentIds
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (ids.length === 0) {
        setError("Please enter at least one shipment ID");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipmentIds: ids }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewShipment = async (id: string) => {
    if (!id.trim()) return;

    setAnalyzingNewId(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipmentIds: [id.trim()] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      // Append new records to existing result
      if (result) {
        setResult({
          ...result,
          records: [...result.records, ...data.records],
          errors: [...result.errors, ...data.errors],
          timestamp: data.timestamp,
        });
      }

      setNewShipmentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAnalyzingNewId(false);
    }
  };

  const handleExportCSV = () => {
    if (!result || result.records.length === 0) return;

    const headers = [
      "Shipment No",
      "Customer",
      "Shipper",
      "Container",
      "SCAC",
      "Initial ETA",
      "Actual Arrival",
      "Delay Reasons",
      "Temperature",
      "Wind Speed",
      "Weather Status",
      "Last Updated",
      "Error",
    ];

    const rows = result.records.map((record) => [
      record.sglShipmentNo,
      record.customerName,
      record.shipperName,
      record.containerNumber,
      record.scac || "",
      record.initialCarrierETA || "",
      record.actualArrivalAt || "",
      record.delayReasons || "",
      record.temperature?.toString() || "",
      record.windSpeed?.toString() || "",
      record.weatherFetchStatus || "",
      record.lastUpdated,
      record.error || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipment-analysis-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredRecords = result?.records.filter((record) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.sglShipmentNo.toLowerCase().includes(query) ||
      record.containerNumber.toLowerCase().includes(query) ||
      record.customerName.toLowerCase().includes(query) ||
      record.shipperName.toLowerCase().includes(query)
    );
  });

  const getWeatherStatusBadge = (status?: string, hasDelayReasons?: boolean) => {
    // If no weather status but has delay reasons, show "Non-weather delay"
    if (!status && hasDelayReasons) {
      return (
        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground border-muted-foreground/30">
          <AlertCircle className="h-3 w-3" />
          Non-weather delay
        </Badge>
      );
    }

    if (!status) return null;

    const variants: Record<string, { variant: "outline", className: string, icon: React.ReactNode }> = {
      SUCCESS: { variant: "outline", className: "border-green-300 text-green-600", icon: <CheckCircle2 className="h-3 w-3" /> },
      NO_DATA_AVAILABLE: { variant: "outline", className: "border-amber-500 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
      RETRY_EXHAUSTED: { variant: "outline", className: "border-red-500 text-red-700", icon: <XCircle className="h-3 w-3" /> },
      FATAL_ERROR: { variant: "outline", className: "border-red-500 text-red-700", icon: <XCircle className="h-3 w-3" /> },
    };

    const config = variants[status] || { variant: "outline" as const, className: "border-gray-500 text-gray-700", icon: null };

    const formatStatus = (status: string) => {
      return status
        .split("_")
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
    };

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        {config.icon}
        {formatStatus(status)}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - Airtable style */}
      <header className="bg-[#2D7FF9] text-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Ship className="h-6 w-6" />
              <span className="font-semibold text-lg">Windward Shipment Analysis</span>
            </div>
            <nav className="flex items-center gap-1">
              <Button variant="ghost" className="text-white hover:bg-white/10 rounded-none border-b-2 border-white">
                Shipments
              </Button>
            </nav>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={handleExportCSV}
            disabled={!result || result.records.length === 0}
          >
            EXPORT CSV
          </Button>
        </div>
      </header>

      {/* Toolbar - Airtable style */}
      {result && (
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Grid view
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredRecords?.length || 0} records
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6">
        {!result ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Analyze Shipments</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter shipment IDs (one per line or comma-separated) to analyze
                  </p>
                </div>
                <Textarea
                  placeholder="Enter shipment IDs...&#10;Example:&#10;SHIPMENT-001&#10;SHIPMENT-002&#10;SHIPMENT-003"
                  value={shipmentIds}
                  onChange={(e) => setShipmentIds(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || !shipmentIds.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze Shipments"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {result.errors.length} error(s) occurred during analysis
                </AlertDescription>
              </Alert>
            )}

            {/* Airtable-style Table */}
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 text-center font-medium">#</TableHead>
                      <TableHead className="font-medium min-w-[140px]">Shipment No</TableHead>
                      <TableHead className="font-medium min-w-[140px]">Customer</TableHead>
                      <TableHead className="font-medium min-w-[140px]">Shipper</TableHead>
                      <TableHead className="font-medium min-w-[140px]">Container</TableHead>
                      <TableHead className="font-medium">SCAC</TableHead>
                      <TableHead className="font-medium min-w-[110px]">Initial ETA</TableHead>
                      <TableHead className="font-medium min-w-[110px]">Actual Arrival</TableHead>
                      <TableHead className="font-medium min-w-[200px]">Delay Reasons</TableHead>
                      <TableHead className="font-medium text-right">Temp (°C)</TableHead>
                      <TableHead className="font-medium text-right">Wind (m/s)</TableHead>
                      <TableHead className="font-medium min-w-[160px]">Weather Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 12 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredRecords && filteredRecords.length > 0 ? (
                      <>
                        {filteredRecords.map((record, index) => (
                          <TableRow key={record.containerNumber} className="hover:bg-muted/50">
                            <TableCell className="text-center text-muted-foreground font-mono text-sm">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">{record.sglShipmentNo}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {record.customerName}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {record.shipperName}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.containerNumber}</TableCell>
                            <TableCell className="font-mono text-sm">{record.scac || "—"}</TableCell>
                            <TableCell className="text-sm">{formatDate(record.initialCarrierETA)}</TableCell>
                            <TableCell className="text-sm">{formatDate(record.actualArrivalAt)}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" title={record.delayReasons}>
                              {record.delayReasons || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {record.temperature?.toFixed(1) || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {record.windSpeed?.toFixed(1) || "—"}
                            </TableCell>
                            <TableCell>
                              {getWeatherStatusBadge(record.weatherFetchStatus, !!record.delayReasons)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Add new shipment row */}
                        <TableRow className="bg-muted/20 hover:bg-muted/30">
                          <TableCell className="text-center text-muted-foreground font-mono text-sm">
                            {filteredRecords.length + 1}
                          </TableCell>
                          <TableCell colSpan={11}>
                            {analyzingNewId ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Analyzing...
                              </div>
                            ) : (
                              <Input
                                placeholder="Enter shipment ID to add..."
                                value={newShipmentId}
                                onChange={(e) => setNewShipmentId(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newShipmentId.trim()) {
                                    handleAddNewShipment(newShipmentId);
                                  }
                                }}
                                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          No records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Footer - Airtable style */}
              {filteredRecords && filteredRecords.length > 0 && (
                <div className="border-t bg-muted/30 px-6 py-3 text-sm font-medium text-muted-foreground">
                  {filteredRecords.length} records • Last updated: {formatDate(result.timestamp)}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setShipmentIds("");
                  setSearchQuery("");
                }}
              >
                New Analysis
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
