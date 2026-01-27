import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './App.css'

// Token contract ABI (minimal - only functions we need)
const TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function mint(address to, uint256 amount) external',
  'function burn(uint256 amount) external',
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
  'event Mint(address indexed to, uint256 amount)',
  'event Burn(address indexed from, uint256 amount)',
]

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [account, setAccount] = useState<string>('')
  const [tokenAddress, setTokenAddress] = useState<string>('')
  const [balance, setBalance] = useState<string>('0')
  const [totalSupply, setTotalSupply] = useState<string>('0')
  const [transferTo, setTransferTo] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  const [mintTo, setMintTo] = useState<string>('')
  const [mintAmount, setMintAmount] = useState<string>('')
  const [burnAmount, setBurnAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [events, setEvents] = useState<Array<{type: string, from: string, to: string, amount: string, txHash: string}>>([])

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        setError('Please install MetaMask')
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      
      setProvider(provider)
      setSigner(signer)
      setAccount(accounts[0])
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
    }
  }

  // Load balance
  const loadBalance = async () => {
    if (!provider || !tokenAddress || !account) return

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider)
      const [balance, supply] = await Promise.all([
        contract.balanceOf(account),
        contract.totalSupply(),
      ])
      
      setBalance(ethers.formatEther(balance))
      setTotalSupply(ethers.formatEther(supply))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load balance')
    }
  }

  // Transfer tokens
  const handleTransfer = async () => {
    if (!signer || !tokenAddress || !transferTo || !transferAmount) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer)
      const tx = await contract.transfer(transferTo, ethers.parseEther(transferAmount))
      await tx.wait()
      
      setTransferTo('')
      setTransferAmount('')
      await loadBalance()
      await loadEvents()
      setError('')
    } catch (err: any) {
      setError(err.message || 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  // Mint tokens
  const handleMint = async () => {
    if (!signer || !tokenAddress || !mintTo || !mintAmount) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer)
      const tx = await contract.mint(mintTo, ethers.parseEther(mintAmount))
      await tx.wait()
      
      setMintTo('')
      setMintAmount('')
      await loadBalance()
      await loadEvents()
      setError('')
    } catch (err: any) {
      setError(err.message || 'Mint failed')
    } finally {
      setLoading(false)
    }
  }

  // Burn tokens
  const handleBurn = async () => {
    if (!signer || !tokenAddress || !burnAmount) {
      setError('Please fill in amount')
      return
    }

    setLoading(true)
    setError('')

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer)
      const tx = await contract.burn(ethers.parseEther(burnAmount))
      await tx.wait()
      
      setBurnAmount('')
      await loadBalance()
      await loadEvents()
      setError('')
    } catch (err: any) {
      setError(err.message || 'Burn failed')
    } finally {
      setLoading(false)
    }
  }

  // Load events
  const loadEvents = async () => {
    if (!provider || !tokenAddress) return

    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider)
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 1000) // Last 1000 blocks

      const [mintEvents, transferEvents, burnEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Mint(), fromBlock),
        contract.queryFilter(contract.filters.Transfer(), fromBlock),
        contract.queryFilter(contract.filters.Burn(), fromBlock),
      ])

      const allEvents = [
        ...mintEvents.map((e: any) => ({
          type: 'Mint',
          from: 'N/A',
          to: e.args.to,
          amount: ethers.formatEther(e.args.amount),
          txHash: e.transactionHash,
        })),
        ...transferEvents.map((e: any) => ({
          type: 'Transfer',
          from: e.args.from,
          to: e.args.to,
          amount: ethers.formatEther(e.args.amount),
          txHash: e.transactionHash,
        })),
        ...burnEvents.map((e: any) => ({
          type: 'Burn',
          from: e.args.from,
          to: '0x0000...0000',
          amount: ethers.formatEther(e.args.amount),
          txHash: e.transactionHash,
        })),
      ].sort((a, b) => b.txHash.localeCompare(a.txHash))

      setEvents(allEvents.slice(0, 20)) // Last 20 events
    } catch (err: any) {
      console.error('Failed to load events:', err)
    }
  }

  // Auto-load balance when account or token address changes
  useEffect(() => {
    if (provider && tokenAddress && account) {
      loadBalance()
      loadEvents()
    }
  }, [provider, tokenAddress, account])

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
              <p><strong>Connected:</strong> {account.slice(0, 6)}...{account.slice(-4)}</p>
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
                      {loading ? 'Processing...' : 'Transfer'}
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
                      {loading ? 'Processing...' : 'Mint'}
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
                      {loading ? 'Processing...' : 'Burn'}
                    </button>
                  </div>
                </div>

                <div className="section">
                  <h2>Recent Events</h2>
                  <div className="events-list">
                    {events.length === 0 ? (
                      <p>No events found</p>
                    ) : (
                      events.map((event, idx) => (
                        <div key={idx} className="event-item">
                          <span className="event-type">{event.type}</span>
                          <span>From: {event.from.slice(0, 6)}...{event.from.slice(-4)}</span>
                          <span>To: {event.to.slice(0, 6)}...{event.to.slice(-4)}</span>
                          <span>{event.amount} tokens</span>
                          <a
                            href={`https://etherscan.io/tx/${event.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-link"
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
  )
}

export default App
