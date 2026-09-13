# XOUL

本机产品实体对话原型。前端静态页面运行在 `8765`，OpenAI-compatible 本地代理运行在 `8780`。

```bash
screen -dmS xoul-static zsh -lc 'cd /Users/cg/Documents/Xoul && exec python3 -m http.server 8765 --bind 127.0.0.1'
screen -dmS xoul-api zsh -lc 'cd /Users/cg/Documents/Xoul && exec python3 server.py'
```

打开管理端 `/admin.html`，在「类型与模型」配置公共模型地址、模型标识和 API Key；产品选择公共模型后保存，C 端通过本地 API 以 OpenAI `chat/completions` 流式协议调用。Key 保存在被忽略的 `.xoul.local.json`，不会提交到仓库。

用户画像在 `/profiles.html` 管理。首次运行会预置林夏、周启和 Mia 三个演示用户；C 端顶部的用户按钮可切换画像，每个画像的聊天记录独立保存。后端会将每个画像在当前 Agent 下的输入和回答完整写入 `.xoul.local.json`，并把当前 Agent 最近互动带入模型上下文。
