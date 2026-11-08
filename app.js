import {setupLandscapeEntry} from './orientation.js';
import {TASKS} from './data.js?v=5';
import {createState,selectTask,beginInspection,discover,answer,inspectionDone,confirmOverview,finish,complete,validateState,retry} from './engine.js?v=5';
const $=s=>document.querySelector(s),root=$('#app'),dlg=$('#question'),tools=$('#tools');
const KEY='haiyang-v2',ROUND_KEY='haiyang-round-v2',COACH_KEY='haiyang-coach-seen',STEPS=['draw','intro','inspect','incident'];
const makeRound=()=>Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint32Array(3)),x=>x.toString(36)).join('-');
let roundId=new URL(location.href).searchParams.get('round')||makeRound();
function setRoundUrl(){const u=new URL(location.href);u.searchParams.set('round',roundId);history.replaceState(null,'',u)}
setRoundUrl();
let state,storageOk=true,recoveryMessage='',ready=false,loading=false,loadError='',loadToken=0,spinning=false,timer,currentQ=null,order=[],feedbackMode=false,lastHotspotId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS={
 zoom:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.2 15.2 5.3 5.3"/><path d="M10.5 7.5v6M7.5 10.5h6"/>',
 resetzoom:'<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M4 4l6 6M20 20l-6-6"/>',
 hint:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z"/>',
 incident:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 stafftools:'<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>'
};
const icon=name=>ICONS[name]?`<svg class="btn-ico" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`:'';
const btn=(label,action,cls='',iconName='')=>`<button type="button" class="${cls}" data-action="${action}">${icon(iconName)}${label}</button>`;
const coachSeen=()=>{try{return sessionStorage.getItem(COACH_KEY)===roundId}catch{return false}};
function removeCoach(){const c=root.querySelector('.coach');if(c)c.remove();try{sessionStorage.setItem(COACH_KEY,roundId)}catch{}}
function resetCoach(){try{sessionStorage.removeItem(COACH_KEY)}catch{}}
let sceneObserver;
const task=()=>TASKS.find(t=>t.id===state.taskId);
const image=(t,kind)=>`assets/${t.id}-${kind}.webp`;
try{
 if(sessionStorage.getItem(ROUND_KEY)===roundId){const raw=sessionStorage.getItem(KEY);if(raw){try{state=validateState(JSON.parse(raw),TASKS)}catch{}if(!state)recoveryMessage='进度无法恢复，请重新抽题。'}}
 if(sessionStorage.getItem('haiyang-v1')){if(!state&&!recoveryMessage)recoveryMessage='版本已更新，请重新抽题。';sessionStorage.removeItem('haiyang-v1');sessionStorage.removeItem('haiyang-round');}
}catch{storageOk=false}
state ||= createState();
function save(){try{sessionStorage.setItem(ROUND_KEY,roundId);sessionStorage.setItem(KEY,JSON.stringify(state))}catch{storageOk=false;notify('此浏览器无法保存进度，请保持页面打开完成本轮。')}}
function notify(text){clearTimeout(timer);$('#toast').textContent=text;$('#toast').classList.add('show');timer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
function showAlert(container,text,action){
 if(!container)return;
 let alert=container.querySelector('.dialog-alert');
 if(!alert){const top=container.querySelector('.dialog-top');if(!top)return;top.insertAdjacentHTML('afterend',`<p class="dialog-alert" role="status"></p>`);alert=container.querySelector('.dialog-alert')}
 alert.textContent=text;
 const target=action?container.querySelector(`[data-action="${action}"]`):null;
 if(target){target.classList.add('is-attention');target.focus({preventScroll:true})}
}
function focusHotspot(id){const el=id?root.querySelector(`[data-q="${id}"]`):null;if(el&&el.focus)el.focus({preventScroll:true})}
function focusToolsTrigger(){const el=root.querySelector('[data-action="stafftools"]')||$('#staff');if(el&&el.focus)el.focus({preventScroll:true})}
function syncSteps(){
 const current=STEPS.indexOf(state.stage);
 document.querySelectorAll('.steps .step').forEach(el=>{
  const index=STEPS.indexOf(el.dataset.step),active=current>=0&&index===current;
  el.classList.toggle('is-active',active);el.classList.toggle('is-done',current>=0&&index<current);
  if(active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
 });
}
function render(){
 sceneObserver?.disconnect();
 syncSteps();
 document.body.classList.toggle('playing',['inspect','incident'].includes(state.stage));
 root.dataset.stage=state.stage;
 if(state.stage==='draw')draw();
 else if(state.stage==='intro')intro(task());
 else if(state.stage==='inspect')inspection(task());
 else if(state.stage==='incident')incident(task());
}
function draw(){
 root.innerHTML=`<section class="draw entry-draw"><div class="draw-head"><p class="eyebrow">实验室安全协作挑战</p><h1>抽取实验任务</h1><p class="draw-lead">三位队员一起，在实验场景里找出隐患、选对整改方式。</p></div><div class="lottery"><div class="wheel-frame"><span class="wheel-pointer" aria-hidden="true"></span><svg class="wheel" viewBox="0 0 300 300" role="img" aria-label="实验转盘：叶绿素a、总碱度、痕量金属"><path d="M150 150L150 10A140 140 0 0 1 271.24 220Z" fill="#116958"/><path d="M150 150L271.24 220A140 140 0 0 1 28.76 220Z" fill="#ba542e"/><path d="M150 150L28.76 220A140 140 0 0 1 150 10Z" fill="#315b70"/><g class="spin-label" text-anchor="middle"><text x="224" y="109">叶绿素 a</text><text x="150" y="246">总碱度</text><text x="77" y="109">痕量金属</text></g><circle cx="150" cy="150" r="20" fill="#f2f5f3"/></svg><span class="wheel-hub" aria-hidden="true">SAFE<br>LAB</span></div><div class="lottery-action"><button class="primary draw-button" data-action="spin" ${spinning?'disabled':''}>${spinning?'正在抽取…':'抽取实验'}</button><p class="muted lottery-meta">3 人一机 · 约 5 分钟</p><ul class="draw-facts"><li>随机匹配 1 个实验场景</li><li>找出 6 处隐患，整改 4 处即达标</li><li>不需要填写姓名，扫码即玩</li></ul></div></div>${recoveryMessage?`<p class="recovery-message" role="status">${esc(recoveryMessage)}</p>`:''}</section>`;
}
function intro(t){
 root.innerHTML=`<section class="briefing"><div class="briefing-hero"><p class="eyebrow">实验任务</p><h1>${esc(t.name)}</h1><div class="tag-row"><span class="tag tag-warn">危险试剂 · ${esc(t.reagent)}</span><span class="tag">巡检 6 处 · 整改 4 处达标</span></div></div><div class="briefing-grid"><section class="info-card"><h2>这次实验做什么</h2><p>${esc(t.purpose)}</p><h2>涉及的危险试剂</h2><ul class="reagent-list">${t.reagents.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="info-card info-card-warn"><h2>开始前，请记住</h2><ol class="precautions">${t.precautions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section></div><div class="intro-footer"><p id="resource-status" role="status">${esc(loadError||(ready?'':'正在加载场景…'))}</p><div class="actions">${loadError?btn('重新加载场景','load'):''}<button class="primary" data-action="inspect" ${ready?'':'disabled'}>已了解，开始巡检</button></div></div></section>`;
}
function stageHead(t,label,progress=''){
 return `<div class="stage-head"><div class="stage-title"><p class="stage-label">${label}</p><h1>${esc(t.name)}</h1></div>${progress}${btn('工作人员','stafftools','quiet stage-help','stafftools')}</div>`;
}
function progressBlock(){
 const solved=state.solved.length,done=inspectionDone(state);
 return `<div class="progress" role="status" aria-live="polite"><span class="progress-text">已整改 <b>${solved}</b> 处 / 共 6 处 · ${done?'已达标，可继续整改':'达标需 4 处'}</span><span class="progress-track" aria-hidden="true"><span class="progress-fill" style="width:${Math.round(solved/6*100)}%"></span><span class="progress-threshold" aria-hidden="true"></span></span></div>`;
}
function inspection(t){
 const done=inspectionDone(state);
 root.innerHTML=`<section class="game">${stageHead(t,'安全巡检',progressBlock())}<div class="scene-wrap" style="--scene-image:url(${image(t,'inspect')})"><div class="scene-canvas"><img draggable="false" src="${image(t,'inspect')}" alt="${esc(t.name)}安全巡检图">${t.hazards.map(q=>{const solved=state.solved.includes(q.id);return `<button class="hotspot${solved?' done':''}" style="left:${q.x}%;top:${q.y}%" data-q="${q.id}" aria-label="${solved?'已整改：'+esc(q.title):'检查场景区域 '+(t.hazards.indexOf(q)+1)}"><span class="hotspot-ring" aria-hidden="true"></span><span class="hotspot-mark" aria-hidden="true">${solved?'✓':''}</span></button>`;}).join('')}</div>${coachSeen()?'':`<p class="coach" style="pointer-events:none">点按图片中看起来不安全的地方，找出 6 处隐患中的任意 4 处</p>`}</div><div class="toolbar"><p class="pan-hint" style="display:none">左右拖动查看</p><div class="actions">${btn('放大','zoom','','zoom')}${btn('回到全景','resetzoom','','resetzoom')}${btn('定位提示','hint','','hint')}<button class="primary${done?' is-ready':''}" data-action="incident" ${done?'':'disabled'}>${icon('incident')}查看全部隐患</button>${done?'':'<span class="unlock-hint">整改 4 处后解锁</span>'}</div></div></section>`;
 setupPan();bindImageFailure();
}
function incident(t){
 root.innerHTML=`<section class="incident-display">${stageHead(t,'现场情况')}<div class="incident-layout"><figure class="incident-picture"><span class="photo-tape" aria-hidden="true"></span><img src="${image(t,'incident')}" alt="${esc(t.incidentTitle)}"><figcaption>情景示意 · ${esc(t.incidentTitle)}</figcaption></figure><div class="incident-copy"><div class="pass-banner"><span class="pass-badge" aria-hidden="true"></span><p class="completion-status" role="status"></p></div><h2>${esc(t.incidentTitle)}</h2><p>${esc(t.incident)}</p><div class="actions end-actions"><button type="button" data-action="retry" ${complete(state)?'':'disabled'}>重新挑战</button>${btn('下一队','new','quiet')}</div></div></div></section>`;
 bindImageFailure();
}
function markComplete(){
 finish(state);save();const status=root.querySelector('.completion-status');if(status)status.textContent=complete(state)?'已过关':'';
 const retryButton=root.querySelector('[data-action="retry"]');if(retryButton)retryButton.disabled=!complete(state);
}
function bindImageFailure(){
 const img=root.querySelector('img');if(!img)return;
 const advanceButtons=()=>root.querySelectorAll('[data-action="incident"]');
 advanceButtons().forEach(b=>b.disabled=true);
 img.onload=()=>{if(!img.isConnected)return;advanceButtons().forEach(b=>b.disabled=!inspectionDone(state));if(state.stage==='incident')markComplete()};
 img.onerror=()=>{
  if(!img.isConnected)return;
  img.hidden=true;
  const holder=img.closest('.scene-wrap,.incident-picture');
  holder.classList.add('image-failed');
  if(!holder.querySelector('.image-error'))holder.insertAdjacentHTML('beforeend',`<div class="image-error" role="alert"><p>场景图未能加载，请检查网络后重试。本轮进度已保留。</p>${btn('重新加载场景','reloadscene')}</div>`);
  root.querySelectorAll('[data-action="incident"]').forEach(b=>b.disabled=true);
  holder.querySelectorAll('[data-q]').forEach(b=>b.disabled=true);
 };
 if(img.complete){if(img.naturalWidth)img.onload();else img.onerror();}
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();const timer=setTimeout(()=>{img.onload=img.onerror=null;reject(new Error('timeout'))},15000);img.onload=()=>{clearTimeout(timer);img.naturalWidth?resolve():reject(new Error('image'))};img.onerror=()=>{clearTimeout(timer);reject(new Error('image'))};img.src=src})}
async function prepare(){
 const t=task();if(!t)return;
 const token=++loadToken,round=roundId;ready=false;loading=true;loadError='';render();
 try{await Promise.all(['inspect','incident'].map(k=>loadImage(image(t,k))));if(token!==loadToken||round!==roundId)return;ready=true}
 catch{if(token!==loadToken||round!==roundId)return;loadError='场景图加载失败，请检查网络后重新加载。'}
 if(token===loadToken&&round===roundId){loading=false;if(state.stage==='intro')render();else if(loadError)notify(loadError);else render()}
}
function openQ(id){
 if(state.stage!=='inspect')return;const q=task().hazards.find(q=>q.id===id);if(!q)return;
 discover(state,id);if(state.active!==id&&!state.solved.includes(id))return notify('请先完成正在整改的隐患。');
 lastHotspotId=id;removeCoach();currentQ=q;order=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 feedbackMode=state.solved.includes(id);save();questionRender();if(!dlg.open)dlg.showModal();
}
function questionRender(message='',wrong=false){
 const q=currentQ;if(!q)return;
 const solved=state.solved.includes(q.id),number=task().hazards.indexOf(q)+1;
 dlg.setAttribute('aria-labelledby','question-title');
 const feedback=message?`<div class="feedback ${wrong?'wrong':'ok'}" role="status"><b>${wrong?'还需调整':'判断正确'}</b><p>${esc(message)}</p></div>`:(solved?`<div class="feedback ok" role="status"><b>已整改</b><p>正确做法：${esc(q.options[0])}</p><p>${esc(q.feedback)}</p></div>`:'');
 dlg.innerHTML=`<div class="dialog-top"><div><p class="dialog-eyebrow">第 ${number} 处隐患 / 共 6 处</p><h2 id="question-title">${esc(q.title)}</h2></div><button data-action="closeq" aria-label="关闭题目">×</button></div><p class="question-text">${esc(q.question)}</p>${inspectionDone(state)&&!solved?'<p class="muted">已达标，仍可继续练习整改。</p>':''}${!feedbackMode?`<div class="options">${order.map((index,i)=>`<button class="option" data-option="${index}"><span class="opt-key">${['A','B','C'][i]}</span><span class="opt-text">${esc(q.options[index])}</span></button>`).join('')}</div>`:''}${feedback}${feedbackMode?btn(wrong?'重新选择':'继续巡检',wrong?'rechoose':'closeq','primary'):''}`;
 if(wrong&&feedbackMode){const r=dlg.querySelector('[data-action="rechoose"]');if(r)r.classList.add('is-attention')}
}
function closeQ(){
 if(currentQ&&!inspectionDone(state)&&!state.solved.includes(currentQ.id)&&state.wrong[currentQ.id]?.length){showAlert(dlg,'已开始整改，请先选出合适做法。','rechoose');return}
 const id=currentQ?currentQ.id:lastHotspotId;
 dlg.close();currentQ=null;render();focusHotspot(id);
}
function showInspectionOverview(){
 if(state.stage!=='inspect'||!inspectionDone(state))return;
 const t=task();tools.classList.add('overview-dialog');tools.dataset.overview=roundId;
 tools.setAttribute('aria-labelledby','tools-title');
 tools.innerHTML=`<div class="dialog-top"><div><p class="dialog-eyebrow">安全巡检 · 全部隐患</p><h2 id="tools-title">全部隐患总览</h2><p class="overview-progress">已整改 <b>${state.solved.length}</b> / 6 处</p></div><button data-action="closetools" aria-label="返回继续整改">×</button></div><div class="overview-grid"><div class="overview-picture"><img src="${image(t,'inspect')}" alt="标注全部六处隐患的巡检图">${t.hazards.map((q,i)=>`<span class="overview-marker" style="left:${q.x}%;top:${q.y}%">${i+1}</span>`).join('')}</div><ol class="overview-list">${t.hazards.map((q,i)=>{const done=state.solved.includes(q.id);return `<li><b><span class="overview-index" aria-hidden="true">${i+1}</span> ${esc(q.title)}<span class="status-pill ${done?'is-done':'is-todo'}">${done?'已整改':'未整改'}</span></b><p>${esc(q.options[0])}</p></li>`;}).join('')}</ol></div><div class="actions dialog-dock">${btn('返回继续整改','closetools')}${btn('已查看全部隐患，进入现场情况','confirm-inspection','primary')}</div>`;
 syncOverviewCompact();tools.showModal();const img=tools.querySelector('img');const overviewImageError=()=>{const c=tools.querySelector('[data-action="confirm-inspection"]');if(c)c.disabled=true;showAlert(tools,'总览图片加载失败，请返回重新加载场景。')};img.onerror=overviewImageError;if(img.complete&&!img.naturalWidth)overviewImageError();
}
function closeTools(){tools.close();tools.classList.remove('overview-dialog');delete tools.dataset.overview;focusToolsTrigger()}
function syncOverviewCompact(){const grid=tools.querySelector('.overview-grid');if(!grid)return;grid.classList.toggle('is-compact',innerWidth>innerHeight&&innerHeight<=520)}
function staff(){
 tools.classList.remove('overview-dialog');delete tools.dataset.overview;
 tools.setAttribute('aria-labelledby','tools-title');
 tools.innerHTML=`<div class="dialog-top"><div><p class="dialog-eyebrow">工作人员</p><h2 id="tools-title">现场工作台</h2></div>${btn('关闭','closetools')}</div><div class="tools-grid"><a class="tool-card" href="backup.html" target="_blank" rel="noopener"><b>备用题卡</b>打开工作人员备用题卡（含整改答案）</a><div class="tool-card"><b>恢复指定实验</b>${TASKS.map(t=>btn(`恢复实验：${esc(t.name)}`,`restore-${t.id}`)).join('')}</div><div class="tool-card"><b>资源检查</b>${btn('检查三套场景资源','checkassets')}<p id="resource-status" role="status"></p></div><div class="tool-card is-danger"><b>结束本轮</b>${btn('下一队','new','danger')}</div></div>`;
 tools.showModal();
}
async function onAction(a){
 if(a==='stafftools')staff();
 else if(a==='spin'&&state.stage==='draw'&&!spinning){
  spinning=true;render();const id=TASKS[crypto.getRandomValues(new Uint32Array(1))[0]%TASKS.length].id;selectTask(state,id);save();const round=roundId;const wheel=root.querySelector('.wheel');wheel.getBoundingClientRect();wheel.style.transform=`rotate(${1080+({A:300,B:180,C:60}[id])}deg)`;
  await new Promise(r=>setTimeout(r,1500));spinning=false;if(round===roundId&&state.taskId===id&&state.stage==='intro')prepare();
 }else if(a==='load'&&!loading)prepare();
 else if(a==='inspect'&&ready&&state.stage==='intro'){beginInspection(state);save();render()}
 else if(a==='incident')showInspectionOverview();
 else if(a==='confirm-inspection'&&tools.open&&tools.dataset.overview===roundId&&state.stage==='inspect'){confirmOverview(state);save();closeTools();render();focusToolsTrigger()}
 else if(a==='closeq')closeQ();
 else if(a==='rechoose'&&currentQ){feedbackMode=false;questionRender()}
 else if(a==='closetools')closeTools();
 else if(a==='reloadscene'){const t=task();try{await loadImage(image(t,state.stage==='incident'?'incident':'inspect'));render()}catch{notify('图片仍未加载成功，请检查网络后重试。')}}
 else if(a==='zoom'){const c=$('.scene-canvas');if(c){c.classList.add('zoomed');c.style.transform='scale(1.8)'}}
 else if(a==='resetzoom'){const c=$('.scene-canvas');if(c){c.classList.remove('zoomed');c.style.transform='';setupPan()}}
 else if(a==='hint'&&state.stage==='inspect'){const q=task().hazards.find(q=>!state.solved.includes(q.id));if(q){const b=root.querySelector(`[data-q="${q.id}"]`);b.classList.add('hinted');panToHotspot(q);setTimeout(()=>b.classList.remove('hinted'),3500);notify('看看高亮区域，选择合适的整改方式。')}else notify('本图六处隐患均已整改。')}
 else if(a==='retry'&&complete(state)&&confirm('重新挑战当前实验？')){resetCoach();retry(state);save();prepare()}
 else if(a==='new'&&confirm('开始下一队？')){loadToken++;loading=false;spinning=false;ready=false;loadError='';recoveryMessage='';resetCoach();state=createState();roundId=makeRound();setRoundUrl();save();dlg.close();currentQ=null;closeTools();render()}
 else if(a?.startsWith('restore-')&&TASKS.some(t=>t.id===a.slice(8))&&confirm('恢复指定实验会清空本设备当前记录，是否继续？')){loadToken++;loading=false;resetCoach();state=createState(a.slice(8));state.manual=true;save();closeTools();prepare()}
 else if(a==='checkassets'){const status=$('#resource-status');status.textContent='正在检查…';const list=await Promise.all(TASKS.flatMap(t=>['inspect','incident'].map(async k=>{try{await loadImage(image(t,k));return `${t.id} ${k} ✓`}catch{return `${t.id} ${k} 加载失败`}})));if(status.isConnected)status.textContent=list.join('；')+'。冷启动仍需要网络。'}
}
document.addEventListener('click',e=>{
 const opt=e.target.closest('[data-option]');if(opt&&dlg.contains(opt)&&currentQ&&!feedbackMode){const i=Number(opt.dataset.option);answer(state,currentQ,i);save();feedbackMode=true;questionRender(i===0?currentQ.feedback:(currentQ.wrongFeedback?.[i]||currentQ.feedback),i!==0);return}
 const action=e.target.closest('[data-action]');if(action){if(!action.disabled)onAction(action.dataset.action);return}
 const q=e.target.closest('[data-q]');if(q&&!q.disabled)openQ(q.dataset.q);
});
dlg.addEventListener('cancel',e=>{e.preventDefault();closeQ()});
tools.addEventListener('close',()=>{tools.classList.remove('overview-dialog');delete tools.dataset.overview});
window.addEventListener('resize',()=>{if(tools.open&&tools.classList.contains('overview-dialog'))syncOverviewCompact()});
$('#staff').onclick=staff;
$('.brand').onclick=e=>{e.preventDefault();notify('本轮任务会保留；新队伍请使用工作人员入口。')};
function tapRipple(canvas,e){
 if(e.detail===0)return;
 const wrap=canvas.parentElement;if(!wrap)return;
 const r=wrap.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 if(x<0||y<0||x>r.width||y>r.height)return;
 const dot=document.createElement('span');dot.className='tap-ripple';
 dot.style.left=x+'px';dot.style.top=y+'px';dot.style.pointerEvents='none';
 wrap.appendChild(dot);setTimeout(()=>dot.remove(),600);
}
let pan={x:0,y:0};
function panScale(c){return c.classList.contains('zoomed')?1.8:1}
function panBounds(c,scale){return {bx:Math.max(0,(c.clientWidth*scale-c.parentElement.clientWidth)/2),by:Math.max(0,(c.clientHeight*scale-c.parentElement.clientHeight)/2)}}
function applyPan(c,scale){c.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`}
function updatePanHint(c){
 const hint=root.querySelector('.pan-hint');if(!hint)return;
 const need=!!c&&c.clientWidth>c.parentElement.clientWidth+4;
 hint.hidden=!need;hint.style.display=need?'':'none';
}
function panToHotspot(q){
 const c=$('.scene-canvas');if(!c)return;
 const scale=panScale(c),{bx}=panBounds(c,scale);
 pan.x=Math.max(-bx,Math.min(bx,c.clientWidth*scale*(0.5-q.x/100)));pan.y=0;
 applyPan(c,scale);
}
function setupPan(){
 const c=$('.scene-canvas');if(!c)return;sceneObserver?.disconnect();let start,moved=false;pan={x:0,y:0};
 const fit=()=>{c.style.width=innerWidth>innerHeight?Math.min(c.parentElement.clientWidth,c.parentElement.clientHeight*16/9)+'px':'180%';updatePanHint(c)};
 fit();sceneObserver=new ResizeObserver(fit);sceneObserver.observe(c.parentElement);
 c.onpointerdown=e=>{start={x:e.clientX,y:e.clientY,ox:pan.x,oy:pan.y};moved=false};
 c.onpointermove=e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>8){moved=true;c.setPointerCapture(e.pointerId);const scale=panScale(c),{bx,by}=panBounds(c,scale);pan.x=Math.max(-bx,Math.min(bx,start.ox+dx));pan.y=Math.max(-by,Math.min(by,start.oy+dy));applyPan(c,scale)}};
 c.onpointerup=()=>{start=null};c.onpointercancel=()=>{start=null;moved=false};
 if(c._panClick)c.removeEventListener('click',c._panClick,true);
 c._panClick=e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;return}tapRipple(c,e)};
 c.addEventListener('click',c._panClick,true);
}
render();save();if(!storageOk)notify('无法保存进度，请保持当前页面打开。');
if(state.stage==='intro')prepare();else if(state.stage==='inspect'&&state.active)openQ(state.active);
setupLandscapeEntry();
