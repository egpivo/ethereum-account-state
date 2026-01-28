

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";

// Token contract ABI (minimal - only functions we need)
// Note: transfer does not return bool (contract has no return value)
const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external",
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external",
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
  "event Mint(address indexed to, uint256 amount)",
  "event Burn(address indexed from, uint256 amount)",
];

// Get Etherscan URL based on chainId
// Returns '#' for unsupported chains to prevent incorrect links
function getEtherscanUrl(chainId: bigint, txHash: string): string {
  const chainIdNum = Number(chainId);

  // Mainnet
  if (chainIdNum === 1) {
    return `https://etherscan.io/tx/${txHash}`;
  }

  // Sepolia testnet (primary deployment target)
  if (chainIdNum === 11155111) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  // Local development
  if (chainIdNum === 31337) {
    return `#`;
  }

  // Unknown chain: return '#' to prevent incorrect mainnet links
  // Even if only demoing on Sepolia, this prevents wrong links if chainId detection fails
  return `#`;
}

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [totalSupply, setTotalSupply] = useState<string>("0");
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [mintTo, setMintTo] = useState<string>("");
  const [mintAmount, setMintAmount] = useState<string>("");
  const [burnAmount, setBurnAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [events, setEvents] = useState<
    Array<{
      type: string;
      from: string;
      to: string;
      amount: string;
      txHash: string;
      blockNumber: number;
      logIndex: number;
    }>
  >([]);
  const [eventBlockRange, setEventBlockRange] = useState<{
    fromBlock: number;
    toBlock: number;
    totalEvents: number;
  } | null>(null);

  function isEventLog(e: ethers.Log | ethers.EventLog): e is ethers.EventLog {
    return (e as ethers.EventLog).args !== undefined;
  }

  // Token address UX:
  // - Accept ?token=0x... URL param (shareable)
  // - Persist last used address in localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("token");
      const fromStorage = window.localStorage.getItem("tokenAddress");
      const candidate = (fromQuery || fromStorage || "").trim();
      if (candidate) {
        setTokenAddress(candidate);
      }
    } catch {
      // Ignore (e.g., storage disabled)
    }
  }, []);

  useEffect(() => {
    try {
      if (tokenAddress && tokenAddress.trim()) {
        window.localStorage.setItem("tokenAddress", tokenAddress.trim());
      }
    } catch {
      // Ignore
    }
  }, [tokenAddress]);

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        setError("Please install MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setChainId(network.chainId);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
  };

  // Switch account: Request permissions again to allow user to select a different account
  const switchAccount = async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        setError("Please install MetaMask");
        return;
      }

      // Request permissions again - this will prompt MetaMask to show account selection
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      // After permission request, get the new account
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setChainId(network.chainId);
      setError("");
    } catch (err: any) {
      // User rejected or cancelled
      if (err.code === 4001) {
        setError("Account switch cancelled");
      } else {
        setError(err.message || "Failed to switch account");
      }
    }
  };

  // Disconnect wallet: Clear app state
  // Note: MetaMask remembers authorization. To truly disconnect and allow account selection
  // on next connect, use "Switch Account" button instead, or disconnect in MetaMask's UI.
  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount("");
    setChainId(null);

    // Clear derived UI state (keep tokenAddress persisted for convenience)
    setBalance("0");
    setTotalSupply("0");
    setEvents([]);
    setEventBlockRange(null);
    setError("");
  };

  // Listen for MetaMask account/chain changes
  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected in MetaMask - clear app state
        setProvider(null);
        setSigner(null);
        setAccount("");
        setChainId(null);
        setBalance("0");
        setTotalSupply("0");
        setEvents([]);
        setEventBlockRange(null);
        setError("");
      } else if (accounts[0] !== account) {
        // User switched accounts in MetaMask - update UI
        setAccount(accounts[0]);
        if (provider) {
          provider.getSigner().then((signer) => {
            setSigner(signer);
          });
        }
      }
    };

    const handleChainChanged = () => {
      // Reload page on chain change to ensure clean state
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [account, provider]);

  // Validate address
  const validateAddress = (address: string): boolean => {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  };

  // Validate amount (must be a valid integer string)
  const validateAmount = (
    amount: string
  ): { valid: boolean; error?: string } => {
    if (!amount || amount.trim() === "") {
      return { valid: false, error: "Amount cannot be empty" };
    }
    // Check if it's a valid integer (no decimals)
    if (!/^\d+$/.test(amount.trim())) {
      return {
        valid: false,
        error: "Amount must be a whole number (no decimals)",
      };
    }
    try {
      BigInt(amount);
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid amount" };
    }
  };

  // Load balance
  const loadBalance = async () => {
    if (!provider || !tokenAddress || !account) return;

    // Validate token address
    if (!validateAddress(tokenAddress)) {
      setError("Invalid token contract address");
      return;
    }

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
      const [balance, supply] = await Promise.all([
        contract.balanceOf(account),
        contract.totalSupply(),
      ]);

      // Contract stores amounts as raw uint256 (no decimal scaling)
      // Display as-is without formatEther conversion
      setBalance(balance.toString());
      setTotalSupply(supply.toString());
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load balance");
    }
  };

  // Transfer tokens
  const handleTransfer = async () => {
    if (!signer || !tokenAddress || !transferTo || !transferAmount) {
      setError("Please fill in all fields");
      return;
    }

    // Validate addresses
    if (!validateAddress(tokenAddress)) {
      setError("Invalid token contract address");
      return;
    }
    if (!validateAddress(transferTo)) {
      setError("Invalid recipient address");
      return;
    }

    // Validate amount
    const amountValidation = validateAmount(transferAmount);
    if (!amountValidation.valid) {
      setError(amountValidation.error || "Invalid amount");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
      // Contract expects raw uint256 (no decimal scaling)
      // Convert string to BigInt directly, not parseEther (which multiplies by 10^18)
      const amount = BigInt(transferAmount);
      const tx = await contract.transfer(transferTo, amount);
      await tx.wait();

      setTransferTo("");
      setTransferAmount("");
      await loadBalance();
      await loadEvents();
      setError("");
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  // Mint tokens
  const handleMint = async () => {
    if (!signer || !tokenAddress || !mintTo || !mintAmount) {
      setError("Please fill in all fields");
      return;
    }

    // Validate addresses
    if (!validateAddress(tokenAddress)) {
      setError("Invalid token contract address");
      return;
    }
    if (!validateAddress(mintTo)) {
      setError("Invalid recipient address");
      return;
    }

    // Validate amount
    const amountValidation = validateAmount(mintAmount);
    if (!amountValidation.valid) {
      setError(amountValidation.error || "Invalid amount");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
      // Contract expects raw uint256 (no decimal scaling)
      const amount = BigInt(mintAmount);
      const tx = await contract.mint(mintTo, amount);
      await tx.wait();

      setMintTo("");
      setMintAmount("");
      await loadBalance();
      await loadEvents();
      setError("");
    } catch (err: any) {
      setError(err.message || "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  // Burn tokens
  const handleBurn = async () => {
    if (!signer || !tokenAddress || !burnAmount) {
      setError("Please fill in amount");
      return;
    }

    // Validate token address
    if (!validateAddress(tokenAddress)) {
      setError("Invalid token contract address");
      return;
    }

    // Validate amount
    const amountValidation = validateAmount(burnAmount);
    if (!amountValidation.valid) {
      setError(amountValidation.error || "Invalid amount");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
      // Contract expects raw uint256 (no decimal scaling)
      const amount = BigInt(burnAmount);
      const tx = await contract.burn(amount);
      await tx.wait();

      setBurnAmount("");
      await loadBalance();
      await loadEvents();
      setError("");
    } catch (err: any) {
      setError(err.message || "Burn failed");
    } finally {
      setLoading(false);
    }
  };

  // Load events
  const loadEvents = async () => {
    if (!provider || !tokenAddress) return;

    // Validate token address
    if (!validateAddress(tokenAddress)) {
      return;
    }

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks

      const [mintEvents, transferEvents, burnEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Mint(), fromBlock),
        contract.queryFilter(contract.filters.Transfer(), fromBlock),
        contract.queryFilter(contract.filters.Burn(), fromBlock),
      ]);

      const mintEventLogs = mintEvents.filter(isEventLog);
      const transferEventLogs = transferEvents.filter(isEventLog);
      const burnEventLogs = burnEvents.filter(isEventLog);

      // Deduplicate burn events: Contract emits both Burn and Transfer(..., address(0), ...) for burns
      // Canonical event source: Transfer(..., address(0), ...) is the ERC20 standard burn signal
      // Strategy: Show Transfer(..., address(0), ...) as "Burn", skip explicit Burn events from same transaction
      // This matches the backend reconstruction logic and prevents duplicate display
      const burnTxHashes = new Set<string>();
      for (const e of transferEventLogs) {
        if (e.args.to === ethers.ZeroAddress) {
          burnTxHashes.add(e.transactionHash);
        }
      }

      // Contract stores amounts as raw uint256 (no decimal scaling)
      // Display as-is without formatEther conversion
      const allEvents = [
        ...mintEventLogs.map((e) => ({
          type: "Mint",
          from: "N/A",
          to: e.args.to,
          amount: e.args.amount.toString(),
          txHash: e.transactionHash,
          blockNumber: e.blockNumber,
          logIndex: e.index !== null ? Number(e.index) : 0,
        })),
        ...transferEventLogs.map((e) => {
          // Transfer(..., address(0), ...) is the canonical burn signal (ERC20 standard)
          // Display it as "Burn" type to match user expectations
          const isBurn = e.args.to === ethers.ZeroAddress;
          return {
            type: isBurn ? "Burn" : "Transfer",
            from: e.args.from,
            to: isBurn ? "0x0000...0000" : e.args.to,
            amount: e.args.amount.toString(),
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            logIndex: e.index !== null ? Number(e.index) : 0,
          };
        }),
        // Skip explicit Burn events if the transaction has Transfer(..., address(0), ...)
        // This prevents duplicate display: both events represent the same burn operation
        // Fallback: Only show Burn events if Transfer(..., address(0), ...) is missing (shouldn't happen)
        ...burnEventLogs
          .filter((e) => !burnTxHashes.has(e.transactionHash))
          .map((e) => ({
            type: "Burn",
            from: e.args.from,
            to: "0x0000...0000",
            amount: e.args.amount.toString(),
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            logIndex: e.index !== null ? Number(e.index) : 0,
          })),
      ]
        // Sort by blockNumber (descending), then by logIndex (descending) for chronological order
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) {
            return b.blockNumber - a.blockNumber;
          }
          return b.logIndex - a.logIndex;
        });

      const displayedEvents = allEvents.slice(0, 20); // Last 20 events
      setEvents(displayedEvents);

      // Store block range info for display
      setEventBlockRange({
        fromBlock: Number(fromBlock),
        toBlock: Number(currentBlock),
        totalEvents: allEvents.length,
      });
    } catch (err: any) {
      console.error("Failed to load events:", err);
      setEventBlockRange(null);
    }
  };

  // Listen for MetaMask account/chain changes
  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected in MetaMask
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // User switched accounts in MetaMask
        setAccount(accounts[0]);
        if (provider) {
          provider.getSigner().then((signer) => {
            setSigner(signer);
          });
        }
      }
    };

    const handleChainChanged = () => {
      // Reload page on chain change to ensure clean state
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [account, provider]);

  // Auto-load balance when account or token address changes
  useEffect(() => {
    if (provider && tokenAddress && account) {
      loadBalance();
      loadEvents();
    }
  }, [provider, tokenAddress, account]);

  return (
    <div className="app">
      <header className="header">
        <h1>Ethereum Account State</h1>
        <p>Token & Wallet Interface</p>
      </header>

      <main className="main">
        {!account ? (
          <div className="connect-section">
            <button onClick={connectWallet} className="btn btn-primary">
              Connect Wallet
            </button>
            {error && <div className="error">{error}</div>}
          </div>
        ) : (
          <>
            <div className="wallet-info">
              <p>
                <strong>Connected:</strong> {account.slice(0, 6)}...
                {account.slice(-4)}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  onClick={switchAccount}
                  className="btn btn-secondary"
                >
                  Switch Account
                </button>
                <button
                  onClick={disconnectWallet}
                  className="btn btn-secondary"
                >
                  Disconnect
                </button>
              </div>
            </div>

            <div className="section">
              <h2>Token Contract</h2>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Token contract address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="input"
                />
                <button onClick={loadBalance} className="btn btn-secondary">
                  Load
                </button>
              </div>
            </div>

            {tokenAddress && (
              <>
                <div className="section">
                  <h2>Balance</h2>
                  <div className="balance-display">
                    <div>
                      <p className="label">Your Balance</p>
                      <p className="value">{balance} tokens</p>
                    </div>
                    <div>
                      <p className="label">Total Supply</p>
                      <p className="value">{totalSupply} tokens</p>
                    </div>
                  </div>
                  <button onClick={loadBalance} className="btn btn-secondary">
                    Refresh
                  </button>
                </div>

                <div className="section">
                  <h2>Transfer</h2>
                  <div className="form">
                    <input
                      type="text"
                      placeholder="Recipient address"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="Amount"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="input"
                    />
                    <button
                      onClick={handleTransfer}
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? "Processing..." : "Transfer"}
                    </button>
                  </div>
                </div>

                <div className="section">
                  <h2>Mint</h2>
                  <div className="form">
                    <input
                      type="text"
                      placeholder="Recipient address"
                      value={mintTo}
                      onChange={(e) => setMintTo(e.target.value)}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="Amount"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      className="input"
                    />
                    <button
                      onClick={handleMint}
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? "Processing..." : "Mint"}
                    </button>
                  </div>
                </div>

                <div className="section">
                  <h2>Burn</h2>
                  <div className="form">
                    <input
                      type="text"
                      placeholder="Amount"
                      value={burnAmount}
                      onChange={(e) => setBurnAmount(e.target.value)}
                      className="input"
                    />
                    <button
                      onClick={handleBurn}
                      disabled={loading}
                      className="btn btn-danger"
                    >
                      {loading ? "Processing..." : "Burn"}
                    </button>
                  </div>
                </div>

                <div className="section">
                  <h2>Recent Events</h2>
                  {eventBlockRange && (
                    <div
                      style={{
                        padding: "0.75rem",
                        marginBottom: "1rem",
                        background: "#fff3cd",
                        border: "1px solid #ffc107",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        color: "#856404",
                      }}
                    >
                      <strong>Note:</strong> Showing events from blocks{" "}
                      {eventBlockRange.fromBlock.toLocaleString()} to{" "}
                      {eventBlockRange.toBlock.toLocaleString()} (
                      {eventBlockRange.toBlock - eventBlockRange.fromBlock + 1}{" "}
                      blocks, ~
                      {Math.round(
                        (eventBlockRange.toBlock -
                          eventBlockRange.fromBlock +
                          1) /
                          12
                      )}{" "}
                      hours on Ethereum).
                      {eventBlockRange.totalEvents > 20 && (
                        <span>
                          {" "}
                          Displaying last 20 of {
                            eventBlockRange.totalEvents
                          }{" "}
                          events found.
                        </span>
                      )}
                      {eventBlockRange.totalEvents === 0 && (
                        <span> No events found in this range.</span>
                      )}
                    </div>
                  )}
                  <div className="events-list">
                    {events.length === 0 ? (
                      <p>No events found</p>
                    ) : (
                      events.map((event, idx) => (
                        <div key={idx} className="event-item">
                          <span className="event-type">{event.type}</span>
                          <span>
                            From: {event.from.slice(0, 6)}...
                            {event.from.slice(-4)}
                          </span>
                          <span>
                            To: {event.to.slice(0, 6)}...{event.to.slice(-4)}
                          </span>
                          <span>{event.amount} tokens</span>
                          <a
                            href={
                              chainId
                                ? getEtherscanUrl(chainId, event.txHash)
                                : "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-link"
                            onClick={(e) => {
                              const url = chainId
                                ? getEtherscanUrl(chainId, event.txHash)
                                : "#";
                              // Disable link if URL is '#' (unsupported chain or local network)
                              if (url === "#") {
                                e.preventDefault();
                              }
                            }}
                          >
                            View
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {error && <div className="error">{error}</div>}
          </>
        )}
      </main>
    </div>
  );
}

export default App;