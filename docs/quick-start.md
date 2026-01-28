# 快速開始指南

## 本地開發完整流程

### 1. 啟動 Anvil

```bash
anvil
```

保持這個終端運行。

### 2. 部署合約

在另一個終端：

```bash
make deploy-local
```

記下部署的合約地址（例如：`0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`）

### 3. 配置 MetaMask

1. 添加網絡：
   - Network Name: `Anvil Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. 導入測試賬戶（使用 Anvil 輸出的私鑰）

3. 切換到 "Anvil Local" 網絡

### 4. 啟動前端

```bash
cd frontend
npm run dev
```

### 5. 使用應用

1. **連接錢包**：點擊 "Connect Wallet"
2. **輸入合約地址**：在 "Token Contract" 輸入框中輸入部署的合約地址
3. **載入餘額**：點擊 "Load" 按鈕
4. **Mint 代幣**：
   - 在 "Mint" 區塊輸入接收地址和數量
   - 點擊 "Mint" 並在 MetaMask 中確認
5. **查看餘額**：再次點擊 "Load" 查看更新後的餘額

## 常見問題

### 餘額顯示為 0

這是正常的！新部署的合約初始 `totalSupply` 為 0。你需要先 mint 一些代幣。

### 合約地址不正確

確保使用最新部署的合約地址。可以在 `broadcast/Deploy.s.sol/31337/run-latest.json` 文件中找到。

### 交易失敗

- 確認 MetaMask 連接到 "Anvil Local" 網絡（Chain ID 31337）
- 確認 Anvil 正在運行
- 檢查瀏覽器控制台的錯誤信息
