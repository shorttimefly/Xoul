/* XOUL's local Chat controller. The public page mounts this surface once. */
(function (root) {
  'use strict';
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function create({ root: target, config = {}, adapter = {}, onChange = () => {}, initialMessages = [] }) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('Chat mount not found');
    const entityName = config.product?.name || config.agent?.name || '你的新伙伴';
    function avatar() {
      const badge = el('span', 'chat-avatar', entityName.slice(0, 1));
      if (config.product?.image) {
        const photo = el('img'); photo.alt = ''; photo.src = config.product.image;
        photo.onerror = () => { photo.remove(); badge.textContent = entityName.slice(0, 1); };
        badge.replaceChildren(photo);
      }
      return badge;
    }
    const list = el('div', 'xoul-chat-messages');
    list.setAttribute('role', 'log'); list.setAttribute('aria-label', '对话记录');
    const footer = el('div', 'xoul-chat-footer');
    const status = el('div', 'chat-status');
    status.setAttribute('role', 'status');
    const composer = el('form', 'xoul-chat-composer');
    const input = el('textarea');
    input.rows = 1; input.placeholder = '有什么想对我说的？';
    input.setAttribute('aria-label', '输入问题');
    const sendButton = el('button', 'send-button');
    sendButton.type = 'submit';
    const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
    composer.append(input, sendButton);
    footer.append(status, composer, el('p', 'xoul-chat-note', 'XOUL · 优先基于产品知识回答'));
    host.replaceChildren(list, footer);
    let busy = false, controller, activeForm;
    const messages = [];
    function controls() {
      sendButton.innerHTML = busy ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>' : arrow;
      sendButton.setAttribute('aria-label', busy ? '停止回答' : '发送消息');
      sendButton.disabled = !busy && !input.value.trim();
      list.querySelectorAll('.guide-card').forEach(button => button.disabled = busy);
    }
    function persist() { onChange(messages.map(m => ({ ...m }))); }
    function add(role, text, sources = [], images = []) {
      const message = { role, text, sources: Array.isArray(sources) ? sources : [{ title: String(sources) }], images: Array.isArray(images) ? images : [] };
      messages.push(message);
      const row = el('article', 'xoul-chat-message ' + (role === 'user' ? 'user' : 'assistant'));
      if (role !== 'user') row.append(avatar());
      const body = el('div', 'message-body');
      if (role !== 'user') body.append(el('span', 'message-name', entityName));
      const bubble = el('div', 'xoul-chat-bubble', text);
      body.append(bubble);
      message.images.filter(image => image?.url).forEach(image => {
        const photo = el('img', 'chat-knowledge-image'); photo.src = image.url; photo.alt = image.title || '知识库图片';
        photo.onerror = () => photo.remove();
        body.append(photo);
      });
      row.append(body); list.append(row);
      function showSources(items) {
        body.querySelector('.xoul-chat-sources')?.remove();
        if (!items?.length) return;
        const details = el('details', 'xoul-chat-sources');
        details.append(el('summary', '', '查看来源 · ' + items.length));
        items.forEach(source => {
          details.append(el('strong', '', source.title || '产品知识'));
          if (source.content) details.append(el('p', '', source.content));
        });
        body.append(details);
      }
      showSources(message.sources);
      list.scrollTop = list.scrollHeight; persist();
      return { body, update(text, sources) {
        message.text = text; bubble.textContent = text;
        if (sources) { message.sources = sources; showSources(sources); }
        persist(); list.scrollTop = list.scrollHeight;
      }};
    }
    function knowledgeImagesFor(text) {
      const entries = config.knowledge?.entries || [];
      if (!/(图片|图示|示意|看图|展示|外观|长什么样|照片)/i.test(text)) return [];
      const withImages = entries.filter(entry => entry?.image);
      const matched = withImages.filter(entry => entry.title && text.includes(entry.title));
      return (matched.length ? matched : withImages).slice(0, 3).map(entry => ({ url: entry.image, title: entry.title || '知识库图片' }));
    }
    function welcome() {
      const row = el('article', 'xoul-chat-message assistant welcome-message');
      row.append(avatar());
      const body = el('div', 'message-body');
      body.append(el('span', 'message-name', entityName));
      if (config.product?.image) {
        const photo = el('img', 'entity-photo'); photo.alt = entityName + '的产品图';
        photo.src = config.product.image; photo.onerror = () => photo.remove();
        body.append(photo);
      }
      body.append(el('h2', 'welcome-title', '嗨，我是' + entityName + '。'));
      const fallback = config.product?.type === 'fitness_equipment'
        ? '碰到你真好。今天想和我练点什么？我们可以先熟悉动作，也可以一起算算这次的训练量。按你的节奏来，我陪你。'
        : '碰到你真好。从这一刻起，你可以直接和我说话了。想了解我，或是一起做点什么？从下面选一个，也可以随意聊聊。';
      body.append(el('p', 'welcome-description', config.agent?.welcome?.trim() || fallback));
      const cards = el('div', 'message-cards');
      (config.cards || []).filter(card => card.enabled !== false).forEach((card, index) => {
        const capability = String(card.capability_id || 'custom').replace(/[^a-z0-9_-]/gi, '-');
        const button = el('button', 'guide-card guide-card-' + capability); button.type = 'button';
        button.dataset.index = String(index + 1).padStart(2, '0');
        button.setAttribute('aria-label', card.title || '开始对话');
        button.append(el('span', 'guide-card-title', card.title), el('span', 'guide-card-arrow', '↗'));
        button.addEventListener('click', () => {
          if (busy) return;
          if (card.capability_id === 'calculate_training_volume') calculator(card);
          else send(card.prompt || card.title);
        });
        cards.append(button);
      });
      if (cards.childElementCount) body.append(cards);
      row.append(body); list.append(row);
    }
    async function send(text) {
      text = String(text || '').trim();
      if (!text || busy) return false;
      busy = true; controller = new AbortController();
      status.textContent = '正在整理产品资料…'; status.className = 'chat-status'; controls();
      add('user', text);
      const relatedImages = knowledgeImagesFor(text);
      if (relatedImages.length) add('assistant', '我把相关的器械图片放在这里，你可以直接对照查看。', [], relatedImages);
      let responseView;
      try {
        if (!adapter.send) throw new Error('尚未配置对话接口');
        const result = await adapter.send({ message: text, config, messages: messages.slice(), signal: controller.signal });
        if (controller.signal.aborted) return false;
        if (result && typeof result[Symbol.asyncIterator] === 'function') {
          responseView = add('assistant', '');
          let accumulated = '';
          for await (const event of result) {
            if (controller.signal.aborted) break;
            if (event.type === 'delta') accumulated += event.text;
            responseView.update(accumulated, event.sources);
          }
        } else {
          if (typeof result?.text !== 'string') throw new Error('对话接口未返回文本');
          add('assistant', result.text, result.sources || []);
        }
        status.textContent = controller.signal.aborted ? '已停止回答' : '';
      } catch (error) {
        status.className = 'chat-status error';
        status.textContent = controller.signal.aborted ? '已停止回答' : '回答失败，可重新发送。' + (error.message || '');
      } finally {
        busy = false; controls();
      }
      return true;
    }
    function calculator(card) {
      if (activeForm?.isConnected) { activeForm.querySelector('input')?.focus(); return; }
      add('user', card.title);
      const view = add('assistant', '填入训练数据，我来帮你计算。');
      const form = el('form', 'inline-calculator'); activeForm = form;
      form.append(el('h2', '', '训练量计算'), el('p', '', '组数 × 每组次数 × 重量；此计算不调用模型。'));
      const grid = el('div', 'calc-grid');
      [['sets','组数','4','1','1'],['reps','每组次数','12','1','1'],['weight','重量（kg）','40','0','any']].forEach(([name,title,value,min,step]) => {
        const label = el('label', '', title), field = el('input');
        field.type='number'; field.name=name; field.value=value; field.min=min; field.step=step; field.required=true;
        label.append(field); grid.append(label);
      });
      const error = el('div', 'calc-error'); error.setAttribute('role','alert');
      const actions = el('div','calc-actions'), cancel=el('button','','取消'), submit=el('button','','计算训练量');
      cancel.type='button'; submit.type='submit';
      cancel.onclick=()=>{ form.replaceWith(el('p','cancel-note','已取消，可以继续提问。')); activeForm=null; };
      actions.append(cancel,submit); form.append(grid,error,actions); view.body.append(form);
      form.onsubmit=event=>{
        event.preventDefault();
        const values = new FormData(form);
        const sets=Number(values.get('sets')), reps=Number(values.get('reps')), weight=Number(values.get('weight'));
        const volume=sets*reps*weight;
        if(!Number.isInteger(sets)||sets<1||!Number.isInteger(reps)||reps<1||!Number.isFinite(weight)||weight<0||!Number.isFinite(volume)){
          error.textContent='请输入有效的组数、次数和非负重量。'; return;
        }
        form.replaceWith(el('p','calc-result',volume.toLocaleString('zh-CN')+' kg'));
        view.update('训练量：'+volume.toLocaleString('zh-CN')+' kg\n'+sets+' 组 × '+reps+' 次 × '+weight+' kg');
        view.body.querySelector('.calc-result')?.remove(); activeForm=null;
      };
      list.scrollTop=list.scrollHeight;
    }
    composer.onsubmit=event=>{
      event.preventDefault();
      if(busy){controller.abort();status.textContent='已停止回答';return;}
      const text=input.value.trim(); if(!text)return;
      input.value=''; input.style.height='auto'; send(text);
    };
    input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,140)+'px';controls();});
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)composer.requestSubmit();}
    });
    function reset() {
      if(busy){status.textContent='请先停止当前回答，再开启新对话。';return false;}
      messages.length=0;list.replaceChildren();activeForm=null;welcome();persist();status.textContent='';input.value='';controls();return true;
    }
    welcome();
    initialMessages.filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string').slice(-80).forEach(m=>add(m.role,m.text,m.sources||[],m.images||[]));
    controls();
    return { send, add, reset, get busy(){return busy;}, get messages(){return messages.slice();} };
  }
  root.XoulChatUI={create,version:'0.2.0'};
})(window);
