# 上下文压缩用时

补丁归属 `dsh-chat-enhancement 0.3.72`。从 DSH `5badb15009ae1756c3afe0ae0cef1faafc290ccc` 基线生成，修改会话统计投影和现有统计弹窗，不新增重复渲染器。

在 Harness 根目录备份当前改动，再执行：

```powershell
git apply --check <plugin>/patches/2026-10-10-compaction-statistics.patch
git apply <plugin>/patches/2026-10-10-compaction-statistics.patch
pnpm install --ignore-scripts
pnpm exec tsc -b packages/session/session-stats/tsconfig.json packages/client/ui-chat/tsconfig.json
pnpm exec tsdown --filter @deepseek-ai/dsh-session-stats
Push-Location packages/client/ui-chat
pnpm exec tsdown --config tsdown.config.ts --config-loader native --env.DSH_BUILD_FACE=client
Pop-Location
```

安装固定提交并重启 Host；浏览器刷新后打开输入框底部的会话统计。已结束的压缩尝试累计到“上下文压缩用时”，失败尝试也计入，未结束记录暂不累计。模型、首 token 和解码区间扣除压缩重叠部分；工具统计仍按原始调用对计时。

缓存状态版本由 1 升为 2，原日志回放重建统计。没有更改持久会话事件及日志代际；不支持原地降级缓存版本。旧提供者或没有全日志投影的界面不虚构压缩耗时。

## 迁移说明

`llmMs`、`ttftMs`、`decodeMs` 的历史数值可能下降，因为现在排除压缩区间。新增 `compactionMs`，消费者可继续读取既有字段；需要独立耗时的客户端读取此字段。宿主与界面必须一起构建更新。

## 验证

```powershell
pnpm exec vitest run packages/session/session-stats/tests/projection.spec.ts packages/client/ui-chat/tests/chat-stats.client.spec.tsx
```

## English

Apply the companion patch to the named upstream baseline after backing up local changes. Build both the session-stats provider and ui-chat consumer, install this fixed plugin revision, restart the Host and refresh the browser. Completed compaction attempts, including failures, are timed from matched lifecycle events; pending attempts remain uncounted. Model, first-token and decode intervals exclude overlapping compaction. Tool timing retains its original call-to-result definition.

Cache state version 2 replays the existing log. Session events and released log generations are unchanged. Existing timing values may decrease; `compactionMs` provides the separate total. Older providers and window-only fallback views do not invent an unavailable duration.
