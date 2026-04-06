/**
 * Copilot Proxy — Anthropic SDK fetch interceptor
 *
 * Intercepts fetch calls from the Anthropic SDK, translates them to
 * OpenAI-compatible format, sends to api.githubcopilot.com, and
 * translates the SSE responses back to Anthropic format.
 */

const COPILOT_CHAT_URL =
  'https://api.githubcopilot.com/chat/completions'

// ── Model mapping ────────────────────────────────────────────────
// Copilot supports: claude-sonnet-4, claude-opus-4 (and possibly claude-3.5-sonnet)
// Map all Anthropic model IDs to supported Copilot model names
const MODEL_MAP: Record<string, string> = {
  // Opus variants
  'claude-opus-4-20250514': 'claude-sonnet-4',
  'claude-opus-4': 'claude-sonnet-4',
  'claude-opus-4-1-20250805': 'claude-sonnet-4',
  'claude-opus-4-1': 'claude-sonnet-4',
  'claude-opus-4-5-20251101': 'claude-sonnet-4',
  'claude-opus-4-5': 'claude-sonnet-4',
  'claude-opus-4-6': 'claude-sonnet-4',
  // Sonnet variants
  'claude-sonnet-4-20250514': 'claude-sonnet-4',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4',
  'claude-sonnet-4-5': 'claude-sonnet-4',
  'claude-sonnet-4-6': 'claude-sonnet-4',
  'claude-3-7-sonnet-20250219': 'claude-sonnet-4',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4',
  // Haiku variants
  'claude-haiku-4-5-20251001': 'claude-sonnet-4',
  'claude-haiku-4-5': 'claude-sonnet-4',
  'claude-3-5-haiku-20241022': 'claude-sonnet-4',
}

function mapModel(model: string): string {
  const mapped = MODEL_MAP[model] ?? 'claude-sonnet-4'
  if (mapped !== model) {
    process.stderr.write(`[copilot] model: ${model} → ${mapped}\n`)
  }
  return mapped
}

// ── Message translation (Anthropic → OpenAI) ──────────────────��─

interface AnthropicMessage {
  role: string
  content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string | AnthropicContentBlock[]
}

interface OpenAIMessage {
  role: string
  content?: string | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

function flattenContent(
  content: string | AnthropicContentBlock[],
): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('')
}

function extractToolCalls(
  content: AnthropicContentBlock[],
): OpenAIToolCall[] {
  return content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({
      id: b.id!,
      type: 'function' as const,
      function: {
        name: b.name!,
        arguments:
          typeof b.input === 'string' ? b.input : JSON.stringify(b.input),
      },
    }))
}

function extractToolResults(
  content: string | AnthropicContentBlock[],
): string {
  if (typeof content === 'string') return content
  return content
    .map((b) => {
      if (b.type === 'text' && b.text) return b.text
      if (b.type === 'tool_result' && b.content) {
        return typeof b.content === 'string'
          ? b.content
          : flattenContent(b.content)
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function translateMessages(
  messages: AnthropicMessage[],
): OpenAIMessage[] {
  const out: OpenAIMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'user', content: msg.content })
        continue
      }

      // Check for tool_result blocks
      const toolResults = msg.content.filter((b) => b.type === 'tool_result')
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          const text = tr.content
            ? extractToolResults(tr.content)
            : ''
          out.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id!,
            content: text,
          })
        }
        // Also include any non-tool-result text
        const textBlocks = msg.content.filter(
          (b) => b.type === 'text' && b.text,
        )
        if (textBlocks.length > 0) {
          out.push({
            role: 'user',
            content: textBlocks.map((b) => b.text!).join(''),
          })
        }
        continue
      }

      out.push({ role: 'user', content: flattenContent(msg.content) })
      continue
    }

    if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'assistant', content: msg.content })
        continue
      }

      const toolCalls = extractToolCalls(msg.content)
      const text = flattenContent(msg.content)

      if (toolCalls.length > 0) {
        out.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolCalls,
        })
      } else {
        out.push({ role: 'assistant', content: text })
      }
      continue
    }

    // system or other
    out.push({ role: msg.role, content: flattenContent(msg.content) })
  }

  return fixConversationStructure(out)
}

/**
 * Ensure tool messages are preceded by an assistant message with
 * matching tool_calls. Insert synthetic ones if missing.
 */
function fixConversationStructure(
  messages: OpenAIMessage[],
): OpenAIMessage[] {
  const fixed: OpenAIMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!
    if (msg.role === 'tool') {
      const prev = fixed[fixed.length - 1]
      const needsSynthetic =
        !prev ||
        prev.role !== 'assistant' ||
        !prev.tool_calls?.some((tc) => tc.id === msg.tool_call_id)

      if (needsSynthetic) {
        fixed.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: msg.tool_call_id!,
              type: 'function',
              function: { name: 'unknown', arguments: '{}' },
            },
          ],
        })
      }
    }
    fixed.push(msg)
  }

  return fixed
}

// ── Tool translation ─────────────────────────────────────────────

interface AnthropicTool {
  name: string
  description?: string
  input_schema?: Record<string, unknown>
}

function translateTools(
  tools: AnthropicTool[],
): { type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      ...(t.description && { description: t.description }),
      ...(t.input_schema && { parameters: t.input_schema }),
    },
  }))
}

