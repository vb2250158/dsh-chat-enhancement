# Changelog

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
