"use client";

import React, { useState, useEffect } from "react";
import {
  CaretCircleDownIcon,
  CaretCircleUpIcon,
  CheckIcon,
  GearIcon,
} from "@phosphor-icons/react";
import { truncateAddress } from "../../lib/truncateAddress";
import {
  getSupportedChainIds,
  getChainInfo,
  getTokensForChain,
  type TokenInfo,
} from "../../lib/tokens";

interface WalletConfigurePopupProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  profileImage?: string;
  evmAddress?: string;
  solanaAddress?: string;
  userId?: string;
  onPreferencesUpdated?: () => void;
}

export default function WalletConfigurePopup({
  isOpen,
  onClose,
  username = "qimchi",
  profileImage,
  evmAddress,
  solanaAddress,
  userId,
  onPreferencesUpdated,
}: WalletConfigurePopupProps) {
  const [selectedChainId, setSelectedChainId] = useState<number>(8453); // Default to Base
  const [selectedTokenSymbol, setSelectedTokenSymbol] =
    useState<string>("USDC");
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedOtherWallet, setSelectedOtherWallet] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get all supported chains and their tokens
  const supportedChainIds = getSupportedChainIds();
  const selectedChainInfo = getChainInfo(selectedChainId);
  const selectedChainTokens = getTokensForChain(selectedChainId);
  const selectedTokenInfo = selectedChainTokens.find(
    (t) => t.symbol === selectedTokenSymbol
  );

  // Load user preferences when component mounts or userId changes
  const loadUserPreferences = React.useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.user) {
          // Convert enum values back to chain ID and token symbol
          const chainId = getChainIdFromEnum(userData.user.preferredChain);
          const tokenSymbol = getTokenSymbolFromEnum(
            userData.user.preferredToken
          );

          if (chainId) setSelectedChainId(chainId);
          if (tokenSymbol) setSelectedTokenSymbol(tokenSymbol);
        }
      }
    } catch (error) {
      console.error("Error loading user preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadUserPreferences();
    }
  }, [userId, loadUserPreferences]);

  // Helper functions to convert enum values back to chain ID and token symbol
  const getChainIdFromEnum = (chainEnum: string): number | null => {
    const enumToChainId: Record<string, number> = {
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
    return enumToChainId[chainEnum] || null;
  };

  const getTokenSymbolFromEnum = (tokenEnum: string): string | null => {
    const enumToTokenSymbol: Record<string, string> = {
      ETH: "ETH",
      USDC: "USDC",
      BSC_USD: "BSC-USD",
      USDT: "USDT",
      BNB: "BNB",
      MOVE: "MOVE",
      POL: "POL",
      SEI: "SEI",
    };
    return enumToTokenSymbol[tokenEnum] || null;
  };

  // Chain options with colors and icons
  const chainOptions = supportedChainIds.map((chainId) => {
    const chain = getChainInfo(chainId);
    const chainColors = {
      1: "bg-gradient-to-r from-purple-500 via-blue-500 to-green-500", // Ethereum
      8453: "bg-gradient-to-r from-blue-500 to-purple-500", // Base
      10: "bg-gradient-to-r from-red-500 to-orange-500", // Optimism
      666666666: "bg-gradient-to-r from-purple-500 to-pink-500", // Degen
      111111111: "bg-gradient-to-r from-pink-500 to-purple-500", // Unichain
      42220: "bg-gradient-to-r from-green-500 to-yellow-500", // Celo
    };

    const chainIcons = {
      1: "⟠", // Ethereum
      8453: "🔵", // Base
      10: "🔴", // Optimism
      666666666: "🎲", // Degen
      111111111: "🦄", // Unichain
      42220: "🌱", // Celo
    };

    return {
      id: chainId,
      name: chain?.name || "Unknown",
      icon: chainIcons[chainId as keyof typeof chainIcons] || "🔗",
      color: chainColors[chainId as keyof typeof chainColors] || "bg-gray-500",
    };
  });

  if (!isOpen) return null;

  const handleChainSelect = (chainId: number) => {
    setSelectedChainId(chainId);
    // Reset token to first available token for the selected chain
    const tokens = getTokensForChain(chainId);
    if (tokens.length > 0) {
      setSelectedTokenSymbol(tokens[0].symbol);
    }
    setShowChainDropdown(false);
    setHasChanges(true);
  };

  const handleTokenSelect = (tokenSymbol: string) => {
    setSelectedTokenSymbol(tokenSymbol);
    setShowTokenDropdown(false);
    setHasChanges(true);
  };

  const handleOtherWalletSelect = (walletType: string) => {
    setSelectedOtherWallet(
      selectedOtherWallet === walletType ? null : walletType
    );
  };

  const handleSaveSettings = async () => {
    if (!userId) {
      console.error("No user ID provided");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/users/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          preferredChainId: selectedChainId,
          preferredTokenSymbol: selectedTokenSymbol,
          preferredAddress: evmAddress, // Use EVM address as preferred address
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preferences");
      }

      const result = await response.json();
      console.log("Preferences updated:", result);

      setHasChanges(false);
      onPreferencesUpdated?.();

      // Show success feedback (you can add a toast notification here)
    } catch (error) {
      console.error("Error updating preferences:", error);
      // Show error feedback (you can add a toast notification here)
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-xl transition-transform duration-300 max-h-[90vh]"
        style={{
          animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl z-10 flex items-center justify-between p-3 pb-2">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center mr-2">
              <GearIcon size={20} weight="fill" className="text-white" />
            </div>
            <span className="text-xl font-semibold text-black">Configure</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* User Profile Section */}
          <div className="p-4">
            <div className="flex flex-col items-center">
              {/* Profile Image */}
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-16 h-16 rounded-full mb-3"
                />
              ) : (
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              )}
              {/* Username */}
              <span className="text-gray-500 font-medium">@{username}</span>
            </div>
          </div>

          {/* Preferred Settlement Section */}
          <div className="p-4">
            <h3 className="font-bold text-black mb-3">Preferred Settlement</h3>

            {/* Chain and Token Selection */}
            {isLoading ? (
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Chain Selector */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowChainDropdown(!showChainDropdown)}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-6 h-6 ${
                          chainOptions.find((c) => c.id === selectedChainId)
                            ?.color
                        } rounded-full flex items-center justify-center mr-3`}
                      >
                        <span className="text-white text-xs font-bold">
                          {
                            chainOptions.find((c) => c.id === selectedChainId)
                              ?.icon
                          }
                        </span>
                      </div>
                      <span className="font-medium text-black">
                        {selectedChainInfo?.name}
                      </span>
                    </div>
                    {showChainDropdown ? (
                      <CaretCircleUpIcon
                        size={18}
                        weight="fill"
                        className="text-gray-400"
                      />
                    ) : (
                      <CaretCircleDownIcon
                        size={18}
                        weight="fill"
                        className="text-gray-400"
                      />
                    )}
                  </button>

                  {/* Chain Dropdown */}
                  {showChainDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10">
                      <div className="max-h-48 overflow-y-auto">
                        {chainOptions.map((chain) => (
                          <button
                            key={chain.id}
                            onClick={() => handleChainSelect(chain.id)}
                            className="w-full p-2 text-left hover:bg-gray-50 flex items-center"
                          >
                            <div
                              className={`w-6 h-6 ${chain.color} rounded-full flex items-center justify-center mr-3`}
                            >
                              <span className="text-white text-xs font-bold">
                                {chain.icon}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-black">
                                {chain.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {getTokensForChain(chain.id).length} tokens
                                available
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Token Selector */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white text-xs font-bold">
                          {selectedTokenInfo?.icon || "$"}
                        </span>
                      </div>
                      <span className="font-medium text-black">
                        {selectedTokenInfo?.symbol || "Select Token"}
                      </span>
                    </div>
                    {showTokenDropdown ? (
                      <CaretCircleUpIcon
                        size={18}
                        weight="fill"
                        className="text-gray-400"
                      />
                    ) : (
                      <CaretCircleDownIcon
                        size={18}
                        weight="fill"
                        className="text-gray-400"
                      />
                    )}
                  </button>

                  {/* Token Dropdown */}
                  {showTokenDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10">
                      <div className="max-h-48 overflow-y-auto">
                        {selectedChainTokens.map((token) => (
                          <button
                            key={token.symbol}
                            onClick={() => handleTokenSelect(token.symbol)}
                            className="w-full p-2 text-left hover:bg-gray-50 flex items-center"
                          >
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                              <span className="text-white text-xs font-bold">
                                {token.icon}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-black">
                                {token.symbol}
                              </div>
                              <div className="text-xs text-gray-500">
                                {token.name}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Primary Wallet Section */}
          <div className="p-4">
            <h3 className="font-bold text-black mb-3">Primary wallet</h3>
            <div className="space-y-2">
              {/* EVM Wallet */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-xs font-bold">E</span>
                  </div>
                  <div>
                    <span className="font-medium text-black">EVM</span>
                    <span className="text-gray-500 ml-2">
                      {evmAddress
                        ? truncateAddress(evmAddress)
                        : "Not connected"}
                    </span>
                  </div>
                </div>
                <CheckIcon size={16} weight="bold" className="text-green-500" />
              </div>

              {/* Solana Wallet */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-xs font-bold">S</span>
                  </div>
                  <div>
                    <span className="font-medium text-black">Solana</span>
                    <span className="text-gray-500 ml-2">
                      {solanaAddress
                        ? truncateAddress(solanaAddress)
                        : "Not connected"}
                    </span>
                  </div>
                </div>
                <CheckIcon size={16} weight="bold" className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Other Wallets Section */}
          <div className="p-4">
            <h3 className="font-bold text-black mb-3">Other Wallets</h3>
            <div className="space-y-2">
              {/* EVM Wallet Option */}
              <button
                onClick={() => handleOtherWalletSelect("evm")}
                className="w-full flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-xs font-bold">E</span>
                  </div>
                  <div>
                    <span className="font-medium text-black">EVM</span>
                    <span className="text-gray-500 ml-2">
                      {evmAddress
                        ? truncateAddress(evmAddress)
                        : "Not connected"}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 border-2 rounded-full ${
                    selectedOtherWallet === "evm"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedOtherWallet === "evm" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </button>

              {/* Solana Wallet Option */}
              <button
                onClick={() => handleOtherWalletSelect("solana")}
                className="w-full flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-xs font-bold">S</span>
                  </div>
                  <div>
                    <span className="font-medium text-black">Solana</span>
                    <span className="text-gray-500 ml-2">
                      {solanaAddress
                        ? truncateAddress(solanaAddress)
                        : "Not connected"}
                    </span>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 border-2 rounded-full ${
                    selectedOtherWallet === "solana"
                      ? "border-purple-500 bg-purple-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedOtherWallet === "solana" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Add Wallets Button */}
          <div className="p-4 pb-20"></div>
        </div>
      </div>

      {/* Floating Save Settings Button */}
      {hasChanges && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full bg-black text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
