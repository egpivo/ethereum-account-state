import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { Token } from "../../domain/entities/Token.js";

/**
 * @application Service: StateQueryService
 * @description Application service for querying on-chain state
 * 
 * Demonstrates understanding of:
 * - Storage state (direct reads)
 * - Historical state (event-based reconstruction)
 */
export class StateQueryService {
  constructor(private readonly provider: ethers.Provider) {}

  /**
   * Query ETH balance (eth_getBalance)
   */
  async getEthBalance(address: Address): Promise<Balance> {
    const balance = await this.provider.getBalance(address.getValue());
    return Balance.from(balance);
  }

  /**
   * Query token balance via eth_call
   */
  async getTokenBalance(
    tokenAddress: Address,
    accountAddress: Address
  ): Promise<Balance> {
    const tokenInterface = new ethers.Interface([
      "function balanceOf(address account) external view returns (uint256)",
    ]);

    const data = tokenInterface.encodeFunctionData("balanceOf", [
      accountAddress.getValue(),
    ]);

    const result = await this.provider.call({
      to: tokenAddress.getValue(),
      data,
    });

    const decoded = tokenInterface.decodeFunctionResult("balanceOf", result);
    return Balance.from(decoded[0]);
  }

  /**
   * Query total supply via eth_call
   */
  async getTotalSupply(tokenAddress: Address): Promise<Balance> {
    const tokenInterface = new ethers.Interface([
      "function totalSupply() external view returns (uint256)",
    ]);

    const data = tokenInterface.encodeFunctionData("totalSupply", []);

    const result = await this.provider.call({
      to: tokenAddress.getValue(),
      data,
    });

    const decoded = tokenInterface.decodeFunctionResult("totalSupply", result);
    return Balance.from(decoded[0]);
  }

  /**
   * Reconstruct token state from events (historical state)
   */
  async reconstructStateFromEvents(
    tokenAddress: Address,
    fromBlock: number = 0
  ): Promise<Token> {
    const token = Token.create(tokenAddress);
    const tokenInterface = new ethers.Interface([
      "event Mint(address indexed to, uint256 amount)",
      "event Transfer(address indexed from, address indexed to, uint256 amount)",
      "event Burn(address indexed from, uint256 amount)",
    ]);

    const currentBlock = await this.provider.getBlockNumber();
    const filter = {
      address: tokenAddress.getValue(),
      fromBlock,
      toBlock: currentBlock,
    };

    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      try {
        const parsed = tokenInterface.parseLog(log);

        if (parsed?.name === "Mint") {
          const to = Address.from(parsed.args.to);
          const amount = Balance.from(parsed.args.amount);
          token.mint(to, amount);
        } else if (parsed?.name === "Transfer") {
          const from = Address.from(parsed.args.from);
          const to = Address.from(parsed.args.to);
          const amount = Balance.from(parsed.args.amount);
          token.transfer(from, to, amount);
        } else if (parsed?.name === "Burn") {
          const from = Address.from(parsed.args.from);
          const amount = Balance.from(parsed.args.amount);
          token.burn(from, amount);
        }
      } catch (error) {
        // Skip unparseable logs
        console.warn(`Failed to parse log: ${log.transactionHash}`, error);
      }
    }

    return token;
  }

  /**
   * Compare storage state vs derived state (for verification)
   */
  async compareState(
    tokenAddress: Address,
    accountAddress: Address
  ): Promise<{
    storageBalance: Balance;
    derivedBalance: Balance;
    match: boolean;
  }> {
    const storageBalance = await this.getTokenBalance(
      tokenAddress,
      accountAddress
    );

    // Reconstruct from events
    const reconstructedToken = await this.reconstructStateFromEvents(
      tokenAddress
    );
    const derivedBalance = reconstructedToken.getBalance(accountAddress);

    return {
      storageBalance,
      derivedBalance,
      match: storageBalance.equals(derivedBalance),
    };
  }
}
