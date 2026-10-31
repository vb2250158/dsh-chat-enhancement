# Experimental attachment components

These components are source-only UI experiments. They are not imported by the released client, registered in composer slots, exported from the package, or used to upload files. The existing DSH attachment service remains the sole upload and draft owner. The caller supplies localized labels, stable item identities, progress, availability and callbacks.

The rail consumes vertical wheel events while hovered and pages horizontally. File cards expose remove/retry actions. DropOverlay is pointer-transparent and owns no drag listeners. ImageLightbox delegates focus containment, restoration, Escape and backdrop dismissal to the public DSH Modal primitive. The previous unverified decorative SVG illustrations have been removed; these experiments use text and existing public primitives.

Run the isolated verification script with explicit paths to a built DSH checkout and an existing Playwright package. It uses synthetic filenames and local data URLs only, with a new local Vite server and no DSH Home, credentials, model or message route. It does not start the released plugin.

```powershell
node scripts/check-attachment-experiments.mjs --dsh-source '<built DSH checkout>' --playwright '<existing playwright/index.mjs>' --output '<new evidence directory>'
```

The package metadata locales translate plugin-list names/descriptions only. Full component labels belong to a future caller's locale namespace. Composer integration and actual upload, persistence and Session behavior remain separate work and require their own end-to-end acceptance.

## 中文

本目录仅保存未接入正式 composer 的 UI 实验源码；不进入已发布客户端或插件导出，不负责上传与草稿存储。调用者提供本地化文案、文件状态、稳定 ID 和回调。预览复用公开 Modal 的焦点和关闭行为，来源未经确认的插画已移除。上面的命令在独立本地页面使用合成数据验证组件，不启动正式插件或访问 DSH Home。正式集成、上传、持久化和会话行为需要独立实现及验收。
