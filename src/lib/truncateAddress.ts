export const truncateAddress = (address: string) => {
  if (!address) return "";
  // For Solana addresses (44 chars) and ETH addresses (42 chars including 0x)
  // Take first 4 chars and last 3 chars for Solana
  // Take first 6 chars (including 0x) and last 4 chars for ETH
  if (address.startsWith("0x")) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
};
