/* Run only in an isolated test browser context, never against user drafts. */
window.testEntityChat = async function () {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const host = document.createElement('section');
  document.body.append(host);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
  canvas.getContext('2d').fillRect(0, 0, 80, 80);
  const config = { product: { name: '测试实体', image: canvas.toDataURL() }, agent: { name: '内部 Agent', welcome: '见到你真好，今天想和我聊什么？' }, cards: [{ title: '和我聊聊', prompt: '你好' }] };
  try {
    const chat = XoulChatUI.create({ root: host, config });
    const photo = host.querySelector('.welcome-message .entity-photo');
    assert(photo, 'Product image must be inside the welcome chat message');
    await photo.decode();
    assert(photo.naturalWidth === 80, 'Product image must load');
    assert(host.querySelector('.message-name').textContent === '测试实体', 'The entity itself should speak, not the internal Agent label');
    assert(host.querySelector('.welcome-description').textContent === config.agent.welcome, 'Custom welcome must be rendered');
    assert(host.querySelector('.welcome-message .message-cards .guide-card'), 'Cards must stay in Chat');
    chat.reset();
    assert(host.querySelectorAll('.entity-photo').length === 1, 'New chat must preserve one product image');
    XoulChatUI.create({ root: host, config: { product: { name: '水杯' } } });
    assert(!host.querySelector('.entity-photo'), 'Missing image must not render a broken placeholder');
    assert(host.querySelector('.welcome-title').textContent.includes('我是水杯'), 'Fallback welcome must use first person');
    return 'PASS: image, entity identity, custom/default welcome, inline cards, reset, no-image fallback';
  } finally { host.remove(); }
};
