import { NextRequest, NextResponse } from "next/server";
import { GasyardSDK } from "gasyard-sdk";
import {
  getChainInfoByGasyardId,
  SUPPORTED_CHAINS,
  getTokenInfo,
} from "~/lib/tokens";
import { prisma } from "~/lib/prisma";
import { z } from "zod";

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

// Validation schema for simplified bridge request
const simplifiedBridgeRequestSchema = z.object({
  receiverFid: z.string().min(1),
  amount: z.string().min(1),
  sourceChainId: z.number().min(1),
  sourceTokenSymbol: z.string().min(1),
  sourceAddress: z.string().optional(),
});

// Legacy validation schema for bridge request (keeping for backward compatibility)
const bridgeRequestSchema = z.object({
  sourceNetwork: z.number().min(1),
  destinationNetwork: z.number().min(1),
  tokenOutAddress: z.string().min(1),
  destinationAddress: z.string().min(1),
  tokenInAddress: z.string().min(1),
  sourceTokenAmount: z.string().min(1),
  sourceAddress: z.string().optional(),
  minOutput: z.string().optional(),
  expiryTimestamp: z.number().optional(),
  userFid: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log("=== Bridge API Request Started ===");
    const body = await request.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    // Try to parse as simplified request first
    const simplifiedParseResult = simplifiedBridgeRequestSchema.safeParse(body);
    if (simplifiedParseResult.success) {
      console.log("Parsed as simplified bridge request");
      return await handleSimplifiedBridgeRequest(simplifiedParseResult.data);
    }

    // If simplified parsing fails, try legacy format
    const legacyParseResult = bridgeRequestSchema.safeParse(body);
    if (legacyParseResult.success) {
      console.log("Parsed as legacy bridge request");
      return await handleLegacyBridgeRequest(legacyParseResult.data);
    }

    // If both parsing attempts fail, return validation error
    console.log("Request validation failed");
    console.log("Simplified parse errors:", simplifiedParseResult.error.errors);
    console.log("Legacy parse errors:", legacyParseResult.error.errors);

    return NextResponse.json(
      {
        error: "Invalid request data",
        details: [
          ...simplifiedParseResult.error.errors,
          ...legacyParseResult.error.errors,
        ],
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("=== Bridge API Error ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace available"
    );

    // Handle SDK errors
    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Bridge transaction failed",
          message: error.message,
          details: error.stack,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

async function handleSimplifiedBridgeRequest(data: {
  receiverFid: string;
  amount: string;
  sourceChainId: number;
  sourceTokenSymbol: string;
  sourceAddress?: string;
}) {
  console.log("=== Simplified Bridge Request Processing ===");
  const {
    receiverFid,
    amount,
    sourceChainId,
    sourceTokenSymbol,
    sourceAddress,
  } = data;

  console.log("Input data:", {
    receiverFid,
    amount,
    sourceChainId,
    sourceTokenSymbol,
    sourceAddress,
  });

  // Get receiver's preferences
  console.log("Fetching receiver preferences for FID:", receiverFid);
  const receiver = await prisma.user.findUnique({
    where: { fid: receiverFid },
  });

  if (!receiver) {
    console.log("Receiver not found for FID:", receiverFid);
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  console.log("Receiver found:", {
    fid: receiver.fid,
    username: receiver.username,
    preferredChain: receiver.preferredChain,
    preferredToken: receiver.preferredToken,
    preferredAddress: receiver.preferredAddress,
  });

  // Debug: Log the full address length and content
  console.log("Address debugging:", {
    preferredAddressLength: receiver.preferredAddress?.length || 0,
    preferredAddressFull: receiver.preferredAddress,
    preferredAddressType: typeof receiver.preferredAddress,
  });

  if (!receiver.preferredAddress) {
    console.log("Receiver has no preferred address set");
    return NextResponse.json(
      { error: "Receiver has no preferred address set" },
      { status: 400 }
    );
  }

  // Convert receiver's preferences to chain ID and token symbol
  const destinationChainId = CHAIN_ENUM_TO_ID[receiver.preferredChain];
  const destinationTokenSymbol = TOKEN_ENUM_TO_SYMBOL[receiver.preferredToken];

  // Validate address format and length
  const destinationAddress = receiver.preferredAddress.trim();
  console.log("Address validation:", {
    originalAddress: receiver.preferredAddress,
    trimmedAddress: destinationAddress,
    addressLength: destinationAddress.length,
    isEthAddress:
      destinationAddress.startsWith("0x") && destinationAddress.length === 42,
    isSolanaAddress:
      !destinationAddress.startsWith("0x") && destinationAddress.length === 44,
  });

  // Check if address looks truncated
  if (destinationAddress.includes("...")) {
    console.error("Address appears to be truncated:", destinationAddress);
    return NextResponse.json(
      { error: "Destination address appears to be truncated" },
      { status: 400 }
    );
  }

  // Validate address format matches destination chain
  const isSolanaDestination = destinationChainId === 1329; // Solana chain ID
  const isEthAddress =
    destinationAddress.startsWith("0x") && destinationAddress.length === 42;
  const isSolanaAddress =
    !destinationAddress.startsWith("0x") && destinationAddress.length === 44;

  if (isSolanaDestination && !isSolanaAddress) {
    console.error("Invalid address format for Solana destination:", {
      destinationAddress,
      expectedFormat: "Solana address (44 chars, no 0x prefix)",
      actualFormat: isEthAddress ? "Ethereum address" : "Unknown format",
    });
    return NextResponse.json(
      {
        error:
          "Destination address must be a valid Solana address for Solana destination",
      },
      { status: 400 }
    );
  }

  if (!isSolanaDestination && !isEthAddress) {
    console.error("Invalid address format for EVM destination:", {
      destinationAddress,
      expectedFormat: "Ethereum address (42 chars with 0x prefix)",
      actualFormat: isSolanaAddress ? "Solana address" : "Unknown format",
    });
    return NextResponse.json(
      {
        error:
          "Destination address must be a valid Ethereum address for EVM destination",
      },
      { status: 400 }
    );
  }

  console.log("Converted preferences:", {
    preferredChain: receiver.preferredChain,
    destinationChainId,
    preferredToken: receiver.preferredToken,
    destinationTokenSymbol,
  });

  // Get chain and token information
  const sourceChain = SUPPORTED_CHAINS[sourceChainId];
  const destinationChain = SUPPORTED_CHAINS[destinationChainId];

  console.log("Chain information:", {
    sourceChain: sourceChain
      ? {
          id: sourceChain.id,
          name: sourceChain.name,
          gasyardId: sourceChain.gasyardId,
        }
      : null,
    destinationChain: destinationChain
      ? {
          id: destinationChain.id,
          name: destinationChain.name,
          gasyardId: destinationChain.gasyardId,
        }
      : null,
  });

  if (!sourceChain) {
    console.log("Source network not supported:", sourceChainId);
    return NextResponse.json(
      { error: `Source network ${sourceChainId} is not supported` },
      { status: 400 }
    );
  }

  if (!destinationChain) {
    console.log("Destination network not supported:", destinationChainId);
    return NextResponse.json(
      { error: `Destination network ${destinationChainId} is not supported` },
      { status: 400 }
    );
  }

  const sourceToken = getTokenInfo(sourceChainId, sourceTokenSymbol);
  const destinationToken = getTokenInfo(
    destinationChainId,
    destinationTokenSymbol
  );

  console.log("Token information:", {
    sourceToken: sourceToken
      ? {
          symbol: sourceToken.symbol,
          name: sourceToken.name,
          address: sourceToken.address,
          decimals: sourceToken.decimals,
        }
      : null,
    destinationToken: destinationToken
      ? {
          symbol: destinationToken.symbol,
          name: destinationToken.name,
          address: destinationToken.address,
          decimals: destinationToken.decimals,
        }
      : null,
  });

  if (!sourceToken) {
    console.log("Source token not found:", {
      sourceChainId,
      sourceTokenSymbol,
    });
    return NextResponse.json(
      {
        error: `Token ${sourceTokenSymbol} not found on source network ${sourceChainId}`,
      },
      { status: 400 }
    );
  }

  if (!destinationToken) {
    console.log("Destination token not found:", {
      destinationChainId,
      destinationTokenSymbol,
    });
    return NextResponse.json(
      {
        error: `Token ${destinationTokenSymbol} not found on destination network ${destinationChainId}`,
      },
      { status: 400 }
    );
  }

  // Convert amount to smallest unit (wei/smallest unit)
  const sourceTokenAmount = (
    parseFloat(amount) * Math.pow(10, sourceToken.decimals)
  ).toString();

  console.log("Amount conversion:", {
    originalAmount: amount,
    sourceTokenDecimals: sourceToken.decimals,
    convertedAmount: sourceTokenAmount,
  });

  // Initialize Gasyard SDK
  const apiKey = process.env.GASYARD_API_KEY;
  console.log("Environment check:", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : "N/A",
  });

  if (!apiKey) {
    console.log("Gasyard API key not configured");
    return NextResponse.json(
      { error: "Gasyard API key is not configured" },
      { status: 500 }
    );
  }

  console.log(
    "Initializing Gasyard SDK with API key:",
    apiKey.substring(0, 8) + "..."
  );

  const sdk = new GasyardSDK({
    apiKey,
  });

  // Prepare bridge parameters
  const bridgeParams = {
    sourceNetwork: sourceChain.gasyardId,
    destinationNetwork: destinationChain.gasyardId,
    tokenOutAddress: destinationToken.address,
    destinationAddress: destinationAddress, // Use validated address
    tokenInAddress: sourceToken.address,
    sourceTokenAmount,
    sourceAddress,
  };

  console.log("Bridge parameters:", JSON.stringify(bridgeParams, null, 2));

  // Additional validation and debugging
  console.log("Parameter validation:", {
    sourceNetworkValid:
      typeof bridgeParams.sourceNetwork === "number" &&
      bridgeParams.sourceNetwork > 0,
    destinationNetworkValid:
      typeof bridgeParams.destinationNetwork === "number" &&
      bridgeParams.destinationNetwork > 0,
    tokenOutAddressValid:
      typeof bridgeParams.tokenOutAddress === "string" &&
      bridgeParams.tokenOutAddress.length > 0,
    destinationAddressValid:
      typeof bridgeParams.destinationAddress === "string" &&
      bridgeParams.destinationAddress.length > 0,
    tokenInAddressValid:
      typeof bridgeParams.tokenInAddress === "string" &&
      bridgeParams.tokenInAddress.length > 0,
    sourceTokenAmountValid:
      typeof bridgeParams.sourceTokenAmount === "string" &&
      bridgeParams.sourceTokenAmount.length > 0,
    sourceAddressValid: bridgeParams.sourceAddress
      ? typeof bridgeParams.sourceAddress === "string" &&
        bridgeParams.sourceAddress.length > 0
      : true,
  });

  try {
    // Execute bridge transaction
    console.log("Calling Gasyard SDK bridge method...");
    const bridgeTx = await sdk.bridge(bridgeParams);
    console.log(
      "Bridge transaction successful:",
      JSON.stringify(bridgeTx, null, 2)
    );

    // Return the bridge transaction data
    return NextResponse.json({
      success: true,
      bridgeTransaction: bridgeTx,
      sourceChain: {
        id: sourceChain.id,
        name: sourceChain.name,
        gasyardId: sourceChain.gasyardId,
      },
      destinationChain: {
        id: destinationChain.id,
        name: destinationChain.name,
        gasyardId: destinationChain.gasyardId,
      },
      sourceToken: {
        symbol: sourceToken.symbol,
        name: sourceToken.name,
        address: sourceToken.address,
        decimals: sourceToken.decimals,
      },
      destinationToken: {
        symbol: destinationToken.symbol,
        name: destinationToken.name,
        address: destinationToken.address,
        decimals: destinationToken.decimals,
      },
      amount: sourceTokenAmount,
      receiver: {
        fid: receiver.fid,
        username: receiver.username,
        preferredAddress: receiver.preferredAddress,
      },
    });
  } catch (bridgeError) {
    console.error("=== Bridge SDK Error ===");
    console.error(
      "Bridge error type:",
      bridgeError instanceof Error
        ? bridgeError.constructor.name
        : typeof bridgeError
    );
    console.error(
      "Bridge error message:",
      bridgeError instanceof Error ? bridgeError.message : String(bridgeError)
    );

    // Handle Axios-like errors with response data
    const axiosError = bridgeError as any;
    console.error("Bridge error response:", axiosError.response?.data);
    console.error("Bridge error status:", axiosError.response?.status);
    console.error("Bridge error config:", {
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      params: axiosError.config?.params,
    });

    // Return detailed error information
    return NextResponse.json(
      {
        error: "Bridge transaction failed",
        message:
          bridgeError instanceof Error
            ? bridgeError.message
            : String(bridgeError),
        details: {
          response: axiosError.response?.data,
          status: axiosError.response?.status,
          requestParams: bridgeParams,
        },
      },
      { status: 500 }
    );
  }
}

async function handleLegacyBridgeRequest(data: {
  sourceNetwork: number;
  destinationNetwork: number;
  tokenOutAddress: string;
  destinationAddress: string;
  tokenInAddress: string;
  sourceTokenAmount: string;
  sourceAddress?: string;
  minOutput?: string;
  expiryTimestamp?: number;
  userFid?: string;
}) {
  console.log("=== Legacy Bridge Request Processing ===");
  const {
    sourceNetwork,
    destinationNetwork,
    tokenOutAddress,
    destinationAddress,
    tokenInAddress,
    sourceTokenAmount,
    sourceAddress,
    minOutput,
    expiryTimestamp,
    userFid,
  } = data;

  console.log("Legacy bridge input data:", {
    sourceNetwork,
    destinationNetwork,
    tokenOutAddress,
    destinationAddress,
    tokenInAddress,
    sourceTokenAmount,
    sourceAddress,
    minOutput,
    expiryTimestamp,
    userFid,
  });

  // Validate networks exist
  const sourceChain = getChainInfoByGasyardId(sourceNetwork);
  const destinationChain = getChainInfoByGasyardId(destinationNetwork);

  console.log("Legacy chain validation:", {
    sourceNetwork,
    sourceChain: sourceChain
      ? {
          id: sourceChain.id,
          name: sourceChain.name,
          gasyardId: sourceChain.gasyardId,
        }
      : null,
    destinationNetwork,
    destinationChain: destinationChain
      ? {
          id: destinationChain.id,
          name: destinationChain.name,
          gasyardId: destinationChain.gasyardId,
        }
      : null,
  });

  if (!sourceChain) {
    console.log("Legacy: Source network not supported:", sourceNetwork);
    return NextResponse.json(
      { error: `Source network ${sourceNetwork} is not supported` },
      { status: 400 }
    );
  }

  if (!destinationChain) {
    console.log(
      "Legacy: Destination network not supported:",
      destinationNetwork
    );
    return NextResponse.json(
      { error: `Destination network ${destinationNetwork} is not supported` },
      { status: 400 }
    );
  }

  // Validate tokens exist on respective chains
  const sourceToken = sourceChain.tokens.find(
    (token) => token.address.toLowerCase() === tokenInAddress.toLowerCase()
  );

  const destinationToken = destinationChain.tokens.find(
    (token) => token.address.toLowerCase() === tokenOutAddress.toLowerCase()
  );

  if (!sourceToken) {
    return NextResponse.json(
      {
        error: `Token ${tokenInAddress} not found on source network ${sourceNetwork}`,
      },
      { status: 400 }
    );
  }

  if (!destinationToken) {
    return NextResponse.json(
      {
        error: `Token ${tokenOutAddress} not found on destination network ${destinationNetwork}`,
      },
      { status: 400 }
    );
  }

  // Initialize Gasyard SDK
  const apiKey = process.env.GASYARD_API_KEY;
  console.log("Legacy environment check:", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : "N/A",
  });

  if (!apiKey) {
    console.log("Legacy: Gasyard API key not configured");
    return NextResponse.json(
      { error: "Gasyard API key is not configured" },
      { status: 500 }
    );
  }

  console.log(
    "Legacy: Initializing Gasyard SDK with API key:",
    apiKey.substring(0, 8) + "..."
  );

  const sdk = new GasyardSDK({
    apiKey,
  });

  // Prepare legacy bridge parameters
  const legacyBridgeParams = {
    sourceNetwork: sourceChain.gasyardId,
    destinationNetwork: destinationChain.gasyardId,
    tokenOutAddress,
    destinationAddress,
    tokenInAddress,
    sourceTokenAmount,
    sourceAddress,
    minOutput,
    expiryTimestamp,
  };

  console.log(
    "Legacy bridge parameters:",
    JSON.stringify(legacyBridgeParams, null, 2)
  );

  // Additional validation and debugging for legacy request
  console.log("Legacy parameter validation:", {
    sourceNetworkValid:
      typeof legacyBridgeParams.sourceNetwork === "number" &&
      legacyBridgeParams.sourceNetwork > 0,
    destinationNetworkValid:
      typeof legacyBridgeParams.destinationNetwork === "number" &&
      legacyBridgeParams.destinationNetwork > 0,
    tokenOutAddressValid:
      typeof legacyBridgeParams.tokenOutAddress === "string" &&
      legacyBridgeParams.tokenOutAddress.length > 0,
    destinationAddressValid:
      typeof legacyBridgeParams.destinationAddress === "string" &&
      legacyBridgeParams.destinationAddress.length > 0,
    tokenInAddressValid:
      typeof legacyBridgeParams.tokenInAddress === "string" &&
      legacyBridgeParams.tokenInAddress.length > 0,
    sourceTokenAmountValid:
      typeof legacyBridgeParams.sourceTokenAmount === "string" &&
      legacyBridgeParams.sourceTokenAmount.length > 0,
    sourceAddressValid: legacyBridgeParams.sourceAddress
      ? typeof legacyBridgeParams.sourceAddress === "string" &&
        legacyBridgeParams.sourceAddress.length > 0
      : true,
    minOutputValid: legacyBridgeParams.minOutput
      ? typeof legacyBridgeParams.minOutput === "string" &&
        legacyBridgeParams.minOutput.length > 0
      : true,
    expiryTimestampValid: legacyBridgeParams.expiryTimestamp
      ? typeof legacyBridgeParams.expiryTimestamp === "number" &&
        legacyBridgeParams.expiryTimestamp > 0
      : true,
  });

  try {
    // Execute bridge transaction
    console.log("Legacy: Calling Gasyard SDK bridge method...");
    const bridgeTx = await sdk.bridge(legacyBridgeParams);
    console.log(
      "Legacy: Bridge transaction successful:",
      JSON.stringify(bridgeTx, null, 2)
    );

    // Return the bridge transaction data
    return NextResponse.json({
      success: true,
      bridgeTransaction: bridgeTx,
      sourceChain: {
        id: sourceChain.id,
        name: sourceChain.name,
        gasyardId: sourceChain.gasyardId,
      },
      destinationChain: {
        id: destinationChain.id,
        name: destinationChain.name,
        gasyardId: destinationChain.gasyardId,
      },
      sourceToken: {
        symbol: sourceToken.symbol,
        name: sourceToken.name,
        address: sourceToken.address,
        decimals: sourceToken.decimals,
      },
      destinationToken: {
        symbol: destinationToken.symbol,
        name: destinationToken.name,
        address: destinationToken.address,
        decimals: destinationToken.decimals,
      },
      amount: sourceTokenAmount,
    });
  } catch (legacyBridgeError) {
    console.error("=== Legacy Bridge SDK Error ===");
    console.error(
      "Legacy bridge error type:",
      legacyBridgeError instanceof Error
        ? legacyBridgeError.constructor.name
        : typeof legacyBridgeError
    );
    console.error(
      "Legacy bridge error message:",
      legacyBridgeError instanceof Error
        ? legacyBridgeError.message
        : String(legacyBridgeError)
    );

    // Handle Axios-like errors with response data
    const axiosError = legacyBridgeError as any;
    console.error("Legacy bridge error response:", axiosError.response?.data);
    console.error("Legacy bridge error status:", axiosError.response?.status);
    console.error("Legacy bridge error config:", {
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      params: axiosError.config?.params,
    });

    // Return detailed error information
    return NextResponse.json(
      {
        error: "Legacy bridge transaction failed",
        message:
          legacyBridgeError instanceof Error
            ? legacyBridgeError.message
            : String(legacyBridgeError),
        details: {
          response: axiosError.response?.data,
          status: axiosError.response?.status,
          requestParams: legacyBridgeParams,
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint to get available bridge routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceNetwork = searchParams.get("sourceNetwork");
    const destinationNetwork = searchParams.get("destinationNetwork");

    if (sourceNetwork && destinationNetwork) {
      const sourceChain = getChainInfoByGasyardId(parseInt(sourceNetwork));
      const destinationChain = getChainInfoByGasyardId(
        parseInt(destinationNetwork)
      );

      if (!sourceChain || !destinationChain) {
        return NextResponse.json(
          { error: "Invalid network parameters" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        sourceChain: {
          id: sourceChain.id,
          name: sourceChain.name,
          gasyardId: sourceChain.gasyardId,
          tokens: sourceChain.tokens.map((token) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
            icon: token.icon,
          })),
        },
        destinationChain: {
          id: destinationChain.id,
          name: destinationChain.name,
          gasyardId: destinationChain.gasyardId,
          tokens: destinationChain.tokens.map((token) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
            icon: token.icon,
          })),
        },
      });
    }

    // Return all supported networks and tokens
    return NextResponse.json({
      supportedNetworks: Object.values(SUPPORTED_CHAINS).map((chain) => ({
        id: chain.id,
        name: chain.name,
        gasyardId: chain.gasyardId,
      })),
    });
  } catch (error) {
    console.error("Failed to get bridge data:", error);
    return NextResponse.json(
      { error: "Failed to get bridge data" },
      { status: 500 }
    );
  }
}
