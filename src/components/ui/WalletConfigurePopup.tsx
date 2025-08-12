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
  fid?: number;
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
  fid,
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
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [evmAddressesList, setEvmAddressesList] = useState<string[]>([]);
  const [solanaAddressesList, setSolanaAddressesList] = useState<string[]>([]);
  const [preferredAddress, setPreferredAddress] = useState<string>("");

  // Get all supported chains and their tokens
  const supportedChainIds = getSupportedChainIds();
  const selectedChainInfo = getChainInfo(selectedChainId);
  const selectedChainTokens = getTokensForChain(selectedChainId);
  const selectedTokenInfo = selectedChainTokens.find(
    (t) => t.symbol === selectedTokenSymbol
  );
  const isSolanaSelected = selectedChainId === 1329;

  // Load user preferences by fid when component mounts or fid changes
  const loadUserPreferences = React.useCallback(async () => {
    if (!fid) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/preferences?fid=${fid}`);
      if (response.ok) {
        const data = await response.json();
        const prefs = data.user;
        if (prefs) {
          if (prefs.preferredChainId)
            setSelectedChainId(prefs.preferredChainId);
          if (prefs.preferredTokenSymbol)
            setSelectedTokenSymbol(prefs.preferredTokenSymbol);
          if (prefs.preferredAddress)
            setPreferredAddress(prefs.preferredAddress);
        }
      }
    } catch (error) {
      console.error("Error loading user preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fid]);

  useEffect(() => {
    if (fid) {
      loadUserPreferences();
    }
  }, [fid, loadUserPreferences]);

  // Load wallet addresses from Neynar via API
  useEffect(() => {
    const loadWallets = async () => {
      if (!fid) return;
      setWalletsLoading(true);
      try {
        const res = await fetch(`/api/users/wallets?fid=${fid}`);
        if (res.ok) {
          const json = await res.json();
          setEvmAddressesList(json.evmAddresses || []);
          setSolanaAddressesList(json.solanaAddresses || []);
        }
      } catch (err) {
        console.error("Error loading wallets:", err);
      } finally {
        setWalletsLoading(false);
      }
    };
    loadWallets();
  }, [fid]);

  // Enforce address type based on selected chain (EVM vs Solana)
  useEffect(() => {
    // If Solana chain selected, enforce Solana address
    if (isSolanaSelected) {
      if (solanaAddressesList.length === 0) {
        if (preferredAddress) {
          setPreferredAddress("");
          setHasChanges(true);
        }
        return;
      }
      if (!solanaAddressesList.includes(preferredAddress)) {
        setPreferredAddress(solanaAddressesList[0]);
        setHasChanges(true);
      }
      return;
    }

    // Else EVM chain selected, enforce EVM address (case-insensitive)
    if (evmAddressesList.length === 0) {
      if (preferredAddress) {
        setPreferredAddress("");
        setHasChanges(true);
      }
      return;
    }
    const lower = preferredAddress?.toLowerCase?.() ?? "";
    const hasMatch = evmAddressesList.some(
      (a) => (a?.toLowerCase?.() ?? a) === lower
    );
    if (!hasMatch) {
      setPreferredAddress(evmAddressesList[0]);
      setHasChanges(true);
    }
  }, [isSolanaSelected, evmAddressesList, solanaAddressesList]);

  // Helper functions to convert enum values back to chain ID and token symbol
  // removed enum converters; preferences GET returns chainId and token symbol directly

  // Simple chain list (no icons/colors)
  const chainList = supportedChainIds
    .map((chainId) => ({
      id: chainId,
      name: getChainInfo(chainId)?.name || "Unknown",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
          preferredAddress: preferredAddress || "",
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
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
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
                        {chainList.map((chain) => (
                          <button
                            key={chain.id}
                            onClick={() => handleChainSelect(chain.id)}
                            className="w-full p-2 text-left hover:bg-gray-50 flex items-center"
                          >
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

          {/* Receiving Address Section - show all, disable mismatched type */}
          <div className="p-4">
            <h3 className="font-bold text-black mb-3">Receiving address</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-black mb-2">EVM</div>
                <div className="space-y-2">
                  {walletsLoading && (
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  )}
                  {evmAddressesList.length === 0 && !walletsLoading && (
                    <div className="text-sm text-gray-500">
                      No EVM addresses
                    </div>
                  )}
                  {evmAddressesList.map((addr) => {
                    const isDisabled = isSolanaSelected;
                    const isSelected =
                      preferredAddress?.toLowerCase() === addr.toLowerCase();
                    return (
                      <button
                        key={addr}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setPreferredAddress(addr);
                          setHasChanges(true);
                        }}
                        className={`w-full flex items-center justify-between p-2 bg-white border rounded-lg transition-colors ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-xs font-bold">
                              E
                            </span>
                          </div>
                          <span className="text-black text-sm">
                            {truncateAddress(addr)}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckIcon
                            size={16}
                            weight="bold"
                            className="text-blue-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-black mb-2">
                  Solana
                </div>
                <div className="space-y-2">
                  {walletsLoading && (
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  )}
                  {solanaAddressesList.length === 0 && !walletsLoading && (
                    <div className="text-sm text-gray-500">
                      No Solana addresses
                    </div>
                  )}
                  {solanaAddressesList.map((addr) => {
                    const isDisabled = !isSolanaSelected;
                    const isSelected = preferredAddress === addr;
                    return (
                      <button
                        key={addr}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setPreferredAddress(addr);
                          setHasChanges(true);
                        }}
                        className={`w-full flex items-center justify-between p-2 bg-white border rounded-lg transition-colors ${
                          isSelected
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:bg-gray-50"
                        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-xs font-bold">
                              S
                            </span>
                          </div>
                          <span className="text-black text-sm">
                            {truncateAddress(addr)}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckIcon
                            size={16}
                            weight="bold"
                            className="text-purple-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Other Wallets Section removed in favor of explicit address lists */}

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
