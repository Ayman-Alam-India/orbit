import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), 'workshop-data')
const read = async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'))

const tools = [
  { name: 'list_incidents', description: 'List seeded production incidents', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_incident', description: 'Get one incident by id', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'list_service_health', description: 'List current service health', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_recent_deploys', description: 'List recent deployments', inputSchema: { type: 'object', properties: { service: { type: 'string' } } } },
  { name: 'search_logs', description: 'Search recent log messages', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
]

const result = (id, value) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] } })}\n`)

process.stdin.setEncoding('utf8')

let buffer = ''
process.stdin.on('data', async (chunk) => {
  buffer += chunk
  const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
  for (const line of lines.filter(Boolean)) {
    const request = JSON.parse(line)
    if (request.method === 'initialize') result(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'incident-data', version: '1.0.0' } })
    else if (request.method === 'notifications/initialized') continue
    else if (request.method === 'tools/list') result(request.id, { tools })
    else if (request.method === 'tools/call') {
      const { name } = request.params; const args = request.params.arguments ?? {}
      const data = name === 'list_incidents' ? await read('incidents.json') : name === 'get_incident' ? (await read('incidents.json')).find((item) => item.id === args.id) : name === 'list_service_health' ? await read('services.json') : name === 'get_recent_deploys' ? (await read('deploys.json')).filter((item) => !args.service || item.service === args.service) : (await read('logs.json')).filter((item) => item.message.toLowerCase().includes(args.query.toLowerCase()))
      result(request.id, data ?? { error: 'Not found' })
    }
  }
})
