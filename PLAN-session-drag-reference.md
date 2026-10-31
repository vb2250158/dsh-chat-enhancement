# Proposal: drag a session into the composer

Status: unimplemented design proposal. The existing `@session` reference flow is the starting point; this repository does not currently register a session-drag composer entry.

The current DSH API exposes the session-scoped `conversation.input.overlay` list slot in `packages/client/ui-conversation/src/client/contract/slots.ts`. The input hub handles `slash/input-insert-reference`; `packages/context/session-reference/README.md` defines canonical `dsh-session:` references. These are evidence to revisit when implementing against a chosen Host release, not a claim that a sidebar drag payload is a public session-reference API.

Use the existing resolver and reference insertion flow. Keep file drops, ordinary text drops, drafts, selection and sidebar ordering under their existing owners. Do not inspect private registries, patch sidebar DOM, replace the resident attachments renderer, or treat arbitrary dropped text as a trusted session identity.

Before implementation, verify the chosen release's supported drag identity and its sidebar drag-end behavior. The old design identified a possible reorder when a drag crossed another session row before ending in the composer; a new design must prove that session ordering remains unchanged. If that requires a new upstream extension point, review that minimal API separately.

Acceptance must cover successful references, malformed/unknown/self references, Files payloads, drops outside the target, cancelled drags, draft persistence, keyboard access and unchanged sidebar ordering. Touch support needs its own interaction design; no current mobile compatibility claim is made.

## 中文

此文只是尚未实现的会话拖拽引用提案。已有公开引用链路和输入 overlay slot 可作为实现起点，但侧栏拖拽数据不因此成为公开引用协议。实施前核对目标版本的身份、输入与排序行为，不解析私有 registry 或修改侧栏 DOM，不接管正式附件 owner；验收须证明引用、取消、文件拖放、草稿、键盘和侧栏顺序均符合预期。
