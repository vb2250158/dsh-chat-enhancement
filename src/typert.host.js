/** Strict Host Remote descriptors for the chat preview readers. */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const dshHome = resolve(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'))
const { z } = createRequire(join(dshHome, 'profiles', 'web', 'package.json'))('zod')
const packageName = 'dsh-chat-enhancement'

const mediaRequest = z.object({ sessionId: z.string().min(1), token: z.string().min(1) })
const mediaResult = z.object({ mediaType: z.string(), name: z.string(), dataBase64: z.string() })
const markdownRequest = z.object({ sessionId: z.string().min(1), path: z.string().min(1) })
const markdownResult = z.object({ name: z.string(), text: z.string() })

function descriptor(service, requestSymbol, requestSchema, resultSymbol, resultSchema) {
  return {
    id: `${packageName}#${service}/read`,
    service,
    namespace: service,
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: requestSymbol, schema: requestSchema, create: () => (requestSchema) },
    }],
    result: { mode: 'strict', typeSymbol: resultSymbol, schema: resultSchema, create: () => (resultSchema) },
    sourceLocation: { file: 'src/index.js', line: 92, column: 11 },
  }
}

/** Strict Remote descriptors shared by the browser preview client and Host Gateway. */
export const TYPERT = {
  package: packageName,
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: [
    descriptor('chatTitles', `${packageName}#ChatTitlesRequest`, z.discriminatedUnion('action', [z.object({ action: z.literal('list') }), z.object({ action: z.literal('rename'), sessionId: z.string().min(1), onlyUnnamed: z.boolean().optional() })]), `${packageName}#ChatTitlesResult`, z.union([z.object({ items: z.array(z.object({ sessionId: z.string(), cwd: z.string().optional(), createdAt: z.number().optional(), parentSession: z.string().optional(), title: z.string().optional(), unnamed: z.boolean().optional(), error: z.string().optional() })) }), z.object({ sessionId: z.string(), title: z.string(), kind: z.string() })])),
    descriptor('chatRecovery', `${packageName}#ChatRecoveryRequest`, z.object({ action: z.enum(['check', 'recover', 'dismiss', 'recover-quota']), batchId: z.string().optional(), targets: z.array(z.object({ id: z.string().min(1), startSeq: z.number().int().nonnegative() })).optional() }), `${packageName}#ChatRecoveryResult`, z.object({ batchId: z.string(), phase: z.enum(['idle', 'checking', 'ready', 'recovering', 'done', 'failed', 'dismissed']), count: z.number().int().nonnegative(), scanErrors: z.number().int().nonnegative(), restored: z.number().int().nonnegative(), pollIntervalMs: z.number().int().positive(), stage: z.enum(['idle', 'listing', 'scanning', 'validating', 'attaching', 'resuming']), completed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), stageStartedAt: z.number().int().nonnegative(), currentSessionId: z.string(), requestTimeoutMs: z.number().int().positive(), issues: z.array(z.object({ sessionId: z.string(), stage: z.enum(['check', 'recover']), message: z.string() })) })),
    descriptor('chatMedia', `${packageName}#ChatMediaRequest`, mediaRequest, `${packageName}#ChatMediaResult`, mediaResult),
    descriptor('chatMarkdown', `${packageName}#ChatMarkdownRequest`, markdownRequest, `${packageName}#ChatMarkdownResult`, markdownResult),
  ],
}
