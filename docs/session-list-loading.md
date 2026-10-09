# 聊天列表分批加载

配套补丁 `patches/2026-10-09-session-list-loading.patch` 适用于 Harness `0.2.1-alpha.1`、基线 `5badb15009ae1756c3afe0ae0cef1faafc290ccc`。补丁修改会话列表的 Host、Client 与 JSONL 读取流程；插件安装负责分发补丁，实际生效需要应用源码补丁并重建对应包。

首批返回每个工作区最近 5 条空闲根会话，并保留运行中和空白会话。其余会话按最近活动时间每批 50 条异步补齐，每批到达后立即显示。加载期间保留已有列表，合并新消息、运行状态和删除通知；最后一批到达后再核对完整目录。首批仍需发现全部日志 header，后续页复用同一次发现结果，并只计算当前页的完整投影。

JSONL 列表默认同时读取 16 个目录、header 或文件元数据，历史修订计算复用已发现的 generation。header 缓存按实际文件修订校验；取消或失败后等待已开始的读取结束。没有 `paged` 的列表请求仍返回完整结果。分页快照默认保留 8 份、有效期 60 秒；过期游标返回错误，已加载的行保留供重试。

## 应用与重建

写前保存目标文件。已经应用时用 `git apply --reverse --check` 核对，不重复应用；与现有补丁冲突时合并当前源码，再验证受影响文件。

```powershell
$taskHarnessRoot = '<实际 Harness 源码目录>'
$taskPluginRoot = '<dsh-chat-enhancement 源码或安装目录>'
$taskPatch = Join-Path $taskPluginRoot 'patches/2026-10-09-session-list-loading.patch'
git -C $taskHarnessRoot apply --check $taskPatch
git -C $taskHarnessRoot apply $taskPatch
Push-Location $taskHarnessRoot
pnpm run build
Pop-Location
```

Host 与生成的 Remote 描述必须与 Client 一起更新。重建后按当前实例的受管流程重启 Host，并刷新页面；有其它任务持有重启或恢复窗口时，先完成交接。回滚时反向应用补丁，再重建同一组产物。

验收覆盖首批显示、旧页延迟期间打开会话、旧页追加、加载期间删除及活动变化、失败重试、重连和原完整列表接口。合成数据测试使用真实 Web 组合，不修改玩家或用户聊天数据。

## English

The companion patch targets Harness `0.2.1-alpha.1` at `5badb15009ae1756c3afe0ae0cef1faafc290ccc`. Installation distributes the patch; apply it to the checkout used by the active profile and rebuild Host, generated Remote descriptors and Client together.

The first page contains the five most recent idle root Sessions per workspace plus running and blank Sessions. Older Sessions arrive in activity order in pages of 50. Each page becomes visible immediately; established rows remain usable, concurrent updates are replayed, and complete removal reconciliation waits for the final page. Initial discovery still reads all headers; continuations share its ordering and project only their selected rows. JSONL listing bounds concurrent reads at 16, validates header caches against file revisions, and shares generation discovery with historical revision calculation. Cancellation and failure await admitted reads. Requests without `paged` retain complete-list behavior. Up to eight catalog snapshots are retained for 60 seconds; expired cursors fail without clearing received rows.

Back up target files, run `git apply --check`, apply the patch and rebuild as shown above. An already-applied patch passes `git apply --reverse --check`. Resolve conflicts with existing local patches before rebuilding. Restart the Host through its managed workflow and reload the page after any concurrent restart or recovery owner releases that window. To revert, reverse the patch and rebuild. Validate progressive arrival, interaction while older pages are delayed, update/removal races, failure retry, reconnect and complete-list callers with synthetic data through the real Web composition.
