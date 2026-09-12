# Chat UI integration boundary

Cherry Studio is vendored under `vendor/cherry-studio` for reference only. Its official repository is a desktop-first application and is licensed AGPLv3. XOUL therefore keeps the public H5 surface and product data model independent from Cherry Studio.

The C端 adapter boundary is:

```text
Product ID / entrypoint
  -> public experience config
  -> Chat UI adapter
  -> XOUL chat API
  -> configured model provider
```

The current public page mounts `XoulChatUI.create()` from `chat-ui-kit.js`. This is the local XOUL controller, not an assistant-ui or Cherry Studio integration. `public.js` supplies the local product resolver and knowledge-excerpt adapter. Cards are children of the assistant welcome message; calculator forms and their results stay inside the conversation.

The controller mounts the composer once, guards concurrent sends, preserves drafts, handles cancellation and source expansion, and emits message snapshots to product-scoped browser history storage. New conversation clears the current product's local conversation display.

An adapter implements `send({ message, config, messages, signal })` and returns `{ text, sources: [{ title, content }] }`. It may also return an async iterable of `{ type: "delta", text }` events with optional `sources`. Raw fetch responses must be parsed and converted by the adapter.

When the API is available, replace the local resolver and adapter with:

```text
GET  /api/v1/public/entrypoints/{slug}
POST /api/v1/public/experiences/{slug}/chat
```

The request must carry `product_id`, `experience_id`, `conversation_id`, and the user message. The server chooses the Agent, Workflow, knowledge scope, capability permissions, and model profile. The browser never calls a provider directly.

## Model profile

Each Experience stores a model profile with provider name, OpenAI-compatible base URL, model name, temperature, max output tokens, and streaming preference. API keys are a local prototype field only and must move to server-side secret storage before production.

## Reference decision

Cherry Studio is useful as reference material for provider management, agent presets, conversation affordances, and prompt configuration. It is not the XOUL runtime, Product Registry, Workflow compiler, or public C端 shell.
