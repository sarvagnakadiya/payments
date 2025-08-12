"use client";

import React, { useState } from "react";
import {
  CaretCircleDownIcon,
  CaretCircleUpIcon,
  PaperPlaneTiltIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { encodeFunctionData } from "viem";
import NumberPad from "./NumberPad";
import { formatAmount } from "../../lib/utils";
import {
  useFarcasterUserSearch,
  type FarcasterUser,
} from "../../hooks/useFarcasterUserSearch";
import {
  getTokensForChain,
  getTokenInfo,
  getGatewayAddress,
  type TokenInfo,
} from "../../lib/tokens";
import { useTokenApproval } from "../../hooks/useTokenApproval";

interface PayPopupProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  selectedToken: string;
  onAmountChange: (amount: string) => void;
  onTokenChange: (token: string) => void;
}

export default function PayPopup({
  isOpen,
  onClose,
  amount,
  selectedToken,
  onAmountChange,
  onTokenChange,
}: PayPopupProps) {
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<FarcasterUser | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApprovalStep, setIsApprovalStep] = useState(false);

  // Use the approval hook
  const {
    needsApproval,
    isCheckingApproval,
    executeApproval,
    isApproving,
    error: approvalError,
    resetApproval,
  } = useTokenApproval(selectedToken, amount);

  const { users, isSearching, searchQuery, setSearchQuery, clearSearch } =
    useFarcasterUserSearch();

  // Wagmi hooks for transaction handling
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const {
    sendTransaction,
    data: transactionHash,
    error: transactionError,
    isError: isTransactionError,
    isPending: isTransactionPending,
  } = useSendTransaction();

  const {
    isLoading: isTransactionConfirming,
    isSuccess: isTransactionConfirmed,
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  // Get tokens for the current chain (dynamic based on selected chain)
  const tokenOptions = React.useMemo(() => {
    return chainId
      ? getTokensForChain(chainId).map((token) => ({
          symbol: token.symbol,
          name: token.name,
          icon: token.icon,
        }))
      : [];
  }, [chainId]);

  const filteredRecipients = users;

  // Ensure selected token is valid for current chain
  React.useEffect(() => {
    if (chainId && tokenOptions.length > 0) {
      const isValidToken = tokenOptions.some(
        (token) => token.symbol === selectedToken
      );
      if (!isValidToken) {
        // Select the first available token for this chain
        onTokenChange(tokenOptions[0].symbol);
      }
    }
  }, [chainId, tokenOptions, selectedToken, onTokenChange]);

  // Handle transaction errors or cancellation
  React.useEffect(() => {
    if (isTransactionError) {
      console.error("Transaction failed or was cancelled:", transactionError);

      // Reset processing states
      setIsProcessing(false);
      setIsApprovalStep(false);

      // Set error message
      setError(
        transactionError?.message || "Transaction was cancelled or failed"
      );
    }
  }, [isTransactionError, transactionError]);

  const handleApproval = async () => {
    console.log("=== HANDLE APPROVAL CALLED ===");
    setError(null);

    try {
      console.log("=== EXECUTING APPROVAL ===");
      await executeApproval();
      console.log("=== APPROVAL EXECUTION COMPLETED ===");
    } catch (err) {
      console.error("=== APPROVAL FAILED ===");
      console.error("Error details:", err);
      setError(err instanceof Error ? err.message : "Approval failed");
      setIsApprovalStep(false);
    }
  };

  const executeBridgeTransaction = React.useCallback(async () => {
    console.log("=== EXECUTE BRIDGE TRANSACTION CALLED ===");
    console.log("selectedRecipient:", selectedRecipient);
    console.log("amount:", amount);
    console.log("isConnected:", isConnected);
    console.log("address:", address);
    console.log("chainId:", chainId);
    console.log("publicClient:", !!publicClient);

    if (!selectedRecipient || !amount || !isConnected || !address || !chainId) {
      console.log("=== BRIDGE TRANSACTION VALIDATION FAILED ===");
      setError("Please select a recipient and ensure wallet is connected");
      return;
    }

    // Additional wallet and chain validation
    if (!publicClient) {
      console.log("=== PUBLIC CLIENT NOT AVAILABLE ===");
      setError("Wallet client not available");
      return;
    }

    console.log("=== STARTING BRIDGE TRANSACTION PROCESS ===");
    setIsProcessing(true);
    setError(null);

    try {
      console.log("=== CALLING BRIDGE API ===");
      console.log("API payload:", {
        receiverFid: selectedRecipient.fid.toString(),
        amount: amount,
        sourceChainId: chainId,
        sourceTokenSymbol: selectedToken,
        sourceAddress: address,
      });

      // Call the simplified bridge API
      const response = await fetch("/api/getSwapData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverFid: selectedRecipient.fid.toString(),
          amount: amount,
          sourceChainId: chainId,
          sourceTokenSymbol: selectedToken,
          sourceAddress: address,
        }),
      });

      const data = await response.json();
      console.log("=== BRIDGE API RESPONSE ===");
      console.log("Response data:", data);

      if (!data.success) {
        console.log("=== BRIDGE API FAILED ===");
        console.log("Error:", data.error);
        throw new Error(data.error || "Failed to generate bridge transaction");
      }

      // Check for the correct response format
      const bridgeTransaction = data.bridgeTransaction?.transaction;
      console.log("=== BRIDGE TRANSACTION DATA ===");
      console.log("bridgeTransaction:", bridgeTransaction);

      if (
        !bridgeTransaction ||
        !bridgeTransaction.to ||
        !bridgeTransaction.data
      ) {
        console.log("=== INVALID BRIDGE TRANSACTION DATA ===");
        throw new Error("Invalid bridge transaction data received from API");
      }

      // Validate transaction parameters
      if (
        !bridgeTransaction.to.startsWith("0x") ||
        bridgeTransaction.to.length !== 42
      ) {
        throw new Error("Invalid transaction destination address");
      }

      if (!bridgeTransaction.data.startsWith("0x")) {
        throw new Error("Invalid transaction data format");
      }

      // Additional validation
      if (bridgeTransaction.data.length < 10) {
        throw new Error("Transaction data too short");
      }

      // Estimate gas before sending transaction
      try {
        const gasEstimate = await publicClient.estimateGas({
          account: address,
          to: bridgeTransaction.to as `0x${string}`,
          data: bridgeTransaction.data as `0x${string}`,
        });
      } catch (gasError) {
        console.error("=== GAS ESTIMATION FAILED ===");
        console.error("Gas error:", gasError);
        throw new Error(
          `Gas estimation failed: ${
            gasError instanceof Error ? gasError.message : "Unknown error"
          }`
        );
      }

      console.log("=== SENDING BRIDGE TRANSACTION ===");
      console.log("Transaction to:", bridgeTransaction.to);
      console.log("Transaction data:", bridgeTransaction.data);

      // Execute the bridge transaction using wagmi
      sendTransaction({
        to: bridgeTransaction.to as `0x${string}`,
        data: bridgeTransaction.data as `0x${string}`,
      });

      console.log("=== BRIDGE TRANSACTION SENT ===");
    } catch (err) {
      console.error("=== BRIDGE TRANSACTION FAILED ===");
      console.error("Error details:", err);
      setError(
        err instanceof Error ? err.message : "Bridge transaction failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedRecipient,
    amount,
    isConnected,
    address,
    chainId,
    publicClient,
    selectedToken,
    sendTransaction,
  ]);

  // Reset approval status when transaction is confirmed
  React.useEffect(() => {
    if (isTransactionConfirmed) {
      console.log("=== TRANSACTION CONFIRMED ===");
      console.log("isApprovalStep:", isApprovalStep);
      console.log("Transaction hash:", transactionHash);

      if (isApprovalStep) {
        console.log(
          "=== APPROVAL TRANSACTION CONFIRMED - PROCEEDING TO PAY ==="
        );
        // If this was an approval transaction, proceed to execute the bridge transaction
        setIsApprovalStep(false);
        // Execute bridge transaction immediately after approval
        executeBridgeTransaction();
      } else {
        console.log("=== PAY TRANSACTION CONFIRMED - RESETTING POPUP ===");
        // If this was a bridge transaction, reset everything
        resetApproval();
        setSelectedRecipient(null);
        clearSearch();
        onAmountChange("0");
        onClose();
      }
    }
  }, [
    isTransactionConfirmed,
    isApprovalStep,
    executeBridgeTransaction,
    transactionHash,
    resetApproval,
    setSelectedRecipient,
    clearSearch,
    onAmountChange,
    onClose,
  ]);

  // Monitor approval status changes and auto-proceed to payment when approval is no longer needed
  React.useEffect(() => {
    console.log("=== APPROVAL STATUS MONITOR ===");
    console.log("isApprovalStep:", isApprovalStep);
    console.log("needsApproval:", needsApproval);
    console.log("isApproving:", isApproving);
    console.log("isCheckingApproval:", isCheckingApproval);

    if (
      isApprovalStep &&
      !needsApproval &&
      !isApproving &&
      !isCheckingApproval
    ) {
      console.log("=== APPROVAL COMPLETE - AUTO-PROCEEDING TO PAY ===");
      // Approval is complete, proceed to payment
      setIsApprovalStep(false);
      executeBridgeTransaction();
    }
  }, [
    needsApproval,
    isApprovalStep,
    isApproving,
    isCheckingApproval,
    executeBridgeTransaction,
  ]);

  const handlePay = async () => {
    console.log("=== HANDLE PAY CALLED ===");
    console.log("selectedRecipient:", selectedRecipient);
    console.log("amount:", amount);
    console.log("isConnected:", isConnected);
    console.log("address:", address);
    console.log("chainId:", chainId);
    console.log("needsApproval:", needsApproval);

    if (!selectedRecipient || !amount || !isConnected || !address || !chainId) {
      console.log("=== PAY VALIDATION FAILED ===");
      setError("Please select a recipient and ensure wallet is connected");
      return;
    }

    // If approval is needed, handle approval first
    if (needsApproval) {
      console.log("=== APPROVAL NEEDED - STARTING APPROVAL PROCESS ===");
      setIsApprovalStep(true);
      await handleApproval();
      return;
    }

    console.log("=== NO APPROVAL NEEDED - EXECUTING PAY DIRECTLY ===");
    // If no approval needed, execute bridge transaction directly
    await executeBridgeTransaction();
  };

  // Reset states when popup closes
  const handleClose = () => {
    setError(null);
    setIsProcessing(false);
    setIsApprovalStep(false);
    resetApproval();
    setSelectedRecipient(null);
    clearSearch();
    onAmountChange("0");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={(e) => {
          // Close dropdowns when clicking overlay
          setShowRecipientDropdown(false);
          setShowTokenDropdown(false);
          handleClose();
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-xl transition-transform duration-300"
        style={{
          animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
              <PaperPlaneTiltIcon
                size={20}
                weight="fill"
                className="text-white"
              />
            </div>
            <span className="text-xl font-semibold text-black">Pay</span>
          </div>
          <button
            onClick={handleClose}
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

        {/* Content */}
        <div className="px-4 pb-4 space-y-4">
          {/* Recipient Input */}
          <div className="relative flex justify-center">
            <div
              className={`bg-gray-100 rounded-full transition-all duration-200 ${
                selectedRecipient ? "px-3 py-2 w-auto" : "p-3 w-full"
              }`}
            >
              <div className="flex items-center">
                <span className="text-gray-500 mr-3 text-sm font-medium">
                  To:
                </span>
                <input
                  type="text"
                  placeholder="Search recipients..."
                  value={
                    selectedRecipient ? selectedRecipient.name : searchQuery
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    setSelectedRecipient(null); // Clear selection when typing
                    setShowRecipientDropdown(true);
                  }}
                  onFocus={() => setShowRecipientDropdown(true)}
                  className="bg-transparent text-sm font-medium text-black placeholder-gray-400 focus:outline-none min-w-0"
                  style={{
                    width: selectedRecipient
                      ? `${selectedRecipient.name.length * 8 + 8}px`
                      : "auto",
                  }}
                />
                {selectedRecipient && (
                  <button
                    onClick={() => {
                      setSelectedRecipient(null);
                      clearSearch();
                      setShowRecipientDropdown(false);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon size={16} weight="fill" />
                  </button>
                )}
              </div>
            </div>

            {/* Recipient Dropdown */}
            {showRecipientDropdown && (selectedRecipient || searchQuery) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10">
                <div className="max-h-32 overflow-y-auto">
                  {isSearching && (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Searching...
                    </div>
                  )}
                  {!isSearching &&
                    filteredRecipients.map((recipient) => (
                      <button
                        key={recipient.fid}
                        onClick={() => {
                          setSelectedRecipient(recipient);
                          clearSearch();
                          setShowRecipientDropdown(false);
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 flex items-center"
                      >
                        {recipient.avatar ? (
                          <img
                            src={recipient.avatar}
                            alt={recipient.name}
                            className="w-8 h-8 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              {recipient.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-black">
                            {recipient.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{recipient.username} •{" "}
                            {recipient.address
                              ? `${recipient.address.slice(
                                  0,
                                  6
                                )}...${recipient.address.slice(-4)}`
                              : "No address"}
                          </div>
                        </div>
                      </button>
                    ))}
                  {!isSearching &&
                    filteredRecipients.length === 0 &&
                    searchQuery && (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No users found
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Amount Display */}
          <div className="text-center py-2">
            <div
              className={`text-5xl font-light transition-colors ${
                parseFloat(amount) === 0 ? "text-gray-400" : "text-black"
              }`}
            >
              ${formatAmount(amount)}
            </div>
          </div>

          {/* Token Selector */}
          <div className="relative flex justify-center">
            <div
              className={`bg-gray-100 rounded-full p-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                selectedToken ? "w-fit max-w-full" : "w-full"
              }`}
              onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            >
              <div className="flex items-center">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-xs font-bold">
                    {tokenOptions.find((t) => t.symbol === selectedToken)
                      ?.icon || "$"}
                  </span>
                </div>
                <span className="text-black font-medium">{selectedToken}</span>
              </div>
              {showTokenDropdown ? (
                <CaretCircleUpIcon
                  size={18}
                  weight="fill"
                  className="text-gray-400 ml-2"
                />
              ) : (
                <CaretCircleDownIcon
                  size={18}
                  weight="fill"
                  className="text-gray-400 ml-2"
                />
              )}
            </div>

            {/* Token Dropdown */}
            {showTokenDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 min-w-full">
                <div className="max-h-32 overflow-y-auto">
                  {tokenOptions.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        onTokenChange(token.symbol);
                        setShowTokenDropdown(false);
                      }}
                      className="w-full p-3 text-left hover:bg-gray-50 flex items-center"
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

          {/* Number Pad */}
          <NumberPad amount={amount} onAmountChange={onAmountChange} />

          {/* Error Display */}
          {(error || approvalError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error || approvalError}</p>
            </div>
          )}

          {/* Transaction Status */}
          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-600 text-sm">Processing transaction...</p>
            </div>
          )}

          {/* Pay Button */}
          <button
            className={`w-full py-3 rounded-xl font-semibold text-lg transition-colors mt-4 ${
              !isConnected ||
              !selectedRecipient ||
              isProcessing ||
              isApproving ||
              parseFloat(amount) === 0
                ? "bg-orange-200 text-orange-400 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
            onClick={handlePay}
            disabled={
              !isConnected ||
              !selectedRecipient ||
              isProcessing ||
              isApproving ||
              parseFloat(amount) === 0
            }
          >
            {isCheckingApproval
              ? "Checking..."
              : isProcessing || isApproving
              ? isApprovalStep
                ? "Approving..."
                : "Processing..."
              : needsApproval
              ? "Approve & Pay"
              : "Pay"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
