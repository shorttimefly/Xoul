(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  let profiles = [], currentId = null, dirty = false;
  const lines = value => String(value || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
  const setLines = value => (Array.isArray(value) ? value : []).join('\n');
  function notice(message) { $('notice').textContent = message; $('notice').hidden = false; window.clearTimeout(notice.timer); notice.timer = window.setTimeout(() => { $('notice').hidden = true; }, 4200); }
  function profile() { return profiles.find(item => item.id === currentId); }
  function markSaved() { dirty = false; $('saveState').textContent = '已保存'; }
  function renderList() {
    $('profileCount').textContent = profiles.length + ' 个画像'; $('profilesList').replaceChildren();
    profiles.forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-list-item' + (item.id === currentId ? ' active' : '');
      button.innerHTML = '<span class="avatar"></span><span><strong></strong><small></small></span><span class="history-count"></span>';
      button.querySelector('.avatar').textContent = item.avatar || item.name?.slice(0, 1) || '?'; button.querySelector('strong').textContent = item.name || '未命名画像'; button.querySelector('small').textContent = (item.headline || '暂无标签') + (item.enabled === false ? ' · 已停用' : '');
      button.querySelector('.history-count').textContent = ((item.agent_history || []).length || 0) + ' 条互动'; button.onclick = () => select(item.id); $('profilesList').append(button);
    });
    if (!$('profilesList').childElementCount) $('profilesList').append(Object.assign(document.createElement('div'), { className: 'profile-empty', textContent: '还没有用户画像。' }));
  }
  function fill() {
    const item = profile(); if (!item) { $('editorPanel').hidden = true; renderList(); return; }
    $('editorPanel').hidden = false; $('editorTitle').textContent = item.name || '编辑画像'; $('profileName').value = item.name || ''; $('profileAvatar').value = item.avatar || ''; $('profileHeadline').value = item.headline || ''; $('profilePreferences').value = setLines(item.preferences); $('profileGoals').value = setLines(item.goals); $('profileNotes').value = item.notes || ''; $('profileEnabled').checked = item.enabled !== false;
    const count = item.agent_history || []; const agents = new Set(count.map(event => event.agent_id).filter(Boolean)); $('historySummary').innerHTML = '<strong>' + count.length + '</strong> 条输入/回答已保存，覆盖 <strong>' + agents.size + '</strong> 个 Agent。历史记录只会按当前 Agent 的最近内容注入上下文。';
    renderList();
  }
  function select(id) { if (dirty && !window.confirm('当前画像还有未保存的修改。放弃修改并切换？')) return; currentId = id; dirty = false; fill(); }
  function create() { if (dirty && !window.confirm('当前画像还有未保存的修改。放弃修改并新建？')) return; const id = 'user_' + Date.now().toString(36); profiles.push({ id, name: '新用户', avatar: '新', headline: '', preferences: [], goals: [], notes: '', enabled: true, seed: false, agent_history: [] }); currentId = id; dirty = true; fill(); $('profileName').focus(); }
  function collect() { const item = profile(); if (!item) return; item.name = $('profileName').value.trim(); item.avatar = $('profileAvatar').value.trim() || item.name.slice(0, 1); item.headline = $('profileHeadline').value.trim(); item.preferences = lines($('profilePreferences').value); item.goals = lines($('profileGoals').value); item.notes = $('profileNotes').value.trim(); item.enabled = $('profileEnabled').checked; item.seed = false; dirty = true; $('saveState').textContent = '未保存'; $('editorTitle').textContent = item.name || '编辑画像'; renderList(); }
  async function save() { collect(); const item = profile(); if (!item?.name) { notice('请填写用户名称。'); return; } window.XoulProfiles.save(profiles); try { const response = await fetch(window.XoulApiBase() + '/api/v1/admin/user-profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_profiles: profiles }) }); if (!response.ok) throw new Error('HTTP ' + response.status); markSaved(); notice('用户画像已保存，C 端可立即切换体验。'); } catch (_) { $('saveState').textContent = '本地已保存'; notice('服务器保存失败，本地修改已保存，请重试。'); dirty = false; } renderList(); }
  async function boot() { profiles = window.XoulProfiles.load(); try { const response = await fetch(window.XoulApiBase() + '/api/v1/admin/user-profiles'); const payload = await response.json(); if (response.ok && Array.isArray(payload.user_profiles) && payload.user_profiles.length) { profiles = window.XoulProfiles.save(payload.user_profiles); } } catch (_) {} currentId = profiles[0]?.id || null; fill(); }
  $('profileForm').addEventListener('input', () => { dirty = true; $('saveState').textContent = '未保存'; }); $('profileForm').addEventListener('change', () => { dirty = true; $('saveState').textContent = '未保存'; }); $('profileForm').onsubmit = event => { event.preventDefault(); save(); }; $('newProfile').onclick = create; $('cancelEdit').onclick = () => { dirty = false; fill(); }; $('deleteProfile').onclick = () => { const item = profile(); if (!item) return; if (profiles.length <= 1) { notice('至少保留一个可管理的用户画像。'); return; } if (!window.confirm('确认删除“' + item.name + '”？该画像的本地管理记录也会移除。')) return; profiles = profiles.filter(entry => entry.id !== item.id); window.XoulProfiles.save(profiles); currentId = profiles[0]?.id || null; dirty = false; fill(); save(); }; $('resetSeeds').onclick = () => { if (!window.confirm('恢复 3 个演示画像？自定义画像会被移除，但已保存的互动记录不会影响服务器历史。')) return; profiles = window.XoulProfiles.reset(); currentId = profiles[0]?.id || null; dirty = true; fill(); save(); }; boot();
}());
