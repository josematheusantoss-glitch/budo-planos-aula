const KEY = 'budo-lesson-plans-v2';
const OLD_KEY = 'budo-lesson-plans-v1';
const CLOUD_SYNC_KEY = 'budo-cloud-last-sync-v1';
const TARGET = 60;
const $ = selector => document.querySelector(selector);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeVideoUrl = value => {try {const url=new URL(String(value||'').trim());return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
const videoLink = value => {const url=safeVideoUrl(value);return url?`<a class="video-open" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo ↗</a><span class="video-print print-only">${escapeHtml(url)}</span>`:'';};
let videoDbPromise;
function videoDb(){
  if(!videoDbPromise)videoDbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('budo-video-files',1);request.onupgradeneeded=()=>request.result.createObjectStore('videos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return videoDbPromise;
}
async function putVideo(id,blob){const db=await videoDb();return new Promise((resolve,reject)=>{const transaction=db.transaction('videos','readwrite');transaction.objectStore('videos').put(blob,id);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}
async function getVideo(id){const db=await videoDb();return new Promise((resolve,reject)=>{const request=db.transaction('videos').objectStore('videos').get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});}
async function deleteVideo(id){const db=await videoDb();return new Promise((resolve,reject)=>{const transaction=db.transaction('videos','readwrite');transaction.objectStore('videos').delete(id);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}
const fileAsDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
const localDate = () => new Date().toLocaleDateString('en-CA');
const localTime = () => new Date().toTimeString().slice(0,5);
const stage = (title, minutes, activity = '', extra = {}) => ({id:uid(), title, minutes, activity, ...extra});
const exampleWarmup = ['Corrida — 2 voltas','Deslocamentos laterais','Lateral dentro/fora','Joelhos altos','Calcanhares','Desacelerar','100 polichinelos','300 abdominais variados','Prancha — 1 minuto','Fuga de quadril 1 — uma ida','Fuga de quadril 2 — uma ida'].join('\n');

function template(blank = false) {
  return {
    id:uid(), className:blank?'':'Faixas brancas · Meia guarda', instructor:'', date:localDate(), startTime:localTime(),
    group:blank?'':'Faixas brancas', theme:blank?'':'Raspagem de meia guarda com escudo de joelho', videoUrl:'', videoFile:null, notes:'', isStarter:!blank, updatedAt:Date.now(),
    steps:[
      stage('Aquecimento geral',10,exampleWarmup), stage('Água',2), stage('Aquecimento técnico',10),
      stage('Técnica principal',27,'',{subdivisions:[{id:uid(),name:'Demonstração',minutes:5},{id:uid(),name:'Repetições',minutes:17},{id:uid(),name:'Resistência leve',minutes:5}]}),
      stage('Água',2), stage('Lutas',9,'',{fight:{rounds:3,roundMinutes:3,observation:'Casar duplas por peso e experiência'}})
    ]
  };
}
const emptyDraft=()=>({...template(true),isStarter:true});
const isFightStage=s=>/^lutas?\b/i.test(String(s.title||'').trim());
function normalizePlan(plan, isDraft = false) {
  const normalized={
    id:plan.id||uid(), className:plan.className||plan.theme||'', instructor:plan.instructor||'', date:plan.date||localDate(),
    startTime:plan.startTime||'', group:plan.group||'', theme:plan.theme||'', videoUrl:plan.videoUrl||'', videoFile:plan.videoFile?.id?{id:String(plan.videoFile.id),name:String(plan.videoFile.name||'Vídeo'),type:String(plan.videoFile.type||'video/mp4'),size:Number(plan.videoFile.size)||0,path:plan.videoFile.path||null}:null, notes:plan.notes||'',
    updatedAt:plan.updatedAt||Date.now(), isStarter:!!plan.isStarter, recordedAt:plan.recordedAt||null, scheduledAt:plan.scheduledAt||null,
    completedAt:plan.completedAt||(plan.recordedAt&&!plan.scheduledAt?plan.recordedAt:null), lastTimeEdit:plan.lastTimeEdit||null,
    steps:(plan.steps||[]).map(s=>({id:s.id||uid(),title:s.title||'',minutes:Math.max(0,Math.floor(Number(s.minutes)||0)),
      activity:typeof s.activity==='string'?s.activity:(s.items||[]).map(x=>x.text).filter(Boolean).join('\n'),
      ...(Array.isArray(s.subdivisions)?{subdivisions:s.subdivisions.map(x=>({id:x.id||uid(),name:x.name||'',minutes:Math.max(0,Math.floor(Number(x.minutes)||0))}))}:{}),
      ...(isFightStage(s)?{fight:{rounds:Math.max(1,Math.floor(Number(s.fight?.rounds)||3)),roundMinutes:Math.max(1,Math.floor(Number(s.fight?.roundMinutes)||3)),observation:s.fight?.observation??s.fight?.organization??''}}:{})
    }))
  };
  if(isDraft) normalized.steps.forEach((s,i)=>{
    if(!isFightStage(s))return;
    const previous=plan.steps?.[i];
    if(previous?.fight && previous.fight.observation===undefined){
      const fightMinutes=s.fight.rounds*s.fight.roundMinutes;
      const difference=s.minutes-fightMinutes;
      s.minutes=fightMinutes;
      const recipient=normalized.steps.find(x=>/técnica principal/i.test(x.title))||normalized.steps.slice(0,i).reverse().find(x=>!isFightStage(x)&&x.title.toLocaleLowerCase('pt-BR')!=='água');
      if(recipient&&recipient!==s&&recipient.minutes+difference>=0){recipient.minutes+=difference;rebalanceSubdivisions(recipient);}
    } else s.minutes=s.fight.rounds*s.fight.roundMinutes;
  });
  return normalized;
}
function monthKey(plan) {
  const date=String(plan?.date||'');
  return /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)?date.slice(0,7):'sem-data';
}
function monthLabel(key) {
  if(key==='sem-data')return 'Sem data';
  const [year,month]=key.split('-').map(Number);
  const label=new Date(year,month-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  return label.charAt(0).toLocaleUpperCase('pt-BR')+label.slice(1);
}
function saoNow(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
const isDue=(plan,at=saoNow())=>/^\d{4}-\d{2}-\d{2}$/.test(plan.date||'')&&at>=`${plan.date}T19:00`;
const isCompleted=plan=>!!plan.completedAt||isDue(plan);
const scheduledRecords=()=>store.past.filter(p=>!isCompleted(p)).sort((a,b)=>`${a.date}T${a.startTime||''}`.localeCompare(`${b.date}T${b.startTime||''}`));
function months() {return [...new Set(store.past.filter(isCompleted).map(monthKey))].sort((a,b)=>a==='sem-data'?1:b==='sem-data'?-1:a.localeCompare(b));}
function monthRecords(key) {return store.past.filter(p=>isCompleted(p)&&monthKey(p)===key).sort((a,b)=>`${b.date||''}T${b.startTime||''}`.localeCompare(`${a.date||''}T${a.startTime||''}`));}
function syncScheduledSelection(){const records=scheduledRecords();if(!records.some(p=>p.id===store.scheduledId))store.scheduledId=records[0]?.id||null;}
function syncPastSelection() {
  const available=months();
  if(!available.length){store.pastMonth=null;store.pastId=null;return;}
  if(!available.includes(store.pastMonth)){const selected=store.past.find(p=>p.id===store.pastId&&isCompleted(p));store.pastMonth=selected?monthKey(selected):available[available.length-1];}
  const inMonth=monthRecords(store.pastMonth);
  if(!inMonth.some(p=>p.id===store.pastId))store.pastId=inMonth[0]?.id||null;
}
function readStore() {
  try {
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved && Array.isArray(saved.drafts) && Array.isArray(saved.past)) {
      saved.drafts=saved.drafts.map(p=>normalizePlan(p,true)); saved.past=saved.past.map(p=>normalizePlan(p,false));
      if(!saved.drafts.length) saved.drafts=[emptyDraft()];
      saved.view=['draft','scheduled','past'].includes(saved.view)?saved.view:'draft';
      saved.scheduledId=saved.scheduledId||null;
      saved.activeId=saved.drafts.some(p=>p.id===saved.activeId)?saved.activeId:saved.drafts[0].id;
      saved.pastId=saved.past.some(p=>p.id===saved.pastId)?saved.pastId:(saved.past[0]?.id||null);
      return saved;
    }
  } catch {}
  try {
    const old=JSON.parse(localStorage.getItem(OLD_KEY));
    if(Array.isArray(old?.plans) && old.plans.length) {
      const drafts=old.plans.map(p=>normalizePlan(p,true));
      return {drafts,past:[],activeId:drafts.some(p=>p.id===old.activeId)?old.activeId:drafts[0].id,scheduledId:null,pastId:null,pastMonth:null,view:'draft'};
    }
  } catch {}
  const first=template();
  return {drafts:[first],past:[],activeId:first.id,scheduledId:null,pastId:null,pastMonth:null,view:'draft'};
}
let store=readStore();
syncPastSelection();
syncScheduledSelection();
let toastTimer;
let cloudReady=false;
const cloudTimers=new Map(),cloudDirty=new Set();
function queueCloudSave(plan){
  if(!cloudReady||!plan)return;
  cloudDirty.add(plan.id);
  clearTimeout(cloudTimers.get(plan.id));
  cloudTimers.set(plan.id,setTimeout(async()=>{
    const latest=[...store.drafts,...store.past].find(p=>p.id===plan.id);
    if(!latest)return;
    try{await budoCloud.saveLesson(latest);cloudDirty.delete(plan.id);}
    catch{toast('Alteração salva neste aparelho. A sincronização será tentada novamente.');}
  },600));
}
async function syncCloud(){
  if(!cloudReady)return;
  const remote=await budoCloud.listLessons();
  const previousSync=Number(localStorage.getItem(CLOUD_SYNC_KEY)||0);
  const local=[...store.drafts,...store.past],merged=new Map(remote.map(row=>[row.id,normalizePlan(row.plan,!row.plan.recordedAt)]));
  const upload=[];
  for(const plan of local){
    const server=merged.get(plan.id);
    if(plan.isStarter&&!server){if(!remote.length)merged.set(plan.id,plan);continue;}
    if(!server&&previousSync&&!cloudDirty.has(plan.id)&&plan.updatedAt<=previousSync)continue;
    if(!server||cloudDirty.has(plan.id)||plan.updatedAt>server.updatedAt){merged.set(plan.id,plan);upload.push(plan);}
  }
  const all=[...merged.values()];
  store.drafts=all.filter(p=>!p.recordedAt);
  store.past=all.filter(p=>!!p.recordedAt);
  if(!store.drafts.length)store.drafts=[emptyDraft()];
  if(!store.drafts.some(p=>p.id===store.activeId))store.activeId=store.drafts[0].id;
  syncScheduledSelection();syncPastSelection();
  localStorage.setItem(KEY,JSON.stringify(store));render();
  for(const plan of all){
    if(!plan.videoFile?.id||plan.videoFile.path)continue;
    try{const blob=await getVideo(plan.videoFile.id);if(!blob||blob.size>50*1024*1024)continue;await budoCloud.uploadVideo(plan.videoFile.id,blob);plan.videoFile.path=plan.videoFile.id;plan.updatedAt=Date.now();if(!upload.includes(plan))upload.push(plan);}
    catch{toast('Um vídeo antigo ainda está disponível apenas neste aparelho.');}
  }
  localStorage.setItem(KEY,JSON.stringify(store));
  for(const plan of upload){try{await budoCloud.saveLesson(plan);}catch{cloudDirty.add(plan.id);}}
  localStorage.setItem(CLOUD_SYNC_KEY,String(Date.now()));
}
async function connectCloud(){
  const ok=await budoCloud.restore();
  if(!ok){$('#authGate').hidden=false;return;}
  cloudReady=true;$('#authGate').hidden=true;$('#loggedInUser').textContent=budoCloud.username();
  try{await syncCloud();}catch{toast('Sem conexão com as aulas compartilhadas. Seus dados locais foram mantidos.');}
}
const draft=()=>store.view==='scheduled'?store.past.find(p=>p.id===store.scheduledId):store.drafts.find(p=>p.id===store.activeId)||store.drafts[0];
const scheduled=()=>scheduledRecords().find(p=>p.id===store.scheduledId)||scheduledRecords()[0];
const past=()=>monthRecords(store.pastMonth).find(p=>p.id===store.pastId)||monthRecords(store.pastMonth)[0];
const current=()=>store.view==='past'?past():store.view==='scheduled'?scheduled():draft();
const sum=p=>p.steps.reduce((n,s)=>n+s.minutes,0);
const fightUsed=s=>s.fight?s.fight.rounds*s.fight.roundMinutes:0;
function overflowStages(plan) {
  let elapsed=0;
  return plan.steps.flatMap(s=>{const over=Math.max(0,elapsed+s.minutes-Math.max(elapsed,TARGET));elapsed+=s.minutes;return over?[{id:s.id,title:s.title||'Etapa sem título',minutes:over}]:[];});
}
function persist(changed=false) {
  if(changed&&store.view!=='past'&&draft()){draft().isStarter=false;draft().updatedAt=Date.now();queueCloudSave(draft());}
  localStorage.setItem(KEY,JSON.stringify(store));
  $('#saveStatus').textContent=store.view==='draft'?'✓ Rascunho salvo':store.view==='scheduled'?'✓ Alterações salvas':(past()?'✓ Aula concluída':'');
  renderList();
  renderDock();
}
function toast(message) {
  const node=$('#toast');node.textContent=message;node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4300);
}
function setView(view) {store.view=view;if(view==='past')syncPastSelection();if(view==='scheduled')syncScheduledSelection();persist();render();closeSidebar();}
function renderList() {
  $('#draftTab').classList.toggle('active',store.view==='draft');
  $('#scheduledTab').classList.toggle('active',store.view==='scheduled');
  $('#pastTab').classList.toggle('active',store.view==='past');
  $('#draftTab').setAttribute('aria-selected',String(store.view==='draft'));
  $('#scheduledTab').setAttribute('aria-selected',String(store.view==='scheduled'));
  $('#pastTab').setAttribute('aria-selected',String(store.view==='past'));
  $('#scheduledCount').textContent=scheduledRecords().length;
  $('#pastCount').textContent=store.past.filter(isCompleted).length;
  const list=store.view==='past'?monthRecords(store.pastMonth):store.view==='scheduled'?scheduledRecords():store.drafts;
  const activeId=store.view==='past'?store.pastId:store.view==='scheduled'?store.scheduledId:store.activeId;
  const ordered=store.view==='draft'?list.slice().sort((a,b)=>(b.recordedAt||b.updatedAt)-(a.recordedAt||a.updatedAt)):list;
  $('#planList').innerHTML=ordered.length?ordered.map(p=>
    store.view!=='draft'
      ?`<button type="button" class="plan-link ${p.id===activeId?'active':''}" data-plan="${p.id}"><strong>${escapeHtml(p.instructor||'Sem instrutor')}</strong><small>${escapeHtml(formatDate(p.date))} · ${escapeHtml(p.theme||'Sem tema')}</small></button>`
      :`<button type="button" class="plan-link ${p.id===activeId?'active':''}" data-plan="${p.id}"><strong>${escapeHtml(p.className||p.theme||'Aula sem nome')}</strong><small>${escapeHtml(formatDate(p.date)||'Sem data')} · ${escapeHtml(p.startTime||'Sem horário')} · ${escapeHtml(p.instructor||'Sem instrutor')}</small></button>`).join('')
    :`<p class="empty-list">${store.view==='scheduled'?'Nenhuma aula agendada.':store.view==='past'&&store.past.length?'Nenhuma aula concluída neste mês.':'Nenhuma aula registrada ainda.'}</p>`;
}
function renderDock() {
  const dock=$('#timeDock');
  if(store.view==='past'||!draft()){dock.hidden=true;return;}
  dock.hidden=false;
  const plan=draft(),total=sum(plan),remaining=TARGET-total,over=overflowStages(plan);
  const width=Math.min(100,Math.max(0,total/TARGET*100));
  const last=plan.lastTimeEdit;
  dock.innerHTML=`<div class="dock-top"><strong>${remaining>0?`${remaining} min disponíveis`:remaining===0?'60 min fechados':`${-remaining} min acima`}</strong><span>${total} / ${TARGET} min</span></div><div class="dock-track"><div class="dock-fill ${remaining<0?'over':''}" style="width:${width}%"></div></div><small>${remaining<0?(last&&last.to>last.from?`Último aumento: ${escapeHtml(last.title)} (+${last.to-last.from} min)`:`Excesso a partir de: ${escapeHtml(over[0]?.title||'etapa')}`):remaining===0?'Pronto para registrar':'Distribua o tempo restante entre as etapas'}</small>`;
}
function render() {
  renderList();renderDock();
  const isPast=store.view==='past',isScheduled=store.view==='scheduled',plan=current();
  $('#newPlan').textContent='＋ Nova aula';
  $('#pageEyebrow').textContent=isPast?'AULAS CONCLUÍDAS':isScheduled?'AULA AGENDADA':'MONTAR AULA';
  $('#pageTitle').textContent=isPast?'Aulas concluídas':(plan?.className||'Nova aula');
  $('#pageSubtitle').textContent=isPast?'Registro completo das aulas realizadas.':isScheduled?'Aula registrada. Você pode completar ou ajustar os dados até as 19h do dia da aula.':'Preencha as etapas e registre a aula ao final.';
  $('#duplicatePlan').textContent=isPast?'Usar como modelo':'Duplicar';
  $('#duplicatePlan').hidden=!plan;
  $('#deletePlan').hidden=!plan;
  $('#saveStatus').textContent=isPast?(plan?'✓ Aula concluída':''):isScheduled?'✓ Alterações salvas':'✓ Rascunho salvo';
  $('#printButton').hidden=!plan;
  $('#editor').innerHTML=isPast?renderPast(plan):isScheduled&&!plan?'<div class="empty-state"><h2>Nenhuma aula agendada</h2><p>As aulas registradas para datas futuras aparecem aqui.</p></div>':renderDraft(plan,isScheduled);
  $('#editor').querySelectorAll('.step-title-input').forEach(resizeStepTitle);
  $('#editor').querySelectorAll('.activity-text, #notes').forEach(resizeWritingArea);
  loadVideoPreviews();
}
let previewVersion=0,previewUrls=[];
async function loadVideoPreviews(){
  const version=++previewVersion;
  previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
  for(const node of $('#editor').querySelectorAll('video[data-video-id]')){
    try{
      let blob=await getVideo(node.dataset.videoId);
      if(!blob&&cloudReady){blob=await budoCloud.downloadVideo(node.dataset.videoId);if(blob)putVideo(node.dataset.videoId,blob).catch(()=>{});}
      if(version!==previewVersion)return;
      if(blob){const url=URL.createObjectURL(blob);previewUrls.push(url);node.src=url;}
      else node.closest('.video-attachment').querySelector('.video-missing').hidden=false;
    }catch{if(version===previewVersion)node.closest('.video-attachment').querySelector('.video-missing').hidden=false;}
  }
}
function resizeStepTitle(node){node.style.height='auto';node.style.height=`${node.scrollHeight}px`;}
function resizeWritingArea(node){node.style.height='auto';node.style.height=`${node.scrollHeight}px`;}
function videoAttachment(file,editable=false){
  if(!file)return '';
  return `<div class="video-attachment"><div class="video-attachment-head"><strong>🎬 ${escapeHtml(file.name)}</strong>${editable?`<button type="button" class="small-button no-print" data-action="remove-video">Remover</button>`:''}</div><details class="video-preview no-print"><summary>Assistir vídeo</summary><video controls playsinline preload="none" data-video-id="${escapeHtml(file.id)}"></video></details><p class="video-missing no-print" hidden>Vídeo não encontrado neste navegador. Importe o backup da aula.</p></div>`;
}
function renderDraft(plan,isScheduled=false) {
  const total=sum(plan),remaining=TARGET-total,over=overflowStages(plan);
  const last=plan.lastTimeEdit;
  const lastChange=last&&last.to>last.from?`Último aumento: <strong>${escapeHtml(last.title)} (+${last.to-last.from} min)</strong>. `:'';
  const overText=over.length?`<p class="overrun-list">${lastChange}A soma ultrapassa 60 min a partir de ${over.map(s=>`<strong>${escapeHtml(s.title)} (+${s.minutes} min)</strong>`).join(', ')}. Reajuste os tempos antes de registrar.</p>`:'';
  const issues=[];
  for(const s of plan.steps){if(s.subdivisions?.length&&s.subdivisions.reduce((n,x)=>n+x.minutes,0)!==s.minutes)issues.push(`Subdivisões de ${s.title} não somam ${s.minutes} min.`);}
  return `<article class="sheet"><div class="sheet-header"><img class="sheet-logo" src="logobudo.jpeg" alt="Logo Budô"><div class="sheet-kicker">JIU-JÍTSU · PLANEJAMENTO<strong>PLANO DE AULA</strong></div></div><div class="sheet-body">
    <div class="section-title"><h2>01 / IDENTIFICAÇÃO</h2></div>
    <div class="meta-grid">
      ${field('className','Nome da aula',plan.className,'Ex.: Aula de faixas brancas','span-2')}
      ${field('instructor','Instrutor / monitor',plan.instructor,'Nome do responsável','span-2')}
      ${field('date','Data',plan.date,'','', 'date')}
      ${field('startTime','Horário',plan.startTime,'','', 'time')}
      ${field('group','Turma',plan.group,'Ex.: Faixas brancas')}
      ${field('theme','Tema',plan.theme,'Tema da aula')}
    </div>
    <div class="video-reference field"><span class="field-label">Vídeo de referência</span><div class="video-upload-row"><label class="video-upload no-print" for="videoFileInput">＋ Anexar vídeo</label><input id="videoFileInput" type="file" accept="video/*" hidden><span class="video-upload-hint no-print">Até 50 MB · para vídeos maiores, use um link</span></div>${videoAttachment(plan.videoFile,true)}<div class="video-link-label no-print">ou cole o link</div><div class="video-row"><input id="videoUrl" aria-label="Link do vídeo de referência" type="url" inputmode="url" data-field="videoUrl" value="${escapeHtml(plan.videoUrl)}" placeholder="https://..."><div id="videoActions">${videoLink(plan.videoUrl)}</div></div></div>
    <div class="section-title"><h2>02 / ETAPAS DA AULA</h2><span class="field-label">${plan.steps.length} etapas · meta ${TARGET} min</span></div>
    <div class="stages">${plan.steps.map((s,i)=>renderStep(s,i,plan.steps.length,over)).join('')}</div>
    <button type="button" class="add-stage no-print" data-action="add-step">＋ Adicionar etapa</button>
    <div class="notes-section"><div class="section-title"><h2>03 / OBSERVAÇÕES</h2></div><div class="field"><label for="notes">Observações da aula</label><textarea id="notes" data-field="notes" placeholder="Objetivos, adaptações, materiais ou registro da aula">${escapeHtml(plan.notes)}</textarea><div class="notes-print print-only">${escapeHtml(plan.notes)}</div></div></div>
    <div class="final-review"><div class="section-title"><h2>04 / CONFERÊNCIA FINAL</h2></div><div class="final-total ${remaining===0?'ready':'needs-adjustment'}"><span>Tempo das etapas</span><strong>${total} / ${TARGET} min</strong><em>${remaining>0?`Faltam ${remaining} min`:remaining<0?`Passou ${-remaining} min`:'Tempo correto'}</em></div>${overText}${issues.map(x=>`<p class="validation-issue">${escapeHtml(x)}</p>`).join('')}<p class="final-hint">${isScheduled?'Aula agendada. Cada alteração é salva automaticamente até as 19h do dia da aula.':'O registro final exige exatamente 60 minutos. O rascunho é salvo automaticamente.'}</p>${isScheduled?'':`<button id="registerClass" class="button primary register-button no-print" type="button">✓ Salvar e registrar aula</button>`}</div>
  </div></article>`;
}
function field(key,label,value,placeholder='',extraClass='',type='text') {return `<div class="field ${extraClass}"><label for="${key}">${label}</label><input id="${key}" type="${type}" data-field="${key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;}
function renderStep(s,i,count,over) {
  const isFight=isFightStage(s);
  const subdiv=!isFight&&s.subdivisions?.length?`<div class="subdivisions"><h4>Divisão da etapa · ${s.subdivisions.reduce((n,x)=>n+x.minutes,0)} / ${s.minutes} min</h4>${s.subdivisions.map(x=>`<div class="sub-row"><input class="sub-name" aria-label="Nome da subdivisão" data-sub-name="${s.id}:${x.id}" value="${escapeHtml(x.name)}"><input type="number" min="0" step="1" aria-label="Minutos da subdivisão" data-sub-time="${s.id}:${x.id}" value="${x.minutes}"><span>min</span><button class="small-button no-print" type="button" data-action="remove-sub" data-id="${s.id}:${x.id}" aria-label="Remover subdivisão">×</button></div>`).join('')}<button class="small-button no-print" type="button" data-action="add-sub" data-id="${s.id}">＋ Subdivisão</button></div>`:'';
  const f=isFight?s.fight:null;
  const content=isFight?`<div class="fight-simple"><div class="fight-fields"><label>Quantidade de lutas<input class="fight-input" type="number" min="1" step="1" data-fight="${s.id}:rounds" value="${f.rounds}"></label><label>Minutos por luta<input class="fight-input" type="number" min="1" step="1" data-fight="${s.id}:roundMinutes" value="${f.roundMinutes}"></label></div><p class="fight-summary">${f.rounds} ${f.rounds===1?'luta':'lutas'} de ${f.roundMinutes} ${f.roundMinutes===1?'minuto':'minutos'} · ${fightUsed(s)} min no total</p><div class="field"><label for="fight-observation-${s.id}">Observação</label><input id="fight-observation-${s.id}" data-fight-observation="${s.id}" value="${escapeHtml(f.observation)}" placeholder="Ex.: casar duplas por peso e experiência"></div></div>`:`<div class="field"><label for="activity-${s.id}">Atividades / conteúdo da etapa</label><textarea class="activity-text" id="activity-${s.id}" data-activity="${s.id}" placeholder="Escreva livremente o que será feito nesta etapa">${escapeHtml(s.activity)}</textarea><div class="activity-print print-only">${escapeHtml(s.activity)}</div></div>${subdiv}${!s.subdivisions?.length?`<div class="stage-extras no-print"><button class="small-button" type="button" data-action="add-sub" data-id="${s.id}">＋ Dividir tempo</button></div>`:''}`;
  return `<section class="step-card ${over.some(x=>x.id===s.id)?'step-over':''}" data-step="${s.id}"><div class="step-head"><span class="step-number">${String(i+1).padStart(2,'0')}</span><textarea rows="1" class="step-title-input" aria-label="Título da etapa ${i+1}" data-step-title="${s.id}">${escapeHtml(s.title)}</textarea><label class="step-time"><input type="number" min="0" step="1" aria-label="Tempo da etapa ${i+1}" data-step-time="${s.id}" value="${s.minutes}" ${isFight?'readonly':''}> min</label><div class="step-controls no-print"><button class="icon-button" type="button" data-action="up-step" data-id="${s.id}" aria-label="Subir etapa" ${i===0?'disabled':''}>↑</button><button class="icon-button" type="button" data-action="down-step" data-id="${s.id}" aria-label="Descer etapa" ${i===count-1?'disabled':''}>↓</button><button class="icon-button" type="button" data-action="remove-step" data-id="${s.id}" aria-label="Remover etapa">×</button></div></div><div class="step-body">${content}</div></section>`;
}
function renderMonthNavigation() {
  return `<div class="month-tabs no-print" role="tablist" aria-label="Filtrar aulas por mês">${months().map(key=>`<button type="button" role="tab" aria-selected="${key===store.pastMonth}" class="month-tab ${key===store.pastMonth?'active':''}" data-month="${key}">${escapeHtml(monthLabel(key))}<span>${monthRecords(key).length}</span></button>`).join('')}</div>`;
}
function renderMonthCards() {
  const records=monthRecords(store.pastMonth);
  return `<section class="month-section no-print"><div class="month-heading"><div><span class="eyebrow">REGISTROS DO MÊS</span><h2>${escapeHtml(monthLabel(store.pastMonth))}</h2></div><span>${records.length} ${records.length===1?'aula':'aulas'}</span></div><div class="month-records">${records.map(p=>`<button type="button" class="month-record ${p.id===store.pastId?'active':''}" data-past-plan="${p.id}"><strong class="month-instructor">${escapeHtml(p.instructor||'Sem instrutor')}</strong><span class="month-date">${escapeHtml(formatDate(p.date))}${p.startTime?` · ${escapeHtml(p.startTime)}`:''}</span><span class="month-theme">${escapeHtml(p.theme||'Sem tema')}</span></button>`).join('')}</div></section>`;
}
function renderPast(plan) {
  if(!plan)return `<div class="empty-state"><h2>Nenhuma aula registrada</h2><p>Quando salvar uma aula de 60 minutos, ela aparecerá aqui com todos os detalhes.</p><button class="button primary" type="button" data-action="show-drafts">Montar aula</button></div>`;
  return `${renderMonthNavigation()}${renderMonthCards()}<article class="sheet past-sheet"><div class="sheet-header"><img class="sheet-logo" src="logobudo.jpeg" alt="Logo Budô"><div class="sheet-kicker">JIU-JÍTSU · REGISTRO<strong>AULA REALIZADA</strong></div></div><div class="sheet-body"><div class="section-title"><h2>IDENTIFICAÇÃO</h2></div><div class="record-grid">${record('Nome da aula',plan.className)}${record('Instrutor / monitor',plan.instructor)}${record('Data',formatDate(plan.date))}${record('Horário',plan.startTime)}${record('Turma',plan.group)}${record('Tema',plan.theme)}</div>${plan.videoFile||safeVideoUrl(plan.videoUrl)?`<div class="video-reference video-record"><span class="field-label">VÍDEO DE REFERÊNCIA</span>${videoAttachment(plan.videoFile)}${videoLink(plan.videoUrl)}</div>`:''}<div class="section-title"><h2>ETAPAS · ${sum(plan)} MIN</h2></div><div class="stages">${plan.steps.map((s,i)=>`<section class="step-card"><div class="step-head"><span class="step-number">${String(i+1).padStart(2,'0')}</span><strong class="record-step-title">${escapeHtml(s.title)}</strong><strong>${s.minutes} min</strong></div><div class="step-body">${s.activity?`<div class="record-activity">${escapeHtml(s.activity)}</div>`:''}${s.subdivisions?.length?`<div class="record-sub">${s.subdivisions.map(x=>`${escapeHtml(x.name)}: ${x.minutes} min`).join(' · ')}</div>`:''}${s.fight?`<div class="record-sub">${s.fight.rounds} ${s.fight.rounds===1?'luta':'lutas'} de ${s.fight.roundMinutes} ${s.fight.roundMinutes===1?'minuto':'minutos'}${s.fight.observation?` · ${escapeHtml(s.fight.observation)}`:''}</div>`:''}</div></section>`).join('')}</div><div class="notes-section"><div class="section-title"><h2>OBSERVAÇÕES</h2></div><div class="record-activity">${escapeHtml(plan.notes||'—')}</div></div><p class="recorded-at">Registrada em ${escapeHtml(new Date(plan.recordedAt||plan.updatedAt).toLocaleString('pt-BR'))}</p></div></article>`;
}
function record(label,value){return `<div class="record-field"><small>${label}</small><strong>${escapeHtml(value||'—')}</strong></div>`;}
function formatDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value||'';const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}
function adjustParts(parts,diff) {if(!diff)return true;if(diff>0){parts[parts.length-1].minutes+=diff;return true;}let left=-diff;for(const part of [...parts].reverse()){const take=Math.min(part.minutes,left);part.minutes-=take;left-=take;if(!left)break;}return left===0;}
function rebalanceSubdivisions(s){if(!s.subdivisions?.length)return;adjustParts(s.subdivisions,s.minutes-s.subdivisions.reduce((n,x)=>n+x.minutes,0));}
function changeStepTime(id,value){const n=Number(value);if(!Number.isInteger(n)||n<0){toast('Informe um tempo inteiro de 0 minuto ou mais.');render();return;}const p=draft(),s=p.steps.find(x=>x.id===id);if(isFightStage(s)){render();return;}p.lastTimeEdit={id,title:s.title,from:s.minutes,to:n};s.minutes=n;rebalanceSubdivisions(s);persist(true);render();}
function changeSubTime(sid,pid,value){const n=Number(value),s=draft().steps.find(x=>x.id===sid);if(!Number.isInteger(n)||n<0||n>s.minutes){toast('A subdivisão deve caber no tempo da etapa.');render();return;}const part=s.subdivisions.find(x=>x.id===pid),others=s.subdivisions.filter(x=>x.id!==pid).map(x=>({...x}));if(!others.length&&n!==s.minutes){toast('A única subdivisão deve ter o tempo completo da etapa.');render();return;}if(others.length&&!adjustParts(others,part.minutes-n)){toast('As demais subdivisões não têm tempo suficiente.');render();return;}part.minutes=n;others.forEach(x=>s.subdivisions.find(y=>y.id===x.id).minutes=x.minutes);persist(true);render();}
function move(arr,index,direction){const next=index+direction;if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];persist(true);render();}
function videoIsReferenced(id){return [...store.drafts,...store.past].some(p=>p.videoFile?.id===id);}
function handleAction(action,id){if(action==='show-drafts'){setView('draft');return;}const p=draft();let s=p.steps.find(x=>x.id===id);
  if(action==='remove-video'){const oldId=p.videoFile?.id;p.videoFile=null;persist(true);render();if(oldId&&!videoIsReferenced(oldId)){deleteVideo(oldId).catch(()=>{});if(cloudReady)budoCloud.deleteVideo(oldId).catch(()=>{});}return;}
  if(action==='add-step')p.steps.push(stage('Nova etapa',0));
  else if(action==='remove-step'){if(p.steps.length===1){toast('Mantenha pelo menos uma etapa.');return;}if(!confirm('Remover esta etapa?'))return;p.steps=p.steps.filter(x=>x.id!==id);}
  else if(action==='up-step'||action==='down-step'){move(p.steps,p.steps.findIndex(x=>x.id===id),action==='up-step'?-1:1);return;}
  else if(action==='add-sub'){if(!s.subdivisions)s.subdivisions=[{id:uid(),name:'Parte 1',minutes:s.minutes}];else s.subdivisions.push({id:uid(),name:'Nova subdivisão',minutes:0});}
  else if(action==='remove-sub'){const [sid,pid]=id.split(':');s=p.steps.find(x=>x.id===sid);s.subdivisions=s.subdivisions.filter(x=>x.id!==pid);if(s.subdivisions.length)rebalanceSubdivisions(s);else delete s.subdivisions;}
  persist(true);render();
}
function registerClass(){const p=draft();const required=[['className','nome da aula'],['instructor','instrutor/monitor'],['date','data'],['startTime','horário'],['group','turma'],['theme','tema']];const missing=required.find(([key])=>!String(p[key]||'').trim());if(missing){toast(`Preencha ${missing[1]} antes de registrar.`);$(`#${missing[0]}`)?.focus();return;}if(sum(p)!==TARGET){const over=overflowStages(p);toast(sum(p)>TARGET?`Excedeu ${sum(p)-TARGET} min. Confira ${over[0]?.title||'as etapas'}.`:`Faltam ${TARGET-sum(p)} min para completar a aula.`);$('#registerClass').scrollIntoView({behavior:'smooth',block:'center'});return;}const invalid=p.steps.find(s=>s.subdivisions?.length&&s.subdivisions.reduce((n,x)=>n+x.minutes,0)!==s.minutes || s.fight&&fightUsed(s)>s.minutes);if(invalid){toast(`Revise o tempo interno de ${invalid.title}.`);return;}const registered=structuredClone(p);registered.recordedAt=Date.now();registered.updatedAt=registered.recordedAt;registered.scheduledAt=registered.recordedAt;registered.completedAt=isDue(registered)?registered.recordedAt:null;store.past.unshift(registered);store.pastId=registered.id;store.scheduledId=registered.id;store.pastMonth=monthKey(registered);store.drafts=store.drafts.filter(x=>x.id!==p.id);if(!store.drafts.length)store.drafts=[emptyDraft()];store.activeId=store.drafts[0].id;store.view=registered.completedAt?'past':'scheduled';persist();queueCloudSave(registered);render();window.scrollTo({top:0,behavior:'smooth'});toast(registered.completedAt?'Aula registrada como concluída.':'Aula registrada em Agendadas.');}
$('#editor').addEventListener('click',e=>{const month=e.target.closest('[data-month]');if(month){store.pastMonth=month.dataset.month;syncPastSelection();persist();render();return;}const record=e.target.closest('[data-past-plan]');if(record){store.pastId=record.dataset.pastPlan;persist();render();return;}const action=e.target.closest('[data-action]');if(action)handleAction(action.dataset.action,action.dataset.id);if(e.target.closest('#registerClass'))registerClass();});
$('#editor').addEventListener('input',e=>{if(store.view==='past')return;const t=e.target,p=draft();if(t.dataset.field!==undefined){p[t.dataset.field]=t.value;if(t.dataset.field==='className')$('#pageTitle').textContent=t.value||'Nova aula';if(t.dataset.field==='notes'){$('#editor .notes-print').textContent=t.value;resizeWritingArea(t);}if(t.dataset.field==='videoUrl')$('#videoActions').innerHTML=videoLink(t.value);persist(true);}else if(t.dataset.stepTitle){p.steps.find(s=>s.id===t.dataset.stepTitle).title=t.value;resizeStepTitle(t);persist(true);}else if(t.dataset.activity){p.steps.find(s=>s.id===t.dataset.activity).activity=t.value;t.nextElementSibling.textContent=t.value;resizeWritingArea(t);persist(true);}else if(t.dataset.subName){const [sid,pid]=t.dataset.subName.split(':');p.steps.find(s=>s.id===sid).subdivisions.find(x=>x.id===pid).name=t.value;persist(true);}else if(t.dataset.fightObservation){p.steps.find(s=>s.id===t.dataset.fightObservation).fight.observation=t.value;persist(true);}});
$('#editor').addEventListener('focusout',e=>{const t=e.target;if(!t.dataset.stepTitle||store.view==='past')return;const s=draft().steps.find(x=>x.id===t.dataset.stepTitle);const wasFight=!!s.fight,nowFight=isFightStage(s);if(wasFight===nowFight)return;if(nowFight){s.fight={rounds:3,roundMinutes:3,observation:''};s.minutes=fightUsed(s);delete s.subdivisions;}else delete s.fight;persist(true);render();});
$('#editor').addEventListener('change',e=>{if(store.view==='past')return;const t=e.target;if(t.dataset.field==='date'&&store.view==='scheduled'){reconcileSchedule();return;}if(t.dataset.stepTime)changeStepTime(t.dataset.stepTime,t.value);else if(t.dataset.subTime){const [sid,pid]=t.dataset.subTime.split(':');changeSubTime(sid,pid,t.value);}else if(t.dataset.fight){const [sid,key]=t.dataset.fight.split(':'),s=draft().steps.find(x=>x.id===sid),n=Number(t.value);if(!Number.isInteger(n)||n<1){toast('Use um número inteiro maior que zero.');render();return;}const before=s.minutes;s.fight[key]=n;s.minutes=fightUsed(s);draft().lastTimeEdit={id:s.id,title:s.title,from:before,to:s.minutes};persist(true);render();}});
$('#editor').addEventListener('change',async e=>{
  if(e.target.id!=='videoFileInput'||store.view==='past')return;
  const file=e.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('video/')){toast('Selecione um arquivo de vídeo.');e.target.value='';return;}
  if(cloudReady&&file.size>50*1024*1024){toast('Vídeos acima de 50 MB: use o campo de link.');e.target.value='';return;}
  const planId=draft().id,id=uid();toast('Salvando o vídeo no navegador...');
  try{
    await putVideo(id,file);
    if(cloudReady){try{await budoCloud.uploadVideo(id,file);}catch(error){await deleteVideo(id);throw error;}}
    const plan=[...store.drafts,...store.past].find(p=>p.id===planId);
    if(!plan){await deleteVideo(id);return;}
    const oldId=plan.videoFile?.id;
    plan.videoFile={id,name:file.name,type:file.type,size:file.size,path:cloudReady?id:null};
    persist(true);render();toast('Vídeo anexado à aula.');
    if(oldId&&!videoIsReferenced(oldId)){deleteVideo(oldId).catch(()=>{});if(cloudReady)budoCloud.deleteVideo(oldId).catch(()=>{});}
  }catch{toast('Não foi possível salvar o vídeo. Verifique o espaço disponível no navegador.');e.target.value='';}
});
$('#planList').addEventListener('click',e=>{const button=e.target.closest('[data-plan]');if(!button)return;if(store.view==='past')store.pastId=button.dataset.plan;else if(store.view==='scheduled')store.scheduledId=button.dataset.plan;else store.activeId=button.dataset.plan;persist();render();closeSidebar();});
$('#draftTab').onclick=()=>setView('draft');$('#scheduledTab').onclick=()=>setView('scheduled');$('#pastTab').onclick=()=>setView('past');
$('#newPlan').onclick=()=>{const p=template(true);store.drafts.push(p);store.activeId=p.id;store.view='draft';persist(true);render();closeSidebar();};
$('#duplicatePlan').onclick=()=>{const p=structuredClone(current());p.id=uid();p.recordedAt=null;p.scheduledAt=null;p.completedAt=null;p.className=`${p.className||'Aula'} (cópia)`;p.updatedAt=Date.now();store.drafts.push(p);store.activeId=p.id;store.view='draft';persist(true);render();toast('Cópia aberta para montagem.');};
$('#deletePlan').onclick=()=>{const isRegistered=store.view!=='draft',p=current();if(!p||!confirm(`Excluir ${isRegistered?'este registro':'este rascunho'}?`))return;const oldVideoId=p.videoFile?.id;if(isRegistered){store.past=store.past.filter(x=>x.id!==p.id);store.pastId=null;store.scheduledId=null;syncPastSelection();syncScheduledSelection();}else{store.drafts=store.drafts.filter(x=>x.id!==p.id);if(!store.drafts.length)store.drafts=[emptyDraft()];store.activeId=store.drafts[0].id;}persist();render();if(cloudReady)budoCloud.deleteLesson(p.id).catch(()=>toast('Exclusão salva neste aparelho; sincronização pendente.'));if(oldVideoId&&!videoIsReferenced(oldVideoId)){deleteVideo(oldVideoId).catch(()=>{});if(cloudReady)budoCloud.deleteVideo(oldVideoId).catch(()=>{});}toast(isRegistered?'Registro excluído.':'Rascunho excluído.');};
$('#printButton').onclick=()=>{if(!current())return;window.print();};
$('#exportBackup').onclick=async()=>{try{toast('Preparando backup com os vídeos...');const ids=[...new Set([...store.drafts,...store.past].map(p=>p.videoFile?.id).filter(Boolean))],videoFiles=[];for(const id of ids){let blob=await getVideo(id);if(!blob&&cloudReady)blob=await budoCloud.downloadVideo(id);if(!blob)throw Error('Vídeo indisponível');videoFiles.push({id,dataUrl:await fileAsDataUrl(blob)});}const blob=new Blob([JSON.stringify({format:'budo-plans',version:3,exportedAt:new Date().toISOString(),drafts:store.drafts,past:store.past,videoFiles})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`budo-aulas-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exportado com os vídeos.');}catch{toast('Não foi possível exportar o backup. Confira os vídeos anexados.');}};
$('#importBackup').onclick=()=>$('#backupFile').click();
$('#backupFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=='budo-plans')throw Error('Formato inválido');const drafts=Array.isArray(data.drafts)?data.drafts:Array.isArray(data.plans)?data.plans:null;if(!drafts||!Array.isArray(data.past||[])||!Array.isArray(data.videoFiles||[]))throw Error('Formato inválido');if(!confirm('Importar backup? Isso substituirá seus rascunhos e aulas passadas neste navegador.'))return;for(const item of data.videoFiles||[]){if(!item.id||typeof item.dataUrl!=='string'||!item.dataUrl.startsWith('data:video/'))throw Error('Vídeo inválido');const blob=await (await fetch(item.dataUrl)).blob();await putVideo(item.id,blob);if(cloudReady&&blob.size<=50*1024*1024)await budoCloud.uploadVideo(item.id,blob);}store={drafts:drafts.map(p=>normalizePlan(p,true)),past:(data.past||[]).map(p=>normalizePlan(p,false)),view:'draft',activeId:null,scheduledId:null,pastId:null,pastMonth:null};if(!store.drafts.length)store.drafts=[emptyDraft()];store.activeId=store.drafts[0].id;syncScheduledSelection();syncPastSelection();persist();render();if(cloudReady)for(const plan of [...store.drafts,...store.past])queueCloudSave(plan);toast('Backup importado com os vídeos.');}catch{toast('Não foi possível importar este backup.');}finally{e.target.value='';}};
function closeSidebar(){$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');}
$('#libraryToggle').onclick=()=>{$('#sidebar').classList.add('open');$('#scrim').classList.add('open');};$('#closeSidebar').onclick=closeSidebar;$('#scrim').onclick=closeSidebar;
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;button.textContent='Entrando...';$('#loginError').textContent='';
  try{await budoCloud.signIn($('#loginUsername').value,$('#loginPassword').value);cloudReady=true;$('#authGate').hidden=true;$('#loggedInUser').textContent=budoCloud.username();$('#loginPassword').value='';try{await syncCloud();}catch{toast('Sem conexão com as aulas compartilhadas. Seus dados locais foram mantidos.');}}
  catch{cloudReady=false;$('#authGate').hidden=false;$('#loginError').textContent='Usuário ou senha inválidos, ou acesso ainda não liberado.';}
  finally{button.disabled=false;button.textContent='Entrar';}
};
$('#logoutButton').onclick=async()=>{cloudReady=false;await budoCloud.signOut();$('#authGate').hidden=false;$('#loggedInUser').textContent='';$('#loginUsername').value='';$('#loginPassword').value='';};
function reconcileSchedule(){
  const due=store.past.filter(p=>p.scheduledAt&&!p.completedAt&&isDue(p));
  if(!due.length)return;
  due.forEach(p=>{p.completedAt=Date.now();p.updatedAt=Date.now();queueCloudSave(p);});
  if(store.view==='scheduled'&&due.some(p=>p.id===store.scheduledId)){store.view='past';store.pastId=store.scheduledId;store.pastMonth=monthKey(due.find(p=>p.id===store.scheduledId));}
  syncScheduledSelection();syncPastSelection();
  localStorage.setItem(KEY,JSON.stringify(store));render();
}
reconcileSchedule();render();localStorage.setItem(KEY,JSON.stringify(store));
setInterval(reconcileSchedule,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcileSchedule();});
connectCloud();
setInterval(()=>{if(cloudReady&&!document.activeElement?.closest('#editor'))syncCloud().catch(()=>{});},30000);
