import React from "react";
import { BoxArrowDownIcon } from "@phosphor-icons/react";
import { useUserProfile } from "../hooks/useUserProfile";

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

interface ActivityTileProps {
  request: FundRequestItem;
  isWalletConnected: boolean;
  payingRequestId: string | null;
  denyingRequestId: string | null;
  paymentStep: string | null;
  onPayRequest: (request: FundRequestItem) => void;
  onDenyRequest: (requestId: string) => void;
  onShowWalletConfigurePopup: () => void;
}

export default function ActivityTile({
  request,
  isWalletConnected,
  payingRequestId,
  denyingRequestId,
  paymentStep,
  onPayRequest,
  onDenyRequest,
  onShowWalletConfigurePopup,
}: ActivityTileProps) {
  const { profile, loading } = useUserProfile(request.sender.fid);

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className="flex items-start space-x-2">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile?.pfpUrl && !loading ? (
            <img
              src={profile.pfpUrl}
              alt={`${request.sender.username} profile`}
              className="w-10 h-10 rounded-full object-cover border border-gray-100"
              onError={(e) => {
                // Fallback to default avatar if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center ${
              profile?.pfpUrl && !loading ? "hidden" : ""
            }`}
          >
            <div className="w-6 h-6 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Activity Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1.5 mb-1.5">
            <span className="text-sm font-medium text-gray-700">
              @{request.sender.username}
            </span>
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <BoxArrowDownIcon
                size={10}
                weight="fill"
                className="text-white"
              />
            </div>
            <span className="text-sm text-gray-600">requested payment of</span>
          </div>

          <div className="text-lg font-bold text-gray-900 mb-2">
            ${Number(request.amount).toFixed(2)}
            {request.overrideToken && (
              <span className="text-sm text-gray-500 font-normal ml-2">
                in {request.overrideToken}
              </span>
            )}
          </div>

          {request.note && (
            <div className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
              &ldquo;{request.note}&rdquo;
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (!isWalletConnected) {
                  onShowWalletConfigurePopup();
                  return;
                }
                onPayRequest(request);
              }}
              disabled={
                !isWalletConnected ||
                payingRequestId === request.id ||
                denyingRequestId === request.id
              }
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 ${
                !isWalletConnected
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : payingRequestId === request.id
                  ? "bg-orange-400 text-white cursor-not-allowed shadow-inner"
                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
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
                await onDenyRequest(request.id);
              }}
              disabled={
                payingRequestId === request.id ||
                denyingRequestId === request.id
              }
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 ${
                denyingRequestId === request.id
                  ? "bg-gray-400 text-white cursor-not-allowed shadow-inner"
                  : "bg-gray-600 text-white hover:bg-gray-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              }`}
            >
              {denyingRequestId === request.id ? "Processing..." : "Deny"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
