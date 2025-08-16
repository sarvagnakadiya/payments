"use client";

import { useRef, useEffect } from "react";
import blockies from "ethereum-blockies";

interface AddressIconProps {
  address: string;
  size?: number;
  scale?: number;
  className?: string;
}

export default function AddressIcon({
  address,
  size = 8,
  scale = 4,
  className = "",
}: AddressIconProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && address) {
      const icon = blockies.create({
        seed: address.toLowerCase(),
        size,
        scale,
      });
      ref.current.innerHTML = ""; // clear old
      ref.current.appendChild(icon); // attach canvas
    }
  }, [address, size, scale]);

  return <span ref={ref} className={className} />;
}
