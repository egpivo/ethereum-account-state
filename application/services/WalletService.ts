import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { Token } from "../../domain/entities/Token.js";
import { StateTransition } from "../../domain/services/StateTransition.js";
import { StateQueryService } from "./StateQueryService.js";

/**
 * @application Service: WalletService
 * @description Application service for wallet operations (signing, sending transactions)
 *
 * Separation of concerns:
 * - Wallet: signing & transaction submission
 * - State: managed by smart contract
 * - Authority: determined by private key ownership
 *
 * Uses domain validation (StateTransition) to ensure off-chain rules match on-chain rules,
 * preventing wasted gas on invalid transactions.
 */
export class WalletService {
  private readonly stateQueryService: StateQueryService;

  constructor(
    private readonly provider: ethers.Provider,
    private readonly signer: ethers.Wallet,
    private readonly tokenAddress: Address
  ) {
    this.stateQueryService = new StateQueryService(provider);
  }

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
   * @throws Error if transaction wait times out or fails (tx.wait() returns null)
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

    const receipt = await tx.wait();

    // tx.wait() can return null if the transaction was dropped or wait times out
    // This violates the non-nullable return type, so we throw an error
    if (receipt === null) {
      throw new Error(
        `Transaction ${tx.hash} was dropped or wait timed out. Receipt is null.`
      );
    }

    return receipt;
  }

  /**
   * Execute a token transfer
   * @dev Uses domain validation (StateTransition) to ensure off-chain rules match on-chain rules
   */
  async transfer(
    to: Address,
    amount: Balance
  ): Promise<ethers.TransactionReceipt> {
    // Domain validation: ensure off-chain rules match on-chain rules
    // This prevents wasted gas on invalid transactions
    const from = this.getAddress();

    // Reconstruct current state from events for validation
    // Note: In production, you might want to cache this or use storage reads
    const currentToken =
      await this.stateQueryService.reconstructStateFromEvents(
        this.tokenAddress
      );

    const validation = StateTransition.validateTransfer(
      currentToken,
      from,
      to,
      amount
    );
    if (!validation.valid) {
      throw new Error(`Transfer validation failed: ${validation.reason}`);
    }

    const tokenInterface = new ethers.Interface([
      "function transfer(address to, uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("transfer", [
      to.getValue(),
      amount.getValue(),
    ]);

    return await this.sendTransaction(this.tokenAddress, data);
  }

  /**
   * Execute a token mint (if wallet has minting authority)
   * @dev Uses domain validation (StateTransition) to ensure off-chain rules match on-chain rules
   */
  async mint(to: Address, amount: Balance): Promise<ethers.TransactionReceipt> {
    // Domain validation: ensure off-chain rules match on-chain rules
    // Reconstruct current state for consistency with transfer() and burn()
    // While mint validation doesn't currently depend on existing balances, using
    // the actual current state ensures consistency and prevents future bugs if
    // mint validation rules change (e.g., max supply checks)
    const currentToken =
      await this.stateQueryService.reconstructStateFromEvents(
        this.tokenAddress
      );
    const validation = StateTransition.validateMint(currentToken, to, amount);
    if (!validation.valid) {
      throw new Error(`Mint validation failed: ${validation.reason}`);
    }

    const tokenInterface = new ethers.Interface([
      "function mint(address to, uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("mint", [
      to.getValue(),
      amount.getValue(),
    ]);

    return await this.sendTransaction(this.tokenAddress, data);
  }

  /**
   * Execute a token burn
   * @dev Uses domain validation (StateTransition) to ensure off-chain rules match on-chain rules
   */
  async burn(amount: Balance): Promise<ethers.TransactionReceipt> {
    // Domain validation: ensure off-chain rules match on-chain rules
    const currentToken =
      await this.stateQueryService.reconstructStateFromEvents(
        this.tokenAddress
      );
    const from = this.getAddress();

    const validation = StateTransition.validateBurn(currentToken, from, amount);
    if (!validation.valid) {
      throw new Error(`Burn validation failed: ${validation.reason}`);
    }

    const tokenInterface = new ethers.Interface([
      "function burn(uint256 amount) external",
    ]);

    const data = tokenInterface.encodeFunctionData("burn", [amount.getValue()]);

    return await this.sendTransaction(this.tokenAddress, data);
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
