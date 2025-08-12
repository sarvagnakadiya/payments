# Token and Chain Configuration

This directory contains the token and chain configuration system for the payments mini app.

## Files

- `tokens.ts` - Main configuration file with supported chains and tokens
- `tokenUtils.ts` - Utility functions for working with tokens and chains
- `constants.ts` - General app constants (updated to reference tokens.ts)

## Usage

### Basic Token Information

```typescript
import { getTokenInfo, getChainInfo, getTokensForChain } from './lib/tokens';

// Get token information for USDC on Base
const usdcToken = getTokenInfo(8453, 'USDC');
console.log(usdcToken);
// {
//   symbol: "USDC",
//   name: "USD Coin", 
//   icon: "💵",
//   decimals: 6,
//   address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
//   coingeckoId: "usd-coin"
// }

// Get all tokens for Base chain
const baseTokens = getTokensForChain(8453);

// Get chain information
const baseChain = getChainInfo(8453);
```

### Utility Functions

```typescript
import { 
  getTokenAddress, 
  getTokenDecimals, 
  formatTokenAmount,
  parseTokenAmount,
  isTokenSupported 
} from './lib/tokenUtils';

// Get token address
const address = getTokenAddress(8453, 'USDC'); // "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

// Get token decimals
const decimals = getTokenDecimals(8453, 'USDC'); // 6

// Format amount from smallest unit to human readable
const formatted = formatTokenAmount('1000000', 8453, 'USDC'); // "1.000000"

// Parse amount from human readable to smallest unit
const parsed = parseTokenAmount('1.5', 8453, 'USDC'); // "1500000"

// Check if token is supported
const supported = isTokenSupported(8453, 'USDC'); // true
```

### Supported Chains

Currently supported chains:

- **Ethereum Mainnet** (Chain ID: 1)
- **Base** (Chain ID: 8453)
- **Optimism** (Chain ID: 10)
- **Degen Chain** (Chain ID: 666666666)
- **Unichain** (Chain ID: 111111111)
- **Celo** (Chain ID: 42220)

### Supported Tokens

Each chain supports different tokens:

- **ETH/WETH** - Native tokens on Ethereum, Base, Optimism
- **USDC** - USD Coin (6 decimals)
- **USDT** - Tether USD (6 decimals)
- **DEGEN** - Degen token on Degen Chain
- **UNI** - Uni token on Unichain
- **CELO** - Celo token on Celo

### Adding New Chains

To add a new chain, update the `SUPPORTED_CHAINS` object in `tokens.ts`:

```typescript
export const SUPPORTED_CHAINS: Record<number, ChainInfo> = {
  // ... existing chains
  
  // New Chain
  12345: {
    id: 12345,
    name: "New Chain",
    nativeCurrency: {
      name: "New Token",
      symbol: "NEW",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.newchain.com"],
    blockExplorerUrls: ["https://explorer.newchain.com"],
    tokens: [
      {
        symbol: "NEW",
        name: "New Token",
        icon: "🆕",
        decimals: 18,
        address: "0x0000000000000000000000000000000000000000",
        coingeckoId: "new-token",
      },
      // Add more tokens...
    ],
  },
};
```

### Adding New Tokens

To add a new token to an existing chain, add it to the `tokens` array:

```typescript
tokens: [
  // ... existing tokens
  {
    symbol: "NEWTOKEN",
    name: "New Token",
    icon: "🆕",
    decimals: 18,
    address: "0x1234567890123456789012345678901234567890",
    coingeckoId: "new-token",
  },
],
```

### Example Component

See `src/components/examples/TokenExample.tsx` for a complete example of how to use the token configuration system in a React component.

## Data Structure

### TokenInfo Interface

```typescript
interface TokenInfo {
  symbol: string;        // Token symbol (e.g., "USDC")
  name: string;          // Full token name (e.g., "USD Coin")
  icon: string;          // Emoji icon (e.g., "💵")
  decimals: number;      // Token decimals (e.g., 6 for USDC)
  address: string;       // Contract address
  coingeckoId?: string;  // CoinGecko ID for price data
}
```

### ChainInfo Interface

```typescript
interface ChainInfo {
  id: number;                    // Chain ID
  name: string;                  // Chain name
  nativeCurrency: {
    name: string;                // Native currency name
    symbol: string;              // Native currency symbol
    decimals: number;            // Native currency decimals
  };
  rpcUrls: string[];             // RPC endpoints
  blockExplorerUrls: string[];   // Block explorer URLs
  tokens: TokenInfo[];           // Supported tokens
}
``` 