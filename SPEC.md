# XOUL Product ID Experience V0.1

## Outcome

在本机实现一个可运行的底层产品原型：管理员创建 Product ID，绑定产品身份、知识条目、Agent、Workflow 和功能卡片；C 端通过公开入口 `/e/{entrypoint}` 进入对应产品体验，并在通用 Chat 界面中使用预设能力。

## Scope

- 产品形象：产品配置支持 PNG/JPG/WebP 上传、预览、替换和移除；上限 2MB、1600 万像素，保存为最长边 1200px 的本地图片。保存产品后会异步调用已选公共模型进行图片理解，生成主体、场景、使用方式、安全边界及可编辑的产品 Prompt；仅当产品 Prompt 为空时自动填入识别出的 Prompt，避免覆盖人工设定。当前图片仅存于当前浏览器，不提供跨设备图片服务。
- 实体欢迎：`agent.welcome` 可按产品配置；C 端以产品名称作为说话者，第一人称问候，不把一句话产品介绍当作欢迎语。无自定义内容时按产品类型提供默认问候。
- 纯 Chat 展示：产品图位于欢迎消息内部，头部与消息头像同步使用；功能卡片仍在欢迎消息内。未配置/加载失败时保留文字问候，不伪造产品照片。
- Product Registry：产品创建、唯一 Product ID、启用/停用。
- Entrypoint Resolver：公开 slug 解析到 Product ID 与 Experience。
- Product URL：管理端根据当前站点 origin 与公开 slug 生成完整 C 端 URL，支持一键打开和复制，可直接写入 NFC；修改 slug 后链接自动更新。
- Knowledge：简单的文字知识条目管理；支持导入 `.md`、`.csv`、PNG/JPG/WebP 图片并作为可编辑知识条目绑定到当前产品。
- Extensible product context：产品支持自定义 `extra_fields` key/value 数组；非空字段会和产品 Prompt、类型 Prompt、图片理解结果、知识条目一起注入 C 端对话上下文。知识库图片只注入标题和说明，不默认发送给模型；用户询问图片/示意时由聊天界面按需展示。
- Agent Definition：角色、语气、回答规则、记忆开关。
- Shared Model Reference：模型连接只在公共模型库维护；产品仅选择 `model_profile_id`，不保存 Provider、接口地址或 API Key。
- Workflow Definition：开放式步骤配置；步骤作为模型编排约束注入上下文，由模型按问题选择需要的知识和步骤，不强制机械执行全部步骤。当前不是独立的检索/工具编排引擎。
- Capability Cards：产品级可配置引导卡片。
- C 端 Experience：产品身份、卡片、聊天记录和模拟引用；知识库图片仅在用户明确询问图片/示意/外观时由聊天区按需展示。
- User Profile Memory：本地用户画像包含头像、偏好、目标和注意事项；每个用户在每个 Agent 下的输入与回答完整留存，当前 Agent 仅取最近记录参与上下文；后台提供用户画像管理，C 端提供已登录状态和画像切换体验。
- 健身示例：动作指导、主要肌群、训练量计算、安全注意事项。

## Non-goals

- 不开发 NFC 写卡、NFC SDK 或芯片读写。
- 不接真实数据库、对象存储或文档解析服务；Markdown/CSV 在浏览器本地读取并保存为产品知识条目，原始文本随产品上下文发送给模型。模型已支持本地 OpenAI-compatible 代理，需在公共模型配置中填写地址、模型标识和 API Key。
- 不做多租户、登录、支付、复杂 RBAC、Multi-Agent、拖拽式 Workflow 编辑器。

## Product contract

```text
entrypoint slug -> experience -> product -> agent + workflow + knowledge + cards
```

Product ID 与公开入口分离。入口可停用或重新绑定；C 端只拿到公开体验配置，不暴露内部管理字段。

## Local prototype behavior

1. 管理端可以创建或选择产品。
2. 产品详情可以编辑身份、知识条目、Agent 设定、Workflow 步骤和卡片。
3. 公共配置中心拆分为独立的产品类型页与模型接入页；两页均提供列表、搜索、新建、编辑、启停、删除和保存反馈。
4. “打开 C 端体验”通过 `/e/{slug}` 进入公开页面。
5. C 端为纯 Chat 布局：顶部显示产品名称，底部固定输入框；功能卡片只显示在助手欢迎消息内。
6. 点击卡片进入对话；训练量表单、取消状态、计算结果都显示在对话消息内，不使用独立卡片区或弹窗。
7. 健身训练量使用确定性计算器：sets × reps × weight。
8. 普通问答展示本地知识摘录及可展开来源，明确标注尚未连接模型。
9. 数据保存在 localStorage，刷新后仍然存在。

## Acceptance checks

- 新建产品后自动生成唯一 `product_id` 与 `entrypoint_slug`。
- 修改产品配置后，公开入口显示最新卡片和身份。
- 停用入口后，公开入口显示不可用状态。
- 不同产品的知识、卡片和聊天记录互不混用。
- 健身计算器对 4 组 × 12 次 × 40 kg 返回 1920 kg。
- 移动宽度下 C 端页面无横向滚动，卡片和聊天输入可用。
- C 端实际挂载 Chat UI 控制器，只有一个输入框；异步回答期间不重建输入框、不丢草稿。
- 管理端六个页签可切换，动态添加条目不丢失正在编辑的内容，保存卡片后保留能力绑定。
- 产品可添加、修改、删除扩展字段；保存后扩展字段出现在模型请求的 system context 中。
- 选择 `.md`、`.csv` 或图片文件后新增一条以文件名命名的知识条目，保存后文本进入当前产品的对话上下文；图片在用户需要时由聊天区展示。
- 后台用户画像页面可管理用户名称、头像、偏好、目标、注意事项和启停；首次运行预置 3 个 Seed。
- C 端显示当前用户身份，切换 3 个 Seed 后聊天记录隔离，发送请求携带画像标识，后端按 Agent 保存互动。

## Suggested future API boundary

```text
GET  /api/v1/public/entrypoints/{slug}
POST /api/v1/public/experiences/{slug}/chat
GET  /api/v1/admin/products/{product_id}
PATCH /api/v1/admin/products/{product_id}
```

## Hosted path mapping

在 `xoul.teamaihub.com` 下使用同域名路径分配：

```text
/             XOUL 首页
/admin        管理端（映射到 admin.html）
/catalog      公共配置中心
/types        产品类型配置（映射到 types.html）
/models       模型接入配置（映射到 models.html）
/e/{slug}     产品 C 端 Chat 体验（映射到 public.html）
/api/...      本地 API 服务（反向代理到 127.0.0.1:8780）
```

服务器部署不上传本机 `.xoul.local.json`；模型地址、模型标识和 API Key 由服务器端单独配置。

本地 API 使用 Python 标准库实现：`python3 server.py` 监听 `127.0.0.1:8780`。管理端将产品和公共目录同步到 `.xoul.local.json`；C 端调用 `/api/v1/public/experiences/{slug}/chat`，后端向 `{base_url}/v1/chat/completions` 发起 `stream:true` 请求并将 OpenAI SSE 增量归一化后返回。API Key 只在本机后端文件和上游请求中出现，不进入公开入口响应。
