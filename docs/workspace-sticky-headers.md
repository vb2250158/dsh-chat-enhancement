# 工作区文件夹吸顶

工作区分组列表滚动时，当前文件夹标题保留在列表顶部。嵌套文件夹排列在父级标题下方；离开一个分组时，后续分组接替。标题使用原文件夹行，保留折叠、展开、新建会话、菜单和拖拽操作。侧栏背景取当前主题令牌，定位会话时预留标题高度。

配套补丁为 `patches/2026-10-08-workspace-sticky-headers.patch`，适用于 DSH `0.2.1-alpha.1` 的 `ui-workspace`。插件安装只携带补丁，每台机器需要对实际 profile 指向的 Harness 源码应用补丁并重建工作区客户端。源码更新后重新执行检查；发生冲突时先合并当前源码，不覆盖其他修改。

```powershell
$taskHarnessRoot = '<实际 Harness 源码目录>'
$taskPluginRoot = '<dsh-chat-enhancement 源码或安装目录>'
$taskPatch = Join-Path $taskPluginRoot 'patches/2026-10-08-workspace-sticky-headers.patch'
git -C $taskHarnessRoot apply --check $taskPatch
git -C $taskHarnessRoot apply $taskPatch
Push-Location $taskHarnessRoot
node node_modules/typescript/bin/tsc -b packages/client/ui-workspace/tsconfig.json --pretty false
Push-Location packages/client/ui-workspace
node ../../../node_modules/tsdown/dist/run.mjs --env.DSH_BUILD_FACE client
Pop-Location
Pop-Location
```

已应用时，用 `git -C $taskHarnessRoot apply --reverse --check $taskPatch` 核对，不重复应用。回滚用 `git -C $taskHarnessRoot apply --reverse $taskPatch`，随后按相同命令重建客户端。两种操作都应先备份目标文件；重建后刷新页面。

验收覆盖长会话列表吸顶、跨分组切换、嵌套标题排列、折叠展开、文件夹菜单和会话定位。检查浅色、深色及自定义主题下的背景遮挡，并确认页面实际下发的客户端包含 `data-dsh-workspace-header`。

## English

Workspace headers remain visible while their sessions scroll. Nested headers stack below ancestor headers, and the following group replaces the previous group at its end. The patch retains the original row and its controls, uses the sidebar theme token and reserves header space when revealing sessions.

The companion patch targets the `ui-workspace` source in DSH `0.2.1-alpha.1`. Installing this plugin distributes the patch but does not apply it. Apply it to the Harness checkout used by the active profile, rebuild the workspace client with the commands above and reload the page. Check for conflicts after upstream updates; reverse the patch and rebuild to roll back. Validate scrolling, group transitions, nested headers, existing controls and all supported themes against the served client artifact.
