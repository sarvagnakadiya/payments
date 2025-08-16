"use client";

import React from "react";
import AddressIcon from "../components/AddressIcon";

interface AddressAvatarProps {
  address: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { containerSize: "w-6 h-6", blockieSize: 6, scale: 3 },
  md: { containerSize: "w-10 h-10", blockieSize: 8, scale: 4 },
  lg: { containerSize: "w-16 h-16", blockieSize: 12, scale: 5 },
};

export function AddressAvatar({
  address,
  size = "md",
  className = "",
}: AddressAvatarProps) {
  const { containerSize, blockieSize, scale } = sizeMap[size];

  return (
    <div
      className={`${containerSize} rounded-full overflow-hidden ${className}`}
    >
      <AddressIcon
        address={address}
        size={blockieSize}
        scale={scale}
        className="w-full h-full"
      />
    </div>
  );
}
