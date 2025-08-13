import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/getBalances?userAddress=0x...
 * Proxies balance request to Gasyard API and returns the JSON response.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Query parameter "userAddress" is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GASYARD_API_KEY || "trial";

    const url = `https://api.gasyard.fi/api/sdk/balance?userAddress=${encodeURIComponent(
      userAddress
    )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
      // Prevent caching to ensure fresh balances
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Upstream error: ${response.statusText}`, details: text },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in getBalances route:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
