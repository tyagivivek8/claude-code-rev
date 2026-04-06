#!/usr/bin/env bun
import { getValidCopilotToken } from './src/services/copilot/auth.ts'

const token = await getValidCopilotToken()
console.error('Got token, fetching models...')

const res = await fetch('https://api.githubcopilot.com/models', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Copilot-Integration-Id': 'vscode-chat',
    'Editor-Version': 'vscode/1.99.0',
  }
})

const data = await res.json() as any
const models = (data.data || [data]).flat()
const claude = models.filter((m: any) =>
  m.id?.toLowerCase().includes('claude') || m.name?.toLowerCase().includes('claude')
)

console.log('\n=== Claude models on Copilot ===')
for (const m of claude) {
  console.log(`  id: ${m.id}`)
  if (m.name && m.name !== m.id) console.log(`  name: ${m.name}`)
  console.log()
}

if (claude.length === 0) {
  console.log('No Claude models found. All models:')
  for (const m of models) {
    console.log(`  ${m.id}`)
  }
}
