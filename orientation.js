// Browsers own physical screen orientation. Provide a landscape-first entry,
// with best-effort fullscreen/lock and a usable fallback when either is denied.
export function setupLandscapeEntry(){
  const skipKey='haiyang-landscape-skip';
  const roundId=(()=>{try{return new URL(location.href).searchParams.get('round')||''}catch{return ''}})();
  const portrait=matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 1100px)');
  const gate=document.createElement('dialog');
  gate.className='orientation-gate';gate.setAttribute('aria-labelledby','orientation-title');
  gate.innerHTML=`<div class="orientation-content">
    <p class="orientation-kicker">海样归航 · 实验室安全协作挑战</p>
    <div class="orientation-illustration" aria-hidden="true">
      <svg viewBox="0 0 220 150" width="220" height="150" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="54" y="52" width="112" height="66" rx="11"/>
        <path d="M70 68h80v34H70z" fill="#dcece4" stroke="none"/>
        <path d="M80 90c5-9 10-9 15 0s10 9 15 0 10-9 15 0" stroke="#0e7269" stroke-width="3"/>
        <path d="M40 36c22-22 66-26 94-6m-8-20 9 21-22 1" stroke-width="5"/>
        <path d="M40 132h140" stroke-width="4" opacity=".35"/>
      </svg>
    </div>
    <h2 id="orientation-title">请将手机横过来</h2>
    <p>横屏后自动进入，方便三位队员一起看图和操作。</p>
    <button type="button" class="primary" id="landscape-fullscreen">尝试全屏横屏</button>
    <p id="orientation-status" role="status">如果没有自动旋转，请关闭手机方向锁定后横放。</p>
    <button type="button" class="quiet" id="landscape-portrait">继续竖屏体验</button>
    <p class="orientation-hint">抽题 · 巡检 6 处隐患 · 整改 4 处即达标</p>
  </div>`;
  document.body.append(gate);const wechat=/MicroMessenger/i.test(navigator.userAgent);if(wechat){gate.querySelector('#landscape-fullscreen').hidden=true;gate.querySelector('#orientation-status').textContent='微信内请先关闭手机方向锁定，再将手机横放。'}let bypass=false;try{bypass=sessionStorage.getItem(skipKey)===roundId}catch{}
  function update(){if(portrait.matches&&!bypass){if(!gate.open)gate.showModal()}else if(gate.open)gate.close()}
  gate.addEventListener('cancel',e=>e.preventDefault());
  gate.querySelector('#landscape-portrait').addEventListener('click',()=>{bypass=true;try{sessionStorage.setItem(skipKey,roundId)}catch{};update()});
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
