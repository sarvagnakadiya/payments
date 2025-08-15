"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useMiniApp } from "@neynar/react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { checkTokenApprovalNeeded } from "~/lib/tokenUtils";
import {
  getTokenInfo,
  getGatewayAddress,
  getChainInfo,
  getTokenImageSrc,
  getSupportedChainIds,
  getNetworkIconUrl,
} from "~/lib/tokens";
import type { FarcasterUser } from "../hooks/useFarcasterUserSearch";
import { encodeFunctionData } from "viem";
import { useNeynarUser } from "../hooks/useNeynarUser";
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
  // Track all processed hashes in this flow to avoid duplicate handling on repeated confirmations
  const processedHashesRef = useRef<Set<string>>(new Set());

  // --- Hooks ---
  const { isSDKLoaded, context, added, actions } = useMiniApp();

  // Removed verbose debug logging effects to avoid unnecessary renders

  // --- Neynar user hook ---
  const { user: neynarUser } = useNeynarUser(context || undefined);

  // --- Fund requests state (API-driven) ---
  interface FundRequestItem {
    id: string;
    senderId: string;
    receiverId: string;
    amount: number;
    overrideChain: string | null;
    overrideToken: string | null;
    overrideAddress: string | null;
    note: string | null;
    createdAt: string;
    expiresAt: string | null;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
    sender: {
      id: string;
      username: string;
      fid: string | null;
    };
    receiver: {
      id: string;
      username: string;
      fid: string | null;
    };
  }

  const [fundRequests, setFundRequests] = useState<FundRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const fetchFundRequests = useCallback(async () => {
    if (!context?.user?.fid) return;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const params = new URLSearchParams({
        fid: String(context.user.fid),
        type: "received",
      });
      const response = await fetch(
        `/api/fund-requests/get?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch fund requests");
      const data = await response.json();
      setFundRequests(data.fundRequests || []);
    } catch (err) {
      setRequestsError(
        err instanceof Error ? err.message : "An error occurred"
      );
    } finally {
      setRequestsLoading(false);
    }
  }, [context?.user?.fid]);

  const updateRequestStatus = useCallback(
    async (requestId: string, status: FundRequestItem["status"]) => {
      try {
        const response = await fetch(
          `/api/fund-requests/${String(context?.user?.fid)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, status }),
          }
        );
        if (!response.ok) throw new Error("Failed to update request status");
        await fetchFundRequests();
        return true;
      } catch (err) {
        setRequestsError(
          err instanceof Error ? err.message : "Failed to update request status"
        );
        return false;
      }
    },
    [fetchFundRequests, context?.user?.fid]
  );
  const [payingRequestId, setPayingRequestId] = useState<string | null>(null);
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);

  // Transaction hooks
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
          await sdk.actions.ready({});
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

  // Fetch fund requests whenever fid changes
  useEffect(() => {
    fetchFundRequests();
  }, [fetchFundRequests]);

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
      processedHashesRef.current.clear();

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
  const {
    address: evmAddress,
    isConnected: isEvmConnected,
    chainId,
  } = useAccount();
  const solanaWallet = useSolanaWallet();
  const { publicKey: solanaPublicKey } = solanaWallet;

  // Check if any wallet is connected
  const isWalletConnected = isEvmConnected || !!solanaPublicKey;
  // EVM must be ready for paying a fund request
  const isEvmPaymentReady = Boolean(
    isEvmConnected && evmAddress && chainId && publicClient
  );

  // --- Deep link recipient (for pay links) ---
  const [deepLinkRecipient, setDeepLinkRecipient] =
    useState<FarcasterUser | null>(null);

  // Parse pay deep link and open Pay popup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shouldPay = params.get("pay");
    if (shouldPay === "1") {
      const amt = params.get("amount") || "0";
      const tok = (params.get("token") || "USDC").toUpperCase();
      const fidStr = params.get("fid");
      const username = params.get("username") || "";
      const name = params.get("name") || username;
      const address = params.get("address") || "";
      const avatar = params.get("avatar") || "";

      setAmount(amt);
      setSelectedToken(tok);

      if (fidStr) {
        const fid = Number(fidStr);
        if (!Number.isNaN(fid)) {
          setDeepLinkRecipient({ fid, username, name, address, avatar });
        }
      }

      setShowPayPopup(true);
    }
  }, []);

  // --- Balances via backend API ---
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [stableTokenBalances, setStableTokenBalances] = useState<{
    USDC: number;
    USDT: number;
  }>({ USDC: 0, USDT: 0 });
  const [stableTokenBalancesByChain, setStableTokenBalancesByChain] = useState<{
    USDC: Record<number, number>;
    USDT: Record<number, number>;
  }>({ USDC: {}, USDT: {} });
  const [showBreakdown, setShowBreakdown] = useState<{
    USDC: boolean;
    USDT: boolean;
  }>({
    USDC: false,
    USDT: false,
  });

  // Token and network icons are provided via tokens lib

  const fetchBalances = useCallback(async () => {
    if (!evmAddress) return;
    setBalancesLoading(true);
    try {
      const res = await fetch(`/api/getBalances?userAddress=${evmAddress}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch balances");
      const data = await res.json();
      const assets: Array<{
        tokenSymbol?: string;
        balance?: string;
        balanceUsd?: string | number;
        blockchain?: string;
        chainId?: number | string;
        network?: string;
        chain?: string;
      }> = data?.walletAssets?.assets || [];

      // Aggregate stablecoin balances across chains
      let usdc = 0;
      let usdt = 0;
      const usdcByChain: Record<number, number> = {};
      const usdtByChain: Record<number, number> = {};
      for (const asset of assets) {
        const symbol = (asset.tokenSymbol || "").toUpperCase();
        const bal = Number(asset.balance || 0);
        // Derive chainId from various possible fields
        let chainId: number | null = null;
        const rawChainId = asset.chainId as any;
        if (typeof rawChainId === "number") chainId = rawChainId;
        else if (typeof rawChainId === "string" && rawChainId.trim() !== "") {
          const parsed = Number(rawChainId);
          if (!Number.isNaN(parsed)) chainId = parsed;
        }
        if (!chainId && asset.blockchain)
          chainId = mapBlockchainToChainId(asset.blockchain);
        if (!chainId && asset.network)
          chainId = mapBlockchainToChainId(asset.network);
        if (!chainId && asset.chain)
          chainId = mapBlockchainToChainId(asset.chain);

        if (symbol === "USDC") {
          usdc += bal;
          if (chainId) usdcByChain[chainId] = (usdcByChain[chainId] || 0) + bal;
        }
        if (symbol === "USDT") {
          usdt += bal;
          if (chainId) usdtByChain[chainId] = (usdtByChain[chainId] || 0) + bal;
        }
      }
      setStableTokenBalances({ USDC: usdc, USDT: usdt });
      setStableTokenBalancesByChain({ USDC: usdcByChain, USDT: usdtByChain });
      setTotalUsd(Number(data?.walletAssets?.totalBalanceUsd || 0));
    } catch (e) {
      console.error("Failed to load balances:", e);
      setStableTokenBalances({ USDC: 0, USDT: 0 });
      setStableTokenBalancesByChain({ USDC: {}, USDT: {} });
      setTotalUsd(0);
    } finally {
      setBalancesLoading(false);
    }
  }, [evmAddress]);

  useEffect(() => {
    if (evmAddress) {
      fetchBalances();
    }
  }, [evmAddress, fetchBalances]);

  // Payment functions
  // Map external blockchain string to EVM chain id
  const mapBlockchainToChainId = (blockchain: string): number | null => {
    const key = blockchain.toLowerCase();
    if (key === "ethereum" || key === "mainnet") return 1;
    if (key === "base") return 8453;
    if (key === "arbitrum") return 42161;
    if (key === "bsc" || key === "bnb" || key === "bnb chain") return 56;
    if (key === "polygon" || key === "matic") return 137;
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

  const executePaymentTransaction = useCallback(
    async (
      request: any,
      overrides?: { chainId: number; tokenSymbol: string; amount: string }
    ) => {
      console.log("calling execute payyyy---------");
      console.log("currentPayingRequest", request);
      console.log("evmAddress", evmAddress);
      console.log("chainId", chainId);
      console.log("going to execute payment transaction");
      if (!request || !evmAddress) {
        console.log("Missing required data for payment", {
          hasCurrentPayingRequest: !!request,
          hasEvmAddress: !!evmAddress,
          chainId,
        });
        return;
      }

      try {
        // Prepare params via quote overrides if provided
        console.log("going to get tx data");
        const sourceChainIdToUse = overrides?.chainId ?? chainId!;
        const tokenSymbolToUse =
          overrides?.tokenSymbol ?? (request.overrideToken || "USDC");
        const amountToUse = overrides?.amount ?? request.amount.toString();

        const response = await fetch("/api/getSwapData", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverFid: request.sender.fid,
            amount: amountToUse,
            sourceChainId: sourceChainIdToUse,
            sourceTokenSymbol: tokenSymbolToUse,
            sourceAddress: evmAddress,
            // Pass through request-specific overrides so backend can prioritize them
            overrideChain: request.overrideChain || undefined,
            overrideToken: request.overrideToken || undefined,
            overrideAddress: request.overrideAddress || undefined,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.error || "Failed to generate bridge transaction"
          );
        }

        const bridgeTransaction = data.bridgeTransaction?.transaction;

        if (
          !bridgeTransaction ||
          !bridgeTransaction.to ||
          !bridgeTransaction.data
        ) {
          throw new Error("Invalid bridge transaction data received from API");
        }

        // Log if this is a direct transfer
        if (data.isDirectTransfer) {
          console.log("=== DIRECT TRANSFER DETECTED ===");
          console.log(
            "Skipping complex approval flow for same chain/token transfer"
          );
        }

        console.log("bridgeTransaction:", bridgeTransaction);
        console.log("going to send transaction noww");
        // Execute the bridge transaction and await submission
        const bridgeHash = await sendTransactionAsync({
          to: bridgeTransaction.to as `0x${string}`,
          data: bridgeTransaction.data as `0x${string}`,
        });
        console.log("bridge tx hash:", bridgeHash);
      } catch (err) {
        console.error("Payment failed:", err);
        setPayingRequestId(null);
        setCurrentPayingRequest(null);
        setPaymentStep(null);
      }
    },
    [currentPayingRequest, evmAddress, chainId]
  );

  const handlePayRequest = async (request: any) => {
    if (!isEvmPaymentReady) {
      console.error("Missing required data for payment", {
        hasEvmAddress: !!evmAddress,
        chainId,
        hasPublicClient: !!publicClient,
      });
      setShowWalletConfigurePopup(true);
      return;
    }

    setPayingRequestId(request.id);
    setCurrentPayingRequest(request);

    try {
      // First, check if this would be a direct transfer by calling the payment API
      console.log("Checking if direct transfer is possible...");
      const response = await fetch("/api/getSwapData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverFid: request.sender.fid,
          amount: request.amount.toString(),
          sourceChainId: chainId!,
          sourceTokenSymbol: request.overrideToken || "USDC",
          sourceAddress: evmAddress,
          overrideChain: request.overrideChain || undefined,
          overrideToken: request.overrideToken || undefined,
          overrideAddress: request.overrideAddress || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate transaction");
      }

      const bridgeTransaction = data.bridgeTransaction?.transaction;

      if (
        !bridgeTransaction ||
        !bridgeTransaction.to ||
        !bridgeTransaction.data
      ) {
        throw new Error("Invalid transaction data received from API");
      }

      // Check if this is a direct transfer
      if (data.isDirectTransfer) {
        console.log("=== DIRECT TRANSFER - SKIPPING APPROVAL ===");
        console.log("Same chain/token detected, executing direct transfer");

        // For direct transfers, skip approval and execute immediately
        setPaymentStep("payment");

        const bridgeHash = await sendTransactionAsync({
          to: bridgeTransaction.to as `0x${string}`,
          data: bridgeTransaction.data as `0x${string}`,
        });
        console.log("Direct transfer hash:", bridgeHash);
        return;
      }

      // For cross-chain transfers, use the original flow with quote
      console.log("Cross-chain transfer detected, using quote-based flow");

      // 1) Fetch quote to determine source chain/token & deposit amount
      const { quote, targetChainId } = await fetchPaymentQuote(
        evmAddress!,
        request.amount.toString()
      );

      // 2) Switch chain if needed
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      // 3) Compute approval amount from quote
      const tokenDecimals = Number(quote.tokenDecimals ?? 6);
      const requiredAmount = BigInt(
        Math.floor(Number(quote.depositAmount) * Math.pow(10, tokenDecimals))
      );

      // 4) Execute approval (always approve exact required amount)
      setPaymentStep("approval");
      await executeApprovalForRequest(request, requiredAmount, {
        chainId: targetChainId,
        tokenSymbol: String(quote.tokenSymbol || "USDC").toUpperCase(),
      });

      // 5) Execute payment with quoted params
      setPaymentStep("payment");
      await executePaymentTransaction(request, {
        chainId: targetChainId,
        tokenSymbol: String(quote.tokenSymbol || "USDC").toUpperCase(),
        amount: String(quote.depositAmount),
      });
    } catch (error) {
      console.error("Failed to process payment request:", error);
      setPayingRequestId(null);
      setCurrentPayingRequest(null);
      setPaymentStep(null);
    }
  };

  const executeApprovalForRequest = async (
    request: any,
    requiredAmount: bigint,
    overrides?: { chainId: number; tokenSymbol: string }
  ) => {
    if (!evmAddress || !chainId) {
      console.error("Missing required data for approval");
      return;
    }

    try {
      const tokenSymbol =
        overrides?.tokenSymbol || request.overrideToken || "USDC";
      const chainToUse = overrides?.chainId ?? chainId;
      const tokenInfo = getTokenInfo(chainToUse, tokenSymbol);
      if (!tokenInfo) {
        throw new Error(
          `Token ${tokenSymbol} not found on chain ${chainToUse}`
        );
      }

      const gatewayAddress = getGatewayAddress(chainToUse);
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

      // Send approval and wait for on-chain confirmation before proceeding
      const approvalHash = await sendTransactionAsync({
        to: tokenInfo.address as `0x${string}`,
        data: approvalData,
      });
      console.log("approval tx hash:", approvalHash);
      try {
        await publicClient!.waitForTransactionReceipt({ hash: approvalHash });
      } catch (e) {
        console.warn("waitForTransactionReceipt failed, proceeding:", e);
      }
      console.log("approval confirmed on-chain, proceeding to bridge");
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
              {[
                "https://api.gasyard.fi/uploads/base-network.png",
                "https://api.gasyard.fi/uploads/arb-network.png",
                "https://api.gasyard.fi/uploads/solana.png",
              ].map((iconUrl, index) => {
                const overlapClass = index > 0 ? "-ml-3" : "";
                const zClasses = ["z-10", "z-20", "z-30"];
                const zClass = zClasses[index] || "z-10";
                return (
                  <img
                    key={iconUrl}
                    src={iconUrl}
                    alt="Network"
                    className={`w-4 h-4 rounded-full object-cover ${overlapClass} ${zClass}`}
                  />
                );
              })}
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
        {
          // Connected state - show balances
          <>
            {/* Main balance amount */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-black">
                ${balancesLoading ? "0.0" : totalUsd.toFixed(1)}
              </div>
            </div>

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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <img
                      src={getTokenImageSrc("USDC") || "/usdc.png"}
                      alt="USDC"
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <div>
                      <div className="font-semibold text-black">USDC</div>
                      <div className="text-sm text-gray-600">
                        {balancesLoading ? (
                          <div className="spinner h-4 w-4"></div>
                        ) : (
                          stableTokenBalances.USDC.toFixed(2)
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setShowBreakdown((prev) => ({
                          ...prev,
                          USDC: !prev.USDC,
                        }))
                      }
                      className="ml-2 text-gray-500 hover:text-gray-700"
                      aria-label="Toggle USDC breakdown"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          showBreakdown.USDC ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="font-semibold text-black">
                      {balancesLoading
                        ? "$0.00"
                        : `$${stableTokenBalances.USDC.toFixed(2)}`}
                    </div>
                  </div>
                </div>
                {showBreakdown.USDC && (
                  <div className="pl-11 pb-3">
                    {balancesLoading ? (
                      <div className="spinner h-4 w-4"></div>
                    ) : (
                      Object.entries(stableTokenBalancesByChain.USDC)
                        .filter(([, bal]) => (bal as number) > 0)
                        .map(([cid, bal]) => {
                          const info = getChainInfo(Number(cid));
                          return (
                            <div
                              key={`usdc-${cid}`}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex items-center space-x-2">
                                <img
                                  src={getNetworkIconUrl(Number(cid))}
                                  alt={`${info?.name || `Chain ${cid}`} logo`}
                                  className="w-4 h-4 rounded"
                                />
                                <div className="text-sm text-gray-600">
                                  {info?.name || `Chain ${cid}`}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-black">
                                {Number(bal).toFixed(2)}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}

                {/* USDT Balance */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <img
                      src={getTokenImageSrc("USDT") || "/usdt.png"}
                      alt="USDT"
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <div>
                      <div className="font-semibold text-black">USDT</div>
                      <div className="text-sm text-gray-600">
                        {balancesLoading ? (
                          <div className="spinner h-4 w-4"></div>
                        ) : (
                          stableTokenBalances.USDT.toFixed(2)
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setShowBreakdown((prev) => ({
                          ...prev,
                          USDT: !prev.USDT,
                        }))
                      }
                      className="ml-2 text-gray-500 hover:text-gray-700"
                      aria-label="Toggle USDT breakdown"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          showBreakdown.USDT ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="font-semibold text-black">
                      {balancesLoading
                        ? "$0.00"
                        : `$${stableTokenBalances.USDT.toFixed(2)}`}
                    </div>
                  </div>
                </div>
                {showBreakdown.USDT && (
                  <div className="pl-11">
                    {balancesLoading ? (
                      <div className="spinner h-4 w-4"></div>
                    ) : (
                      Object.entries(stableTokenBalancesByChain.USDT)
                        .filter(([, bal]) => (bal as number) > 0)
                        .map(([cid, bal]) => {
                          const info = getChainInfo(Number(cid));
                          return (
                            <div
                              key={`usdt-${cid}`}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex items-center space-x-2">
                                <img
                                  src={getNetworkIconUrl(Number(cid))}
                                  alt={`${info?.name || `Chain ${cid}`} logo`}
                                  className="w-4 h-4 rounded"
                                />
                                <div className="text-sm text-gray-600">
                                  {info?.name || `Chain ${cid}`}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-black">
                                {Number(bal).toFixed(2)}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
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
                                onClick={() => {
                                  if (!isWalletConnected) {
                                    setShowWalletConfigurePopup(true);
                                    return;
                                  }
                                  handlePayRequest(request);
                                }}
                                disabled={
                                  !isWalletConnected ||
                                  payingRequestId === request.id ||
                                  denyingRequestId === request.id
                                }
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                  !isWalletConnected
                                    ? "bg-gray-300 text-white cursor-not-allowed"
                                    : payingRequestId === request.id
                                    ? "bg-orange-300 text-white cursor-not-allowed"
                                    : "bg-orange-500 text-white hover:bg-orange-600"
                                }`}
                              >
                                {!isWalletConnected
                                  ? "Connect Wallet"
                                  : payingRequestId === request.id
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
        }
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
        prefillRecipient={deepLinkRecipient || undefined}
      />

      <RequestPopup
        isOpen={showRequestPopup}
        onClose={() => {
          setShowRequestPopup(false);
          // Refresh requests when popup is closed
          fetchFundRequests();
        }}
        amount={amount}
        selectedToken={selectedToken}
        onAmountChange={setAmount}
        onTokenChange={setSelectedToken}
        currentUserFid={
          context?.user?.fid ? String(context.user.fid) : undefined
        }
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
