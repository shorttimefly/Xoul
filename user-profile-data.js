(function (root) {
  'use strict';
  const KEY = 'xoul.local.user-profiles.v1';
  const seeds = [
    { id: 'user_linxia', name: '林夏', avatar: '林', headline: '刚开始训练，想循序渐进', preferences: ['循序渐进', '先讲清楚动作'], goals: ['每周训练 3 次', '建立稳定习惯'], notes: '膝盖偶尔紧，希望训练建议温和、可执行。', enabled: true, seed: true },
    { id: 'user_zhouqi', name: '周启', avatar: '周', headline: '进阶力量训练者', preferences: ['直接给结论', '关注训练量'], goals: ['提升下肢力量', '记录渐进超负荷'], notes: '可以接受更高训练强度，但仍需明确安全边界。', enabled: true, seed: true },
    { id: 'user_mia', name: 'Mia', avatar: 'M', headline: '忙碌上班族', preferences: ['碎片化训练', '回答简短一点'], goals: ['每次 20 分钟内完成', '保持精力'], notes: '工作日时间有限，优先推荐低门槛、易坚持的安排。', enabled: true, seed: true }
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function load() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(KEY) || 'null');
      if (Array.isArray(value) && value.length) return value;
    } catch (_) {}
    const value = clone(seeds);
    root.localStorage?.setItem(KEY, JSON.stringify(value));
    return value;
  }
  function save(value) { const next = clone(Array.isArray(value) ? value : []); root.localStorage?.setItem(KEY, JSON.stringify(next)); return next; }
  function reset() { return save(seeds); }
  root.XoulProfiles = { KEY, seeds: clone(seeds), load, save, reset };
}(window));
