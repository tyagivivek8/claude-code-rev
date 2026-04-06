/**
 * GitHub Copilot Authentication
 *
 * Implements the GitHub device flow OAuth and Copilot session token exchange.
 * Tokens are cached in ~/.claude/copilot-auth.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// VS Code Copilot OAuth client ID
const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const COPILOT_TOKEN_URL =
  'https://api.github.com/copilot_internal/v2/token'

interface CopilotAuthCache {
  githubToken: string
  copilotToken: string
  copilotExpires: number // epoch ms
}

function getAuthCachePath(): string {
  return join(homedir(), '.claude', 'copilot-auth.json')
}

function readCache(): CopilotAuthCache | null {
  try {
    const data = readFileSync(getAuthCachePath(), 'utf-8')
    return JSON.parse(data) as CopilotAuthCache
  } catch {
    return null
  }
}

function writeCache(cache: CopilotAuthCache): void {
  const dir = join(homedir(), '.claude')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {}
  writeFileSync(getAuthCachePath(), JSON.stringify(cache, null, 2))
}

/**
 * Run the GitHub OAuth device flow to get a GitHub access token.
 * Prints the device code URL to stderr and polls for completion.
 */
export async function runGitHubDeviceFlow(): Promise<string> {
  // Step 1: Request device code
  const codeRes = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  })

  if (!codeRes.ok) {
    throw new Error(
      `GitHub device code request failed: ${codeRes.status} ${await codeRes.text()}`,
    )
  }

  const codeData = (await codeRes.json()) as {
    device_code: string
    user_code: string
    verification_uri: string
    interval: number
    expires_in: number
  }

  // biome-ignore lint/suspicious/noConsole:: intentional user-facing output
  console.error(
    `\n  GitHub Copilot Authentication Required\n` +
      `  Open: ${codeData.verification_uri}\n` +
      `  Enter code: ${codeData.user_code}\n` +
      `  Waiting for authorization...\n`,
  )

  // Step 2: Poll for token
  const interval = (codeData.interval || 5) * 1000
  const deadline = Date.now() + codeData.expires_in * 1000

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval))

    const tokenRes = await fetch(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: codeData.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })

    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      error?: string
    }

    if (tokenData.access_token) {
      // biome-ignore lint/suspicious/noConsole:: intentional user-facing output
      console.error('  GitHub authentication successful!\n')
      return tokenData.access_token
    }

    if (
      tokenData.error &&
      tokenData.error !== 'authorization_pending' &&
      tokenData.error !== 'slow_down'
    ) {
      throw new Error(`GitHub OAuth error: ${tokenData.error}`)
    }
  }

  throw new Error('GitHub device flow timed out')
}

/**
 * Exchange a GitHub token for a Copilot session token.
 */
async function getCopilotSessionToken(
  githubToken: string,
): Promise<{ token: string; expires_at: number }> {
  const res = await fetch(COPILOT_TOKEN_URL, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/json',
      'User-Agent': 'GitHubCopilotChat/0.24.2',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Copilot token exchange failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    token: string
    expires_at: number
  }

  return data
}

/**
 * Get a valid Copilot session token, refreshing if needed.
 * Will trigger device flow on first use.
 */
export async function getValidCopilotToken(): Promise<string> {
  const cache = readCache()

  // Check if we have a valid cached token (with 5 min buffer)
  if (cache?.copilotToken && cache.copilotExpires > Date.now() + 300_000) {
    return cache.copilotToken
  }

  // Try to refresh with existing GitHub token
  if (cache?.githubToken) {
    try {
      const session = await getCopilotSessionToken(cache.githubToken)
      const updated: CopilotAuthCache = {
        ...cache,
        copilotToken: session.token,
        copilotExpires: session.expires_at * 1000,
      }
      writeCache(updated)
      return session.token
    } catch {
      // GitHub token may be revoked, fall through to device flow
    }
  }

  // No valid token — run device flow
  const githubToken = await runGitHubDeviceFlow()
  const session = await getCopilotSessionToken(githubToken)

  writeCache({
    githubToken,
    copilotToken: session.token,
    copilotExpires: session.expires_at * 1000,
  })

  return session.token
}

/** Check if we have cached Copilot auth (may be expired). */
export function hasCopilotAuth(): boolean {
  return readCache()?.githubToken != null
}

/** Clear all cached Copilot auth. */
export function clearCopilotAuth(): void {
  try {
    writeFileSync(getAuthCachePath(), '{}')
  } catch {}
}
