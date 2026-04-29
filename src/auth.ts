import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { API_BASE, CHAINS, type PaymentRequiredError } from './shared'

export type AuthSession = {
  session_token: string
  user_email: string
  wallet_address: string
  linked_at: string
}

export type ClaimResponse = {
  session_token: string
  user_email: string
  wallet_address: string
}

export type BalanceResponse = {
  balance: string
  symbol: string
}

export const AUTH_PATH = join(homedir(), '.config', 'spawnr', 'auth.json')

export function readAuth(): AuthSession | null {
  if (!existsSync(AUTH_PATH)) return null
  try {
    const raw = readFileSync(AUTH_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (!parsed.session_token || !parsed.user_email || !parsed.wallet_address) return null
    return parsed as AuthSession
  } catch {
    return null
  }
}

export function writeAuth(session: AuthSession): void {
  const dir = dirname(AUTH_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(AUTH_PATH, JSON.stringify(session, null, 2) + '\n', 'utf-8')
  try { chmodSync(AUTH_PATH, 0o600) } catch {}
}

export function deleteAuth(): boolean {
  if (!existsSync(AUTH_PATH)) return false
  unlinkSync(AUTH_PATH)
  return true
}

export async function claimPairToken(token: string): Promise<ClaimResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/claim`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'thespawn-cli',
      },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) return null
    return (await res.json()) as ClaimResponse
  } catch {
    return null
  }
}

export async function fetchBalance(
  chainId: number,
  address: string,
  timeoutMs = 2000,
): Promise<BalanceResponse | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const url = `${API_BASE}/api/wallet/balance?chain_id=${chainId}&address=${encodeURIComponent(address)}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'thespawn-cli' },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as BalanceResponse
  } catch {
    return null
  }
}

export type FundLinkResponse = {
  code: string
  url: string
  status_url: string
}

/**
 * Create a short funding link backed by the Coindisco onramp.
 * The browser opens to a Spawn-branded page that hosts the widget pre-filled
 * with the user's wallet, USDC on Base, and the required amount.
 */
export async function createFundLink(
  walletAddress: string,
  amount: number,
  chain = 'base',
  timeoutMs = 2000,
): Promise<FundLinkResponse | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${API_BASE}/api/v1/fund-links`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'thespawn-cli',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        chain,
        amount: Number(amount.toFixed(2)),
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as FundLinkResponse
  } catch {
    return null
  }
}

export function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Build a structured error payload when a call fails with 402.
 * Fetches current balance on the required network so we can tell the user
 * exactly how much to top up.
 *
 * If the user is linked, generates a short branded fund link pointing at the
 * Coindisco onramp pre-filled with the wallet and required amount.
 * Top-up defaults to Base network (the only network we currently fund via card).
 */
export async function describePaymentError(err: PaymentRequiredError, session: AuthSession | null) {
  const req = err.requirement
  const chainId = CHAINS[req.network]
  const amountNum = Number(req.amount === '<0.01' ? '0.01' : req.amount) || 0

  let currentBalance: string | null = null
  let balanceNum = 0
  if (session?.wallet_address && chainId) {
    const bal = await fetchBalance(chainId, session.wallet_address)
    if (bal) {
      currentBalance = bal.balance
      balanceNum = Number(bal.balance === '<0.01' ? '0.01' : bal.balance) || 0
    }
  }

  const shortage = Math.max(0, amountNum - balanceNum)
  const topUp = shortage > 0 ? shortage.toFixed(2) : '0.00'

  // Generate a short fund link if we know the wallet. Card top-up only on Base for now.
  let fundUrl = `${API_BASE}/wallet`
  let fundCode: string | null = null
  if (session?.wallet_address && shortage > 0) {
    const link = await createFundLink(session.wallet_address, shortage, 'base')
    if (link) {
      fundUrl = link.url
      fundCode = link.code
    }
  }

  return {
    error: 'payment_required',
    message: `Need ${req.amount} ${req.symbol} on ${req.network} to complete this action.`,
    required: {
      amount: req.amount,
      symbol: req.symbol,
      network: req.network,
      pay_to: req.payTo || null,
    },
    wallet: session?.wallet_address
      ? {
          address: shortenAddress(session.wallet_address),
          address_full: session.wallet_address,
          balance: currentBalance ?? '-',
          symbol: req.symbol,
          network: req.network,
        }
      : null,
    top_up: {
      minimum: topUp,
      symbol: req.symbol,
      network: 'base',
    },
    fund_url: fundUrl,
    fund_code: fundCode,
    hint: session
      ? fundCode
        ? `Open ${fundUrl} to top up with a card (Base USDC). Rerun once funded.`
        : `Send at least ${topUp} ${req.symbol} on ${req.network} to ${session.wallet_address}, then rerun.`
      : `Run \`spawnr login <token>\` to link your wallet, then fund it with at least ${req.amount} ${req.symbol} on ${req.network}.`,
  }
}
