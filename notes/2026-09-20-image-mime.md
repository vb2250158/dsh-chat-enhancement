# 图片扩展名与内容不一致

QQ 样例的扩展名为 `.png`，文件头为 JPEG。浏览器提交 `image/png` 后，官方存储返回 `IMAGE_TYPE_MISMATCH`。

插件通过 bundle 停用官方 `attachment-local` 条目并提供其公开实现的子类。仅在 `validateImage`、`saveImage`、`saveImages` 入口按四种已有图片签名修正 MIME，未知签名保持原输入。官方解码器继续执行完整校验，文件名、字节、存储目录、历史读取、压缩和普通文件处理保持原有实现。

原条目的自定义配置不会自动转移；使用自定义附件限制或目录的部署须把配置迁到 `chat-enhancement-attachments`。卸载插件后应把配置迁回。现有默认配置无需迁移。

运行 `npm test` 验证插件回归；设置 `DSH_SOURCE_ROOT` 后运行 `node --test tests/image-attachments.integration.mjs` 验证官方存储集成。可用 `DSH_IMAGE_SAMPLE` 指定本地问题图片，样例内容不进入仓库。测试覆盖四种格式、完整准入与历史读回、普通文件、整批失败无部分写入、数量和资源限制。
