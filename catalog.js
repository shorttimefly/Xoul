(function () {
  'use strict';
  const KEY = 'xoul.local.catalog.v1';
  const defaults = {
    types: [
      { id: 'fitness_equipment', name: '健身器材', prompt: '你是懂训练与安全的健身器材伙伴。', image: '', enabled: true },
      { id: 'consumer_product', name: '消费产品', prompt: '你是温和、可靠的产品伙伴。', image: '', enabled: true }
    ],
    models: [{ id: 'default_local', name: '本地演示模型', provider: 'OpenAI-compatible', base_url: '', model: '', temperature: .3, max_tokens: 2048, api_key: '', enabled: true }]
  };
  const page = document.body.dataset.catalogPage || 'types';
  const isTypes = page === 'types';
  const collectionKey = isTypes ? 'types' : 'models';
  const config = isTypes ? {
    eyebrow: 'PRODUCT TYPES', title: '产品类型', description: '定义产品的共同人格、提示词和视觉标识，产品配置时直接选择。', singular: '产品类型', empty: '还没有产品类型，先创建一个通用类型。'
  } : {
    eyebrow: 'MODEL CONNECTIONS', title: '模型接入', description: '集中管理 OpenAI-compatible 模型连接，多个产品可以复用同一个配置。', singular: '模型配置', empty: '还没有模型接入，先创建一个连接配置。'
  };
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const load = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      if (value && Array.isArray(value.types) && Array.isArray(value.models)) return value;
    } catch (_) {}
    const value = clone(defaults); localStorage.setItem(KEY, JSON.stringify(value)); return value;
  };
  let data = load();
  let selectedId = null;
  let query = '';

  function sync() {
    fetch(window.XoulApiBase() + '/api/v1/admin/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog: data, products: JSON.parse(localStorage.getItem('xoul.local.products.v1') || '[]') })
    }).catch(() => {});
  }
  function persist(message) {
    localStorage.setItem(KEY, JSON.stringify(data)); sync();
    $('saveState').textContent = message || '已保存'; $('notice').textContent = message || '配置已保存'; $('notice').hidden = false;
    window.clearTimeout(persist.timer); persist.timer = window.setTimeout(() => { $('notice').hidden = true; }, 3200);
  }
  function inputField(label, value, key, type, wide) {
    const wrapper = document.createElement('label'); if (wide) wrapper.className = 'wide'; wrapper.textContent = label;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input'); input.name = key; input.value = value ?? '';
    if (type !== 'textarea') input.autocomplete = key === 'api_key' ? 'new-password' : 'off';
    if (type !== 'textarea') input.type = type || 'text'; else input.rows = 4;
    wrapper.append(input); return wrapper;
  }
  function renderList() {
    const list = $(collectionKey + 'List'); list.replaceChildren();
    const items = data[collectionKey].filter(item => ((item.name || '') + ' ' + (item.provider || '') + ' ' + (item.model || '')).toLowerCase().includes(query));
    $('listCount').textContent = String(items.length); $('collectionHint').textContent = '共 ' + items.length + ' 项';
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'catalog-empty'; empty.textContent = query ? '没有匹配的配置。' : config.empty; list.append(empty); return; }
    items.forEach(item => {
      const row = document.createElement('article'); row.className = 'catalog-row' + (item.id === selectedId ? ' selected' : '');
      const marker = document.createElement('span'); marker.className = 'catalog-row-marker'; marker.textContent = isTypes ? 'T' : 'M';
      const body = document.createElement('div'); body.className = 'catalog-row-body';
      const heading = document.createElement('div'); heading.className = 'catalog-row-heading';
      const name = document.createElement('strong'); name.textContent = item.name || '未命名';
      const status = document.createElement('span'); status.className = 'catalog-status ' + (item.enabled === false ? 'off' : ''); status.textContent = item.enabled === false ? '已停用' : '已启用';
      heading.append(name, status);
      const meta = document.createElement('small'); meta.textContent = isTypes ? (item.prompt || '未设置类型 Prompt') : ((item.provider || '未设置 Provider') + (item.model ? ' · ' + item.model : ''));
      const id = document.createElement('code'); id.textContent = item.id;
      body.append(heading, meta, id);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'row-edit'; edit.textContent = '编辑'; edit.onclick = () => openEditor(item.id);
      row.append(marker, body, edit); list.append(row);
    });
  }
  function renderEditor() {
    const panel = $('editorPanel'); const item = data[collectionKey].find(value => value.id === selectedId);
    if (!item) { panel.hidden = true; return; }
    panel.hidden = false; $('editorTitle').textContent = item.name || '编辑配置'; $('editorMode').textContent = '编辑 ' + config.singular;
    const fields = $('editorFields'); fields.replaceChildren();
    fields.append(inputField(isTypes ? '类型名称' : '模型名称', item.name, 'name'));
    if (isTypes) {
      fields.append(inputField('类型 Prompt', item.prompt, 'prompt', 'textarea', true));
      fields.append(inputField('类型图片地址（可选）', item.image, 'image', 'url', true));
    } else {
      fields.append(inputField('Provider', item.provider, 'provider'));
      fields.append(inputField('兼容接口地址', item.base_url, 'base_url', 'url', true));
      fields.append(inputField('模型标识', item.model, 'model'));
      fields.append(inputField('API Key', item.api_key, 'api_key', 'password'));
      fields.append(inputField('温度', item.temperature ?? .3, 'temperature', 'number'));
      fields.append(inputField('最大输出 Token', item.max_tokens ?? 2048, 'max_tokens', 'number'));
    }
    const enabled = document.createElement('label'); enabled.className = 'catalog-switch';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'enabled'; checkbox.checked = item.enabled !== false;
    enabled.append(checkbox, document.createTextNode('启用此配置')); fields.append(enabled);
  }
  function openEditor(id) { selectedId = id; renderList(); renderEditor(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function createItem() {
    const id = (isTypes ? 'type_' : 'model_') + Date.now();
    data[collectionKey].unshift(isTypes ? { id, name: '新产品类型', prompt: '', image: '', enabled: true } : { id, name: '新模型', provider: 'OpenAI-compatible', base_url: '', model: '', temperature: .3, max_tokens: 2048, api_key: '', enabled: true });
    selectedId = id; renderList(); renderEditor(); const first = $('editorFields').querySelector('input'); if (first) first.focus();
  }
  function deleteSelected() {
    const item = data[collectionKey].find(value => value.id === selectedId); if (!item) return;
    if (!window.confirm('确定删除“' + (item.name || '未命名') + '”吗？')) return;
    data[collectionKey] = data[collectionKey].filter(value => value.id !== selectedId); selectedId = null; persist('已删除配置'); renderList(); renderEditor();
  }
  $('pageEyebrow').textContent = config.eyebrow; $('pageTitle').textContent = config.title; $('pageDescription').textContent = config.description; $('collectionTitle').textContent = config.title; $('collectionHint').textContent = '共 ' + data[collectionKey].length + ' 项'; $('createButton').textContent = '＋ 新建' + config.singular; $('editorMode').textContent = '选择左侧配置进行编辑'; $('editorPanel').hidden = true;
  $('createButton').onclick = createItem; $('deleteButton').onclick = deleteSelected; $('searchInput').oninput = event => { query = event.target.value.trim().toLowerCase(); renderList(); };
  $('editorForm').onsubmit = event => {
    event.preventDefault(); const item = data[collectionKey].find(value => value.id === selectedId); if (!item) return;
    const form = new FormData(event.target); const name = String(form.get('name') || '').trim();
    if (!name) { $('editorError').textContent = '请先填写名称。'; $('editorError').hidden = false; return; }
    $('editorError').hidden = true; item.name = name; item.enabled = form.get('enabled') === 'on';
    if (isTypes) { item.prompt = String(form.get('prompt') || '').trim(); item.image = String(form.get('image') || '').trim(); }
    else { item.provider = String(form.get('provider') || '').trim(); item.base_url = String(form.get('base_url') || '').trim(); item.model = String(form.get('model') || '').trim(); item.api_key = String(form.get('api_key') || ''); item.temperature = Number(form.get('temperature') || .3); item.max_tokens = Number(form.get('max_tokens') || 2048); }
    persist('已保存' + config.singular); renderList(); renderEditor();
  };
  $('cancelButton').onclick = () => { selectedId = null; renderList(); renderEditor(); };
  sync(); renderList();
})();
