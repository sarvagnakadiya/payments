"use client";

import { useState } from "react";
import {
  CaretCircleDownIcon,
  CaretCircleUpIcon,
  CheckIcon,
  GearIcon,
} from "@phosphor-icons/react";
import { truncateAddress } from "../../lib/truncateAddress";

interface WalletConfigurePopupProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  profileImage?: string;
  evmAddress?: string;
  solanaAddress?: string;
}

export default function WalletConfigurePopup({
  isOpen,
  onClose,
  username = "qimchi",
  profileImage,
  evmAddress = "0x524...5FB2",
  solanaAddress = "4zd...VUx",
}: WalletConfigurePopupProps) {
  const [selectedChain, setSelectedChain] = useState<"solana" | "eth">(
    "solana"
  );
  const [selectedToken, setSelectedToken] = useState<"usdc" | "usdt">("usdc");
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedOtherWallet, setSelectedOtherWallet] = useState<string | null>(
    null
  );

  // Chain options
  const chainOptions = [
    { id: "solana", name: "Solana", icon: "S", color: "bg-purple-500" },
    {
      id: "eth",
      name: "Ethereum",
      icon: "E",
      color: "bg-gradient-to-r from-purple-500 via-blue-500 to-green-500",
    },
  ];

  // Token options
  const tokenOptions = [
    {
      id: "usdc",
      symbol: "USDC",
      name: "USD Coin",
      icon: "$",
      color: "bg-blue-500",
    },
    {
      id: "usdt",
      symbol: "USDT",
      name: "Tether",
      icon: "₮",
      color: "bg-green-500",
    },
  ];

  if (!isOpen) return null;

  const handleChainSelect = (chain: "solana" | "eth") => {
    setSelectedChain(chain);
    setShowChainDropdown(false);
  };

  const handleTokenSelect = (token: "usdc" | "usdt") => {
    setSelectedToken(token);
    setShowTokenDropdown(false);
  };

  const handleOtherWalletSelect = (walletType: string) => {
    setSelectedOtherWallet(
      selectedOtherWallet === walletType ? null : walletType
    );
  };

  const selectedChainData = chainOptions.find((c) => c.id === selectedChain);
  const selectedTokenData = tokenOptions.find((t) => t.id === selectedToken);

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
            <div className="flex gap-2">
              {/* Chain Selector */}
              <div className="relative flex-1">
                <button
                  onClick={() => setShowChainDropdown(!showChainDropdown)}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 ${selectedChainData?.color} rounded-full flex items-center justify-center mr-3`}
                    >
                      <span className="text-white text-xs font-bold">
                        {selectedChainData?.icon}
                      </span>
                    </div>
                    <span className="font-medium text-black">
                      {selectedChainData?.name}
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
                    <div className="max-h-32 overflow-y-auto">
                      {chainOptions.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() =>
                            handleChainSelect(chain.id as "solana" | "eth")
                          }
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
                    <div
                      className={`w-6 h-6 ${selectedTokenData?.color} rounded-full flex items-center justify-center mr-3`}
                    >
                      <span className="text-white text-xs font-bold">
                        {selectedTokenData?.icon}
                      </span>
                    </div>
                    <span className="font-medium text-black">
                      {selectedTokenData?.symbol}
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
                    <div className="max-h-32 overflow-y-auto">
                      {tokenOptions.map((token) => (
                        <button
                          key={token.id}
                          onClick={() =>
                            handleTokenSelect(token.id as "usdc" | "usdt")
                          }
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center"
                        >
                          <div
                            className={`w-6 h-6 ${token.color} rounded-full flex items-center justify-center mr-3`}
                          >
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
                      {truncateAddress(evmAddress)}
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
                      {truncateAddress(solanaAddress)}
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
                      {truncateAddress(evmAddress)}
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
                      {truncateAddress(solanaAddress)}
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

      {/* Floating Add Wallets Button */}
      <div className="fixed bottom-4 left-4 right-4 z-50">
        <button className="w-full bg-black text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-lg">
          Add Wallets
        </button>
      </div>

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
