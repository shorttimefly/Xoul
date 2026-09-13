(function () {
  'use strict';
  const KEY='xoul.local.products.v1';
  const CATALOG_KEY='xoul.local.catalog.v1';
  const seed={id:'prod_fitness_318',name:'深蹲训练器 318',type:'fitness_equipment',intro:'你的专属训练助手，帮助你安全完成每一次训练。',enabled:true,slug:'fitness-machine-318',knowledge:[{title:'动作说明',body:'双脚与肩同宽，保持背部中立，缓慢下蹲至大腿平行，再用脚跟发力站起。'}],agent:{name:'健身指导 Agent',tone:'专业、友好',role:'你是专业的健身教练，帮助用户安全完成训练。',rules:'优先引用产品知识；涉及安全时提醒用户量力而行。',memory:true},model:{provider:'OpenAI-compatible',name:'gpt-5.5',base_url:'',api_key:'',temperature:0.3,max_tokens:2048,streaming:true},workflow:['load_product_context','retrieve_knowledge','classify_intent','run_capability','generate_answer'],workflow_options:{max_iterations:3,failure_policy:'stop'},cards:[{title:'怎么做这个动作？',prompt:'请告诉我这个动作的正确做法。',capability:'explain_exercise'},{title:'主要锻炼哪些肌肉？',prompt:'这个动作主要锻炼哪些肌肉？',capability:'identify_muscles'},{title:'帮我算今天训练量',prompt:'帮我计算今天的训练量。',capability:'calculate_training_volume'},{title:'安全注意事项',prompt:'这个动作有哪些安全注意事项？',capability:'check_safety_notes'}]};
  const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
  const stepNames={load_product_context:'加载产品上下文',retrieve_knowledge:'检索知识库',classify_intent:'识别用户意图',run_capability:'调用产品能力',generate_answer:'生成回答',write_memory:'记录重要记忆'};
  const capabilityNames={custom:'对话问答',explain_exercise:'动作指导',identify_muscles:'肌群说明',calculate_training_volume:'训练量计算',check_safety_notes:'安全事项'};
  const panelNames=['产品身份','知识库','Agent 设定','模型接入','Workflow','对话卡片'];
  const panels=[...document.querySelectorAll('.panel')];
  let current, dirty=false, activeTab=0, noticeTimer, imageRequest=0, imageLoading=false;
  const fieldMap={
    productName:['name'],productType:['type'],productIntro:['intro'],
    agentName:['agent','name'],agentTone:['agent','tone'],agentWelcome:['agent','welcome'],agentRole:['agent','role'],agentRules:['agent','rules'],memoryEnabled:['agent','memory'],
    workflowMaxIterations:['workflow_options','max_iterations'],workflowFailurePolicy:['workflow_options','failure_policy']
  };
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function productExperienceUrl(){const slug=encodeURIComponent(current?.slug||'');return /^https?:$/.test(location.protocol)?location.origin+'/e/'+slug:new URL('public.html?entrypoint='+slug,location.href).href;}
  function load(){
    const raw=localStorage.getItem(KEY);
    if(!raw){localStorage.setItem(KEY,JSON.stringify([seed]));return [clone(seed)];}
    const data=JSON.parse(raw);if(!Array.isArray(data)||!data.length)throw new Error('产品数据格式无效');
    return data;
  }
  function catalog(){
    const defaults={types:[{id:'fitness_equipment',name:'健身器材',prompt:'你是懂训练与安全的健身器材伙伴。',image:''},{id:'consumer_product',name:'消费产品',prompt:'你是温和、可靠的产品伙伴。',image:''}],models:[{id:'default_local',name:'本地演示模型',provider:'OpenAI-compatible',base_url:'',model:'',temperature:.3,max_tokens:2048,api_key:''}]};
    try{const value=JSON.parse(localStorage.getItem(CATALOG_KEY));if(value?.types?.length&&value?.models?.length)return value;localStorage.setItem(CATALOG_KEY,JSON.stringify(defaults));return defaults;}catch(_){return defaults;}
  }
  function syncBackend(products){return fetch(window.XoulApiBase()+'/api/v1/admin/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products,catalog:catalog()})}).catch(()=>null);}
  function populateSharedCatalog(){
    const shared=catalog(), type=$('productType');
    if(shared.types.length){type.replaceChildren(...shared.types.map(x=>new Option(x.name,x.id)));}
    const select=$('modelProfile'); if(!select)return;
    select.replaceChildren(...shared.models.map(x=>{const option=new Option(x.name+(x.enabled===false?'（已停用）':''),x.id);option.disabled=x.enabled===false;return option;}));
    select.onchange=()=>{current.model_profile_id=select.value;current.model={};renderModelSummary();mark();};
  }
  function hydrateSharedCatalog(){
    return fetch(window.XoulApiBase()+'/api/v1/admin/catalog').then(response=>response.ok?response.json():null).then(remote=>{
      if(!remote||!Array.isArray(remote.types)||!Array.isArray(remote.models))return;
      const local=catalog(), localModels=Object.fromEntries((local.models||[]).map(item=>[item.id,item]));
      const merged={types:remote.types.length?remote.types:local.types,models:remote.models.length?remote.models.map(item=>({...localModels[item.id],...item,api_key:localModels[item.id]?.api_key||''})):local.models};
      localStorage.setItem(CATALOG_KEY,JSON.stringify(merged));populateSharedCatalog();fill();
    }).catch(()=>null);
  }
  function normalize(product){
    const p=clone(product);p.agent={...seed.agent,...p.agent};p.model={...seed.model,...p.model};
    p.prompt=p.prompt||'';
    p.workflow_options={...seed.workflow_options,...p.workflow_options};
    p.extra_fields=Array.isArray(p.extra_fields)?p.extra_fields:[];p.knowledge=p.knowledge||[];p.cards=p.cards||[];p.workflow=p.workflow||[];
    return p;
  }
  function mark(){dirty=true;$('dirtyHint').textContent='有未保存的修改';$('saveState').textContent='未保存';stats();}
  function notice(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,4200);}
  function persist(){
    const products=load(),index=products.findIndex(p=>p.id===current.id);
    const saved=clone(current);saved.model={};
    if(index<0)products.push(saved);else products[index]=saved;
    localStorage.setItem(KEY,JSON.stringify(products));
    syncBackend(products).then(()=>refreshImageUnderstanding());
    dirty=false;$('saveState').textContent='本地已保存';$('dirtyHint').textContent='所有修改已保存';renderProducts();stats();
  }
  function stats(){
    $('knowledgeCount').textContent=current.knowledge.length;$('cardCount').textContent=current.cards.filter(c=>c.enabled!==false).length;
    $('stepCount').textContent=current.workflow.length;$('pageTitle').textContent=current.name||'未命名产品';
  }
  function renderProducts(){
    const query=$('productSearch').value.trim().toLowerCase();
    $('productList').replaceChildren();
    load().filter(p=>(p.name+' '+p.id).toLowerCase().includes(query)).forEach(p=>{
      const button=el('button','product-item'+(current?.id===p.id?' active':''));button.type='button';
      button.setAttribute('aria-pressed',String(current?.id===p.id));
      const name=el('strong','',p.name);if(p.enabled===false)name.append(el('em','','停用'));
      button.append(name,el('small','',p.id));button.onclick=()=>select(p.id);$('productList').append(button);
    });
    if(!$('productList').childElementCount)$('productList').append(el('p','empty','没有匹配的产品'));
  }
  function renderExtraFields(){
    const box=$('extraFieldsList');if(!box)return;box.replaceChildren();
    current.extra_fields.forEach((item,i)=>{
      const row=el('div','extra-field-item');
      const key=el('input');key.name='extra-key-'+i;key.value=item.key||'';key.placeholder='key（例如：训练重点）';key.setAttribute('aria-label','扩展字段名称 '+(i+1));
      const value=el('input');value.name='extra-value-'+i;value.value=item.value??'';value.placeholder='value（例如：下肢力量）';value.setAttribute('aria-label','扩展字段值 '+(i+1));
      key.oninput=()=>{item.key=key.value;mark();};value.oninput=()=>{item.value=value.value;mark();};
      row.append(key,value,removeButton('删除扩展字段 '+(i+1),()=>{current.extra_fields.splice(i,1);renderExtraFields();mark();}));box.append(row);
    });
    if(!box.childElementCount)box.append(el('div','empty extra-fields-empty','还没有扩展字段。需要补充时，按 key / value 添加即可。'));
  }
  function tab(index){
    activeTab=index;panels.forEach((p,i)=>p.hidden=i!==index);
    [...$('configTabs').children].forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
  }
  panels.forEach((panel,i)=>{
    panel.id='panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+i);
    panel.querySelector('.num').textContent=String(i+1).padStart(2,'0');
    const button=el('button','tab',panelNames[i]);button.type='button';button.id='tab-'+i;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
    button.onclick=()=>tab(i);
    button.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:-1)+panels.length)%panels.length;tab(next);$('tab-'+next).focus();}};
    $('configTabs').append(button);
  });
  $('configTabs').setAttribute('role','tablist');
  populateSharedCatalog();
  panels[3].querySelector('.panel-title p').textContent='从公共模型库选择；产品只保存模型引用';
  const imageUnderstanding=el('div','image-understanding');imageUnderstanding.hidden=true;$('imagePreview').after(imageUnderstanding);
  function understandingText(result){return [['主体',result.subject],['场景',result.scene],['使用场景',Array.isArray(result.use_cases)?result.use_cases.join('、'):result.use_cases],['适用人群',Array.isArray(result.suitable_for)?result.suitable_for.join('、'):result.suitable_for],['使用方法',result.usage_method],['安全提示',Array.isArray(result.safety)?result.safety.join('、'):result.safety],['产品 Prompt',result.product_prompt]].filter(([,value])=>value).map(([label,value])=>label+'：'+value).join('\n');}
  function renderImageUnderstanding(result){
    imageUnderstanding.replaceChildren();imageUnderstanding.hidden=!current?.image;if(imageUnderstanding.hidden)return;
    const heading=el('div','understanding-heading');heading.append(el('strong','', '图片理解 · '),el('span','image-understanding-status',{queued:'排队中',processing:'理解中',ready:'已完成，可修改',failed:'失败'}[result?.status]||'等待提交'));imageUnderstanding.append(heading);
    if(result?.status!=='ready'){imageUnderstanding.append(el('p','image-understanding-result',result?.error||'图片保存后会在后台生成理解结果。'));return;}
    current.image_understanding={...result,raw_text:result.raw_text||understandingText(result)};
    if(result.product_prompt&&!String(current.prompt||'').trim()){
      current.prompt=result.product_prompt;productPrompt.value=current.prompt;
    }
    const wrapper=el('label','', '识别结果（可修改）'),input=el('textarea');input.id='imageUnderstandingText';input.name='image_understanding';input.rows=8;input.value=current.image_understanding.raw_text;input.setAttribute('aria-label','图片理解识别结果');
    input.oninput=()=>{current.image_understanding.raw_text=input.value;current.image_understanding.status='ready';mark();};wrapper.append(input);
    imageUnderstanding.append(wrapper,el('p','image-understanding-result','修改后保存产品配置，这段文本会作为产品上下文参与 C 端对话。'));
  }
  const productPromptLabel=el('label','wide','产品 Prompt'),productPrompt=el('textarea');productPrompt.id='productPrompt';productPrompt.rows=3;productPrompt.placeholder='描述这个产品希望如何理解自己、陪伴用户和处理边界。';productPromptLabel.append(productPrompt);$('productIntro').parentElement.after(productPromptLabel);productPrompt.addEventListener('input',()=>{current.prompt=productPrompt.value;mark();});
  let understandingTimer;
  function refreshImageUnderstanding(){
    clearTimeout(understandingTimer); if(!current?.image){imageUnderstanding.hidden=true;return;}
    fetch(window.XoulApiBase()+'/api/v1/admin/products/'+encodeURIComponent(current.id)+'/image-understanding').then(response=>response.json()).then(result=>{
      renderImageUnderstanding(result);
      if(result.status==='queued'||result.status==='processing')understandingTimer=setTimeout(refreshImageUnderstanding,1800);
    }).catch(()=>{imageUnderstanding.hidden=true;});
  }
  panels[4].querySelector('.panel-title p').textContent='配置可用步骤；模型会根据用户问题灵活选择，不必机械执行全部步骤';
  panels[5].querySelector('h3').textContent='对话引导卡片';
  panels[5].querySelector('.panel-title p').textContent='显示在助手欢迎消息内，点击即可开始';
  $('productImage').setAttribute('capture','environment');
  $('agentRules').placeholder='优先使用产品知识；明确回答范围与边界。';
  Object.entries(fieldMap).forEach(([id,path])=>{
    const input=$(id);
    input.addEventListener(input.type==='checkbox'||input.tagName==='SELECT'?'change':'input',()=>{
      let owner=current;path.slice(0,-1).forEach(key=>owner=owner[key]);
      owner[path.at(-1)]=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?'':Number(input.value)):input.value;
      mark();
    });
  });
  function fill(){
    Object.entries(fieldMap).forEach(([id,path])=>{
      const value=path.reduce((obj,key)=>obj?.[key],current),input=$(id);
      if(input.type==='checkbox')input.checked=!!value;
      else {if(input.tagName==='SELECT'&&value!=null&&![...input.options].some(o=>o.value===String(value)))input.add(new Option(String(value),String(value)));input.value=value??'';}
    });
    if($('modelProfile')){$('modelProfile').value=current.model_profile_id||'';renderModelSummary();}
    $('productId').textContent=current.id;$('entrySlug').textContent='/e/'+current.slug;
    const productUrl=productExperienceUrl();$('productUrl').value=productUrl;$('openProductUrl').href=productUrl;
    productPrompt.value=current.prompt||'';
    const preview=$('imagePreview'), previewImg=preview.querySelector('img');
    preview.hidden=!current.image;
    if(current.image) previewImg.src=current.image; else previewImg.removeAttribute('src');
    refreshImageUnderstanding();
    $('statusText').textContent=current.enabled?'入口已启用':'入口已停用';$('productStatus').classList.toggle('off',!current.enabled);
    $('toggleStatus').textContent=current.enabled?'停用入口':'启用入口';
    renderExtraFields();renderKnowledge();renderWorkflow();renderCards();stats();tab(activeTab);
  }
  function renderModelSummary(){
    const summary=$('modelProfileSummary'), selected=catalog().models.find(x=>x.id===$('modelProfile')?.value);
    if(!summary)return;
    if(!selected){summary.textContent='尚未选择公共模型，请先到“模型接入”创建并启用一个模型。';summary.className='model-profile-summary warning';return;}
    const connection=[selected.provider,selected.model||selected.name].filter(Boolean).join(' · ');
    summary.textContent=(connection||'未填写连接信息')+' · '+(selected.base_url?'已配置接口':'待配置接口');summary.className='model-profile-summary'+(selected.enabled===false?' warning':'');
  }
  function select(id){
    if(dirty&&!confirm('当前产品还有未保存的修改。放弃修改并切换？'))return;
    imageRequest++;imageLoading=false;$('productImage').value='';
    current=normalize(load().find(p=>p.id===id));
    const models=catalog().models||[];
    if(!current.model_profile_id&&models.length)current.model_profile_id=models.find(x=>x.model===current.model?.name)?.id||models[0].id;
    dirty=false;$('saveState').textContent='本地已保存';
    $('dirtyHint').textContent='修改后保存，即可预览';fill();renderProducts();
  }
  function field(label,value,onInput,tag='input'){
    const wrapper=el('label','',label),input=el(tag);input.name=label;input.value=value??'';
    input.addEventListener('input',()=>{onInput(input.value);mark();});wrapper.append(input);return wrapper;
  }
  function removeButton(label,action){const button=el('button','remove','×');button.type='button';button.setAttribute('aria-label',label);button.onclick=action;return button;}
  function renderKnowledge(){
    const box=$('knowledgeList');box.replaceChildren();
    current.knowledge.forEach((k,i)=>{
      const item=el('div','knowledge-item'),fields=el('div');
      if(k.image){const preview=el('img','knowledge-image-preview');preview.src=k.image;preview.alt=k.title||'知识库图片';fields.append(preview);}
      fields.append(field('条目名称',k.title,v=>k.title=v),field('知识内容',k.body,v=>k.body=v,'textarea'));
      if(k.source)fields.append(el('small','field-hint','来源：'+k.source));
      item.append(fields,removeButton('删除知识条目 '+(i+1),()=>{current.knowledge.splice(i,1);renderKnowledge();mark();}));box.append(item);
    });
    if(!box.childElementCount)box.append(el('div','empty','还没有知识条目。添加产品说明、使用方法或常见问题。'));
  }
  function renderWorkflow(){
    const box=$('workflowList');box.replaceChildren();
    current.workflow.forEach((step,i)=>{
      const item=el('div','workflow-item'),select=el('select');select.name='workflow-step-'+i;select.setAttribute('aria-label','第 '+(i+1)+' 步');
      const type=typeof step==='string'?step:step.type;
      const choices={...stepNames};if(!choices[type])choices[type]=type;
      Object.entries(choices).forEach(([value,label])=>select.add(new Option(label,value)));
      select.value=type;select.onchange=()=>{current.workflow[i]=typeof step==='string'?select.value:{...step,type:select.value};mark();};
      const actions=el('div','step-actions');
      [-1,1].forEach(direction=>{
        const button=el('button','move',direction<0?'↑':'↓');button.type='button';button.setAttribute('aria-label',(direction<0?'上移':'下移')+'第 '+(i+1)+' 步');
        button.disabled=i+direction<0||i+direction>=current.workflow.length;
        button.onclick=()=>{[current.workflow[i],current.workflow[i+direction]]=[current.workflow[i+direction],current.workflow[i]];renderWorkflow();mark();};actions.append(button);
      });
      actions.append(removeButton('删除第 '+(i+1)+' 步',()=>{current.workflow.splice(i,1);renderWorkflow();mark();}));
      item.append(el('span','step-num',String(i+1).padStart(2,'0')),select,actions);box.append(item);
    });
    if(!box.childElementCount)box.append(el('div','empty','添加步骤，定义产品助手的对话流程。'));
  }
  function renderCards(){
    const box=$('cardList');box.replaceChildren();
    current.cards.forEach((card,i)=>{
      const item=el('div','card-item'),fields=el('div','card-fields');
      fields.append(field('卡片标题',card.title,v=>card.title=v));
      const label=el('label','','点击后的能力'),select=el('select');select.name='card-capability-'+i;
      const choices={...capabilityNames};if(card.capability&&!choices[card.capability])choices[card.capability]=card.capability;
      Object.entries(choices).forEach(([value,title])=>select.add(new Option(title,value)));
      select.value=card.capability||'custom';select.onchange=()=>{card.capability=select.value;mark();};label.append(select);fields.append(label);
      fields.append(field('发给助手的问题',card.prompt,v=>card.prompt=v));
      item.append(fields,removeButton('删除卡片 '+(i+1),()=>{current.cards.splice(i,1);renderCards();mark();}));box.append(item);
    });
    if(!box.childElementCount)box.append(el('div','empty','添加一个问题或能力，让用户在对话里一键开始。'));
  }
  $('configForm').noValidate=true;
  $('configForm').onsubmit=event=>{
    event.preventDefault();
    if(imageLoading){notice('图片正在处理，请稍后保存。');return;}
    const invalid=[...event.target.querySelectorAll('input,select,textarea')].find(input=>!input.checkValidity());
    if(invalid){tab(panels.indexOf(invalid.closest('.panel')));invalid.reportValidity();return;}
    current.name=current.name.trim();
    if(!current.name){tab(0);$('productName').focus();notice('请填写产品名称。');return;}
    try{persist();notice('已保存。在预览中查看最新的产品对话。');}catch(_){notice('保存失败，请检查浏览器本地存储空间。');}
  };
  $('newProduct').onclick=()=>{
    if(dirty&&!confirm('放弃当前未保存的修改并创建产品？'))return;
    imageRequest++;imageLoading=false;$('productImage').value='';
    const suffix=crypto.randomUUID().replaceAll('-','').slice(0,12);
    current=normalize({...clone(seed),id:'prod_'+suffix,slug:'entry_'+suffix,name:'新产品',intro:'',knowledge:[],cards:[],model:{provider:'OpenAI-compatible',name:'',base_url:'',api_key:'',temperature:0.3,max_tokens:2048,streaming:true},agent:{name:'产品助手',role:'',rules:'',tone:'专业、友好',memory:false}});
    persist();activeTab=0;fill();$('productSearch').value='';renderProducts();$('productName').focus();notice('产品已创建。填写产品身份后添加知识与对话卡片。');
  };
  $('addKnowledge').onclick=()=>{current.knowledge.push({title:'新知识条目',body:''});renderKnowledge();mark();};
  $('addExtraField').onclick=()=>{current.extra_fields.push({key:'',value:''});renderExtraFields();mark();};
  $('importKnowledge').onclick=()=>$('knowledgeFile').click();
  $('knowledgeFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const isMarkdown=/\.md$/i.test(file.name)||file.type==='text/markdown',isCsv=/\.csv$/i.test(file.name)||file.type==='text/csv',isImage=['image/png','image/jpeg','image/webp'].includes(file.type);
    if(!isMarkdown&&!isCsv&&!isImage){notice('请选择 Markdown（.md）、CSV、PNG、JPG 或 WebP 文件。');return;}
    if(file.size>2*1024*1024){notice('Markdown / CSV 文件请控制在 2MB 以内。');return;}
    try{
      if(isMarkdown||isCsv){
        const body=await file.text(),text=body.replace(/^\uFEFF/,'');if(!text.trim()){notice('这个文件没有可导入的内容。');return;}
        current.knowledge.push({title:file.name.replace(/\.(?:md|csv)$/i,''),body:text,source:isCsv?'CSV 文件':'Markdown 文件'});
      }else{
        const url=URL.createObjectURL(file),photo=new Image();photo.src=url;await photo.decode();
        const scale=Math.min(1,1200/Math.max(photo.naturalWidth,photo.naturalHeight)),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));canvas.getContext('2d').drawImage(photo,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
        current.knowledge.push({title:file.name.replace(/\.[^.]+$/,''),body:'知识库图片：请在对话中参考这张图片。',image:canvas.toDataURL('image/webp',0.82),source:'图片文件'});
      }
      renderKnowledge();mark();notice('已导入「'+file.name+'」，保存产品配置后会带入 C 端上下文。');
    }catch(_){notice('知识库文件读取失败，请重试。');}
  });
  $('addStep').onclick=()=>{current.workflow.push('retrieve_knowledge');renderWorkflow();mark();};
  $('addCard').onclick=()=>{current.cards.push({title:'新功能卡片',prompt:'',capability:'custom'});renderCards();mark();};
  $('toggleStatus').onclick=()=>{current.enabled=!current.enabled;mark();fill();notice('入口状态已修改，保存后生效。');};
  $('openExperience').onclick=()=>{
    if(dirty){notice('请先保存修改，再预览最新体验。');return;}
    window.open(productExperienceUrl(),'_blank','noopener');
  };
  $('copyProductUrl').onclick=async()=>{
    const url=productExperienceUrl();
    try{await navigator.clipboard.writeText(url);notice('C 端产品链接已复制，可用于 NFC 写入。');}
    catch(_){$('productUrl').focus();$('productUrl').select();document.execCommand('copy');notice('C 端产品链接已复制，可用于 NFC 写入。');}
  };
  $('productSearch').oninput=renderProducts;
  $('productImage').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    const request=++imageRequest, product=current;
    imageLoading=false;event.target.value='';
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){notice('请选择 PNG、JPG 或 WebP 图片。');return;}
    if(file.size>2*1024*1024){notice('图片请控制在 2MB 以内。');return;}
    imageLoading=true;notice('正在处理图片…');
    const url=URL.createObjectURL(file);
    try{
      const photo=new Image();photo.src=url;await photo.decode();
      if(request!==imageRequest||current!==product)return;
      if(!photo.naturalWidth||photo.naturalWidth*photo.naturalHeight>16000000)throw new Error('dimensions');
      const scale=Math.min(1,1200/Math.max(photo.naturalWidth,photo.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
      canvas.getContext('2d').drawImage(photo,0,0,canvas.width,canvas.height);
      current.image=canvas.toDataURL('image/webp',0.85);current.image_understanding=null;fill();mark();notice('产品图片已更新，保存后 C 端可见。');
    }catch(_){if(request===imageRequest&&current===product)notice('图片无法读取或超过 1600 万像素，请换一张图片。');}
    finally{URL.revokeObjectURL(url);if(request===imageRequest)imageLoading=false;}
  });
  $('removeImage').onclick=()=>{imageRequest++;imageLoading=false;current.image='';current.image_understanding=null;$('productImage').value='';fill();mark();};
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  async function boot(){
    let initial=load(), serverHasProducts=false;
    try{
      const response=await fetch(window.XoulApiBase()+'/api/v1/admin/products');
      const remote=await response.json();
      if(response.ok&&Array.isArray(remote.products)&&remote.products.length){initial=remote.products;serverHasProducts=true;localStorage.setItem(KEY,JSON.stringify(initial));}
    }catch(_){/* offline/local mode keeps the browser copy */}
    select(initial[0].id);
    if(!serverHasProducts)syncBackend(initial.map(item=>item.id===current.id?current:item));
    hydrateSharedCatalog();
  }
  boot().catch(()=>notice('本地产品数据无法读取，请检查存储内容；原始数据未被覆盖。'));
})();
