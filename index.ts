import {
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  VersionedTransaction,
  TransactionInstruction,
  TransactionMessage,
  ComputeBudgetProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js'
import {
  BUY_INTERVAL_MAX,
  BUY_INTERVAL_MIN,
  SELL_INTERVAL_MAX,
  SELL_INTERVAL_MIN,
  BUY_LOWER_PERCENT,
  BUY_UPPER_PERCENT,
  DISTRIBUTE_WALLET_NUM,
  PRIVATE_KEY,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  TOKEN_MINT,
} from './constants'
import { Data, readJson, saveDataToFile, sleep } from './utils'
import base58 from 'bs58'
import { getBuyTxWithJupiter, getSellTxWithJupiter } from './utils/swapOnlyAmm'
import { execute } from './executor/legacy'

export const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed"
})

export const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
const baseMint = new PublicKey(TOKEN_MINT)
const distritbutionNum = DISTRIBUTE_WALLET_NUM > 20 ? 20 : DISTRIBUTE_WALLET_NUM

const main = async () => {

  const solBalance = await solanaConnection.getBalance(mainKp.publicKey)
  console.log(`Volume bot is running`)
  console.log(`Wallet address: ${mainKp.publicKey.toBase58()}`)
  console.log(`Pool token mint: ${baseMint.toBase58()}`)
  console.log(`Wallet SOL balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(3)}SOL`)
  console.log(`Buying wait time max: ${BUY_INTERVAL_MAX}s`)
  console.log(`Buying wait time min: ${BUY_INTERVAL_MIN}s`)
  console.log(`Selling wait time max: ${SELL_INTERVAL_MAX}s`)
  console.log(`Selling wait time min: ${SELL_INTERVAL_MIN}s`)
  console.log(`Buy upper limit percent: ${BUY_UPPER_PERCENT}%`)
  console.log(`Buy lower limit percent: ${BUY_LOWER_PERCENT}%`)
  console.log(`Distribute SOL to ${distritbutionNum} wallets`)

  let data: {
    kp: Keypair;
    buyAmount: number;
  }[] | null = null

  if (solBalance < (BUY_LOWER_PERCENT + 0.002) * distritbutionNum) {
    console.log("Sol balance is not enough for distribution")
  }

  data = await distributeSol(solanaConnection, mainKp, distritbutionNum)
  if (data == null || data.length == 0) {
    console.log("Distribution failed")
    return
  }

  data.map(async ({ kp }, i) => {
    await sleep(i * 30000)
    let srcKp = kp
    while (true) {
      // buy part with random percent
      const BUY_WAIT_INTERVAL = Math.round(Math.random() * (BUY_INTERVAL_MAX - BUY_INTERVAL_MIN) + BUY_INTERVAL_MIN)
      const SELL_WAIT_INTERVAL = Math.round(Math.random() * (SELL_INTERVAL_MAX - SELL_INTERVAL_MIN) + SELL_INTERVAL_MIN)
      const solBalance = await solanaConnection.getBalance(srcKp.publicKey)

      let buyAmountInPercent = Number((Math.random() * (BUY_UPPER_PERCENT - BUY_LOWER_PERCENT) + BUY_LOWER_PERCENT).toFixed(3))

      if (solBalance < 5 * 10 ** 6) {
        console.log("Sol balance is not enough in one of wallets")
        return
      }

      let buyAmountFirst = Math.floor((solBalance - 5 * 10 ** 6) / 100 * buyAmountInPercent)
      let buyAmountSecond = Math.floor(solBalance - buyAmountFirst - 5 * 10 ** 6)

      console.log(`balance: ${solBalance / 10 ** 9} first: ${buyAmountFirst / 10 ** 9} second: ${buyAmountSecond / 10 ** 9}`)
      // try buying until success
      let i = 0
      while (true) {
        try {

          if (i > 10) {
            console.log("Error in buy transaction")
            return
          }
          const result = await buy(srcKp, baseMint, buyAmountFirst)
          if (result) {
            break
          } else {
            i++
            await sleep(2000)
          }
        } catch (error) {
          i++
        }
      }

      let l = 0
      while (true) {
        try {
          if (l > 10) {
            console.log("Error in buy transaction")
            throw new Error("Error in buy transaction")
          }
          const result = await buy(srcKp, baseMint, buyAmountSecond)
          if (result) {
            break
          } else {
            l++
            await sleep(2000)
          }
        } catch (error) {
          l++
        }
      }

      await sleep(BUY_WAIT_INTERVAL * 1000)

      // try selling until success
      let j = 0
      while (true) {
        if (j > 10) {
          console.log("Error in sell transaction")
          return
        }
        const result = await sell(baseMint, srcKp)
        if (result) {
          break
        } else {
          j++
          await sleep(2000)
        }
      }

      await sleep(SELL_WAIT_INTERVAL * 1000)

      // SOL transfer part

      const balance = await solanaConnection.getBalance(srcKp.publicKey)
      if (balance < 5 * 10 ** 6) {
        console.log("Sub wallet balance is not enough to continue volume swap")
        return
      }
      let k = 0
      while (true) {
        try {
          if (k > 5) {
            console.log("Failed to transfer SOL to new wallet in one of sub wallet")
            return
          }
          const destinationKp = Keypair.generate()

          const tx = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }),
            SystemProgram.transfer({
              fromPubkey: srcKp.publicKey,
              toPubkey: destinationKp.publicKey,
              lamports: balance - 17_000
            })
          )

          tx.feePayer = srcKp.publicKey
          tx.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash

          // console.log(await solanaConnection.simulateTransaction(tx))
          saveDataToFile([{
            privateKey: base58.encode(destinationKp.secretKey),
            pubkey: destinationKp.publicKey.toBase58(),
          }])
          const sig = await sendAndConfirmTransaction(solanaConnection, tx, [srcKp], { skipPreflight: true, commitment: "finalized" })
          srcKp = destinationKp
          console.log(await solanaConnection.getBalance(destinationKp.publicKey) / 10 ** 9, "SOL")
          console.log(`Transferred SOL to new wallet after buy and sell, https://solscan.io/tx/${sig}`)
          break
        } catch (error) {
          k++
        }
      }
    }
  })
}

