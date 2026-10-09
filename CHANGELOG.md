# Changelog

## 0.3.71 (2026-10-09)

- 补回当前宿主的主会话、子会话及额度失败续跑接口，保留原身份和待处理输入。
- 区分临时失败与宿主能力缺失；保留失败项，停用无效重试，显示逐项错误与成功数量。
- 用户已在原会话继续运行时移除过期失败提示；超时测试等待真实挂载信号，避免固定毫秒延迟导致误报。
- 配套宿主补丁更新为当前源码，并覆盖重复请求、取消、维护期间拒绝、原父关系和新挂载失败释放。

## 0.3.67 (2026-10-08)

- 提问图文中的本地图片支持 Desktop 的 `dsh-app://app`，仍拒绝 Shell 页面、相对路径和危险协议。
- Local question images use the Desktop application's authenticated file route; shell pages, relative paths and unsafe schemes remain rejected.

## 0.3.66 (2026-10-08)

- 使用标题服务已有的用户输入聚合判断空会话，列名读取现有投影候选；写前仍复核当前标题，避免批量列名重复载入旧日志。
- Use the title owner's existing input aggregate and cached listing candidates, retaining the authoritative pre-write title check without cold-log batch reads.

## 0.3.65 (2026-10-08)

- 会话命名通过正式异步观察读取用户消息，释放观察后调用标题生成；真实 Session 验证不依赖已移除的 `events` 属性。
- Read title input through asynchronous session observations, releasing the observation before generation; cover the current Session class without an `events` property.

## 0.3.64 (2026-10-08)

- 恢复会话菜单自动重命名，提供写前复核及写后回读的批量调用入口；空会话使用可确认元数据命名。
- Restore Auto-rename through the public session-menu slot, with guarded batch naming and title readback; name empty sessions from recorded metadata.

## 0.3.63 (2026-10-08)

- 增加工作区文件夹吸顶补丁，保留原文件夹操作，嵌套标题按层级排列。
- Bundle the workspace sticky-header patch, retaining existing controls and stacking nested headers below ancestors.

## 0.3.61 (2026-10-08)

- 中断检查默认 4 路限量并行，最后轮次反向读取，保留原恢复顺序、失败重试和取消释放。
- Bound interruption scans to four concurrent reads and inspect final turns backwards, preserving resumption order, retries and cancellation cleanup.

## 0.3.60 (2026-10-07)

- 缩小图标绘制内容约三分之一，增加方框内的留白。
- Reduce icon artwork by one third with a centered, padded viewBox.

## 0.3.59 — 2026-10-07

- Open this plugin from the Plugins list to access its existing configuration and controls. Settings no longer duplicates its navigation entry.
- 在插件列表中点击本插件进入详情页，即可使用原有配置和操作界面；设置菜单不再重复显示该插件入口。

## 0.3.58 (2026-10-07)

- 为插件列表提供中英文名称与说明，并发布独立的 SVG 图标。
- Publish English and Chinese plugin display metadata and a dedicated SVG icon.
