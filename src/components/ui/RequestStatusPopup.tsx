"use client";

import {
  ReceiptXIcon,
  BoxArrowDownIcon,
  XCircleIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import { formatAmount } from "../../lib/utils";

interface RequestStatusPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isSuccess: boolean;
  amount: string;
  selectedToken: string;
  username: string;
}

export default function RequestStatusPopup({
  isOpen,
  onClose,
  isSuccess,
  amount,
  selectedToken,
  username,
}: RequestStatusPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
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
        <div className="px-4 pb-6 text-center">
          {/* Status Icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="flex items-center justify-center">
                {isSuccess ? (
                  <SealCheckIcon
                    size={84}
                    weight="fill"
                    className="text-green-500"
                  />
                ) : (
                  <ReceiptXIcon
                    size={84}
                    weight="fill"
                    className="text-red-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sender Info */}
          <div className="bg-gray-100 rounded-full px-4 py-2 mb-4 inline-flex items-center">
            <span className="text-gray-500 mr-3 text-sm font-medium">
              From:
            </span>
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-xs">👤</span>
            </div>
            <span className="text-gray-500 text-sm">@{username}</span>
            <button className="ml-2 text-gray-400 hover:text-gray-600">
              <XCircleIcon size={16} weight="fill" />
            </button>
          </div>

          {/* Amount */}
          <div className="text-5xl font-light text-black mb-4">
            ${formatAmount(amount)}
          </div>

          {/* Currency */}
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 mb-4">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-xs font-bold">$</span>
            </div>
            <span className="text-black font-medium">{selectedToken}</span>
          </div>

          {/* Status Message */}
          <div
            className={`text-lg font-medium ${
              isSuccess ? "text-green-500" : "text-red-500"
            }`}
          >
            {isSuccess ? "Successfully sent" : "Request cancelled"}
          </div>
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
