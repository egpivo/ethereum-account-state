/**
 * @example Usage Example
 * @description Demonstrates how to use the DDD-based token and wallet system
 */

import { ethers } from "ethers";
import { Address, Balance } from "../domain/index.js";
import { WalletService, StateQueryService } from "../application/index.js";
import { EthereumProvider } from "../infrastructure/index.js";

async function main() {
  // ============ Setup ============
  
  // Create provider (use local anvil for development)
  const provider = EthereumProvider.createLocal();
  
  // Create wallet from private key
  const privateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil default
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Token contract address (deploy first using Deploy.s.sol)
  const tokenAddress = Address.from(process.env.TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3");
  
  // Initialize services (WalletService now requires tokenAddress for domain validation)
  const walletService = new WalletService(provider, wallet, tokenAddress);
  const stateQueryService = new StateQueryService(provider);
  
  console.log("Wallet address:", walletService.getAddress().getValue());
  console.log("Token address:", tokenAddress.getValue());
  
  // ============ Query State ============
  
  console.log("\n=== Querying State ===");
  
  // Query ETH balance
  const ethBalance = await stateQueryService.getEthBalance(walletService.getAddress());
  console.log("ETH Balance:", ethBalance.toString());
  
  // Query token balance
  const tokenBalance = await stateQueryService.getTokenBalance(
    tokenAddress,
    walletService.getAddress()
  );
  console.log("Token Balance:", tokenBalance.toString());
  
  // Query total supply
  const totalSupply = await stateQueryService.getTotalSupply(tokenAddress);
  console.log("Total Supply:", totalSupply.toString());
  
  // ============ Execute Transfer ============
  
  console.log("\n=== Executing Transfer ===");
  
  const recipient = Address.from("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"); // Anvil account #1
  const transferAmount = Balance.from(100n);
  
  console.log(`Transferring ${transferAmount.toString()} tokens to ${recipient.getValue()}`);
  
  try {
    const receipt = await walletService.transfer(
      recipient,
      transferAmount
    );
    
    const inspection = WalletService.inspectReceipt(receipt);
    console.log("Transaction:", inspection.transactionHash);
    console.log("Success:", inspection.success);
    console.log("Gas Used:", inspection.gasUsed.toString());
    
    // Verify state change
    const newBalance = await stateQueryService.getTokenBalance(
      tokenAddress,
      walletService.getAddress()
    );
    console.log("New Balance:", newBalance.toString());
    
  } catch (error) {
    console.error("Transfer failed:", error);
  }
  
  // ============ Reconstruct State from Events ============
  
  console.log("\n=== Reconstructing State from Events ===");
  
  try {
    const reconstructedToken = await stateQueryService.reconstructStateFromEvents(
      tokenAddress
    );
    
    console.log("Reconstructed Total Supply:", reconstructedToken.getTotalSupply().toString());
    console.log("Reconstructed Balance:", reconstructedToken.getBalance(walletService.getAddress()).toString());
    
    // Verify invariant
    const invariantHolds = reconstructedToken.verifyInvariant();
    console.log("Invariant holds:", invariantHolds);
    
  } catch (error) {
    console.error("Reconstruction failed:", error);
  }
  
  // ============ Compare Storage vs Derived State ============
  
  console.log("\n=== Comparing Storage vs Derived State ===");
  
  try {
    const comparison = await stateQueryService.compareState(
      tokenAddress,
      walletService.getAddress()
    );
    
    console.log("Storage Balance:", comparison.storageBalance.toString());
    console.log("Derived Balance:", comparison.derivedBalance.toString());
    console.log("Match:", comparison.match);
    
  } catch (error) {
    console.error("Comparison failed:", error);
  }
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
