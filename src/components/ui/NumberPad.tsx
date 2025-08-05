"use client";

import { BackspaceIcon } from "@phosphor-icons/react";

interface NumberPadProps {
  amount: string;
  onAmountChange: (amount: string) => void;
}

export default function NumberPad({ amount, onAmountChange }: NumberPadProps) {
  const handleNumberInput = (num: string) => {
    // Convert "0.00" to "0" for easier handling
    const currentAmount = amount === "0.00" ? "0" : amount;

    if (num === "backspace") {
      // Remove the last character
      const newAmount = currentAmount.slice(0, -1);
      // If empty or just a decimal point, return "0"
      if (newAmount === "" || newAmount === ".") {
        onAmountChange("0");
      } else {
        onAmountChange(newAmount);
      }
    } else if (num === ".") {
      // Only add decimal if it doesn't already exist
      if (!currentAmount.includes(".")) {
        onAmountChange(currentAmount + ".");
      }
    } else {
      // Handle number input
      let newAmount = currentAmount;

      // If current amount is "0" and we're not adding a decimal, replace it
      if (currentAmount === "0" && num !== ".") {
        newAmount = num;
      } else {
        // Check if we already have 2 decimal places
        if (currentAmount.includes(".")) {
          const [dollars, cents] = currentAmount.split(".");
          if (cents.length >= 2) {
            return; // Don't add more digits after 2 decimal places
          }
        }

        // Add the number
        newAmount = currentAmount + num;
      }

      onAmountChange(newAmount);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 py-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          onClick={() => handleNumberInput(num.toString())}
          className="w-16 h-14 flex items-center justify-center text-2xl font-normal text-black hover:bg-gray-50 transition-colors mx-auto rounded-full"
        >
          {num}
        </button>
      ))}
      <button
        onClick={() => handleNumberInput(".")}
        className="w-16 h-14 flex items-center justify-center text-2xl font-normal text-black hover:bg-gray-50 transition-colors mx-auto rounded-full"
      >
        •
      </button>
      <button
        onClick={() => handleNumberInput("0")}
        className="w-16 h-14 flex items-center justify-center text-2xl font-normal text-black hover:bg-gray-50 transition-colors mx-auto rounded-full"
      >
        0
      </button>
      <button
        onClick={() => handleNumberInput("backspace")}
        className="w-16 h-14 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors mx-auto"
      >
        <BackspaceIcon size={20} weight="fill" />
      </button>
    </div>
  );
}
