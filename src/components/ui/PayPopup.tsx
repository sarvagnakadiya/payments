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
  useSwitchChain,
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
import { checkTokenApprovalNeeded } from "../../lib/tokenUtils";

interface PayPopupProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  selectedToken: string;
  onAmountChange: (amount: string) => void;
  onTokenChange: (token: string) => void;
  prefillRecipient?: FarcasterUser;
}

export default function PayPopup({
  isOpen,
  onClose,
  amount,
  selectedToken,
  onAmountChange,
  onTokenChange,
  prefillRecipient,
}: PayPopupProps) {
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<FarcasterUser | null>(prefillRecipient ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApprovalStep, setIsApprovalStep] = useState(false);
  const [isBridgeStep, setIsBridgeStep] = useState(false);

  // Ref to track processed transactions to prevent duplicate processing
  const processedTransactions = React.useRef<Set<string>>(new Set());

  // Token approval state management
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState<bigint>(0n);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const { users, isSearching, searchQuery, setSearchQuery, clearSearch } =
    useFarcasterUserSearch();

  // Wagmi hooks for transaction handling
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const {
    sendTransaction,
    sendTransactionAsync,
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

  // If recipient is prefilled (from deep link) ensure dropdown/search are reset
  React.useEffect(() => {
    if (prefillRecipient) {
      setSelectedRecipient(prefillRecipient);
      clearSearch();
    }
  }, [prefillRecipient, clearSearch]);

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

  // Quote helpers
  const mapBlockchainToChainId = (blockchain: string): number | null => {
    const k = blockchain.toLowerCase();
    if (k === "ethereum" || k === "mainnet") return 1;
    if (k === "base") return 8453;
    if (k === "arbitrum") return 42161;
    if (k === "bsc" || k === "bnb" || k === "bnb chain") return 56;
    if (k === "polygon" || k === "matic") return 137;
    return null;
  };

  const fetchPaymentQuote = async (userAddress: string, amountStr: string) => {
    const url = `https://api.gasyard.fi/api/sdk/process-payment-quote?userAddress=${encodeURIComponent(
      userAddress
    )}&amount=${encodeURIComponent(amountStr)}`;
    const res = await fetch(url, {
      headers: { "x-api-key": "trial" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch payment quote");
    const data = await res.json();
    const quote = Array.isArray(data.result) ? data.result[0] : undefined;
    if (!quote) throw new Error("No quote returned");
    const targetChainId = mapBlockchainToChainId(quote.blockchain);
    if (!targetChainId) throw new Error("Unsupported blockchain in quote");
    return { quote, targetChainId } as const;
  };

  // Check approval status
  const checkApproval = React.useCallback(async () => {
    if (!address || !chainId || !publicClient) {
      console.log("=== CHECK APPROVAL - MISSING DATA ===");
      console.log("address:", !!address);
      console.log("chainId:", chainId);
      console.log("publicClient:", !!publicClient);
      setNeedsApproval(false);
      return;
    }

    console.log("=== CHECKING TOKEN APPROVAL ===");
    console.log("Input parameters:", {
      chainId,
      selectedToken,
      amount,
      address,
    });

    setIsCheckingApproval(true);
    setError(null);

    try {
      const result = await checkTokenApprovalNeeded(
        publicClient,
        chainId,
        selectedToken,
        address,
        amount
      );

      console.log("=== APPROVAL CHECK RESULT ===");
      console.log("needsApproval:", result.needsApproval);
      console.log("requiredAmount:", result.requiredAmount?.toString());

      setNeedsApproval(result.needsApproval);
      if (result.needsApproval) {
        setApprovalAmount(result.requiredAmount);
      }
    } catch (error) {
      console.error("=== ERROR CHECKING APPROVAL ===");
      console.error("Error details:", error);
      setError("Failed to check token approval");
      setNeedsApproval(false);
    } finally {
      setIsCheckingApproval(false);
    }
  }, [address, chainId, publicClient, selectedToken, amount]);

  // Execute approval transaction
  const executeApproval = React.useCallback(async () => {
    if (!address || !chainId || !publicClient) {
      setApprovalError("Missing required data for approval");
      return;
    }

    setIsApproving(true);
    setApprovalError(null);

    try {
      const tokenInfo = getTokenInfo(chainId, selectedToken);
      if (!tokenInfo) {
        throw new Error(`Token ${selectedToken} not found on chain ${chainId}`);
      }

      const gatewayAddress = getGatewayAddress(chainId);
      if (gatewayAddress === "Native Integration") {
        throw new Error("No approval needed for native integration");
      }

      // Create approval transaction data
      const approvalData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "approve",
        args: [gatewayAddress as `0x${string}`, approvalAmount],
      });

      console.log("=== EXECUTING APPROVAL ===");
      console.log("Token:", tokenInfo.address);
      console.log("Gateway:", gatewayAddress);
      console.log("Amount:", approvalAmount.toString());

      sendTransaction({
        to: tokenInfo.address as `0x${string}`,
        data: approvalData,
      });
    } catch (err) {
      console.error("=== APPROVAL FAILED ===");
      console.error("Error details:", err);
      setApprovalError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsApproving(false);
    }
  }, [
    address,
    chainId,
    publicClient,
    selectedToken,
    approvalAmount,
    sendTransaction,
  ]);

  // Reset approval state
  const resetApproval = React.useCallback(() => {
    setNeedsApproval(false);
    setIsCheckingApproval(false);
    setApprovalAmount(0n);
    setError(null);
    setIsApproving(false);
    setApprovalError(null);
    setIsBridgeStep(false);
    processedTransactions.current.clear();
  }, []);

  // Set approval as complete
  const setApprovalComplete = React.useCallback(() => {
    setNeedsApproval(false);
    setIsApproving(false);
  }, []);

  // Check approval when amount, token, address, or chain changes
  React.useEffect(() => {
    if (
      amount &&
      amount.trim() !== "" &&
      parseFloat(amount) > 0 &&
      selectedToken &&
      address &&
      chainId
    ) {
      checkApproval();
    } else {
      // Reset approval state if no valid amount
      setNeedsApproval(false);
      setApprovalAmount(0n);
    }
  }, [checkApproval, amount, selectedToken, address, chainId]);

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

  // Handle approval transaction errors
  React.useEffect(() => {
    if (isTransactionError && isApproving) {
      console.error(
        "Approval transaction failed or was cancelled:",
        transactionError
      );
      setIsApproving(false);
      setApprovalError(
        transactionError?.message ||
          "Approval transaction was cancelled or failed"
      );
    }
  }, [isTransactionError, transactionError, isApproving]);

  // Re-check approval status after transaction is confirmed
  React.useEffect(() => {
    if (isTransactionConfirmed && isApproving) {
      console.log(
        "=== APPROVAL TRANSACTION CONFIRMED - RE-CHECKING APPROVAL ==="
      );
      console.log("Transaction hash:", transactionHash);
      setIsApproving(false);
      // Set approval as no longer needed immediately
      setNeedsApproval(false);
      // Then re-check to confirm
      checkApproval();
    }
  }, [isTransactionConfirmed, isApproving, checkApproval, transactionHash]);

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
    setIsBridgeStep(true);
    setError(null);

    try {
      // 1) Fetch quote and switch chain/token accordingly
      const { quote, targetChainId } = await fetchPaymentQuote(
        address!,
        amount
      );
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }
      const tokenFromQuote = String(
        quote.tokenSymbol || selectedToken
      ).toUpperCase();
      if (tokenFromQuote !== selectedToken) {
        onTokenChange(tokenFromQuote);
      }

      // 2) Check and perform approval on quoted chain/token for quoted deposit amount
      try {
        const approvalCheck = await checkTokenApprovalNeeded(
          publicClient!,
          targetChainId,
          tokenFromQuote,
          address!,
          String(quote.depositAmount)
        );
        if (approvalCheck.needsApproval) {
          const tokenInfo = getTokenInfo(targetChainId, tokenFromQuote);
          const gatewayAddress = getGatewayAddress(targetChainId);
          if (tokenInfo && gatewayAddress !== "Native Integration") {
            const approvalData = encodeFunctionData({
              abi: [
                {
                  inputs: [
                    { name: "spender", type: "address" },
                    { name: "amount", type: "uint256" },
                  ],
                  name: "approve",
                  outputs: [{ name: "", type: "bool" }],
                  stateMutability: "nonpayable",
                  type: "function",
                },
              ],
              functionName: "approve",
              args: [
                gatewayAddress as `0x${string}`,
                approvalCheck.requiredAmount,
              ],
            });
            setIsApprovalStep(true);
            const hash = await sendTransactionAsync({
              to: tokenInfo.address as `0x${string}`,
              data: approvalData,
            });
            try {
              await publicClient!.waitForTransactionReceipt({ hash });
            } catch (e) {
              console.warn("waitForTransactionReceipt failed, proceeding:", e);
            }
            setIsApprovalStep(false);
          }
        }
      } catch (approvalErr) {
        console.error(
          "Approval check/step failed (continuing to attempt bridge):",
          approvalErr
        );
        setIsApprovalStep(false);
      }

      console.log("=== CALLING BRIDGE API ===");
      console.log("API payload:", {
        receiverFid: selectedRecipient.fid.toString(),
        amount: String(quote.depositAmount),
        sourceChainId: targetChainId,
        sourceTokenSymbol: tokenFromQuote,
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
          amount: String(quote.depositAmount),
          sourceChainId: targetChainId,
          sourceTokenSymbol: tokenFromQuote,
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
      // Don't set isProcessing to false here - let the transaction confirmation handle it
    } catch (err) {
      console.error("=== BRIDGE TRANSACTION FAILED ===");
      console.error("Error details:", err);
      setError(
        err instanceof Error ? err.message : "Bridge transaction failed"
      );
      setIsProcessing(false); // Only set to false on error
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
    onTokenChange,
    switchChainAsync,
  ]);

  // Reset state when bridge transaction is confirmed
  React.useEffect(() => {
    if (isTransactionConfirmed && transactionHash) {
      if (processedTransactions.current.has(transactionHash)) return;
      processedTransactions.current.add(transactionHash);

      if (isBridgeStep) {
        setIsProcessing(false);
        setIsBridgeStep(false);
        resetApproval();
        setSelectedRecipient(null);
        clearSearch();
        onAmountChange("0");
        onClose();
      }
    }
  }, [
    isTransactionConfirmed,
    transactionHash,
    isBridgeStep,
    resetApproval,
    setSelectedRecipient,
    clearSearch,
    onAmountChange,
    onClose,
  ]);

  // Monitor approval status changes and auto-proceed to payment when approval is no longer needed
  // Removed this effect as it was causing conflicts with the transaction confirmation flow

  // Force re-check approval when approval transaction is confirmed
  // Removed this effect as it was causing conflicts with the transaction confirmation flow

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

    // Always run through executeBridgeTransaction which now fetches quote and switches chain
    await executeBridgeTransaction();
  };

  // Reset states when popup closes
  const handleClose = () => {
    setError(null);
    setIsProcessing(false);
    setIsApprovalStep(false);
    setIsBridgeStep(false);
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
                : isBridgeStep
                ? "Processing Payment..."
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
