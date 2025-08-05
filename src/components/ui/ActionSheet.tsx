"use client";

import { BoxArrowDownIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPayClick: () => void;
  onRequestClick: () => void;
}

export default function ActionSheet({
  isOpen,
  onClose,
  onPayClick,
  onRequestClick,
}: ActionSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Action Sheet - positioned at bottom right where the plus button is */}
      <div
        className="absolute bottom-6 right-6 w-80 bg-black rounded-2xl shadow-lg p-5 transition-all duration-150"
        style={{
          animation: "morphFromButton 0.15s cubic-bezier(0.4,0,0.2,1)",
          transformOrigin: "bottom right",
        }}
      >
        <div className="w-full space-y-3">
          {/* Pay Option */}
          <div
            onClick={() => {
              onClose();
              onPayClick();
            }}
            className="bg-[#1F1F1F] rounded-xl p-4 flex items-center cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
              <PaperPlaneTiltIcon
                size={24}
                weight="fill"
                className="text-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-base">Pay</div>
              <div className="text-gray-400 text-sm">Send money to friends</div>
            </div>
          </div>

          {/* Request Option */}
          <div
            onClick={() => {
              onClose();
              onRequestClick();
            }}
            className="bg-[#1F1F1F] rounded-xl p-4 flex items-center cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
              <BoxArrowDownIcon
                size={24}
                weight="fill"
                className="text-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-base">Request</div>
              <div className="text-gray-400 text-sm">
                Ask for money from friends
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes morphFromButton {
          from {
            opacity: 0;
            transform: scale(0.1) translateY(0);
            border-radius: 50%;
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            border-radius: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
