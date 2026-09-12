/* XOUL local data adapter. The interface mirrors the future HTTP API and keeps
 * the prototype independent from a database or model provider. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else { root.XoulData = factory(root); root.XoulLocal = root.XoulData; }
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const STORAGE_KEY = 'xoul:v0:data';
  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const fitness = () => {
    const productId = 'fitness-machine-318';
    const experienceId = 'experience_fitness_318';
    const agentId = 'agent_fitness_318';
    const workflowId = 'workflow_fitness_default';
    const knowledgeId = 'knowledge_fitness_318';
    const created = now();
    return {
      version: 1, products: [{ id: productId, product_id: productId, name: '深蹲训练器 318', type: 'fitness_equipment', status: 'active', description: '你的专属训练助手', image: '', identity: { name: '深蹲训练器 318', brand: 'XOUL Fitness', model: '318', description: '帮助你安全完成训练并理解训练数据' }, xoul: { id: 'xoul_fitness_318', state: 'ready' }, knowledge_collection_id: knowledgeId, created_at: created, updated_at: created }],
      entrypoints: [{ id: 'entry_fitness_318', public_slug: productId, type: 'nfc', product_id: productId, experience_id: experienceId, status: 'active', created_at: created }],
      experiences: [{ id: experienceId, product_id: productId, name: '健身指导', status: 'active', agent_id: agentId, workflow_id: workflowId, knowledge_collection_id: knowledgeId, card_ids: ['card_explain', 'card_muscles', 'card_volume', 'card_safety'], created_at: created, updated_at: created }],
      agents: [{ id: agentId, name: '健身指导 Agent', description: '提供动作、肌群和训练建议', role: '专业、耐心的健身指导助手', tone: '清晰友好', rules: ['基于产品知识回答', '涉及安全时提醒量力而行'], memory_enabled: true }],
      workflows: [{ id: workflowId, name: '健身问答流程', version: 1, steps: [{ type: 'load_product_context' }, { type: 'retrieve_knowledge', top_k: 6 }, { type: 'classify_intent' }, { type: 'run_capability' }, { type: 'generate_answer' }] }],
      cards: [{ id: 'card_explain', title: '怎么做这个动作？', prompt: '请介绍这个器械的正确动作和步骤。', capability_id: 'explain_exercise', sort_order: 1, enabled: true }, { id: 'card_muscles', title: '主要锻炼哪些肌肉？', prompt: '这个动作主要锻炼哪些肌肉？', capability_id: 'identify_muscles', sort_order: 2, enabled: true }, { id: 'card_volume', title: '帮我算训练量', prompt: '帮我计算今天的训练量。', capability_id: 'calculate_training_volume', sort_order: 3, enabled: true, input_schema: { sets: 'number', reps: 'number', weight_kg: 'number' } }, { id: 'card_safety', title: '安全注意事项', prompt: '这个动作有哪些安全注意事项？', capability_id: 'check_safety_notes', sort_order: 4, enabled: true }],
      cards: [{ id: 'card_explain', title: '怎么做这个动作？', prompt: '请介绍这个器械的正确动作和步骤。', capability_id: 'explain_exercise', sort_order: 1, enabled: true }, { id: 'card_muscles', title: '主要锻炼哪些肌肉？', prompt: '这个动作主要锻炼哪些肌肉？', capability_id: 'identify_muscles', sort_order: 2, enabled: true }, { id: 'card_volume', title: '帮我算训练量', prompt: '帮我计算今天的训练量。', capability_id: 'calculate_training_volume', sort_order: 3, enabled: true, input_schema: { sets: 'number', reps: 'number', weight_kg: 'number' } }, { id: 'card_safety', title: '安全注意事项', prompt: '这个动作有哪些安全注意事项？', capability_id: 'check_safety_notes', sort_order: 4, enabled: true }],
      capabilities: [{ id: 'explain_exercise', name: '动作指导' }, { id: 'identify_muscles', name: '主要肌群' }, { id: 'calculate_training_volume', name: '计算训练量' }, { id: 'check_safety_notes', name: '安全注意事项' }],
      knowledge: [{ id: 'knowledge_fitness_318', product_id: productId, name: '深蹲训练器知识', entries: [{ id: 'knowledge_entry_1', title: '基础动作', content: '双脚与肩同宽，保持背部中立，屈膝下蹲后用脚底发力返回。动作应平稳可控。', source: '动作说明' }, { id: 'knowledge_entry_2', title: '安全事项', content: '训练前热身，选择适合自己的重量；如有疼痛请立即停止并咨询专业人士。', source: '安全注意事项' }] }],
      conversations: [], audit: { created_at: created }
    };
  };

  function storage() { return root && root.localStorage ? root.localStorage : null; }
  function load() { const s = storage(); if (!s) return fitness(); try { const raw = s.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : fitness(); } catch (_) { return fitness(); } }
  let db = load();
  function persist() { const s = storage(); if (s) s.setItem(STORAGE_KEY, JSON.stringify(db)); return clone(db); }
  function save(next) { db = clone(next); return persist(); }
  function reset() { db = fitness(); return persist(); }
  function find(collection, value) { return (db[collection] || []).find((x) => x.id === value || x.product_id === value || x.public_slug === value); }

  function createProduct(input) {
    const productId = input.product_id || id('product');
    if (find('products', productId)) throw new Error('product_id already exists');
    const stamp = now(), experienceId = id('experience'), agentId = id('agent'), workflowId = id('workflow'), knowledgeId = id('knowledge');
    const product = { id: productId, product_id: productId, name: input.name || '未命名产品', type: input.type || 'generic', status: 'active', description: input.description || '', image: input.image || '', identity: input.identity || {}, xoul: { id: id('xoul'), state: 'ready' }, knowledge_collection_id: knowledgeId, created_at: stamp, updated_at: stamp };
    db.products.push(product); db.entrypoints.push({ id: id('entry'), public_slug: input.public_slug || productId, type: 'nfc', product_id: productId, experience_id: experienceId, status: 'active', created_at: stamp });
    db.experiences.push({ id: experienceId, product_id: productId, name: input.experience_name || '产品助手', status: 'active', agent_id: agentId, workflow_id: workflowId, knowledge_collection_id: knowledgeId, card_ids: [], created_at: stamp, updated_at: stamp });
    db.agents.push({ id: agentId, name: input.agent_name || `${product.name} Agent`, role: input.agent_role || '产品助手', tone: '清晰友好', rules: [], memory_enabled: true });
    db.workflows.push({ id: workflowId, name: '默认流程', version: 1, steps: [{ type: 'load_product_context' }, { type: 'retrieve_knowledge' }, { type: 'generate_answer' }] }); db.knowledge.push({ id: knowledgeId, product_id: productId, name: `${product.name}知识`, entries: [] });
    persist(); return getProduct(productId);
  }
  function getProduct(productId) { const p = find('products', productId); return p ? clone(p) : null; }
  function resolveEntrypoint(slug) { const e = find('entrypoints', slug); if (!e) return { status: 'not_found', entrypoint: null }; if (e.status !== 'active') return { status: 'inactive', entrypoint: clone(e) }; const p = find('products', e.product_id), x = find('experiences', e.experience_id); if (!p || !x || x.status !== 'active') return { status: 'unavailable', entrypoint: clone(e) }; const a = find('agents', x.agent_id), w = find('workflows', x.workflow_id), k = find('knowledge', x.knowledge_collection_id); const cards = (x.card_ids || []).map((cid) => find('cards', cid)).filter(Boolean).sort((m,n) => (m.sort_order||0)-(n.sort_order||0)); return { status: 'active', entrypoint: clone(e), product: clone(p), experience: clone(x), agent: clone(a), workflow: clone(w), knowledge: clone(k), cards: clone(cards) }; }
  function updateConfig(productId, patch) { const p = db.products.find((x) => x.product_id === productId || x.id === productId); if (!p) return null; Object.assign(p, patch, { updated_at: now() }); persist(); return getProduct(productId); }
  function getConfig(productId) { const r = resolveEntrypoint((db.entrypoints.find((e) => e.product_id === productId) || {}).public_slug); return r.status === 'active' ? r : null; }
  function calculateTrainingVolume(sets, reps, weightKg) { const values = [sets, reps, weightKg].map(Number); if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('sets, reps and weightKg must be non-negative numbers'); return { sets: values[0], reps: values[1], weight_kg: values[2], volume_kg: values[0] * values[1] * values[2] }; }
  function addKnowledge(productId, entry) { const p = db.knowledge.find((x) => x.product_id === productId); if (!p) throw new Error('knowledge collection not found'); const item = Object.assign({ id: id('knowledge_entry'), title: '未命名条目', content: '', source: '手工录入', created_at: now() }, entry); p.entries.push(item); persist(); return clone(item); }
  function addConversation(productId, conversation) { db.conversations.push(Object.assign({ id: id('conversation'), product_id: productId, messages: [], created_at: now(), updated_at: now() }, conversation)); persist(); return clone(db.conversations[db.conversations.length - 1]); }
  return { STORAGE_KEY, load: () => clone(db), save, reset, createProduct, getProduct, resolveEntrypoint, getConfig, updateConfig, addKnowledge, addConversation, calculateTrainingVolume, product: { create: createProduct, get: getProduct }, entrypoint: { resolve: resolveEntrypoint }, config: { get: getConfig, update: updateConfig }, knowledge: { add: addKnowledge }, training: { calculateVolume: calculateTrainingVolume } };
}));
