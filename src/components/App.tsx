"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useMiniApp } from "@neynar/react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
  useSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { getTokenAddress, checkTokenApprovalNeeded } from "~/lib/tokenUtils";
import { getTokenInfo, getGatewayAddress } from "~/lib/tokens";
import { encodeFunctionData } from "viem";
import { useNeynarUser } from "../hooks/useNeynarUser";
import { useFundRequests } from "../hooks/useFundRequests";
import { sdk } from "@farcaster/miniapp-sdk";

import ActionSheet from "./ui/ActionSheet";
import PayPopup from "./ui/PayPopup";
import RequestPopup from "./ui/RequestPopup";
import WalletConfigurePopup from "./ui/WalletConfigurePopup";
import {
  BoxArrowDownIcon,
  CoinsIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";

// --- Types ---
export interface AppProps {
  title?: string;
}

/**
 * App component serves as the main container for the mini app interface.
 *
 * This component provides a mobile-first layout with:
 * - Profile information in the top left
 * - Wallet selection in the top right
 * - Main balance display (only when connected)
 * - Transaction notifications
 * - Detailed asset balances (USDC/USDT) (only when connected)
 * - Connect wallet popup (when not connected)
 * - Floating action button for new transactions
 *
 * @param props - Component props
 * @param props.title - Optional title for the mini app (defaults to "Payments Mini App")
 *
 * @example
 * ```tsx
 * <App title="My Mini App" />
 * ```
 */
export default function App(
  { title }: AppProps = { title: "Payments Mini App" }
) {
  // --- State ---
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [showWalletConfigurePopup, setShowWalletConfigurePopup] =
    useState(false);
  const [amount, setAmount] = useState("0");
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Payment flow state
  const [paymentStep, setPaymentStep] = useState<"approval" | "payment" | null>(
    null
  );
  const [currentPayingRequest, setCurrentPayingRequest] = useState<any>(null);
  // Track which transaction hash has already been processed to avoid double-processing
  const lastProcessedHashRef = useRef<string | undefined>(undefined);

  // --- Hooks ---
  const { isSDKLoaded, context, added, actions } = useMiniApp();

  // Removed verbose debug logging effects to avoid unnecessary renders

  // --- Neynar user hook ---
  const { user: neynarUser } = useNeynarUser(context || undefined);

  // --- Fund requests hook ---
  const {
    fundRequests,
    isLoading: requestsLoading,
    updateRequestStatus,
    refetch: refetchRequests,
  } = useFundRequests(currentUserId, "received");
  const [payingRequestId, setPayingRequestId] = useState<string | null>(null);
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);

  // Transaction hooks
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

  useEffect(() => {
    if (context?.user?.fid) {
      const initializeApp = async () => {
        try {
          console.log("Initializing app with data fetching...");
          // Check if user exists in database
          const userResponse = await fetch("/api/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fid: context.user.fid,
              username: context.user.username,
              usernameSource: "FARCASTER",
            }),
          });

          if (userResponse.ok) {
            const result = await userResponse.json();
            console.log("User data stored successfully:", result);
            // Store the user ID for later use
            if (result.user?.id) {
              setCurrentUserId(result.user.id);
            }
          } else {
            console.error(
              "Failed to store user data:",
              userResponse.statusText
            );
          }

          // Step 2: Fetch token balances (this will be handled by the balance hooks)
          // The balance hooks will automatically fetch when wallet is connected
          console.log(
            "Token balances will be fetched when wallet is connected"
          );

          // Step 3: Mark data as loaded
          setIsDataLoaded(true);

          // Step 4: Call sdk.actions.ready() after all data is fetched
          console.log("Calling sdk.actions.ready()...");
          await sdk.actions.ready();
          console.log("sdk.actions.ready() completed successfully");
        } catch (error) {
          console.error("Error during app initialization:", error);
          // Still mark as loaded to prevent infinite retries
          setIsDataLoaded(true);
        }
      };

      initializeApp();
    }
  }, [context?.user?.fid, context?.user?.username]);

  // Handle transaction errors or cancellation
  useEffect(() => {
    if (isTransactionError && currentPayingRequest && paymentStep) {
      console.error("Transaction failed or was cancelled:", transactionError);

      // Reset payment state
      setCurrentPayingRequest(null);
      setPaymentStep(null);
      setPayingRequestId(null);

      // Reset guard
      lastProcessedHashRef.current = undefined;

      // You could show an error message here if needed
      console.log("Payment process cancelled or failed");
    }
  }, [isTransactionError, transactionError, currentPayingRequest, paymentStep]);

  // Auto-add mini app if not added (no delay)
  useEffect(() => {
    if (context && !added) {
      actions
        .addMiniApp()
        .then(() => {
          console.log("addMiniApp() completed successfully");
        })
        .catch((error) => {
          console.error("addMiniApp() failed:", error);
        });
    }
  }, [context, added, actions]);

  // --- Wallet hooks ---
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const solanaWallet = useSolanaWallet();
  const { publicKey: solanaPublicKey } = solanaWallet;

  // Check if any wallet is connected
  const isWalletConnected = isEvmConnected || !!solanaPublicKey;

  // --- Balance hooks ---
  const usdcAddress = getTokenAddress(chainId, "USDC") as `0x${string}`;
  const usdtAddress = getTokenAddress(chainId, "USDT") as `0x${string}`;

  const { data: usdcBalance, isLoading: usdcLoading } = useBalance({
    address: evmAddress as `0x${string}`,
    token: usdcAddress,
    query: {
      enabled: !!evmAddress && !!usdcAddress,
    },
  });

  const { data: usdtBalance, isLoading: usdtLoading } = useBalance({
    address: evmAddress as `0x${string}`,
    token: usdtAddress,
    query: {
      enabled: !!evmAddress && !!usdtAddress,
    },
  });

  // Removed verbose balance logging effects

  // Calculate total balance
  const totalBalance =
    Number(usdcBalance?.value || 0) / Math.pow(10, usdcBalance?.decimals || 6) +
    Number(usdtBalance?.value || 0) / Math.pow(10, usdtBalance?.decimals || 6);

  // Helper function to format balance
  const formatBalance = (balance: any) => {
    if (!balance) return "0.0";
    return (Number(balance.value) / Math.pow(10, balance.decimals)).toFixed(1);
  };

  // Payment functions

  const executePaymentTransaction = useCallback(async () => {
    console.log("calling execute payyyy---------");
    console.log("currentPayingRequest", currentPayingRequest);
    console.log("evmAddress", evmAddress);
    console.log("chainId", chainId);
    if (!currentPayingRequest || !evmAddress || !chainId) {
      console.log("Missing required data for payment");
      return;
    }

    try {
      // Call the getSwapData API
      const response = await fetch("/api/getSwapData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverFid: currentPayingRequest.sender.fid,
          amount: currentPayingRequest.amount.toString(),
          sourceChainId: chainId,
          sourceTokenSymbol: currentPayingRequest.overrideToken || "USDC",
          sourceAddress: evmAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate bridge transaction");
      }

      const bridgeTransaction = data.bridgeTransaction?.transaction;

      if (
        !bridgeTransaction ||
        !bridgeTransaction.to ||
        !bridgeTransaction.data
      ) {
        throw new Error("Invalid bridge transaction data received from API");
      }

      // Execute the bridge transaction
      sendTransaction({
        to: bridgeTransaction.to as `0x${string}`,
        data: bridgeTransaction.data as `0x${string}`,
      });
    } catch (err) {
      console.error("Payment failed:", err);
      setPayingRequestId(null);
      setCurrentPayingRequest(null);
      setPaymentStep(null);
    }
  }, [currentPayingRequest, evmAddress, chainId, sendTransaction]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isTransactionConfirmed && currentPayingRequest && paymentStep) {
      // Guard to avoid double-processing same hash
      if (lastProcessedHashRef.current === transactionHash) return;
      lastProcessedHashRef.current = transactionHash;

      if (paymentStep === "approval") {
        // Approval transaction confirmed, now execute payment immediately
        setPaymentStep("payment");
        executePaymentTransaction();
      } else if (paymentStep === "payment") {
        // Payment transaction confirmed, update request status
        updateRequestStatus(currentPayingRequest.id, "ACCEPTED");
        setCurrentPayingRequest(null);
        setPaymentStep(null);
        setPayingRequestId(null);
        // Reset guard for next flow
        lastProcessedHashRef.current = undefined;
      }
    }
  }, [
    isTransactionConfirmed,
    currentPayingRequest,
    paymentStep,
    updateRequestStatus,
    executePaymentTransaction,
    transactionHash,
  ]);

  const handlePayRequest = async (request: any) => {
    setPayingRequestId(request.id);
    setCurrentPayingRequest(request);

    if (!evmAddress || !chainId || !publicClient) {
      console.error("Missing required data for payment");
      setPayingRequestId(null);
      setCurrentPayingRequest(null);
      return;
    }

    try {
      const tokenSymbol = request.overrideToken || "USDC";
      const amount = request.amount.toString();

      console.log("=== CHECKING APPROVAL FOR FUND REQUEST ===");
      console.log("Request details:", {
        requestId: request.id,
        amount: amount,
        tokenSymbol: tokenSymbol,
        senderUsername: request.sender.username,
      });

      // Check if approval is needed for this specific amount
      const approvalCheck = await checkTokenApprovalNeeded(
        publicClient,
        chainId,
        tokenSymbol,
        evmAddress,
        amount
      );

      console.log("Approval check result:", approvalCheck);

      if (approvalCheck.needsApproval) {
        setPaymentStep("approval");
        await executeApprovalForRequest(request, approvalCheck.requiredAmount);
      } else {
        setPaymentStep("payment");
        await executePaymentTransaction();
      }
    } catch (error) {
      console.error("Failed to check approval for fund request:", error);
      setPayingRequestId(null);
      setCurrentPayingRequest(null);
    }
  };

  const executeApprovalForRequest = async (
    request: any,
    requiredAmount: bigint
  ) => {
    if (!evmAddress || !chainId) {
      console.error("Missing required data for approval");
      return;
    }

    try {
      const tokenSymbol = request.overrideToken || "USDC";
      const tokenInfo = getTokenInfo(chainId, tokenSymbol);
      if (!tokenInfo) {
        throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
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
        args: [gatewayAddress as `0x${string}`, requiredAmount],
      });

      console.log("=== EXECUTING APPROVAL FOR FUND REQUEST ===");
      console.log("Token:", tokenInfo.address);
      console.log("Gateway:", gatewayAddress);
      console.log("Required Amount:", requiredAmount.toString());
      console.log("Request Amount:", request.amount);

      sendTransaction({
        to: tokenInfo.address as `0x${string}`,
        data: approvalData,
      });
    } catch (err) {
      console.error("=== APPROVAL FAILED FOR FUND REQUEST ===");
      console.error("Error details:", err);
      setPayingRequestId(null);
      setCurrentPayingRequest(null);
      setPaymentStep(null);
    }
  };

  // --- Early Returns ---
  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p>Loading SDK...</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div
      className="min-h-screen bg-gray-100"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      {/* Header Section */}
      <div className="px-4 py-4 flex items-center justify-between">
        {/* Profile on left */}
        <div className="flex items-center space-x-3">
          {context?.user?.pfpUrl ? (
            <img
              src={context.user.pfpUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          )}
          <span className="font-medium text-black">
            @{context?.user?.username || "qimchi"}
          </span>
        </div>

        {/* Wallet selection on right */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowWalletConfigurePopup(true)}
            className="flex items-center space-x-2 bg-white px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="relative flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full z-10"></div>
              <div className="w-4 h-4 bg-blue-500 rounded-full -ml-3 z-20"></div>
              <div className="w-4 h-4 bg-purple-500 rounded-full -ml-3 z-30"></div>
            </div>
            <span className="text-sm font-medium">Wallets</span>
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c1.756-.426 1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="px-4 py-6">
        {isWalletConnected ? (
          // Connected state - show balances
          <>
            {/* Main balance amount */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-black">
                ${totalBalance.toFixed(1)}
              </div>
            </div>

            {/* Transaction notification */}
            {/* <div className="bg-gray-100 rounded-lg px-3 py-2 mb-6 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                @{context?.user?.username || "qimchi"} paid +$120
              </span>
              <button className="text-gray-400 hover:text-gray-600">
                <svg
                  className="w-4 h-4"
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
            </div> */}

            {/* Balance card */}
            <div className="bg-white rounded-2xl shadow-sm">
              {/* Card header */}
              <div className="flex bg-white rounded-2xl items-center p-2">
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center mr-3">
                  <CoinsIcon
                    size={32}
                    weight="fill"
                    className="text-white m-1"
                  />
                </div>
                <h2 className="font-semibold text-black">Balance</h2>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                {/* USDC Balance */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white text-xs font-bold">$</span>
                    </div>
                    <div>
                      <div className="font-semibold text-black">USDC</div>
                      <div className="text-sm text-gray-600">
                        {usdcLoading ? (
                          <div className="spinner h-4 w-4"></div>
                        ) : (
                          formatBalance(usdcBalance)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-black">
                    ${formatBalance(usdcBalance)}
                  </div>
                </div>

                {/* USDT Balance */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white text-xs font-bold">T</span>
                    </div>
                    <div>
                      <div className="font-semibold text-black">USDT</div>
                      <div className="text-sm text-gray-600">
                        {usdtLoading ? (
                          <div className="spinner h-4 w-4"></div>
                        ) : (
                          formatBalance(usdtBalance)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-black">
                    ${formatBalance(usdtBalance)}
                  </div>
                </div>
              </div>
            </div>

            {/* Activities Section */}
            <div className="mt-6">
              <h2 className="font-semibold text-black mb-4">Activities</h2>

              {requestsLoading ? (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-center py-8">
                    <div className="spinner h-6 w-6"></div>
                    <span className="ml-2 text-gray-600">
                      Loading requests...
                    </span>
                  </div>
                </div>
              ) : fundRequests.length === 0 ? (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <BoxArrowDownIcon size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500">No pending requests</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {fundRequests
                    .filter((request) => request.status === "PENDING")
                    .map((request) => (
                      <div
                        key={request.id}
                        className="bg-white rounded-2xl p-4 shadow-sm"
                      >
                        <div className="flex items-start space-x-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          </div>

                          {/* Activity Content */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm text-gray-500">
                                @{request.sender.username}
                              </span>
                              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <BoxArrowDownIcon
                                  size={10}
                                  weight="fill"
                                  className="text-white"
                                />
                              </div>
                              <span className="text-sm text-black">
                                requested payment of
                              </span>
                            </div>

                            <div className="text-lg font-bold text-black mb-3">
                              ${Number(request.amount).toFixed(2)}
                              {request.overrideToken && (
                                <span className="text-sm text-gray-500 ml-2">
                                  in {request.overrideToken}
                                </span>
                              )}
                            </div>

                            {request.note && (
                              <div className="text-sm text-gray-600 mb-3">
                                &ldquo;{request.note}&rdquo;
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handlePayRequest(request)}
                                disabled={
                                  payingRequestId === request.id ||
                                  denyingRequestId === request.id
                                }
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                  payingRequestId === request.id
                                    ? "bg-orange-300 text-white cursor-not-allowed"
                                    : "bg-orange-500 text-white hover:bg-orange-600"
                                }`}
                              >
                                {payingRequestId === request.id
                                  ? paymentStep === "approval"
                                    ? "Approving..."
                                    : "Processing..."
                                  : "Pay"}
                              </button>
                              <button
                                onClick={async () => {
                                  setDenyingRequestId(request.id);
                                  await updateRequestStatus(
                                    request.id,
                                    "REJECTED"
                                  );
                                  setDenyingRequestId(null);
                                }}
                                disabled={
                                  payingRequestId === request.id ||
                                  denyingRequestId === request.id
                                }
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                  denyingRequestId === request.id
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "bg-gray-600 text-white hover:bg-gray-700"
                                }`}
                              >
                                {denyingRequestId === request.id
                                  ? "Processing..."
                                  : "Deny"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Not connected state - show connect wallet popup
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-center">
              {/* Wallet icon */}
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold text-black mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-gray-600 mb-6">
                Connect your wallet to view your balances and start making
                transactions
              </p>

              {/* Connection buttons */}
              <div className="space-y-3">
                {context ? (
                  // Farcaster context available - show auto connect
                  <button
                    onClick={() => connect({ connector: connectors[0] })}
                    className="w-full bg-black text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Connect with Farcaster
                  </button>
                ) : (
                  // No Farcaster context - show manual options
                  <>
                    <button
                      onClick={() => connect({ connector: connectors[1] })}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Connect Coinbase Wallet
                    </button>
                    <button
                      onClick={() => connect({ connector: connectors[2] })}
                      className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      Connect MetaMask
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button - only show when connected */}
      {isWalletConnected && (
        <div className="fixed bottom-6 right-6">
          <PlusCircleIcon
            size={64}
            weight="fill"
            className="hover:rotate-90 transition-transform cursor-pointer"
            onClick={() => setShowActionSheet(true)}
          />
        </div>
      )}

      {/* Popup Components */}
      <ActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onPayClick={() => setShowPayPopup(true)}
        onRequestClick={() => setShowRequestPopup(true)}
      />

      <PayPopup
        isOpen={showPayPopup}
        onClose={() => setShowPayPopup(false)}
        amount={amount}
        selectedToken={selectedToken}
        onAmountChange={setAmount}
        onTokenChange={setSelectedToken}
      />

      <RequestPopup
        isOpen={showRequestPopup}
        onClose={() => {
          setShowRequestPopup(false);
          // Refresh requests when popup is closed
          refetchRequests();
        }}
        amount={amount}
        selectedToken={selectedToken}
        onAmountChange={setAmount}
        onTokenChange={setSelectedToken}
        currentUserId={currentUserId}
      />

      <WalletConfigurePopup
        isOpen={showWalletConfigurePopup}
        onClose={() => setShowWalletConfigurePopup(false)}
        username={context?.user?.username}
        profileImage={context?.user?.pfpUrl}
        evmAddress={evmAddress}
        solanaAddress={solanaPublicKey?.toString()}
        userId={currentUserId}
        fid={context?.user?.fid}
        onPreferencesUpdated={() => {
          console.log("Preferences updated successfully");
          // You can add additional logic here, like refreshing user data
        }}
      />
    </div>
  );
}
