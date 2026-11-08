// Browsers own physical screen orientation. Provide a landscape-first entry,
// with best-effort fullscreen/lock and a usable fallback when either is denied.
export function setupLandscapeEntry(){
  const portrait=matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 1100px)');
  const gate=document.createElement('dialog');
  gate.className='orientation-gate';gate.setAttribute('aria-labelledby','orientation-title');
  gate.innerHTML=`<div class="orientation-content"><svg aria-hidden="true" viewBox="0 0 160 120" width="160" height="120"><rect x="26" y="34" width="108" height="62" rx="9" fill="none" stroke="currentColor" stroke-width="5"/><path d="M44 50h72v30H44z" fill="#dcece4"/><path d="M44 18C65 0 109 3 128 24m-4-16 7 19-20-1" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg><h2 id="orientation-title">请将手机横过来</h2><p>横屏后自动进入，方便三位队员一起看图和操作。</p><button type="button" class="primary" id="landscape-fullscreen">尝试全屏横屏</button><p id="orientation-status" role="status">如果没有自动旋转，请关闭手机方向锁定后横放。</p><button type="button" class="quiet" id="landscape-portrait">继续竖屏体验</button></div>`;
  document.body.append(gate);const wechat=/MicroMessenger/i.test(navigator.userAgent);if(wechat){gate.querySelector('#landscape-fullscreen').hidden=true;gate.querySelector('#orientation-status').textContent='微信内请先关闭手机方向锁定，再将手机横放。'}let bypass=false;
  function update(){if(portrait.matches&&!bypass){if(!gate.open)gate.showModal()}else if(gate.open)gate.close()}
  gate.addEventListener('cancel',e=>e.preventDefault());
  gate.querySelector('#landscape-portrait').addEventListener('click',()=>{bypass=true;update()});
  gate.querySelector('#landscape-fullscreen').addEventListener('click',async()=>{
    const status=gate.querySelector('#orientation-status');
    const button=gate.querySelector('#landscape-fullscreen');button.disabled=true;
    try{
      if(!document.fullscreenElement){
        const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
        if(!request)throw new Error('fullscreen unavailable');
        await request.call(document.documentElement);
      }
      if(typeof screen.orientation?.lock==='function')await screen.orientation.lock('landscape');
      else throw new Error('orientation lock unavailable');
      status.textContent='已请求横屏，若仍未旋转请手动横放手机。';
    }catch{
      status.textContent='此浏览器不能自动横屏。请关闭手机方向锁定后横放，或选择继续竖屏体验。';
    }finally{button.disabled=false;update()}
  });
  if(portrait.addEventListener)portrait.addEventListener('change',update);else portrait.addListener(update);
  window.addEventListener('resize',update);document.addEventListener('fullscreenchange',update);
  update();
}
