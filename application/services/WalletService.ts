import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";

/**
 * @application Service: WalletService
 * @description Application service for wallet operations (signing, sending transactions)
 * 
 * Separation of concerns:
 * - Wallet: signing & transaction submission
 * - State: managed by smart contract
 * - Authority: determined by private key ownership
 */
export class WalletService {
  constructor(
    private readonly provider: ethers.Provider,
    private readonly signer: ethers.Wallet
  ) {}

  /**
   * Get the wallet address
   */
  getAddress(): Address {
    return Address.from(this.signer.address);
  }

  /**
   * Sign a transaction (without sending)
   */
  async signTransaction(
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<string> {
    const tx = {
      to: to.getValue(),
      data,
      value,
    };

    return await this.signer.signTransaction(tx);
  }

  /**
   * Send a transaction and wait for receipt
   */
  async sendTransaction(
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<ethers.TransactionReceipt> {
    const tx = await this.signer.sendTransaction({
      to: to.getValue(),
      data,
      value,
    });

    return await tx.wait();
  }

  /**
   * Execute a token transfer
   */
  async transfer(
    tokenAddress: Address,
    to: Address,
    amount: Balance
  ): Promise<ethers.TransactionReceipt> {
    const tokenInterface = new ethers.Interface([
      "function transfer(address to, uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("transfer", [
      to.getValue(),
      amount.getValue(),
    ]);

    return await this.sendTransaction(tokenAddress, data);
  }

  /**
   * Execute a token mint (if wallet has minting authority)
   */
  async mint(
    tokenAddress: Address,
    to: Address,
    amount: Balance
  ): Promise<ethers.TransactionReceipt> {
    const tokenInterface = new ethers.Interface([
      "function mint(address to, uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("mint", [
      to.getValue(),
      amount.getValue(),
    ]);

    return await this.sendTransaction(tokenAddress, data);
  }

  /**
   * Execute a token burn
   */
  async burn(
    tokenAddress: Address,
    amount: Balance
  ): Promise<ethers.TransactionReceipt> {
    const tokenInterface = new ethers.Interface([
      "function burn(uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("burn", [amount.getValue()]);

    return await this.sendTransaction(tokenAddress, data);
  }

  /**
   * Inspect transaction receipt for success/failure
   */
  static inspectReceipt(receipt: ethers.TransactionReceipt): {
    success: boolean;
    gasUsed: bigint;
    blockNumber: number;
    transactionHash: string;
    error?: string;
  } {
    return {
      success: receipt.status === 1,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.hash,
      error: receipt.status === 0 ? "Transaction reverted" : undefined,
    };
  }
}
