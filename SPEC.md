# XOUL Product ID Experience V0.1

## Outcome

在本机实现一个可运行的底层产品原型：管理员创建 Product ID，绑定产品身份、知识条目、Agent、Workflow 和功能卡片；C 端通过公开入口 `/e/{entrypoint}` 进入对应产品体验，并在通用 Chat 界面中使用预设能力。

## Scope

- 产品形象：产品配置支持 PNG/JPG/WebP 上传、预览、替换和移除；上限 2MB、1600 万像素，保存为最长边 1200px 的本地图片。当前仅存于当前浏览器，不提供跨设备图片服务。
- 实体欢迎：`agent.welcome` 可按产品配置；C 端以产品名称作为说话者，第一人称问候，不把一句话产品介绍当作欢迎语。无自定义内容时按产品类型提供默认问候。
- 纯 Chat 展示：产品图位于欢迎消息内部，头部与消息头像同步使用；功能卡片仍在欢迎消息内。未配置/加载失败时保留文字问候，不伪造产品照片。
- Product Registry：产品创建、唯一 Product ID、启用/停用。
- Entrypoint Resolver：公开 slug 解析到 Product ID 与 Experience。
- Knowledge：简单的文字知识条目管理；文件上传先保留 UI 状态，不做真实解析。
- Agent Definition：角色、语气、回答规则、记忆开关。
- Workflow Definition：结构化步骤配置，支持上下文、知识检索、意图识别、能力调用、回答。
- Capability Cards：产品级可配置引导卡片。
- C 端 Experience：产品身份、卡片、聊天记录和模拟引用。
- 健身示例：动作指导、主要肌群、训练量计算、安全注意事项。

## Non-goals

- 不开发 NFC 写卡、NFC SDK 或芯片读写。
- 不接真实模型、真实数据库、对象存储或文档解析服务。
- 不做多租户、登录、支付、复杂 RBAC、Multi-Agent、拖拽式 Workflow 编辑器。

## Product contract

```text
entrypoint slug -> experience -> product -> agent + workflow + knowledge + cards
```

Product ID 与公开入口分离。入口可停用或重新绑定；C 端只拿到公开体验配置，不暴露内部管理字段。

## Local prototype behavior

1. 管理端可以创建或选择产品。
2. 产品详情可以编辑身份、知识条目、Agent 设定、Workflow 步骤和卡片。
3. “打开 C 端体验”通过 `/e/{slug}` 进入公开页面。
4. C 端为纯 Chat 布局：顶部显示产品名称，底部固定输入框；功能卡片只显示在助手欢迎消息内。
5. 点击卡片进入对话；训练量表单、取消状态、计算结果都显示在对话消息内，不使用独立卡片区或弹窗。
6. 健身训练量使用确定性计算器：sets × reps × weight。
7. 普通问答展示本地知识摘录及可展开来源，明确标注尚未连接模型。
8. 数据保存在 localStorage，刷新后仍然存在。

## Acceptance checks

- 新建产品后自动生成唯一 `product_id` 与 `entrypoint_slug`。
- 修改产品配置后，公开入口显示最新卡片和身份。
- 停用入口后，公开入口显示不可用状态。
- 不同产品的知识、卡片和聊天记录互不混用。
- 健身计算器对 4 组 × 12 次 × 40 kg 返回 1920 kg。
- 移动宽度下 C 端页面无横向滚动，卡片和聊天输入可用。
- C 端实际挂载 Chat UI 控制器，只有一个输入框；异步回答期间不重建输入框、不丢草稿。
- 管理端六个页签可切换，动态添加条目不丢失正在编辑的内容，保存卡片后保留能力绑定。

## Suggested future API boundary

```text
GET  /api/v1/public/entrypoints/{slug}
POST /api/v1/public/experiences/{slug}/chat
GET  /api/v1/admin/products/{product_id}
PATCH /api/v1/admin/products/{product_id}
```

本轮使用浏览器本地适配器实现同一边界，后续可替换为 FastAPI，不改前端产品模型。
