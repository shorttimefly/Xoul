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
      knowledge:{ entries:(p.knowledge||[]).map(k=>({title:k.title,content:k.body,image:k.image||'',source:k.source||''})) },
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
  async function boot(){
   try {
    const API_BASE=window.XoulApiBase();
    let config=resolve();
    try { const response=await fetch(API_BASE+'/api/v1/public/entrypoints/'+encodeURIComponent(slug)); if(response.ok) config=await response.json(); } catch(_) {}
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
    let profiles=(window.XoulProfiles?.load?.()||[]).filter(profile=>profile.enabled!==false);
    try{const response=await fetch(API_BASE+'/api/v1/public/user-profiles');const payload=await response.json();if(response.ok&&Array.isArray(payload.user_profiles)&&payload.user_profiles.length){profiles=payload.user_profiles;window.XoulProfiles?.save(payload.user_profiles);}}catch(_){}
    if(!profiles.length){state('没有可用的体验用户','请先到管理端启用至少一个用户画像。');return;}
    const activeKey='xoul:active-profile:v1';let activeProfile=profiles.find(profile=>profile.id===localStorage.getItem(activeKey))||profiles[0];localStorage.setItem(activeKey,activeProfile.id);
    const toggle=document.getElementById('profile-toggle'),menu=document.getElementById('profile-menu'),options=document.getElementById('profile-options');
    document.getElementById('profile-avatar').textContent=activeProfile.avatar||activeProfile.name?.slice(0,1)||'?';document.getElementById('profile-name').textContent=activeProfile.name||'体验用户';
    profiles.forEach(profile=>{const button=document.createElement('button');button.type='button';button.className='profile-option'+(profile.id===activeProfile.id?' active':'');button.setAttribute('aria-pressed',String(profile.id===activeProfile.id));const avatar=document.createElement('span'),copy=document.createElement('span'),name=document.createElement('strong'),headline=document.createElement('small');avatar.className='profile-avatar';avatar.textContent=profile.avatar||profile.name?.slice(0,1)||'?';name.textContent=profile.name;headline.textContent=profile.headline||'体验用户';copy.append(name,headline);button.append(avatar,copy);button.onclick=()=>{if(profile.id!==activeProfile.id&&!window.xoulChat?.busy){localStorage.setItem(activeKey,profile.id);location.reload();}};options.append(button);});
    toggle.onclick=()=>{const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};document.addEventListener('click',event=>{if(!event.target.closest('.profile-switcher')){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
    const historyKey='xoul:chat:v3:'+activeProfile.id+':'+config.product.id+':'+config.experience.id;
    let history=[];
    try{history=JSON.parse(localStorage.getItem(historyKey)||'[]');if(!Array.isArray(history))history=[];}catch(_){}
    const adapter={
      async *send({message,messages,signal}){
        const history=messages?.[messages.length-1]?.role==='user'?messages.slice(0,-1):messages;
        const response=await fetch(API_BASE+'/api/v1/public/experiences/'+encodeURIComponent(slug)+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile_id:activeProfile.id,message,messages:history}),signal});
        if(!response.ok){let detail='模型服务暂不可用';try{detail=(await response.json()).error?.message||detail;}catch(_){}throw new Error(detail);}
        if(!response.body)throw new Error('模型服务未返回流式响应');
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
        try{
          while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';for(const line of lines){if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')return;try{const event=JSON.parse(data);if(event.type==='delta'&&event.text)yield event;}catch(_){} }}
        }finally{reader.releaseLock();}
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
  }
  boot();
})();
