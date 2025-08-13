"use client";

import { useConnect } from "wagmi";
import { useMiniApp } from "@neynar/react";

export default function ConnectWallet() {
  const { connect, connectors } = useConnect();
  const { context } = useMiniApp();

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="text-center">
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

        <div className="space-y-3">
          {context ? (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Connect with Farcaster
            </button>
          ) : (
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
  );
}
