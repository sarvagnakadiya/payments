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

interface RequestPopupProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  selectedToken: string;
  onAmountChange: (amount: string) => void;
  onTokenChange: (token: string) => void;
}

export default function RequestPopup({
  isOpen,
  onClose,
  amount,
  selectedToken,
  onAmountChange,
  onTokenChange,
}: RequestPopupProps) {
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(true);

  // Sample recipient suggestions
  const recipientSuggestions = [
    { name: "John Doe", address: "0x1234...5678", avatar: "🧑‍💼" },
    { name: "Alice Smith", address: "0xabcd...efgh", avatar: "👩‍💻" },
    { name: "Bob Wilson", address: "0x9876...4321", avatar: "👨‍🎨" },
  ];

  // Sample token options
  const tokenOptions = [
    { symbol: "USDC", name: "USD Coin", icon: "💵" },
    { symbol: "ETH", name: "Ethereum", icon: "⟠" },
    { symbol: "BTC", name: "Bitcoin", icon: "₿" },
  ];

  const filteredRecipients = recipientSuggestions.filter((recipient) =>
    recipient.name.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  const handleCreateLink = () => {
    if (selectedRecipient && parseFloat(amount) > 0) {
      setShowQRCode(true);
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
                  value={selectedRecipient || recipientSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRecipientSearch(value);
                    setSelectedRecipient(""); // Clear selection when typing
                    setShowRecipientDropdown(true);
                  }}
                  onFocus={() => setShowRecipientDropdown(true)}
                  className="bg-transparent text-sm font-medium text-black placeholder-gray-400 focus:outline-none min-w-0"
                  style={{
                    width: selectedRecipient
                      ? `${selectedRecipient.length * 8 + 8}px`
                      : "auto",
                  }}
                />
                {selectedRecipient && (
                  <button
                    onClick={() => {
                      setSelectedRecipient("");
                      setRecipientSearch("");
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
            {showRecipientDropdown &&
              (selectedRecipient || recipientSearch) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10">
                  <div className="max-h-32 overflow-y-auto">
                    {filteredRecipients.map((recipient) => (
                      <button
                        key={recipient.name}
                        onClick={() => {
                          setSelectedRecipient(recipient.name);
                          setRecipientSearch("");
                          setShowRecipientDropdown(false);
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 flex items-center"
                      >
                        <span className="text-2xl mr-3">
                          {recipient.avatar}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-black">
                            {recipient.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {recipient.address}
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredRecipients.length === 0 && recipientSearch && (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No recipients found
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

          {/* Number Pad */}
          <NumberPad amount={amount} onAmountChange={onAmountChange} />

          {/* Request Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCreateLink}
              disabled={!selectedRecipient || parseFloat(amount) <= 0}
              className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-colors ${
                selectedRecipient && parseFloat(amount) > 0
                  ? "bg-black text-white hover:bg-gray-600"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Create Link
            </button>
            <button
              onClick={() => {
                // Simulate request - you can replace this with actual API call
                const success = Math.random() > 0.3; // 70% success rate for demo
                setIsRequestSuccess(success);
                setShowStatusPopup(true);
              }}
              disabled={!selectedRecipient || parseFloat(amount) <= 0}
              className={`flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-green-600 transition-colors ${
                selectedRecipient && parseFloat(amount) > 0
                  ? ""
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Request
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
        username={selectedRecipient}
      />

      {/* Request Status Popup */}
      <RequestStatusPopup
        isOpen={showStatusPopup}
        onClose={() => setShowStatusPopup(false)}
        isSuccess={isRequestSuccess}
        amount={amount}
        selectedToken={selectedToken}
        username={selectedRecipient}
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
