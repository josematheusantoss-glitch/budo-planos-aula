/* Cronômetro: grava apenas transições; os segundos são calculados a partir do relógio. */
const VAPID_PUBLIC_KEY="BPEq7MFvlVwMqplRYDpeGVZsmU2jx_ofrKhrIa4wFgsMdpiySd73ZVnQIf8nd6gppjAIANjSm6txaBnsf7SLDzs";
const livePlan=()=>store.view==='scheduled'?archivePlan('scheduled'):null;
let draggingLiveDock=false;
const liveDockSettings=()=>{try{return JSON.parse(localStorage.getItem('budo-live-dock')||'{}');}catch{return {};}};
function placeLiveDock(dock){
  const settings=liveDockSettings();
  dock.style.opacity=String(settings.opacity??0.72);
  if(Number.isFinite(settings.left)&&Number.isFinite(settings.top)){
    dock.style.left=`${Math.max(0,Math.min(window.innerWidth-dock.offsetWidth,settings.left))}px`;
    dock.style.top=`${Math.max(0,Math.min(window.innerHeight-dock.offsetHeight,settings.top))}px`;
    dock.style.right='auto';dock.style.bottom='auto';
  }
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
async function enableLiveAlerts(){
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){toast('Este navegador não oferece avisos com a tela bloqueada.');return;}
  if(!cloudReady){toast('Entre na sua conta para ativar os avisos.');return;}
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){toast('No iPhone, adicione o site à Tela de Início e abra por lá.');return;}
  try{
    const permission=await Notification.requestPermission();
    if(permission!=='granted'){toast('Permita notificações nas configurações do celular.');return;}
    const registration=await navigator.serviceWorker.ready;
    const bytes=Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
    const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    await budoCloud.savePushSubscription(subscription.toJSON());
    localStorage.setItem('budo-push-user',budoCloud.identity());
    toast('Avisos no celular ativados.');renderLiveTimer();
  }catch(error){console.error(error);toast('Não foi possível ativar os avisos neste aparelho.');}
}
async function disableLiveAlerts(){
  try{const registration=await navigator.serviceWorker?.getRegistration('/');const subscription=await registration?.pushManager?.getSubscription();if(subscription){await budoCloud.deletePushSubscription(subscription.endpoint).catch(()=>{});await subscription.unsubscribe();}}catch{}
  localStorage.removeItem('budo-push-user');
}
const liveAlertControl=()=>localStorage.getItem('budo-push-user')===budoCloud.identity()?'<small class="live-alert-status">✓ Avisos no celular ativos</small>':`<button class="button subtle live-alert-button" type="button" data-live="enable-alerts">♧ Ativar avisos no celular</button>${/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone?'<small class="live-alert-help">No iPhone: Compartilhar → Adicionar à Tela de Início.</small>':''}`;
const liveElapsed=run=>Math.max(0,Number(run.totalElapsedMs)||0)+(run.status==='running'?Math.max(0,Date.now()-run.segmentStartedAt):0);
const liveStageElapsed=run=>Math.max(0,Number(run.stageElapsedMs)||0)+(run.status==='running'?Math.max(0,Date.now()-run.segmentStartedAt):0);
const liveLevel=(elapsed,target)=>{const ratio=target>0?elapsed/target:1;return ratio>=1?'done':ratio>=.9?'red':ratio>=.8?'yellow':'normal';};
async function saveLive(plan){
  plan.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(store));renderList();
  if(cloudReady){try{await budoCloud.saveLesson(plan);}catch{queueCloudSave(plan);toast('Cronômetro salvo neste aparelho. Sincronização pendente.');}}
}
function liveCheckpoint(run){if(run.status!=='running')return;const delta=Math.max(0,Date.now()-run.segmentStartedAt);run.totalElapsedMs+=delta;run.stageElapsedMs+=delta;run.segmentStartedAt=Date.now();}
function liveAlert(plan,level){
  const stage=plan.steps[plan.liveRun.stageIndex];
  const message=level==='done'?`Tempo de ${stage.title} encerrado. Toque em Próxima etapa.`:level==='red'?`${stage.title}: falta cerca de 1 minuto.`:`${stage.title}: prepare a troca de etapa.`;
  toast(message);
  if('Notification' in window&&Notification.permission==='granted'&&document.visibilityState==='visible'){
    try{new Notification('Aula Budô',{body:message,tag:`budo-${plan.id}-${plan.liveRun.stageIndex}-${level}`});}catch{}
  }
}
function renderLiveTimer(){
  if(draggingLiveDock)return;
  const plan=livePlan(),panel=document.querySelector('#liveLessonPanel'),dock=document.querySelector('#liveTimerDock');
  if(!panel||!plan){dock.hidden=true;return;}
  const run=plan.liveRun;
  if(!run){
    dock.hidden=true;
    panel.innerHTML=`<div class="live-intro"><div><span class="eyebrow">ACOMPANHAR A AULA</span><strong>Cronômetro da aula</strong><small>Inicie quando o treino começar. A troca de etapa acontece ao seu toque.</small>${liveAlertControl()}</div><button class="button primary" data-live="start" type="button">▶ Iniciar aula</button></div>`;
    return;
  }
  if(run.status==='finished'){
    dock.hidden=true;
    panel.innerHTML=`<div class="live-result"><span class="eyebrow">AULA FINALIZADA</span><strong>Tempo real: ${formatLiveDuration(run.totalElapsedMs)}</strong><span>Planejado: ${sum(plan)} min</span><div class="live-result-steps">${plan.steps.map((s,i)=>`<small>${escapeHtml(s.title)}: ${formatLiveDuration(run.stageActualMs?.[i]||0)} / ${s.minutes} min previstos</small>`).join('')}</div><small>${isDue(plan)?'A aula está em Concluídas.':'A aula permanece em Registradas até as 19h do dia agendado.'}</small></div>`;
    return;
  }
  const step=plan.steps[run.stageIndex],elapsed=liveStageElapsed(run),target=step.minutes*60000,ratio=target?elapsed/target:1;
  const level=liveLevel(elapsed,target);
  const next=plan.steps[run.stageIndex+1];
  panel.innerHTML=`<div class="live-panel-head"><div><span class="eyebrow">AULA EM ANDAMENTO</span><h2>${escapeHtml(step.title)}</h2><small>Etapa ${run.stageIndex+1} de ${plan.steps.length}${next?` · Próxima: ${escapeHtml(next.title)}`:''}</small></div><span class="live-status ${run.status==='paused'?'paused':level}">${run.status==='paused'?'Pausada':level==='done'?'Trocar etapa':level==='red'?'Quase no fim':level==='yellow'?'Prepare a troca':'Em andamento'}</span></div><div class="live-clock-grid"><div><small>Tempo da etapa</small><strong data-live-stage-time>${formatLiveDuration(elapsed)}</strong><span>de ${step.minutes} min previstos</span></div><div><small>Tempo total</small><strong data-live-total-time>${formatLiveDuration(liveElapsed(run))}</strong><span>meta ${sum(plan)} min</span></div></div><div class="live-progress"><div class="live-progress-fill ${level}" style="width:${Math.min(100,ratio*100)}%"></div></div><div class="live-actions"><button class="button subtle" type="button" data-live="${run.status==='paused'?'resume':'pause'}">${run.status==='paused'?'▶ Retomar':'Ⅱ Pausar'}</button><button class="button primary" type="button" data-live="next" ${run.stageIndex===plan.steps.length-1?'disabled':''}>Próxima etapa →</button><button class="button danger-text" type="button" data-live="finish" ${run.status!=='paused'?'disabled title="Pause antes de finalizar"':''}>Finalizar aula</button></div><small class="live-hint">Para finalizar, pause a aula. A duração real de cada etapa será salva.</small>`;
  panel.insertAdjacentHTML('beforeend',`<div class="live-alert-control">${liveAlertControl()}</div>`);
  dock.hidden=false;
  dock.className=`live-timer-dock no-print ${level}`;
  dock.innerHTML=`<div class="live-dock-controls"><button type="button" class="live-drag-handle" data-live-drag aria-label="Arrastar cronômetro">↕</button><button type="button" data-live="opacity" aria-label="Ajustar opacidade">◐</button></div><button class="live-dock-open" type="button" data-live="open" aria-label="Ver cronômetro da aula"><span class="live-dot"></span><span><strong>${escapeHtml(step.title)}</strong><small data-live-dock-stage>${run.status==='paused'?'Pausada':formatLiveDuration(elapsed)} / ${step.minutes} min</small></span><span class="live-dock-total" data-live-dock-total>${formatLiveDuration(liveElapsed(run))}</span></button>`;
  placeLiveDock(dock);
  if(run.status==='running'){
    const alerts=run.alerts||{};
    for(const [name,limit] of [['yellow',.8],['red',.9],['done',1]]){
      const key=`${run.stageIndex}:${name}`;
      if(ratio>=limit&&!alerts[key]){alerts[key]=true;run.alerts=alerts;localStorage.setItem(KEY,JSON.stringify(store));liveAlert(plan,name);}
    }
  }
}
async function liveAction(action){
  if(action==='enable-alerts'){enableLiveAlerts();return;}
  if(action==='opacity'){const currentSettings=liveDockSettings(),levels=[0.45,0.6,0.75,0.9,1],next=levels[(levels.findIndex(value=>value>=(currentSettings.opacity??0.72))+1)%levels.length];localStorage.setItem('budo-live-dock',JSON.stringify({...currentSettings,opacity:next}));renderLiveTimer();toast(`Opacidade: ${Math.round(next*100)}%`);return;}
  const plan=livePlan();if(!plan)return;
  let run=plan.liveRun;
  if(action==='open'){document.querySelector('#liveLessonPanel')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(action==='start'){
    if(run||!plan.steps.length)return;
    if(plan.date!==saoNow().slice(0,10)){toast('Inicie o cronômetro no dia da aula.');return;}
    run={status:'running',startedAt:Date.now(),startedBy:budoCloud.identity(),segmentStartedAt:Date.now(),totalElapsedMs:0,stageElapsedMs:0,stageIndex:0,stageActualMs:[],alerts:{}};
    plan.liveRun=run;
  }else if(action==='pause'&&run?.status==='running'){liveCheckpoint(run);run.status='paused';run.segmentStartedAt=null;}
  else if(action==='resume'&&run?.status==='paused'){run.status='running';run.segmentStartedAt=Date.now();}
  else if(action==='next'&&run&&run.stageIndex<plan.steps.length-1){liveCheckpoint(run);run.stageActualMs[run.stageIndex]=run.stageElapsedMs;run.stageIndex++;run.stageElapsedMs=0;run.alerts={};}
  else if(action==='finish'&&run?.status==='paused'){
    run.stageActualMs[run.stageIndex]=run.stageElapsedMs;
    run.status='finished';run.finishedAt=Date.now();run.segmentStartedAt=null;
    if(isDue(plan))plan.completedAt=run.finishedAt;
  }else return;
  await saveLive(plan);
  if(action==='finish'&&plan.completedAt){store.view='past';archiveNav.past={month:monthKey(plan),instructor:instructorKey(plan),planId:plan.id};store.pastId=plan.id;store.pastMonth=monthKey(plan);}
  render();
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-live]');if(button)liveAction(button.dataset.live);});
document.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-live-drag]');if(!handle)return;
  event.preventDefault();draggingLiveDock=true;
  const dock=document.querySelector('#liveTimerDock'),rect=dock.getBoundingClientRect(),dx=event.clientX-rect.left,dy=event.clientY-rect.top;
  const move=pointer=>{dock.style.left=`${Math.max(0,Math.min(window.innerWidth-rect.width,pointer.clientX-dx))}px`;dock.style.top=`${Math.max(0,Math.min(window.innerHeight-rect.height,pointer.clientY-dy))}px`;dock.style.right='auto';dock.style.bottom='auto';};
  const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);draggingLiveDock=false;const position=dock.getBoundingClientRect();localStorage.setItem('budo-live-dock',JSON.stringify({...liveDockSettings(),left:position.left,top:position.top}));renderLiveTimer();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
});
function tickLiveTimer(){
  if(draggingLiveDock)return;
  const plan=livePlan(),run=plan?.liveRun;
  if(run?.status!=='running')return;
  const panel=document.querySelector('#liveLessonPanel'),dock=document.querySelector('#liveTimerDock');
  if(!panel||dock.hidden)return;
  const stage=plan.steps[run.stageIndex],elapsed=liveStageElapsed(run),total=liveElapsed(run),target=stage.minutes*60000,ratio=target?elapsed/target:1;
  const level=liveLevel(elapsed,target);
  panel.querySelector('[data-live-stage-time]').textContent=formatLiveDuration(elapsed);
  panel.querySelector('[data-live-total-time]').textContent=formatLiveDuration(total);
  dock.querySelector('[data-live-dock-stage]').textContent=`${formatLiveDuration(elapsed)} / ${stage.minutes} min`;
  dock.querySelector('[data-live-dock-total]').textContent=formatLiveDuration(total);
  const status=panel.querySelector('.live-status');status.className=`live-status ${level}`;status.textContent=level==='done'?'Trocar etapa':level==='red'?'Quase no fim':level==='yellow'?'Prepare a troca':'Em andamento';
  const fill=panel.querySelector('.live-progress-fill');fill.className=`live-progress-fill ${level}`;fill.style.width=`${Math.min(100,ratio*100)}%`;
  dock.className=`live-timer-dock no-print ${level}`;
  const alerts=run.alerts||{};
  for(const [name,limit] of [['yellow',.8],['red',.9],['done',1]]){const key=`${run.stageIndex}:${name}`;if(ratio>=limit&&!alerts[key]){alerts[key]=true;run.alerts=alerts;localStorage.setItem(KEY,JSON.stringify(store));liveAlert(plan,name);}}
}
setInterval(tickLiveTimer,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderLiveTimer();});
renderLiveTimer();
