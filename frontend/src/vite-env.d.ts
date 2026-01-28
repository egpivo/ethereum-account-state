/// <reference types="vite/client" />

// Minimal typing for injected EIP-1193 provider (e.g., MetaMask).
// We keep this permissive because different wallets extend the object.
declare global {
  interface Window {
    ethereum?: any;
  }
}

export {};
