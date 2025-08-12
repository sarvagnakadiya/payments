import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { encodeFunctionData } from "viem";
import { getTokenInfo, getGatewayAddress } from "../lib/tokens";
import { checkTokenApprovalNeeded } from "../lib/tokenUtils";

interface UseTokenApprovalReturn {
  needsApproval: boolean;
  isCheckingApproval: boolean;
  approvalAmount: bigint;
  error: string | null;
  checkApproval: () => Promise<void>;
  resetApproval: () => void;
  executeApproval: () => Promise<void>;
  isApproving: boolean;
  approvalError: string | null;
  setApprovalComplete: () => void;
}

export function useTokenApproval(
  selectedToken: string,
  amount: string
): UseTokenApprovalReturn {
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState<bigint>(0n);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const {
    sendTransaction,
    data: transactionHash,
    error: sendTransactionError,
    isError: isSendTransactionError,
  } = useSendTransaction();

  const {
    isLoading: isTransactionConfirming,
    isSuccess: isTransactionConfirmed,
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  const checkApproval = useCallback(async () => {
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

  const executeApproval = useCallback(async () => {
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

  const resetApproval = () => {
    setNeedsApproval(false);
    setIsCheckingApproval(false);
    setApprovalAmount(0n);
    setError(null);
    setIsApproving(false);
    setApprovalError(null);
  };

  const setApprovalComplete = () => {
    setNeedsApproval(false);
    setIsApproving(false);
  };

  // Check approval when amount, token, address, or chain changes
  useEffect(() => {
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
  useEffect(() => {
    if (isSendTransactionError && isApproving) {
      console.error(
        "Approval transaction failed or was cancelled:",
        sendTransactionError
      );
      setIsApproving(false);
      setApprovalError(
        sendTransactionError?.message ||
          "Approval transaction was cancelled or failed"
      );
    }
  }, [isSendTransactionError, sendTransactionError, isApproving]);

  // Re-check approval status after transaction is confirmed
  useEffect(() => {
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

  return {
    needsApproval,
    isCheckingApproval,
    approvalAmount,
    error,
    checkApproval,
    resetApproval,
    executeApproval,
    isApproving,
    approvalError,
    setApprovalComplete,
  };
}
