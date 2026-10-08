/** 通过公开会话菜单槽位调用 Host 的自动重命名服务。 */
import React from 'react'
import { MenuItemButton, IconSparkleRegular } from '@deepseek-ai/dsh-client-ui-primitives'

export const titleLocales = {
  zh: { autoRename: '自动重命名', pending: '正在生成名称…', failed: '命名失败，点击重试' },
  en: { autoRename: 'Auto-rename', pending: 'Generating title…', failed: 'Naming failed; retry' },
}

const titleRequestSchema = { parse(value) {
  if (!value || !['list', 'rename'].includes(value.action) || (value.action === 'rename' && (typeof value.sessionId !== 'string' || !value.sessionId)) || (value.onlyUnnamed !== undefined && typeof value.onlyUnnamed !== 'boolean')) throw new TypeError('Invalid session title request')
  return value
} }
const titleResultSchema = { parse(value) {
  if (!value || (!Array.isArray(value.items) && !(typeof value.sessionId === 'string' && typeof value.title === 'string' && typeof value.kind === 'string'))) throw new TypeError('Invalid session title result')
  return value
} }
export const titleDescriptor = {
  id: 'dsh-chat-enhancement#chatTitles/read', service: 'chatTitles', namespace: 'chatTitles', method: 'read', invocation: { kind: 'direct' },
  parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatTitlesRequest', create: () => titleRequestSchema } }],
  result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatTitlesResult', create: () => titleResultSchema },
}

/** 请求期间保持菜单可见，失败留在原行重试，成功后关闭。 */
export function AutoRenameSessionMenuItem({ sessionId, useMenuOpenState, readTitles, t }) {
  const [, setMenuOpen] = useMenuOpenState()
  const [state, setState] = React.useState('idle')
  return React.createElement(MenuItemButton, {
    disabled: state === 'pending', icon: React.createElement(IconSparkleRegular),
    onSelect: async () => {
      if (state === 'pending') return
      setState('pending')
      try { await readTitles({ action: 'rename', sessionId }); setMenuOpen(false) }
      catch { setState('failed') }
    },
  }, t(state === 'pending' ? 'pending' : state === 'failed' ? 'failed' : 'autoRename'))
}

/** 插件卸载撤销菜单注册，保留官方手动命名入口。 */
export function installSessionTitlesClient(ctx) {
  ctx.effect(() => ctx.locale.register('chat-enhancement-titles', titleLocales))
  const service = ctx.reflect.get('remote.chatTitles')
  const readTitles = async request => {
    const result = await service.read(request)
    if (!result.ok) throw new Error(result.error?.message || 'Session title service unavailable')
    return result.value
  }
  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.session.menu.item', id: 'chat-enhancement-auto-rename', order: 250,
    locale: 'chat-enhancement-titles', inject: () => ({ readTitles }),
  }, AutoRenameSessionMenuItem))
}
