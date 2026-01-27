import { ethers } from "ethers";

/**
 * @infrastructure EthereumProvider
 * @description Factory for creating Ethereum providers (local/testnet/mainnet)
 */
export class EthereumProvider {
  static createLocal(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider("http://localhost:8545");
  }

  static createTestnet(rpcUrl: string): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  static createFromUrl(rpcUrl: string): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(rpcUrl);
  }
}
