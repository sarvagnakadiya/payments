import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

// Mapping from chain IDs to Chain enum values
const CHAIN_ID_TO_ENUM: Record<number, string> = {
  1: "ETHEREUM",
  8453: "BASE",
  56: "BNB",
  42161: "ARBITRUM",
  42162: "HYPERLIQUID",
  30732: "MOVEMENT",
  1329: "SOLANA",
  1330: "SEI",
  137: "POLYGON",
};

// Mapping from Chain enum values to chain IDs
const CHAIN_ENUM_TO_ID: Record<string, number> = {
  ETHEREUM: 1,
  BASE: 8453,
  BNB: 56,
  ARBITRUM: 42161,
  HYPERLIQUID: 42162,
  MOVEMENT: 30732,
  SOLANA: 1329,
  SEI: 1330,
  POLYGON: 137,
};

// Mapping from token symbols to Token enum values
const TOKEN_SYMBOL_TO_ENUM: Record<string, string> = {
  ETH: "ETH",
  USDC: "USDC",
  "BSC-USD": "BSC_USD",
  USDT: "USDT",
  BNB: "BNB",
  MOVE: "MOVE",
  POL: "POL",
  SEI: "SEI",
  SOL: "SOL",
};

// Mapping from Token enum values to token symbols
const TOKEN_ENUM_TO_SYMBOL: Record<string, string> = {
  ETH: "ETH",
  USDC: "USDC",
  BSC_USD: "BSC-USD",
  USDT: "USDT",
  BNB: "BNB",
  MOVE: "MOVE",
  POL: "POL",
  SEI: "SEI",
  SOL: "SOL",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");

    if (!fid) {
      return NextResponse.json(
        { error: "FID parameter is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { fid },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Convert enum values back to chain ID and token symbol
    const preferredChainId = CHAIN_ENUM_TO_ID[user.preferredChain];
    const preferredTokenSymbol = TOKEN_ENUM_TO_SYMBOL[user.preferredToken];

    return NextResponse.json({
      user: {
        id: user.id,
        fid: user.fid,
        username: user.username,
        preferredChainId,
        preferredTokenSymbol,
        preferredAddress: user.preferredAddress,
      },
    });
  } catch (error) {
    console.error("Failed to fetch user preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch user preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, preferredChainId, preferredTokenSymbol, preferredAddress } =
      body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate chain ID
    if (!preferredChainId || !CHAIN_ID_TO_ENUM[preferredChainId]) {
      return NextResponse.json({ error: "Invalid chain ID" }, { status: 400 });
    }

    // Validate token symbol
    if (!preferredTokenSymbol || !TOKEN_SYMBOL_TO_ENUM[preferredTokenSymbol]) {
      return NextResponse.json(
        { error: "Invalid token symbol" },
        { status: 400 }
      );
    }

    // Convert to enum values
    const chainEnum = CHAIN_ID_TO_ENUM[preferredChainId] as any;
    const tokenEnum = TOKEN_SYMBOL_TO_ENUM[preferredTokenSymbol] as any;

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        preferredChain: chainEnum,
        preferredToken: tokenEnum,
        preferredAddress: preferredAddress || "",
      },
    });

    return NextResponse.json({
      message: "User preferences updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update user preferences:", error);
    return NextResponse.json(
      { error: "Failed to update user preferences" },
      { status: 500 }
    );
  }
}
