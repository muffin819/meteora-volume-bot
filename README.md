# Meteora Volume Bot

## 🚀 Overview
The **Meteora Volume Bot** is an advanced trading automation tool designed to **distribute SOL to multiple wallets** and execute **endless buy and sell swaps** on the **Raydium platform**. Utilizing Solana's blockchain infrastructure, this bot enhances market activity while ensuring seamless operations with **Jupiter V6 swap aggregator**.

---

## 🔧 Key Differences: Updated Version vs. Previous Version

### ❌ Previous Version's Issues:
- **Repetitive Buy & Sell from One Wallet** – Transactions were easily traceable, making it obvious that the same wallets were being used repeatedly.
- **No Increase in Pool Makers** – Only boosted volume without adding new liquidity makers.
- **Inefficient Token Collection** – Tokens were accumulated without being sold before collection, leaving unnecessary token balances.
- **Equal Buys & Sells** – Created sell pressure by always selling at the end of a volume cycle.

### ✅ Improvements in the Updated Version:
- **Dynamic Wallet Usage** – Transfers SOL to a newly created wallet after each buy/sell cycle, preventing repetitive wallet tracking.
- **Increased Maker Participation** – Generates new wallets per trading round, expanding the number of liquidity makers.
- **Optimized Collection Process** – Sells leftover tokens before gathering SOL to the main wallet (reclaiming token account rent of **0.00203 SOL**).
- **More Buys than Sells** – Implements random double-buy logic before selling, generating stronger **buy pressure**.

---

## 🌟 Core Features

🔹 **Automated SOL Distribution** – Seamlessly distributes SOL to new wallets for decentralized execution.
🔹 **Continuous Buy & Sell Swaps** – Executes **simultaneous buy and sell transactions** to optimize volume activity.
🔹 **Powered by Jupiter V6** – Uses **Jupiter V6** for highly efficient swap execution.
🔹 **Configurable Parameters** – Customize **buy amounts, swap intervals, SOL distribution settings**, and more.

---

## 📌 Setup & Installation

### Prerequisites:
Ensure you have the following installed:
- **Node.js & npm**
- **TypeScript**
- **Solana CLI**
- **Jupiter V6 SDK**

### Installation Steps:
```sh
git clone https://github.com/muffin819/meteora-volume-bot.git
cd meteora-volume-bot
npm install
```

### Running the Bot:
```sh
npm run start
```

---

## 🛠️ Configuration
Modify the **config.json** file to customize:
- **Buy amounts & frequency**
- **SOL distribution behavior**
- **Time intervals for swaps**
- **Wallet creation logic**

---

## Contact
**Telegram:** [@dogewhiz](https://t.me/dogewhiz)

---
