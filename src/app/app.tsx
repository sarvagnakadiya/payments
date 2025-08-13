"use client";

import { useAccount } from "wagmi";
import ConnectWallet from "../components/ConnectWallet";
import AppComponent from "../components/App";

export default function App() {
  const { isConnected } = useAccount();
  return isConnected ? <AppComponent /> : <ConnectWallet />;
}
