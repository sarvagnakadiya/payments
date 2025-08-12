# Bridge API Documentation

This API endpoint provides functionality to bridge tokens between different blockchain networks using the Gasyard SDK.

## Endpoints

### POST `/api/getSwapData`

Initiates a bridge transaction between two networks. Supports both simplified and legacy request formats.

#### Simplified Request Format (Recommended)

This format automatically fetches the receiver's preferred chain, token, and address from their user preferences.

```typescript
{
  receiverFid: string,           // Receiver's Farcaster FID
  amount: string,                // Amount to bridge (in human-readable format, e.g., "1.5")
  sourceChainId: number,         // Source network ID (e.g., 1 for Ethereum)
  sourceTokenSymbol: string,     // Source token symbol (e.g., "USDC")
  sourceAddress?: string,        // Optional: Source address
}
```

#### Example Simplified Request

```javascript
const response = await fetch('/api/getSwapData', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    receiverFid: "12345",              // Receiver's FID
    amount: "1.5",                     // 1.5 USDC
    sourceChainId: 1,                  // Ethereum
    sourceTokenSymbol: "USDC",         // USDC token
    sourceAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
  })
});

const data = await response.json();
```

#### Legacy Request Format

For backward compatibility, the API also supports the original detailed format.

```typescript
{
  sourceNetwork: number,           // Source network ID (e.g., 1 for Ethereum)
  destinationNetwork: number,      // Destination network ID (e.g., 8453 for Base)
  tokenOutAddress: string,         // Token address on destination network
  destinationAddress: string,      // Recipient address on destination network
  tokenInAddress: string,          // Token address on source network
  sourceTokenAmount: string,       // Amount to bridge (in wei/smallest unit)
  sourceAddress?: string,          // Optional: Source address
  minOutput?: string,              // Optional: Minimum output amount
  expiryTimestamp?: number,        // Optional: Transaction expiry timestamp
  userFid?: string                 // Optional: User FID for tracking
}
```

#### Example Legacy Request

```javascript
const response = await fetch('/api/getSwapData', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sourceNetwork: 1,                    // Ethereum
    destinationNetwork: 8453,            // Base
    tokenOutAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    destinationAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    tokenInAddress: '0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C', // USDC on Ethereum
    sourceTokenAmount: '1000000',        // 1 USDC (6 decimals)
    sourceAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    userFid: '12345'
  })
});

const data = await response.json();
```

#### Response

```typescript
{
  success: boolean,
  bridgeTransaction: {
    data: string,    // Transaction data to sign
    to: string       // Contract address to send transaction to
  },
  sourceChain: {
    id: number,
    name: string,
    gasyardId: number
  },
  destinationChain: {
    id: number,
    name: string,
    gasyardId: number
  },
  sourceToken: {
    symbol: string,
    name: string,
    address: string,
    decimals: number
  },
  destinationToken: {
    symbol: string,
    name: string,
    address: string,
    decimals: number
  },
  amount: string,
  receiver?: {                    // Only included in simplified format
    fid: string,
    username: string,
    preferredAddress: string
  }
}
```

### GET `/api/getSwapData`

Retrieves available bridge routes and supported networks.

#### Query Parameters

- `sourceNetwork` (optional): Source network ID
- `destinationNetwork` (optional): Destination network ID

#### Example Requests

```javascript
// Get all supported networks
const response = await fetch('/api/getSwapData');
const data = await response.json();

// Get specific route information
const response = await fetch('/api/getSwapData?sourceNetwork=1&destinationNetwork=8453');
const data = await response.json();
```

#### Response

```typescript
{
  sourceChain: {
    id: number,
    name: string,
    gasyardId: number,
    tokens: Array<{
      symbol: string,
      name: string,
      address: string,
      decimals: number,
      icon: string
    }>
  },
  destinationChain: {
    id: number,
    name: string,
    gasyardId: number,
    tokens: Array<{
      symbol: string,
      name: string,
      address: string,
      decimals: number,
      icon: string
    }>
  }
}
```

## Supported Networks

| Network ID | Name | Gasyard ID |
|------------|------|------------|
| 1 | Ethereum | 1 |
| 8453 | Base | 2 |
| 56 | BNB Chain | 3 |
| 42161 | Arbitrum | 4 |
| 42162 | Hyperliquid | 5 |
| 30732 | Movement | 6 |
| 1329 | Solana | 7 |
| 1330 | Sei | 9 |
| 137 | Polygon | 10 |

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found (receiver not found)
- `500`: Internal Server Error

Error responses include:

```typescript
{
  error: string,
  details?: Array<object>,  // For validation errors
  message?: string          // For SDK errors
}
```

## Environment Variables

Make sure to set the following environment variable:

- `GASYARD_API_KEY`: Your Gasyard API key

## Usage Example

```javascript
// Complete bridge transaction flow using simplified format
async function bridgeTokens() {
  try {
    // 1. Get bridge transaction data
    const bridgeResponse = await fetch('/api/getSwapData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverFid: "12345",
        amount: "1.5",
        sourceChainId: 1,
        sourceTokenSymbol: "USDC",
        sourceAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
      })
    });

    const bridgeData = await bridgeResponse.json();
    
    if (!bridgeData.success) {
      throw new Error(bridgeData.error);
    }

    // 2. Sign and send the transaction using your wallet
    const { data, to } = bridgeData.bridgeTransaction;
    
    // Use your preferred wallet library (ethers.js, wagmi, etc.)
    // const tx = await wallet.sendTransaction({
    //   to,
    //   data,
    //   // Add gas parameters as needed
    // });

    console.log('Bridge transaction initiated:', bridgeData);
    
  } catch (error) {
    console.error('Bridge failed:', error);
  }
}
```

## User Preferences

The simplified format automatically uses the receiver's preferred settings:

1. **Preferred Chain**: The chain where the receiver wants to receive tokens
2. **Preferred Token**: The token the receiver wants to receive
3. **Preferred Address**: The address where the receiver wants to receive tokens

These preferences are stored in the database and can be updated via the `/api/users/preferences` endpoint.

## Frontend Integration

The PayPopup component demonstrates how to integrate with this API:

1. User selects a recipient (Farcaster user)
2. User enters amount and selects source token
3. Component calls the simplified API with receiver FID
4. API automatically determines destination based on receiver's preferences
5. Component executes the returned transaction data using wagmi 