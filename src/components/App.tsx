"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
} from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { truncateAddress } from "../lib/truncateAddress";
import { USE_WALLET, USDC_ADDRESSES, USDT_ADDRESSES } from "~/lib/constants";
import { useNeynarUser } from "../hooks/useNeynarUser";
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
  const [amount, setAmount] = useState("0.00");
  const [selectedToken, setSelectedToken] = useState("USDC");

  // --- Hooks ---
  const { isSDKLoaded, context, added, actions } = useMiniApp();

  console.log("context", context);

  // --- Neynar user hook ---
  const { user: neynarUser } = useNeynarUser(context || undefined);

  // Auto-add mini app if not added
  useEffect(() => {
    if (context && !added) {
      actions.addMiniApp();
    }
  }, [context, actions.addMiniApp, added]);

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
  const usdcAddress = USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES];
  const usdtAddress = USDT_ADDRESSES[chainId as keyof typeof USDT_ADDRESSES];

  const { data: usdcBalance, isLoading: usdcLoading } = useBalance({
    address: evmAddress as `0x${string}`,
    token: usdcAddress,
    query: {
      enabled: !!evmAddress && !!usdcAddress,
    },
  });

  console.log("usdcBalance", usdcBalance);

  const { data: usdtBalance, isLoading: usdtLoading } = useBalance({
    address: evmAddress as `0x${string}`,
    token: usdtAddress,
    query: {
      enabled: !!evmAddress && !!usdtAddress,
    },
  });

  console.log("usdtBalance", usdtBalance);

  // Calculate total balance
  const totalBalance =
    Number(usdcBalance?.value || 0) / Math.pow(10, usdcBalance?.decimals || 6) +
    Number(usdtBalance?.value || 0) / Math.pow(10, usdtBalance?.decimals || 6);

  // Helper function to format balance
  const formatBalance = (balance: any) => {
    if (!balance) return "0.0";
    return (Number(balance.value) / Math.pow(10, balance.decimals)).toFixed(1);
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
              {/* <div className="bg-white rounded-2xl shadow-sm"> */}
              <h2 className="font-semibold text-black">Activities</h2>
              {/* Card header */}
              {/* <div className="flex bg-gray-200 rounded-2xl items-center p-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                    <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                  </div>
                </div> */}

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                {/* Activity Item */}
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
                      <span className="text-sm text-gray-500">@sarvagna</span>
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
                      $1000.<span className="text-gray-400">00</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                        Pay
                      </button>
                      <button className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors">
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
        onClose={() => setShowRequestPopup(false)}
        amount={amount}
        selectedToken={selectedToken}
        onAmountChange={setAmount}
        onTokenChange={setSelectedToken}
      />

      <WalletConfigurePopup
        isOpen={showWalletConfigurePopup}
        onClose={() => setShowWalletConfigurePopup(false)}
        username={context?.user?.username}
        profileImage={context?.user?.pfpUrl}
        evmAddress={evmAddress ? truncateAddress(evmAddress) : undefined}
        solanaAddress={
          solanaPublicKey
            ? truncateAddress(solanaPublicKey.toString())
            : undefined
        }
      />
    </div>
  );
}