// ── Request builder ──────────────────────────────────────────────

function buildOpenAIRequest(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const model = mapModel(body.model as string)
  const messages = translateMessages(
    body.messages as AnthropicMessage[],
  )

  const req: Record<string, unknown> = {
    model,
    messages,
    stream: body.stream ?? true,
  }

  if (body.max_tokens) req.max_tokens = body.max_tokens
  if (body.temperature !== undefined) req.temperature = body.temperature

  if (body.system) {
    const systemText =
      typeof body.system === 'string'
        ? body.system
        : (body.system as { text: string }[]).map((s) => s.text).join('\n')
    messages.unshift({ role: 'system', content: systemText })
  }

  if (body.tools && (body.tools as AnthropicTool[]).length > 0) {
    req.tools = translateTools(body.tools as AnthropicTool[])
  }

  return req
}

// ── SSE response translation (OpenAI → Anthropic) ───────────────��

function createAnthropicSSEStream(
  openaiStream: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''
  let contentBlockIndex = 0
  let sentStart = false
  let inputTokens = 0
  let outputTokens = 0
  const messageId = `msg_copilot_${Date.now()}`

  return new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      const reader = openaiStream.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') {
              // End content block
              send('content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
              // Message delta with stop
              send('message_delta', {
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: outputTokens },
              })
              send('message_stop', { type: 'message_stop' })
              controller.close()
              return
            }

            let chunk: Record<string, unknown>
            try {
              chunk = JSON.parse(payload)
            } catch {
              continue
            }

            // Usage info
            if ((chunk.usage as Record<string, number>)?.prompt_tokens) {
              inputTokens = (chunk.usage as Record<string, number>).prompt_tokens
            }
            if ((chunk.usage as Record<string, number>)?.completion_tokens) {
              outputTokens = (chunk.usage as Record<string, number>).completion_tokens
            }

            // Send message_start on first chunk
            if (!sentStart) {
              sentStart = true
              send('message_start', {
                type: 'message_start',
                message: {
                  id: messageId,
                  type: 'message',
                  role: 'assistant',
                  content: [],
                  model,
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: inputTokens, output_tokens: 0 },
                },
              })
              send('content_block_start', {
                type: 'content_block_start',
                index: contentBlockIndex,
                content_block: { type: 'text', text: '' },
              })
            }

            const choices = chunk.choices as {
              delta?: {
                content?: string
                tool_calls?: {
                  index: number
                  id?: string
                  function?: { name?: string; arguments?: string }
                }[]
              }
              finish_reason?: string
            }[]

            if (!choices?.[0]?.delta) continue
            const delta = choices[0].delta

            // Text content
            if (delta.content) {
              send('content_block_delta', {
                type: 'content_block_delta',
                index: contentBlockIndex,
                delta: { type: 'text_delta', text: delta.content },
              })
            }

            // Tool calls
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  // New tool call — close text block, start tool_use block
                  send('content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
                  contentBlockIndex++
                  send('content_block_start', {
                    type: 'content_block_start',
                    index: contentBlockIndex,
                    content_block: {
                      type: 'tool_use',
                      id: tc.id,
                      name: tc.function?.name ?? '',
                      input: {},
                    },
                  })
                }
                if (tc.function?.arguments) {
                  send('content_block_delta', {
                    type: 'content_block_delta',
                    index: contentBlockIndex,
                    delta: {
                      type: 'input_json_delta',
                      partial_json: tc.function.arguments,
                    },
                  })
                }
              }
            }

            // Finish reason
            if (choices[0].finish_reason === 'tool_calls') {
              send('content_block_stop', { type: 'content_block_stop', index: contentBlockIndex })
              send('message_delta', {
                type: 'message_delta',
                delta: { stop_reason: 'tool_use', stop_sequence: null },
                usage: { output_tokens: outputTokens },
              })
              send('message_stop', { type: 'message_stop' })
              controller.close()
              return
            }
          }
        }
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

// ── Public API ──────────────────────────────────────────────��─────

/**
 * Create a fetch function that intercepts Anthropic SDK requests
 * and routes them through GitHub Copilot.
 */
export function createCopilotFetch(
  copilotToken: string,
): typeof globalThis.fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url

    // Only intercept Anthropic messages API calls
    if (!url.includes('/v1/messages')) {
      return fetch(input, init)
    }

    const body = JSON.parse((init?.body as string) ?? '{}') as Record<
      string,
      unknown
    >
    const model = mapModel(body.model as string)
    const openaiBody = buildOpenAIRequest(body)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${copilotToken}`,
      'Content-Type': 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.99.0',
      'Editor-Plugin-Version': 'copilot-chat/0.24.2',
      'Openai-Intent': 'conversation-panel',
      'X-Request-Id': crypto.randomUUID(),
    }

    const res = await fetch(COPILOT_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(openaiBody),
    })

    if (!res.ok) {
      const errBody = await res.text()
      process.stderr.write(`[copilot] API error ${res.status}: ${errBody}\n`)
      // Return a new Response with the error text (original body consumed)
      return new Response(errBody, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
    }

    if (body.stream !== false && res.body) {
      const anthropicStream = createAnthropicSSEStream(res.body, model)
      return new Response(anthropicStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming: would need full response translation
    // For now, return as-is (streaming is the primary path)
    return res
  }
}
