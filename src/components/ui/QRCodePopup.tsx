"use client";

import { useState, useEffect, useRef } from "react";
import { XCircleIcon, CopyIcon, BoxArrowDownIcon } from "@phosphor-icons/react";
import { formatAmount } from "../../lib/utils";

import QRCodeStyling from "qr-code-styling";

interface QRCodePopupProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  username: string;
  // Requester info (the connected user creating the request)
  requesterFid?: number | string;
  requesterUsername?: string;
  requesterPfpUrl?: string;
  // Optional additional recipient metadata for better prefill UX
  recipient?: {
    fid?: number | string;
    name?: string;
    address?: string;
    avatar?: string;
  };
}

export default function QRCodePopup({
  isOpen,
  onClose,
  amount,
  username,
  requesterFid,
  requesterUsername,
  requesterPfpUrl,
  recipient,
}: QRCodePopupProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);

  // Generate a deep link containing payment details
  const paymentLink = (() => {
    const params = new URLSearchParams({
      pay: "1",
      amount: amount || "0",
      username: (requesterUsername || username || "").toString(),
    });
    const fidToEncode = requesterFid ?? recipient?.fid;
    if (fidToEncode !== undefined && fidToEncode !== null) {
      params.set("fid", String(fidToEncode));
    }
    const BASE = "https://farcaster.xyz/miniapps/5wCAaRVHcUM9/payments";
    return `${BASE}?${params.toString()}`;
  })();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleShareLink = () => {
    const recipientFid = recipient?.fid;
    if (!recipientFid) return;
    const url = `https://farcaster.xyz/~/inbox/create/${recipientFid}?text=${encodeURIComponent(
      paymentLink
    )}`;
    window.open(url, "_blank");
  };

  // Generate QR Code
  useEffect(() => {
    if (isOpen && qrRef.current && !qrCode.current) {
      qrCode.current = new QRCodeStyling({
        width: 224, // 56 * 4 = 224px
        height: 224,
        type: "svg",
        data: paymentLink,
        dotsOptions: {
          color: "#000000",
          type: "dots",
        },
        backgroundOptions: {
          color: "#FFFFFF",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 8,
          hideBackgroundDots: true,
          imageSize: 0.4,
        },
        cornersSquareOptions: {
          type: "extra-rounded",
          color: "#000000",
        },
        cornersDotOptions: {
          type: "dot",
          color: "#000000",
        },
      });

      qrCode.current.append(qrRef.current);
    }

    return () => {
      if (qrRef.current && qrCode.current) {
        qrRef.current.innerHTML = "";
        qrCode.current = null;
      }
    };
  }, [isOpen, paymentLink]);

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
        <div className="px-3 pb-3 space-y-3">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="w-56 h-56 bg-white rounded-lg flex items-center justify-center relative">
              <div
                ref={qrRef}
                className="w-full h-full flex items-center justify-center"
              />
              {/* Center Logo/Image with white background to prevent QR overlap */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  {requesterPfpUrl || recipient?.avatar ? (
                    <img
                      src={(requesterPfpUrl || recipient?.avatar) as string}
                      alt="Requester Avatar"
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">👤</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Amount (token removed; settlement uses preferred token) */}
          <div className="flex items-center justify-center">
            <div className="text-4xl font-bold text-black">
              ${formatAmount(amount)}
            </div>
          </div>

          {/* Payment Link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-gray-100 rounded-xl p-3">
              <span className="text-sm text-gray-600 truncate flex-1 mr-2">
                {paymentLink}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <CopyIcon size={16} weight="fill" className="text-white" />
              </button>
            </div>
            {copied && (
              <div className="text-center text-sm text-green-600">
                Link copied to clipboard!
              </div>
            )}
            <button
              onClick={handleShareLink}
              disabled={!recipient?.fid}
              className={`w-full py-3 rounded-xl font-semibold text-lg transition-all duration-200 ${
                recipient?.fid
                  ? "bg-black text-white hover:bg-gray-800 active:scale-95"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
              }`}
            >
              Share link
            </button>
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
