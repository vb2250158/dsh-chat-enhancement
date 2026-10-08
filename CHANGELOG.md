# Changelog

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
