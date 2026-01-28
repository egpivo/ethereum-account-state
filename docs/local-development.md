# Local Development with Anvil

## 連接 MetaMask 到本地 Anvil 節點

### 1. 啟動 Anvil

```bash
anvil
```

Anvil 會在 `http://127.0.0.1:8545` 運行，Chain ID 為 `31337`。

### 2. 在 MetaMask 中添加本地網絡

1. 打開 MetaMask
2. 點擊網絡選擇器（通常顯示 "Ethereum Mainnet"）
3. 點擊 "Add Network" 或 "Add a network manually"
4. 填入以下信息：
   - **Network Name**: `Anvil Local`
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`
   - **Block Explorer URL**: (留空)

5. 點擊 "Save"

### 3. 導入測試賬戶到 MetaMask

Anvil 提供了 10 個預設測試賬戶，每個都有 10000 ETH。你可以導入任何一個：

1. 在 MetaMask 中，點擊右上角賬戶圖標
2. 選擇 "Import Account"
3. 選擇 "Private Key"
4. 貼上其中一個私鑰（從 Anvil 輸出中複製）：

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

5. 點擊 "Import"

**注意**：這些是測試私鑰，**永遠不要**在主網上使用！

### 4. 切換到 Anvil 網絡

在 MetaMask 中選擇 "Anvil Local" 網絡。

### 5. 部署合約（如果還沒部署）

```bash
npm run deploy:local
```

這會部署 Token 合約並輸出合約地址。

### 6. 啟動前端

```bash
cd frontend
npm install
npm run dev
```

### 7. 連接錢包

1. 打開前端應用（通常是 `http://localhost:5173`）
2. 點擊 "Connect Wallet"
3. MetaMask 會彈出，確認連接
4. 確保 MetaMask 連接到 "Anvil Local" 網絡（Chain ID 31337）

### 8. 使用應用

1. 在 "Token Contract" 輸入框中輸入部署的合約地址
2. 點擊 "Load" 查看餘額和總供應量
3. 現在可以進行 Transfer、Mint、Burn 等操作

## 常見問題

### MetaMask 顯示 "Unrecognized chain ID"

確保：
- Anvil 正在運行（`anvil` 命令沒有停止）
- MetaMask 中正確配置了 Chain ID `31337`
- RPC URL 是 `http://127.0.0.1:8545` 或 `http://localhost:8545`

### 交易失敗或無法連接

1. 檢查 Anvil 是否正在運行
2. 確認 MetaMask 連接到正確的網絡（Anvil Local）
3. 檢查瀏覽器控制台是否有錯誤信息

### 想要使用不同的測試賬戶

1. 在 MetaMask 中導入另一個私鑰（從 Anvil 輸出中選擇）
2. 或者使用 MetaMask 的 "Switch Account" 功能切換已導入的賬戶

## Anvil 預設賬戶

Anvil 提供以下測試賬戶（每個都有 10000 ETH）：

- Account 0: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Account 1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- Account 2: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
- ... (更多賬戶見 Anvil 輸出)

對應的私鑰也在 Anvil 啟動時顯示。
