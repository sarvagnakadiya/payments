export interface TokenInfo {
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  address: string;
  coingeckoId?: string;
}

export interface ChainInfo {
  id: number;
  gasyardId: number;
  name: string;
  gatewayContract: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  tokens: TokenInfo[];
}

export const SUPPORTED_CHAINS: Record<number, ChainInfo> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    gasyardId: 1,
    name: "Ethereum",
    gatewayContract: "0x6a2A5B7D0434CC5b77e304bc9D68C20Dee805152",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://eth-mainnet.g.alchemy.com/v2/"],
    blockExplorerUrls: ["https://etherscan.io"],
    tokens: [
      // {
      //   symbol: "ETH",
      //   name: "Ethereum",
      //   icon: "⟠",
      //   decimals: 18,
      //   address: "0x0000000000000000000000000000000000000000", // Native token
      //   coingeckoId: "ethereum",
      // },
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        coingeckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        icon: "💵",
        decimals: 6,
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        coingeckoId: "tether",
      },
    ],
  },

  // Base
  8453: {
    id: 8453,
    gasyardId: 2,
    name: "Base",
    gatewayContract: "0x6a2A5B7D0434CC5b77e304bc9D68C20Dee805152",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        coingeckoId: "usd-coin",
      },
    ],
  },

  // BNB Chain
  56: {
    id: 56,
    gasyardId: 3,
    name: "BNB Chain",
    gatewayContract: "0x6a2A5B7D0434CC5b77e304bc9D68C20Dee805152",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
    tokens: [
      {
        symbol: "BSC-USD",
        name: "BSC USD",
        icon: "💵",
        decimals: 18,
        address: "0x55d398326f99059fF775485246999027B3197955",
        coingeckoId: "busd",
      },
    ],
  },

  // Arbitrum
  42161: {
    id: 42161,
    gasyardId: 4,
    name: "Arbitrum",
    gatewayContract: "0x6a2A5B7D0434CC5b77e304bc9D68C20Dee805152",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
    tokens: [
      // {
      //   symbol: "ETH",
      //   name: "Ethereum",
      //   icon: "⟠",
      //   decimals: 18,
      //   address: "0x0000000000000000000000000000000000000000", // Native token
      //   coingeckoId: "ethereum",
      // },
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        coingeckoId: "usd-coin",
      },
    ],
  },

  // Hyperliquid
  42162: {
    id: 42162,
    gasyardId: 5,
    name: "Hyperliquid",
    gatewayContract: "0x6a2A5B7D0434CC5b77e304bc9D68C20Dee805152",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        coingeckoId: "usd-coin",
      },
    ],
  },

  // Movement
  30732: {
    id: 30732,
    gasyardId: 6,
    name: "Movement",
    gatewayContract: "Native Integration",
    nativeCurrency: {
      name: "MOVE",
      symbol: "MOVE",
      decimals: 18,
    },
    rpcUrls: ["https://mevm.movementnetwork.xyz"],
    blockExplorerUrls: ["https://explorer.movementnetwork.xyz"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
        coingeckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        icon: "💵",
        decimals: 6,
        address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
        coingeckoId: "tether",
      },
    ],
  },

  // Solana
  1329: {
    id: 1329,
    gasyardId: 7,
    name: "Solana",
    gatewayContract: "Native Integration",
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    rpcUrls: ["https://api.mainnet-beta.solana.com"],
    blockExplorerUrls: ["https://explorer.solana.com"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        coingeckoId: "usd-coin",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        icon: "💵",
        decimals: 6,
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        coingeckoId: "tether",
      },
    ],
  },

  // Sei
  1330: {
    id: 1330,
    gasyardId: 9,
    name: "Sei",
    gatewayContract: "0x852512A601EB3Bb0973f35b1c1d77966F0EDe676",
    nativeCurrency: {
      name: "Sei",
      symbol: "SEI",
      decimals: 6,
    },
    rpcUrls: ["https://rpc.wallet.sei.io"],
    blockExplorerUrls: ["https://sei.explorers.guru"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
        coingeckoId: "usd-coin",
      },
    ],
  },

  // Polygon
  137: {
    id: 137,
    gasyardId: 10,
    name: "Polygon",
    gatewayContract: "0x57B74794abE88E9Ce04A927a79A56504D289A818",
    nativeCurrency: {
      name: "Polygon",
      symbol: "POL",
      decimals: 18,
    },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        decimals: 6,
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        coingeckoId: "usd-coin",
      },
    ],
  },
};

// Helper functions
export function getChainInfo(chainId: number): ChainInfo | undefined {
  return SUPPORTED_CHAINS[chainId];
}

export function getChainInfoByGasyardId(
  gasyardId: number
): ChainInfo | undefined {
  return Object.values(SUPPORTED_CHAINS).find(
    (chain) => chain.gasyardId === gasyardId
  );
}

export function getTokenInfo(
  chainId: number,
  tokenSymbol: string
): TokenInfo | undefined {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return undefined;

  return chain.tokens.find((token) => token.symbol === tokenSymbol);
}

export function getAllTokens(): Array<{
  chainId: number;
  chainName: string;
  token: TokenInfo;
}> {
  const allTokens: Array<{
    chainId: number;
    chainName: string;
    token: TokenInfo;
  }> = [];

  Object.entries(SUPPORTED_CHAINS).forEach(([chainId, chain]) => {
    chain.tokens.forEach((token) => {
      allTokens.push({
        chainId: parseInt(chainId),
        chainName: chain.name,
        token,
      });
    });
  });

  return allTokens;
}

export function getSupportedChainIds(): number[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}

export function getTokensForChain(chainId: number): TokenInfo[] {
  const chain = SUPPORTED_CHAINS[chainId];
  return chain ? chain.tokens : [];
}

/**
 * Get the gateway contract address for a given chain
 * All tokens (USDC/USDT) require approval through this gateway
 */
export function getGatewayAddress(chainId: number): string {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  return chain.gatewayContract;
}
