(function () {
  'use strict';
  const K = 'xoul.local.catalog.v1';
  const defaults = { types: [
    { id: 'fitness_equipment', name: '健身器材', prompt: '你是懂训练与安全的健身器材伙伴。', image: '' },
    { id: 'consumer_product', name: '消费产品', prompt: '你是温和、可靠的产品伙伴。', image: '' }
  ], models: [{ id: 'default_local', name: '本地演示模型', provider: 'OpenAI-compatible', base_url: '', model: '', temperature: .3, max_tokens: 2048, api_key: '' }] };
  const $ = id => document.getElementById(id);
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || defaults; } catch (_) { return defaults; } };
  const save = value => { localStorage.setItem(K, JSON.stringify(value)); sync(value); };
  function sync(catalog) {
    fetch(window.XoulApiBase()+'/api/v1/admin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog, products: JSON.parse(localStorage.getItem('xoul.local.products.v1') || '[]') }) }).catch(() => {});
  }
  function field(label, value, cb, type) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const input = document.createElement('input'); input.type = type || 'text'; input.value = value || '';
    input.oninput = () => { cb(input.value); save(data); }; wrapper.append(input); return wrapper;
  }
  let data = load();
  function removeButton(index, collection) {
    const remove = document.createElement('button'); remove.className = 'remove'; remove.type = 'button'; remove.textContent = '×';
    remove.onclick = () => { collection.splice(index, 1); save(data); render(); }; return remove;
  }
  function render() {
    $('types').replaceChildren(); $('models').replaceChildren();
    data.types.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'knowledge-item'; const fields = document.createElement('div');
      fields.append(field('类型名称', item.name, value => item.name = value), field('Prompt 词', item.prompt, value => item.prompt = value), field('图片地址（可选）', item.image, value => item.image = value));
      row.append(fields, removeButton(index, data.types)); $('types').append(row);
    });
    data.models.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'knowledge-item'; const fields = document.createElement('div');
      fields.append(field('模型名称', item.name, value => item.name = value), field('Provider', item.provider, value => item.provider = value), field('兼容接口地址', item.base_url, value => item.base_url = value), field('模型标识', item.model, value => item.model = value), field('API Key（仅本机后端）', item.api_key, value => item.api_key = value, 'password'));
      row.append(fields, removeButton(index, data.models)); $('models').append(row);
    });
  }
  $('addType').onclick = () => { data.types.push({ id: 'type_' + Date.now(), name: '新类型', prompt: '', image: '' }); save(data); render(); };
  $('addModel').onclick = () => { data.models.push({ id: 'model_' + Date.now(), name: '新模型', provider: '', base_url: '', model: '', temperature: .3, max_tokens: 2048, api_key: '' }); save(data); render(); };
  if (!localStorage.getItem(K)) save(data); else sync(data);
  render();
})();
