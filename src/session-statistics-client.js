import * as React from 'react'
import { Modal, Pill, IconGaugeOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { sessionStatisticsReading } from './session-statistics.js'

export const sessionStatisticsLocales = {
  zh: {
    title: '会话统计', close: '关闭会话统计', open: '查看会话统计', counts: '{turns} 轮 · {steps} 步',
    scope: '全会话 · 已结束轮次', total: '轮次累计耗时', ttft: '平均首 token', speed: '输出速度',
    seconds: '{value} 秒', milliseconds: '{value} 毫秒', tps: '{value} tok/s', numberLocale: 'zh-CN',
    model: '模型', tools: '工具调用', compaction: '上下文压缩', other: '其他处理与等待',
    chart: '耗时对比', relative: '相对轮次累计 {value}%', noTotal: '未提供轮次累计时间',
    overlap: '各项按同一时间尺度显示，可能重叠，不能直接相加。其他包含准备、等待、流程处理及未完成步骤；现有数据未细分原因。',
    metrics: '详细数据', metric: '指标', value: '数值', unit: '口径', totalScope: '匹配到结束事件的轮次累计；进行中的轮次结束后计入。',
    modelScope: '步骤开始到模型消息完成，扣除重叠的上下文压缩。', toolsScope: '每次工具调用到结果返回的累计；并行调用分别计时。',
    compactionScope: '已结束的压缩尝试累计，包含失败尝试。', otherScope: '轮次内未被模型、工具或压缩区间覆盖的时间。',
    ttftScope: '步骤开始到首个非空输出的平均时间，样本 {value} 步。',
    speedScope: '同一批有输出 token 与解码计时的步骤：输出 token ÷ 解码秒数。',
    decode: '解码累计耗时', decodeScope: '有输出 token 统计的步骤，从首 token 到消息完成。',
    decodeTokens: '解码统计 token', tokens: 'Token 用量', input: '未缓存输入', cacheRead: '缓存读取', cacheWrite: '缓存写入', output: '输出',
    noStats: '完整日志统计尚不可用。', empty: '尚无已结束的轮次或步骤。', missing: '未提供',
  },
  en: {
    title: 'Session statistics', close: 'Close session statistics', open: 'View session statistics', counts: '{turns} turns · {steps} steps',
    scope: 'Whole session · closed turns', total: 'Cumulative turn time', ttft: 'Average first token', speed: 'Output speed',
    seconds: '{value} s', milliseconds: '{value} ms', tps: '{value} tok/s', numberLocale: 'en-US',
    model: 'Model', tools: 'Tool calls', compaction: 'Context compaction', other: 'Other processing and waiting',
    chart: 'Time comparison', relative: '{value}% of cumulative turn time', noTotal: 'Cumulative turn time unavailable',
    overlap: 'Bars share one time scale. Intervals may overlap and cannot be added directly. Other includes preparation, waiting, orchestration and incomplete steps; these causes are not measured separately.',
    metrics: 'Detailed readings', metric: 'Metric', value: 'Value', unit: 'Measurement', totalScope: 'Sum of matched closed turns; running turns contribute when they close.',
    modelScope: 'Step start to model-message completion, excluding overlapping compaction.', toolsScope: 'Sum of call-to-result intervals; parallel calls are timed separately.',
    compactionScope: 'Sum of completed compaction attempts, including failed attempts.', otherScope: 'Closed-turn time outside recorded model, tool and compaction intervals.',
    ttftScope: 'Average step start to first non-empty output across {value} steps.',
    speedScope: 'Output tokens divided by decode seconds over the same timed steps.',
    decode: 'Cumulative decode time', decodeScope: 'First token to message completion for steps reporting output tokens.',
    decodeTokens: 'Decode sample tokens', tokens: 'Token usage', input: 'Uncached input', cacheRead: 'Cache reads', cacheWrite: 'Cache writes', output: 'Output',
    noStats: 'Whole-log statistics are not available yet.', empty: 'No closed turns or steps yet.', missing: 'Unavailable',
  },
}

export const sessionStatisticsCss = `
.dsh-session-statistics[role=dialog]{width:min(880px,100%);max-height:100%;font-variant-numeric:tabular-nums}
.dsh-session-statistics-content{min-height:0;overflow:auto;overscroll-behavior:contain}
.dsh-session-statistics-body{display:grid;gap:24px;min-width:0;color:var(--dsw-alias-label-primary)}
.dsh-session-statistics-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.dsh-session-statistics-summary>div{display:grid;gap:8px;padding:16px;border:1px solid var(--dsw-alias-line-primary);border-radius:12px;min-width:0}
.dsh-session-statistics-summary dt,.dsh-session-statistics-note{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0}
.dsh-session-statistics-summary dd{font-size:24px;font-weight:600;line-height:1.3;margin:0;overflow-wrap:anywhere}
.dsh-session-statistics-section{display:grid;gap:14px;min-width:0}
.dsh-session-statistics-section h3{font-size:14px;font-weight:600;margin:0}
.dsh-session-statistics-bar{display:grid;gap:7px}
.dsh-session-statistics-bar-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:13px}
.dsh-session-statistics-bar-head span:last-child{white-space:nowrap;font-weight:500}
.dsh-session-statistics-track{height:9px;border-radius:8px;overflow:hidden;background:var(--dsw-alias-interactive-bg-hover)}
.dsh-session-statistics-fill{height:100%;border-radius:inherit;background:var(--dsw-alias-link)}
.dsh-session-statistics-fill[data-kind=tools]{background:var(--dsw-alias-label-primary)}
.dsh-session-statistics-fill[data-kind=compaction]{background:var(--dsw-alias-label-secondary)}
.dsh-session-statistics-fill[data-kind=other]{background:var(--dsw-alias-label-tertiary)}
.dsh-session-statistics-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;line-height:1.6}
.dsh-session-statistics-table th{font-weight:500;color:var(--dsw-alias-label-secondary);text-align:left}
.dsh-session-statistics-table th,.dsh-session-statistics-table td{padding:10px 8px;border-bottom:1px solid var(--dsw-alias-line-primary);vertical-align:top;overflow-wrap:anywhere}
.dsh-session-statistics-table th:first-child{width:25%}.dsh-session-statistics-table th:nth-child(2){width:24%}
.dsh-session-statistics-table td:last-child{color:var(--dsw-alias-label-secondary)}
.dsh-session-statistics-token-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0}
.dsh-session-statistics-token-grid div{display:grid;gap:6px;min-width:0}.dsh-session-statistics-token-grid dt{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsh-session-statistics-token-grid dd{font-size:16px;margin:0;overflow-wrap:anywhere}
.dsh-session-statistics-trigger{max-width:100%;gap:6px;font-variant-numeric:tabular-nums}.dsh-session-statistics-trigger>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:540px){.dsh-session-statistics-summary{gap:8px}.dsh-session-statistics-summary>div{padding:10px}.dsh-session-statistics-summary dd{font-size:18px}.dsh-session-statistics-token-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-session-statistics-table th,.dsh-session-statistics-table td{padding:8px 4px}.dsh-session-statistics-table th:first-child{width:24%}.dsh-session-statistics-table th:nth-child(2){width:27%}}
`

function statisticsNumber(value, t, digits = 1) {
  return new Intl.NumberFormat(t('numberLocale'), { maximumFractionDigits: digits }).format(value)
}

function statisticsDuration(value, t, exact = false) {
  if (value === undefined) return t('missing')
  return exact ? t('milliseconds', { value: statisticsNumber(value, t, 2) }) : t('seconds', { value: statisticsNumber(value / 1000, t) })
}

function StatisticsDetails({ stats, usage, t }) {
  const reading = sessionStatisticsReading(stats)
  if (stats === undefined) return React.createElement('p', { className: 'dsh-session-statistics-note' }, t('noStats'))
  const rows = [
    { key: 'total', value: stats.turnMs, description: t('totalScope') },
    ...reading.timings.map(row => ({ ...row, value: row.milliseconds, description: t(`${row.key}Scope`) })),
    { key: 'ttft', value: reading.averageTtft, description: t('ttftScope', { value: stats.ttftSteps }) },
    { key: 'decode', value: stats.decodeMs, description: t('decodeScope') },
  ]
  return React.createElement('div', { className: 'dsh-session-statistics-body' },
    React.createElement('dl', { className: 'dsh-session-statistics-summary' },
      ...[
        ['total', statisticsDuration(stats.turnMs, t)],
        ['ttft', statisticsDuration(reading.averageTtft, t)],
        ['speed', reading.speed === undefined ? t('missing') : t('tps', { value: statisticsNumber(reading.speed, t) })],
      ].map(([key, value]) => React.createElement('div', { key }, React.createElement('dt', null, t(key)), React.createElement('dd', null, value)))),
    stats.steps === 0 && stats.turns === 0 && React.createElement('p', { className: 'dsh-session-statistics-note' }, t('empty')),
    React.createElement('section', { className: 'dsh-session-statistics-section', 'aria-label': t('chart') },
      React.createElement('h3', null, t('chart')),
      ...reading.timings.map(row => React.createElement('div', { key: row.key, className: 'dsh-session-statistics-bar', 'data-timing-kind': row.key },
        React.createElement('div', { className: 'dsh-session-statistics-bar-head' }, React.createElement('span', null, t(row.key)), React.createElement('span', null, statisticsDuration(row.milliseconds, t))),
        React.createElement('div', { className: 'dsh-session-statistics-track', role: 'img', 'aria-label': `${t(row.key)}: ${statisticsDuration(row.milliseconds, t)}` },
          React.createElement('div', { className: 'dsh-session-statistics-fill', 'data-kind': row.key,
            style: { width: `${reading.scale > 0 ? (row.milliseconds ?? 0) * 100 / reading.scale : 0}%` } })),
        React.createElement('span', { className: 'dsh-session-statistics-note' }, row.milliseconds === undefined ? t('missing')
          : stats.turnMs > 0 ? t('relative', { value: statisticsNumber(row.milliseconds * 100 / stats.turnMs, t) }) : t('noTotal')))),
      React.createElement('p', { className: 'dsh-session-statistics-note' }, t('overlap'))),
    React.createElement('section', { className: 'dsh-session-statistics-section' }, React.createElement('h3', null, t('metrics')),
      React.createElement('table', { className: 'dsh-session-statistics-table', 'aria-label': t('metrics') },
        React.createElement('thead', null, React.createElement('tr', null, ...['metric', 'value', 'unit'].map(key => React.createElement('th', { key, scope: 'col' }, t(key))))),
        React.createElement('tbody', null,
          ...rows.map(row => React.createElement('tr', { key: row.key }, React.createElement('td', null, t(row.key)), React.createElement('td', null, statisticsDuration(row.value, t, true)), React.createElement('td', null, row.description))),
          React.createElement('tr', null, React.createElement('td', null, t('decodeTokens')), React.createElement('td', null, statisticsNumber(stats.decodeTokens, t, 0)), React.createElement('td', null, t('speedScope')))))),
    usage !== undefined && React.createElement('section', { className: 'dsh-session-statistics-section' }, React.createElement('h3', null, t('tokens')),
      React.createElement('dl', { className: 'dsh-session-statistics-token-grid' },
        ...[['input', usage.uncachedInputTokens], ['cacheRead', usage.cacheReadTokens], ['cacheWrite', usage.cacheWriteTokens], ['output', usage.outputTokens]]
          .map(([key, value]) => React.createElement('div', { key }, React.createElement('dt', null, t(key)), React.createElement('dd', null, value === undefined ? t('missing') : statisticsNumber(value, t, 0)))))))
}

/** Replace only the activity entry; projection updates remain owned by the host. */
export function SessionStatisticsPill({ useProjection, t }) {
  const stats = useProjection('sessionStats')
  const usage = useProjection('tokenUsage')
  const [open, setOpen] = React.useState(false)
  const counts = stats === undefined ? t('title') : t('counts', { turns: stats.turns, steps: stats.steps })
  const label = stats?.turnMs === undefined ? counts : `${counts} · ${statisticsDuration(stats.turnMs, t)}`
  return React.createElement(React.Fragment, null,
    React.createElement(Pill, { className: 'dsh-session-statistics-trigger', onClick: () => setOpen(true), active: open,
      'data-composer-stat': 'activity', 'aria-label': `${t('open')} · ${label}`, 'aria-haspopup': 'dialog', 'aria-expanded': open },
    React.createElement(IconGaugeOutlineRegular), React.createElement('span', null, label)),
    React.createElement(Modal, { open, onClose: () => setOpen(false), title: t('title'), closeLabel: t('close'),
      description: `${t('scope')} · ${counts}`, className: 'dsh-session-statistics', contentClassName: 'dsh-session-statistics-content' },
    open && React.createElement(StatisticsDetails, { stats, usage, t })))
}

/** Install a reversible, theme-aware replacement through the public composer slot. */
export function installSessionStatistics(ctx) {
  ctx.effect(() => ctx.locale.register('chat-enhancement-session-statistics', sessionStatisticsLocales))
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = sessionStatisticsCss
    document.head.appendChild(style)
    return () => style.remove()
  })
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock', id: 'activity', priority: -100, order: 0, locale: 'chat-enhancement-session-statistics',
  }, SessionStatisticsPill))
}
