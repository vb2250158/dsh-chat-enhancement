/** Presentation readings from the host-owned, whole-log statistics projection. */
export function sessionStatisticsReading(stats) {
  if (stats === undefined) return { timings: [], averageTtft: undefined, speed: undefined, scale: 0 }
  const timings = [
    { key: 'model', milliseconds: stats.llmMs },
    { key: 'tools', milliseconds: stats.toolMs },
    { key: 'compaction', milliseconds: stats.compactionMs },
    { key: 'other', milliseconds: stats.otherMs },
  ]
  return {
    timings,
    averageTtft: stats.ttftSteps > 0 ? stats.ttftMs / stats.ttftSteps : undefined,
    speed: stats.decodeMs > 0 ? stats.decodeTokens * 1000 / stats.decodeMs : undefined,
    scale: Math.max(stats.turnMs ?? 0, ...timings.map(row => row.milliseconds ?? 0)),
  }
}