const distributeSol = async (connection: Connection, mainKp: Keypair, distritbutionNum: number) => {
  const data: Data[] = []
  const wallets = []
  try {
    const sendSolTx: TransactionInstruction[] = []
    sendSolTx.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 })
    )
    const mainSolBal = await connection.getBalance(mainKp.publicKey)
    if (mainSolBal <= 4 * 10 ** 6) {
      console.log("Main wallet balance is not enough")
      return []
    }
    let solAmount = Math.floor(mainSolBal / distritbutionNum - 4 * 10 ** 6)

    for (let i = 0; i < distritbutionNum; i++) {

      const wallet = Keypair.generate()
      wallets.push({ kp: wallet, buyAmount: solAmount })

      sendSolTx.push(
        SystemProgram.transfer({
          fromPubkey: mainKp.publicKey,
          toPubkey: wallet.publicKey,
          lamports: solAmount
        })
      )
    }

    let index = 0
    while (true) {
      try {
        if (index > 5) {
          console.log("Error in distribution")
          return null
        }
        const siTx = new Transaction().add(...sendSolTx)
        const latestBlockhash = await solanaConnection.getLatestBlockhash()
        siTx.feePayer = mainKp.publicKey
        siTx.recentBlockhash = latestBlockhash.blockhash
        const messageV0 = new TransactionMessage({
          payerKey: mainKp.publicKey,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: sendSolTx,
        }).compileToV0Message()
        const transaction = new VersionedTransaction(messageV0)
        transaction.sign([mainKp])
        const txSig = await execute(transaction, latestBlockhash, 1)
        const distibuteTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
        console.log("SOL distributed ", distibuteTx)
        break
      } catch (error) {
        index++
      }
    }

    wallets.map((wallet) => {
      data.push({
        privateKey: base58.encode(wallet.kp.secretKey),
        pubkey: wallet.kp.publicKey.toBase58(),
      })
    })
    try {
      saveDataToFile(data)
    } catch (error) {

    }
    console.log("Success in distribution")
    return wallets
  } catch (error) {
    console.log(`Failed to transfer SOL`)
    return null
  }
}

const buy = async (newWallet: Keypair, baseMint: PublicKey, buyAmount: number) => {
  let solBalance: number = 0
  try {
    solBalance = await solanaConnection.getBalance(newWallet.publicKey)
  } catch (error) {
    console.log("Error getting balance of wallet")
    return null
  }
  if (solBalance == 0) {
    return null
  }
  try {
    let buyTx = await getBuyTxWithJupiter(newWallet, baseMint, buyAmount)
    if (buyTx == null) {
      console.log(`Error getting buy transaction`)
      return null
    }
    // console.log(await solanaConnection.simulateTransaction(buyTx))
    const latestBlockhash = await solanaConnection.getLatestBlockhash()
    const txSig = await execute(buyTx, latestBlockhash)
    const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : ''

    return tokenBuyTx
  } catch (error) {
    return null
  }
}

const sell = async (baseMint: PublicKey, wallet: Keypair) => {
  try {
    const data: Data[] = readJson()
    if (data.length == 0) {
      await sleep(1000)
      return null
    }

    const tokenAta = await getAssociatedTokenAddress(baseMint, wallet.publicKey)
    const tokenBalInfo = await solanaConnection.getTokenAccountBalance(tokenAta)
    if (!tokenBalInfo) {
      console.log("Balance incorrect")
      return null
    }
    const tokenBalance = tokenBalInfo.value.amount

    try {
      let sellTx = await getSellTxWithJupiter(wallet, baseMint, tokenBalance)

      if (sellTx == null) {
        console.log(`Error getting buy transaction`)
        return null
      }
      // console.log(await solanaConnection.simulateTransaction(sellTx))
      const latestBlockhashForSell = await solanaConnection.getLatestBlockhash()
      const txSellSig = await execute(sellTx, latestBlockhashForSell, false)
      const tokenSellTx = txSellSig ? `https://solscan.io/tx/${txSellSig}` : ''
      return tokenSellTx
    } catch (error) {
      return null
    }
  } catch (error) {
    return null
  }
}

main()
