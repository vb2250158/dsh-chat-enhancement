/** 用完整的人类消息生成标题，自动触发仍只在首条消息发生。 */
import { registerSessionTitleLlmProvider, SessionTitleLlmConfigSchema } from '@deepseek-ai/dsh-session-title-llm'

export const name = 'chat-enhancement-session-title'
export const inject = ['sessionTitle', 'llm', 'sessions']
export const Config = SessionTitleLlmConfigSchema

/** 标题持久化、模型请求记录、取消和失败回退均由官方服务负责。 */
export function apply(ctx, config) {
  registerSessionTitleLlmProvider(ctx, config, name, 'first-prompt', messages => messages)
}
