(function () {
  'use strict';
  const slug = decodeURIComponent((location.pathname.match(/\/e\/([^/]+)/) || [])[1] || new URLSearchParams(location.search).get('entrypoint') || 'fitness-machine-318');
  function resolve() {
    const saved = localStorage.getItem('xoul.local.products.v1');
    const products = saved ? JSON.parse(saved) : [];
    const p = Array.isArray(products) ? products.find(item => item.slug === slug) : null;
    if (p) return {
      status: p.enabled === false ? 'inactive' : 'active',
      product: { id:p.id, name:p.name, description:p.intro, image:p.image, type:p.type },
      experience:{ id:'local_'+p.id },
      agent:{ name:p.agent?.name, welcome:p.agent?.welcome },
      knowledge:{ entries:(p.knowledge||[]).map(k=>({title:k.title,content:k.body})) },
      cards:(p.cards||[]).map((c,i)=>({
        id:c.id||'card_'+i, title:c.title, prompt:c.prompt, enabled:c.enabled!==false,
        capability_id:c.capability === 'custom' && /训练量/.test(c.title) ? 'calculate_training_volume' : c.capability
      }))
    };
    return window.XoulData?.resolveEntrypoint(slug);
  }
  function state(title, message) {
    const element=document.getElementById('state');
    const heading=document.createElement('h1'), paragraph=document.createElement('p');
    heading.textContent=title;paragraph.textContent=message;element.replaceChildren(heading,paragraph);
    element.hidden=false;document.getElementById('app').hidden=true;
  }
  try {
    const config=resolve();
    if(!config||config.status==='not_found'){state('没有找到这个产品','请确认访问链接或产品入口。');return;}
    if(config.status!=='active'){state('这个入口暂不可用','产品入口已停用，请联系产品提供方。');return;}
    document.title=(config.product.name||'产品助手')+' · XOUL';
    document.getElementById('product-name').textContent=config.product.name;
    document.getElementById('agent-name').textContent='碰一碰，认识我';
    if(config.product.image){
      const badge=document.querySelector('.brand-mark'), photo=document.createElement('img');
      photo.alt='';photo.src=config.product.image;
      photo.onerror=()=>{photo.remove();badge.textContent='X';};
      badge.replaceChildren(photo);
    }
    document.getElementById('app').hidden=false;
    const historyKey='xoul:chat:v2:'+config.product.id+':'+config.experience.id;
    let history=[];
    try{history=JSON.parse(localStorage.getItem(historyKey)||'[]');if(!Array.isArray(history))history=[];}catch(_){}
    const adapter={
      async send({message,signal}){
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(resolve,450);
          signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('已停止'));},{once:true});
        });
        const entries=(config.knowledge?.entries||[]).filter(k=>k.content?.trim());
        if(!entries.length)return {text:'我还在认识自己，暂时没有可用的知识资料。等我的主人补充好内容，我们就能聊得更多了。',sources:[]};
        const words=message.replace(/[？?，,。！!]/g,' ').split(/\s+/).filter(Boolean);
        const ranked=entries.map(k=>({k,score:words.reduce((n,w)=>n+((k.title+' '+k.content).includes(w)?1:0),0)})).sort((a,b)=>b.score-a.score);
        const selected=ranked.slice(0,2).map(x=>x.k);
        return {text:'我找到了自己的相关资料，我们一起看看：\n\n'+selected.map(k=>k.title+'\n'+k.content).join('\n\n'),sources:selected};
      }
    };
    window.xoulChat=window.XoulChatUI.create({
      root:'#chat-root',config,adapter,initialMessages:history,
      onChange(messages){try{localStorage.setItem(historyKey,JSON.stringify(messages.slice(-80)));}catch(_){}}
    });
    document.getElementById('new-chat').onclick=()=>window.xoulChat.reset();
  } catch(error) {
    state('暂时无法加载体验','本地配置读取失败。请回到管理端检查产品配置后重试。');
  }
})();
