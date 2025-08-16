import {
  getChainInfo,
  getTokenInfo,
  getAllTokens,
  getSupportedChainIds,
  getTokensForChain,
  getGatewayAddress,
  type TokenInfo,
  type ChainInfo,
} from "./tokens";
import type { PublicClient } from "viem";

/**
 * Utility functions for working with tokens and chains
 */

/**
 * Get all available tokens across all chains
 */
export function getAllAvailableTokens() {
  return getAllTokens();
}

/**
 * Get token information by chain ID and symbol
 */
export function getTokenByChainAndSymbol(
  chainId: number,
  symbol: string
): TokenInfo | undefined {
  return getTokenInfo(chainId, symbol);
}

/**
 * Get all supported chain IDs
 */
export function getAvailableChainIds(): number[] {
  return getSupportedChainIds();
}

/**
 * Get chain information by chain ID
 */
export function getChainById(chainId: number): ChainInfo | undefined {
  return getChainInfo(chainId);
}

/**
 * Get all tokens for a specific chain
 */
export function getTokensByChain(chainId: number): TokenInfo[] {
  return getTokensForChain(chainId);
}

/**
 * Check if a token is supported on a specific chain
 */
export function isTokenSupported(chainId: number, symbol: string): boolean {
  return getTokenInfo(chainId, symbol) !== undefined;
}

/**
 * Get token address by chain ID and symbol
 */
export function getTokenAddress(
  chainId: number,
  symbol: string
): string | undefined {
  const token = getTokenInfo(chainId, symbol);
  return token?.address;
}

/**
 * Get token decimals by chain ID and symbol
 */
export function getTokenDecimals(
  chainId: number,
  symbol: string
): number | undefined {
  const token = getTokenInfo(chainId, symbol);
  return token?.decimals;
}

/**
 * Format token amount based on decimals
 */
export function formatTokenAmount(
  amount: string,
  chainId: number,
  symbol: string
): string {
  const decimals = getTokenDecimals(chainId, symbol);
  if (decimals === undefined) return amount;

  const numAmount = parseFloat(amount);
  return (numAmount / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Parse token amount to wei/smallest unit
 */
export function parseTokenAmount(
  amount: string,
  chainId: number,
  symbol: string
): string {
  const decimals = getTokenDecimals(chainId, symbol);
  if (decimals === undefined) return amount;

  const numAmount = parseFloat(amount);
  return (numAmount * Math.pow(10, decimals)).toString();
}

/**
 * Get all chains that support a specific token
 */
export function getChainsForToken(symbol: string): number[] {
  const supportedChains: number[] = [];

  getSupportedChainIds().forEach((chainId) => {
    if (isTokenSupported(chainId, symbol)) {
      supportedChains.push(chainId);
    }
  });

  return supportedChains;
}

/**
 * Get a list of all unique token symbols across all chains
 */
export function getAllTokenSymbols(): string[] {
  const symbols = new Set<string>();

  getAllTokens().forEach(({ token }) => {
    symbols.add(token.symbol);
  });

  return Array.from(symbols);
}

/**
 * Get token allowance for a spender
 */
export async function getTokenAllowance(
  publicClient: PublicClient,
  chainId: number,
  tokenSymbol: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  const tokenInfo = getTokenInfo(chainId, tokenSymbol);
  if (!tokenInfo) {
    throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
  }

  const allowance = await publicClient.readContract({
    address: tokenInfo.address as `0x${string}`,
    abi: [
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
  });

  return allowance as bigint;
}

/**
 * Get token balance for a user address
 */
export async function getTokenBalance(
  publicClient: PublicClient,
  chainId: number,
  tokenSymbol: string,
  userAddress: string
): Promise<bigint> {
  const tokenInfo = getTokenInfo(chainId, tokenSymbol);
  if (!tokenInfo) {
    throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
  }

  const balance = await publicClient.readContract({
    address: tokenInfo.address as `0x${string}`,
    abi: [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf", 
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [userAddress as `0x${string}`],
  });

  return balance as bigint;
}


/**
 * Check if approval is needed for a token transaction
 */
export async function checkTokenApprovalNeeded(
  publicClient: PublicClient,
  chainId: number,
  tokenSymbol: string,
  ownerAddress: string,
  amount: string
): Promise<{
  needsApproval: boolean;
  currentAllowance: bigint;
  requiredAmount: bigint;
}> {
  const tokenInfo = getTokenInfo(chainId, tokenSymbol);
  if (!tokenInfo) {
    throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
  }

  const gatewayAddress = getGatewayAddress(chainId);

  // If native integration, no approval needed
  if (gatewayAddress === "Native Integration") {
    return { needsApproval: false, currentAllowance: 0n, requiredAmount: 0n };
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { needsApproval: false, currentAllowance: 0n, requiredAmount: 0n };
  }

  const requiredAmount = BigInt(
    Math.floor(parsedAmount * Math.pow(10, tokenInfo.decimals))
  );

  const currentAllowance = await getTokenAllowance(
    publicClient,
    chainId,
    tokenSymbol,
    ownerAddress,
    gatewayAddress
  );

  return {
    needsApproval: currentAllowance < requiredAmount,
    currentAllowance,
    requiredAmount,
  };
}
