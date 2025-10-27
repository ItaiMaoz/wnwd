import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface AnalyzeRequestBody {
  shipmentIds: string[];
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequestBody = await request.json();

    if (!body.shipmentIds || !Array.isArray(body.shipmentIds) || body.shipmentIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. shipmentIds array is required." },
        { status: 400 }
      );
    }

    // Call the Express API server
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shipmentIds: body.shipmentIds }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed");
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        records: [],
        errors: [],
      },
      { status: 500 }
    );
  }
}
