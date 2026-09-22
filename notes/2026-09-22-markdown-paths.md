# Markdown 预览路径

文件卡片触发的 chatMarkdown/read 原先在解析路径后额外要求目标位于会话工作目录内，导致 Agent 引用已存在的工作区外 SKILL.md 时预览失败。读取改为沿用文件系统服务的路径解析，绝对路径不依赖工作目录，相对路径仍需会话 cwd。会话存在性、Markdown 扩展名、普通文件、UTF-8 和大小限制保持原样。

使用真实 Cordis 服务与临时文件验证工作区内外、上级目录、无 cwd 绝对路径以及缺失文件、目录、非 Markdown、非法 UTF-8 和过大文件。发布后从实际页面点击工作区外 Markdown 文件引用，并核对返回内容。

实际 SKILL.md 包含代码块；原弹窗遗漏 MarkdownText 必需的 labels，路径限制解除后暴露渲染异常。弹窗现在通过已有 locale namespace 提供复制、已复制和脚注文案，产物 DOM 测试覆盖代码块及脚注。
