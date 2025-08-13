"use client";

import { useState } from "react";
import {
  CaretCircleDownIcon,
  CaretCircleUpIcon,
  XCircleIcon,
  BoxArrowDownIcon,
} from "@phosphor-icons/react";
import NumberPad from "./NumberPad";
import { formatAmount } from "../../lib/utils";
import QRCodePopup from "./QRCodePopup";
import RequestStatusPopup from "./RequestStatusPopup";
import {
  useFarcasterUserSearch,
  type FarcasterUser,
} from "../../hooks/useFarcasterUserSearch";
import { getTokensForChain } from "../../lib/tokens";

interface RequestPopupProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  selectedToken: string;
  onAmountChange: (amount: string) => void;
  onTokenChange: (token: string) => void;
  currentUserFid?: string | number;
}

export default function RequestPopup({
  isOpen,
  onClose,
  amount,
  selectedToken,
  onAmountChange,
  onTokenChange,
  currentUserFid,
}: RequestPopupProps) {
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<FarcasterUser | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [requestRecipient, setRequestRecipient] =
    useState<FarcasterUser | null>(null);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestToken, setRequestToken] = useState("");

  const { users, isSearching, searchQuery, setSearchQuery, clearSearch } =
    useFarcasterUserSearch();

  // Get tokens for Base chain (you can make this dynamic based on selected chain)
  const tokenOptions = getTokensForChain(8453).map((token) => ({
    symbol: token.symbol,
    name: token.name,
    icon: token.icon,
  }));

  const filteredRecipients = users;

  const handleCreateLink = () => {
    if (selectedRecipient && parseFloat(amount) > 0) {
      setShowQRCode(true);
    }
  };

  const handleRequest = async () => {
    if (!selectedRecipient || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/fund-requests/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderFid: String(currentUserFid || ""),
          receiverFid: String(selectedRecipient.fid),
          amount: parseFloat(amount),
          overrideChain: null, // Use user's preferred chain
          overrideToken: selectedToken,
          overrideAddress: null, // Use user's preferred address
          note: note.trim() || null,
          expiresAt: null, // No expiration for now
        }),
      });

      if (response.ok) {
        // Store request data before resetting form
        setRequestRecipient(selectedRecipient);
        setRequestAmount(amount);
        setRequestToken(selectedToken);
        setIsRequestSuccess(true);
        setShowStatusPopup(true);
        // Reset form
        setSelectedRecipient(null);
        onAmountChange("0");
        setNote("");
        clearSearch();
        // Close popup after a short delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const error = await response.json();
        console.error("Failed to create request:", error);
        // Store request data for error case too
        setRequestRecipient(selectedRecipient);
        setRequestAmount(amount);
        setRequestToken(selectedToken);
        setIsRequestSuccess(false);
        setShowStatusPopup(true);
      }
    } catch (error) {
      console.error("Error creating request:", error);
      // Store request data for error case too
      setRequestRecipient(selectedRecipient);
      setRequestAmount(amount);
      setRequestToken(selectedToken);
      setIsRequestSuccess(false);
      setShowStatusPopup(true);
    } finally {
      setIsSubmitting(false);
    }
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
          onClose();
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
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <BoxArrowDownIcon
                size={20}
                weight="fill"
                className="text-white"
              />
            </div>
            <span className="text-xl font-semibold text-black">Request</span>
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
                  From:
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
            <div className="text-5xl font-light text-black">
              ${formatAmount(amount)}
            </div>
          </div>

          {/* Token Selector */}
          <div className="relative flex justify-center">
            <div
              className={`bg-gray-100 rounded-full p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
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
                  size={16}
                  weight="fill"
                  className="text-gray-400 ml-2"
                />
              ) : (
                <CaretCircleDownIcon
                  size={16}
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

          {/* Note Input */}
          <div className="bg-gray-100 rounded-xl p-3">
            <input
              type="text"
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-transparent text-sm text-black placeholder-gray-400 focus:outline-none"
              maxLength={100}
            />
          </div>

          {/* Number Pad */}
          <NumberPad amount={amount} onAmountChange={onAmountChange} />

          {/* Request Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCreateLink}
              disabled={
                !selectedRecipient || parseFloat(amount) <= 0 || isSubmitting
              }
              className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-all duration-200 ${
                selectedRecipient && parseFloat(amount) > 0 && !isSubmitting
                  ? "bg-black text-white hover:bg-gray-600 active:scale-95"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
              }`}
            >
              Create Link
            </button>
            <button
              onClick={handleRequest}
              disabled={
                !selectedRecipient || parseFloat(amount) <= 0 || isSubmitting
              }
              className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-all duration-200 ${
                selectedRecipient && parseFloat(amount) > 0 && !isSubmitting
                  ? "bg-green-500 text-white hover:bg-green-600 active:scale-95"
                  : "bg-green-200 text-green-400 cursor-not-allowed opacity-60"
              }`}
            >
              {isSubmitting ? "Requesting..." : "Request"}
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Popup */}
      <QRCodePopup
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        amount={amount}
        selectedToken={selectedToken}
        username={selectedRecipient?.username || ""}
      />

      {/* Request Status Popup */}
      <RequestStatusPopup
        isOpen={showStatusPopup}
        onClose={() => {
          setShowStatusPopup(false);
          setRequestRecipient(null); // Clear stored recipient data
          setRequestAmount(""); // Clear stored amount
          setRequestToken(""); // Clear stored token
        }}
        isSuccess={isRequestSuccess}
        amount={requestAmount || amount}
        selectedToken={requestToken || selectedToken}
        username={requestRecipient?.username || ""}
        profileImage={requestRecipient?.avatar || ""}
      />

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
