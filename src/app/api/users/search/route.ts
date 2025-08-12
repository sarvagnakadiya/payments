import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/search/?q=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          api_key: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the response to match the expected format
    const users =
      data.result?.users?.map((user: any) => ({
        name: user.display_name || user.username,
        username: user.username,
        address:
          user.verified_addresses?.primary?.eth_address || user.custody_address,
        avatar: user.pfp_url,
        fid: user.fid,
      })) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
