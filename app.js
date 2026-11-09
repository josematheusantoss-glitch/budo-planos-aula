const KEY = 'budo-lesson-plans-v2';
const OLD_KEY = 'budo-lesson-plans-v1';
const TARGET = 60;
const $ = selector => document.querySelector(selector);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const localDate = () => new Date().toLocaleDateString('en-CA');
const localTime = () => new Date().toTimeString().slice(0,5);
const stage = (title, minutes, activity = '', extra = {}) => ({id:uid(), title, minutes, activity, ...extra});
const exampleWarmup = ['Corrida — 2 voltas','Deslocamentos laterais','Lateral dentro/fora','Joelhos altos','Calcanhares','Desacelerar','100 polichinelos','300 abdominais variados','Prancha — 1 minuto','Fuga de quadril 1 — uma ida','Fuga de quadril 2 — uma ida'].join('\n');

function template(blank = false) {
  return {
    id:uid(), className:blank?'':'Faixas brancas · Meia guarda', instructor:'', date:localDate(), startTime:localTime(),
    group:blank?'':'Faixas brancas', theme:blank?'':'Raspagem de meia guarda com escudo de joelho', notes:'', updatedAt:Date.now(),
    steps:[
      stage('Aquecimento geral',10,exampleWarmup), stage('Água',2), stage('Aquecimento técnico',10),
      stage('Técnica principal',23,'',{subdivisions:[{id:uid(),name:'Demonstração',minutes:5},{id:uid(),name:'Repetições',minutes:13},{id:uid(),name:'Resistência leve',minutes:5}]}),
      stage('Água',2), stage('Lutas',13,'',{fight:{rounds:3,roundMinutes:3,intervalMinutes:1,organization:'Duplas por peso e experiência'}})
    ]
  };
}
function normalizePlan(plan) {
  return {
    id:plan.id||uid(), className:plan.className||plan.theme||'', instructor:plan.instructor||'', date:plan.date||localDate(),
    startTime:plan.startTime||'', group:plan.group||'', theme:plan.theme||'', notes:plan.notes||'',
    updatedAt:plan.updatedAt||Date.now(), recordedAt:plan.recordedAt||null, lastTimeEdit:plan.lastTimeEdit||null,
    steps:(plan.steps||[]).map(s=>({id:s.id||uid(),title:s.title||'',minutes:Math.max(0,Math.floor(Number(s.minutes)||0)),
      activity:typeof s.activity==='string'?s.activity:(s.items||[]).map(x=>x.text).filter(Boolean).join('\n'),
      ...(Array.isArray(s.subdivisions)?{subdivisions:s.subdivisions.map(x=>({id:x.id||uid(),name:x.name||'',minutes:Math.max(0,Math.floor(Number(x.minutes)||0))}))}:{}),
      ...(s.fight?{fight:{rounds:Number(s.fight.rounds)||1,roundMinutes:Number(s.fight.roundMinutes)||1,intervalMinutes:Number(s.fight.intervalMinutes)||0,organization:s.fight.organization||''}}:{})
    }))
  };
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
function months() {return [...new Set(store.past.map(monthKey))].sort((a,b)=>a==='sem-data'?1:b==='sem-data'?-1:a.localeCompare(b));}
function monthRecords(key) {return store.past.filter(p=>monthKey(p)===key).sort((a,b)=>`${b.date||''}T${b.startTime||''}`.localeCompare(`${a.date||''}T${a.startTime||''}`));}
function syncPastSelection() {
  const available=months();
  if(!available.length){store.pastMonth=null;store.pastId=null;return;}
  if(!available.includes(store.pastMonth))store.pastMonth=store.past.find(p=>p.id===store.pastId)?monthKey(store.past.find(p=>p.id===store.pastId)):available[available.length-1];
  const inMonth=monthRecords(store.pastMonth);
  if(!inMonth.some(p=>p.id===store.pastId))store.pastId=inMonth[0]?.id||null;
}
function readStore() {
  try {
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved && Array.isArray(saved.drafts) && Array.isArray(saved.past)) {
      saved.drafts=saved.drafts.map(normalizePlan); saved.past=saved.past.map(normalizePlan);
      if(!saved.drafts.length) saved.drafts=[template(true)];
      saved.view=saved.view==='past'?'past':'draft';
      saved.activeId=saved.drafts.some(p=>p.id===saved.activeId)?saved.activeId:saved.drafts[0].id;
      saved.pastId=saved.past.some(p=>p.id===saved.pastId)?saved.pastId:(saved.past[0]?.id||null);
      return saved;
    }
  } catch {}
  try {
    const old=JSON.parse(localStorage.getItem(OLD_KEY));
    if(Array.isArray(old?.plans) && old.plans.length) {
      const drafts=old.plans.map(normalizePlan);
      return {drafts,past:[],activeId:drafts.some(p=>p.id===old.activeId)?old.activeId:drafts[0].id,pastId:null,pastMonth:null,view:'draft'};
    }
  } catch {}
  const first=template();
  return {drafts:[first],past:[],activeId:first.id,pastId:null,pastMonth:null,view:'draft'};
}
let store=readStore();
syncPastSelection();
let toastTimer;
const draft=()=>store.drafts.find(p=>p.id===store.activeId)||store.drafts[0];
const past=()=>monthRecords(store.pastMonth).find(p=>p.id===store.pastId)||monthRecords(store.pastMonth)[0];
const current=()=>store.view==='past'?past():draft();
const sum=p=>p.steps.reduce((n,s)=>n+s.minutes,0);
const fightUsed=s=>s.fight?s.fight.rounds*s.fight.roundMinutes+Math.max(0,s.fight.rounds-1)*s.fight.intervalMinutes:0;
function overflowStages(plan) {
  let elapsed=0;
  return plan.steps.flatMap(s=>{const over=Math.max(0,elapsed+s.minutes-Math.max(elapsed,TARGET));elapsed+=s.minutes;return over?[{id:s.id,title:s.title||'Etapa sem título',minutes:over}]:[];});
}
function persist() {
  if(store.view==='draft') draft().updatedAt=Date.now();
  localStorage.setItem(KEY,JSON.stringify(store));
  $('#saveStatus').textContent=store.view==='draft'?'✓ Rascunho salvo':(past()?'✓ Aula registrada':'');
  renderList();
  renderDock();
}
function toast(message) {
  const node=$('#toast');node.textContent=message;node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4300);
}
function setView(view) {store.view=view;if(view==='past')syncPastSelection();persist();render();closeSidebar();}
function renderList() {
  $('#draftTab').classList.toggle('active',store.view==='draft');
  $('#pastTab').classList.toggle('active',store.view==='past');
  $('#draftTab').setAttribute('aria-selected',String(store.view==='draft'));
  $('#pastTab').setAttribute('aria-selected',String(store.view==='past'));
  $('#pastCount').textContent=store.past.length;
  const list=store.view==='past'?monthRecords(store.pastMonth):store.drafts;
  const activeId=store.view==='past'?store.pastId:store.activeId;
  const ordered=store.view==='past'?list:list.slice().sort((a,b)=>(b.recordedAt||b.updatedAt)-(a.recordedAt||a.updatedAt));
  $('#planList').innerHTML=ordered.length?ordered.map(p=>
    store.view==='past'
      ?`<button type="button" class="plan-link ${p.id===activeId?'active':''}" data-plan="${p.id}"><strong>${escapeHtml(p.instructor||'Sem instrutor')}</strong><small>${escapeHtml(formatDate(p.date))} · ${escapeHtml(p.theme||'Sem tema')}</small></button>`
      :`<button type="button" class="plan-link ${p.id===activeId?'active':''}" data-plan="${p.id}"><strong>${escapeHtml(p.className||p.theme||'Aula sem nome')}</strong><small>${escapeHtml(formatDate(p.date)||'Sem data')} · ${escapeHtml(p.startTime||'Sem horário')} · ${escapeHtml(p.instructor||'Sem instrutor')}</small></button>`).join('')
    :`<p class="empty-list">${store.view==='past'&&store.past.length?'Nenhuma aula neste mês.':'Nenhuma aula registrada ainda.'}</p>`;
}
function renderDock() {
  const dock=$('#timeDock');
  if(store.view==='past'){dock.hidden=true;return;}
  dock.hidden=false;
  const plan=draft(),total=sum(plan),remaining=TARGET-total,over=overflowStages(plan);
  const width=Math.min(100,Math.max(0,total/TARGET*100));
  const last=plan.lastTimeEdit;
  dock.innerHTML=`<div class="dock-top"><strong>${remaining>0?`${remaining} min disponíveis`:remaining===0?'60 min fechados':`${-remaining} min acima`}</strong><span>${total} / ${TARGET} min</span></div><div class="dock-track"><div class="dock-fill ${remaining<0?'over':''}" style="width:${width}%"></div></div><small>${remaining<0?(last&&last.to>last.from?`Último aumento: ${escapeHtml(last.title)} (+${last.to-last.from} min)`:`Excesso a partir de: ${escapeHtml(over[0]?.title||'etapa')}`):remaining===0?'Pronto para registrar':'Distribua o tempo restante entre as etapas'}</small>`;
}
function render() {
  renderList();renderDock();
  const isPast=store.view==='past',plan=current();
  $('#newPlan').textContent='＋ Nova aula';
  $('#pageEyebrow').textContent=isPast?'AULAS PASSADAS':'MONTAR AULA';
  $('#pageTitle').textContent=isPast?'Aulas passadas':(plan?.className||'Nova aula');
  $('#pageSubtitle').textContent=isPast?'Registro completo das aulas realizadas.':'Preencha as etapas e registre a aula ao final.';
  $('#duplicatePlan').textContent=isPast?'Usar como modelo':'Duplicar';
  $('#duplicatePlan').hidden=isPast&&!plan;
  $('#deletePlan').hidden=!plan;
  $('#saveStatus').textContent=isPast?(plan?'✓ Aula registrada':''):'✓ Rascunho salvo';
  $('#printButton').hidden=!plan;
  $('#editor').innerHTML=isPast?renderPast(plan):renderDraft(plan);
}
function renderDraft(plan) {
  const total=sum(plan),remaining=TARGET-total,over=overflowStages(plan);
  const last=plan.lastTimeEdit;
  const lastChange=last&&last.to>last.from?`Último aumento: <strong>${escapeHtml(last.title)} (+${last.to-last.from} min)</strong>. `:'';
  const overText=over.length?`<p class="overrun-list">${lastChange}A soma ultrapassa 60 min a partir de ${over.map(s=>`<strong>${escapeHtml(s.title)} (+${s.minutes} min)</strong>`).join(', ')}. Reajuste os tempos antes de registrar.</p>`:'';
  const issues=[];
  for(const s of plan.steps){if(s.subdivisions?.length&&s.subdivisions.reduce((n,x)=>n+x.minutes,0)!==s.minutes)issues.push(`Subdivisões de ${s.title} não somam ${s.minutes} min.`);if(s.fight&&fightUsed(s)>s.minutes)issues.push(`Rounds de ${s.title} excedem o tempo da etapa.`);}
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
    <div class="section-title"><h2>02 / ETAPAS DA AULA</h2><span class="field-label">${plan.steps.length} etapas · meta ${TARGET} min</span></div>
    <div class="stages">${plan.steps.map((s,i)=>renderStep(s,i,plan.steps.length,over)).join('')}</div>
    <button type="button" class="add-stage no-print" data-action="add-step">＋ Adicionar etapa</button>
    <div class="notes-section"><div class="section-title"><h2>03 / OBSERVAÇÕES</h2></div><div class="field"><label for="notes">Observações da aula</label><textarea id="notes" data-field="notes" placeholder="Objetivos, adaptações, materiais ou registro da aula">${escapeHtml(plan.notes)}</textarea><div class="notes-print print-only">${escapeHtml(plan.notes)}</div></div></div>
    <div class="final-review"><div class="section-title"><h2>04 / CONFERÊNCIA FINAL</h2></div><div class="final-total ${remaining===0?'ready':'needs-adjustment'}"><span>Tempo das etapas</span><strong>${total} / ${TARGET} min</strong><em>${remaining>0?`Faltam ${remaining} min`:remaining<0?`Passou ${-remaining} min`:'Tempo correto'}</em></div>${overText}${issues.map(x=>`<p class="validation-issue">${escapeHtml(x)}</p>`).join('')}<p class="final-hint">O registro final exige exatamente 60 minutos. O rascunho fica salvo neste navegador durante a montagem.</p><button id="registerClass" class="button primary register-button no-print" type="button">✓ Salvar e registrar aula</button></div>
  </div></article>`;
}
function field(key,label,value,placeholder='',extraClass='',type='text') {return `<div class="field ${extraClass}"><label for="${key}">${label}</label><input id="${key}" type="${type}" data-field="${key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;}
function renderStep(s,i,count,over) {
  const subdiv=s.subdivisions?.length?`<div class="subdivisions"><h4>Divisão da etapa · ${s.subdivisions.reduce((n,x)=>n+x.minutes,0)} / ${s.minutes} min</h4>${s.subdivisions.map(x=>`<div class="sub-row"><input class="sub-name" aria-label="Nome da subdivisão" data-sub-name="${s.id}:${x.id}" value="${escapeHtml(x.name)}"><input type="number" min="0" step="1" aria-label="Minutos da subdivisão" data-sub-time="${s.id}:${x.id}" value="${x.minutes}"><span>min</span><button class="small-button no-print" type="button" data-action="remove-sub" data-id="${s.id}:${x.id}" aria-label="Remover subdivisão">×</button></div>`).join('')}<button class="small-button no-print" type="button" data-action="add-sub" data-id="${s.id}">＋ Subdivisão</button></div>`:'';
  const f=s.fight,used=f?fightUsed(s):0;
  const fight=f?`<div class="fight-grid"><h4>Configuração das lutas</h4><div class="fight-fields"><label>Rounds<input class="fight-input" type="number" min="1" step="1" data-fight="${s.id}:rounds" value="${f.rounds}"></label><label>Por round (min)<input class="fight-input" type="number" min="1" step="1" data-fight="${s.id}:roundMinutes" value="${f.roundMinutes}"></label><label>Intervalo (min)<input class="fight-input" type="number" min="0" step="1" data-fight="${s.id}:intervalMinutes" value="${f.intervalMinutes}"></label><label>Organização (min)<input class="fight-input" value="${Math.max(0,s.minutes-used)}" readonly></label></div><div class="field fight-org"><label>Organização das duplas</label><input data-fight-org="${s.id}" value="${escapeHtml(f.organization)}" placeholder="Ex.: duplas por peso"></div><p class="fight-note ${used>s.minutes?'bad':''}">${f.rounds} rounds × ${f.roundMinutes} min + ${Math.max(0,f.rounds-1)} intervalos × ${f.intervalMinutes} min = ${used} min. ${used>s.minutes?'Aumente o tempo da etapa.':`${s.minutes-used} min para organização.`}</p></div>`:'';
  return `<section class="step-card ${over.some(x=>x.id===s.id)?'step-over':''}" data-step="${s.id}"><div class="step-head"><span class="step-number">${String(i+1).padStart(2,'0')}</span><input class="step-title-input" aria-label="Título da etapa ${i+1}" data-step-title="${s.id}" value="${escapeHtml(s.title)}"><label class="step-time"><input type="number" min="0" step="1" aria-label="Tempo da etapa ${i+1}" data-step-time="${s.id}" value="${s.minutes}"> min</label><div class="step-controls no-print"><button class="icon-button" type="button" data-action="up-step" data-id="${s.id}" aria-label="Subir etapa" ${i===0?'disabled':''}>↑</button><button class="icon-button" type="button" data-action="down-step" data-id="${s.id}" aria-label="Descer etapa" ${i===count-1?'disabled':''}>↓</button><button class="icon-button" type="button" data-action="remove-step" data-id="${s.id}" aria-label="Remover etapa">×</button></div></div><div class="step-body"><div class="field"><label for="activity-${s.id}">Atividades / conteúdo da etapa</label><textarea class="activity-text" id="activity-${s.id}" data-activity="${s.id}" placeholder="Escreva livremente o que será feito nesta etapa">${escapeHtml(s.activity)}</textarea><div class="activity-print print-only">${escapeHtml(s.activity)}</div></div>${subdiv}${fight}<div class="stage-extras no-print">${!s.subdivisions?.length?`<button class="small-button" type="button" data-action="add-sub" data-id="${s.id}">＋ Dividir tempo</button>`:''}${!s.fight?`<button class="small-button" type="button" data-action="add-fight" data-id="${s.id}">＋ Configurar lutas</button>`:''}</div></div></section>`;
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
  return `${renderMonthNavigation()}${renderMonthCards()}<article class="sheet past-sheet"><div class="sheet-header"><img class="sheet-logo" src="logobudo.jpeg" alt="Logo Budô"><div class="sheet-kicker">JIU-JÍTSU · REGISTRO<strong>AULA REALIZADA</strong></div></div><div class="sheet-body"><div class="section-title"><h2>IDENTIFICAÇÃO</h2></div><div class="record-grid">${record('Nome da aula',plan.className)}${record('Instrutor / monitor',plan.instructor)}${record('Data',formatDate(plan.date))}${record('Horário',plan.startTime)}${record('Turma',plan.group)}${record('Tema',plan.theme)}</div><div class="section-title"><h2>ETAPAS · ${sum(plan)} MIN</h2></div><div class="stages">${plan.steps.map((s,i)=>`<section class="step-card"><div class="step-head"><span class="step-number">${String(i+1).padStart(2,'0')}</span><strong class="record-step-title">${escapeHtml(s.title)}</strong><strong>${s.minutes} min</strong></div><div class="step-body">${s.activity?`<div class="record-activity">${escapeHtml(s.activity)}</div>`:''}${s.subdivisions?.length?`<div class="record-sub">${s.subdivisions.map(x=>`${escapeHtml(x.name)}: ${x.minutes} min`).join(' · ')}</div>`:''}${s.fight?`<div class="record-sub">${s.fight.rounds} rounds de ${s.fight.roundMinutes} min · intervalo ${s.fight.intervalMinutes} min · ${escapeHtml(s.fight.organization)}</div>`:''}</div></section>`).join('')}</div><div class="notes-section"><div class="section-title"><h2>OBSERVAÇÕES</h2></div><div class="record-activity">${escapeHtml(plan.notes||'—')}</div></div><p class="recorded-at">Registrada em ${escapeHtml(new Date(plan.recordedAt||plan.updatedAt).toLocaleString('pt-BR'))}</p></div></article>`;
}
function record(label,value){return `<div class="record-field"><small>${label}</small><strong>${escapeHtml(value||'—')}</strong></div>`;}
function formatDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value||'';const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}
function adjustParts(parts,diff) {if(!diff)return true;if(diff>0){parts[parts.length-1].minutes+=diff;return true;}let left=-diff;for(const part of [...parts].reverse()){const take=Math.min(part.minutes,left);part.minutes-=take;left-=take;if(!left)break;}return left===0;}
function rebalanceSubdivisions(s){if(!s.subdivisions?.length)return;adjustParts(s.subdivisions,s.minutes-s.subdivisions.reduce((n,x)=>n+x.minutes,0));}
function changeStepTime(id,value){const n=Number(value);if(!Number.isInteger(n)||n<0){toast('Informe um tempo inteiro de 0 minuto ou mais.');render();return;}const p=draft(),s=p.steps.find(x=>x.id===id);p.lastTimeEdit={id,title:s.title,from:s.minutes,to:n};s.minutes=n;rebalanceSubdivisions(s);persist();render();}
function changeSubTime(sid,pid,value){const n=Number(value),s=draft().steps.find(x=>x.id===sid);if(!Number.isInteger(n)||n<0||n>s.minutes){toast('A subdivisão deve caber no tempo da etapa.');render();return;}const part=s.subdivisions.find(x=>x.id===pid),others=s.subdivisions.filter(x=>x.id!==pid).map(x=>({...x}));if(!others.length&&n!==s.minutes){toast('A única subdivisão deve ter o tempo completo da etapa.');render();return;}if(others.length&&!adjustParts(others,part.minutes-n)){toast('As demais subdivisões não têm tempo suficiente.');render();return;}part.minutes=n;others.forEach(x=>s.subdivisions.find(y=>y.id===x.id).minutes=x.minutes);persist();render();}
function move(arr,index,direction){const next=index+direction;if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];persist();render();}
function handleAction(action,id){if(action==='show-drafts'){setView('draft');return;}const p=draft();let s=p.steps.find(x=>x.id===id);
  if(action==='add-step')p.steps.push(stage('Nova etapa',0));
  else if(action==='remove-step'){if(p.steps.length===1){toast('Mantenha pelo menos uma etapa.');return;}if(!confirm('Remover esta etapa?'))return;p.steps=p.steps.filter(x=>x.id!==id);}
  else if(action==='up-step'||action==='down-step'){move(p.steps,p.steps.findIndex(x=>x.id===id),action==='up-step'?-1:1);return;}
  else if(action==='add-sub'){if(!s.subdivisions)s.subdivisions=[{id:uid(),name:'Parte 1',minutes:s.minutes}];else s.subdivisions.push({id:uid(),name:'Nova subdivisão',minutes:0});}
  else if(action==='remove-sub'){const [sid,pid]=id.split(':');s=p.steps.find(x=>x.id===sid);s.subdivisions=s.subdivisions.filter(x=>x.id!==pid);if(s.subdivisions.length)rebalanceSubdivisions(s);else delete s.subdivisions;}
  else if(action==='add-fight')s.fight={rounds:1,roundMinutes:1,intervalMinutes:0,organization:''};
  persist();render();
}
function registerClass(){const p=draft();const required=[['className','nome da aula'],['instructor','instrutor/monitor'],['date','data'],['startTime','horário'],['group','turma'],['theme','tema']];const missing=required.find(([key])=>!String(p[key]||'').trim());if(missing){toast(`Preencha ${missing[1]} antes de registrar.`);$(`#${missing[0]}`)?.focus();return;}if(sum(p)!==TARGET){const over=overflowStages(p);toast(sum(p)>TARGET?`Excedeu ${sum(p)-TARGET} min. Confira ${over[0]?.title||'as etapas'}.`:`Faltam ${TARGET-sum(p)} min para completar a aula.`);$('#registerClass').scrollIntoView({behavior:'smooth',block:'center'});return;}const invalid=p.steps.find(s=>s.subdivisions?.length&&s.subdivisions.reduce((n,x)=>n+x.minutes,0)!==s.minutes || s.fight&&fightUsed(s)>s.minutes);if(invalid){toast(`Revise o tempo interno de ${invalid.title}.`);return;}const completed=structuredClone(p);completed.recordedAt=Date.now();store.past.unshift(completed);store.pastId=completed.id;store.pastMonth=monthKey(completed);store.drafts=store.drafts.filter(x=>x.id!==p.id);if(!store.drafts.length)store.drafts=[template(true)];store.activeId=store.drafts[0].id;store.view='past';persist();render();window.scrollTo({top:0,behavior:'smooth'});toast('Aula registrada em Aulas passadas.');}
$('#editor').addEventListener('click',e=>{const month=e.target.closest('[data-month]');if(month){store.pastMonth=month.dataset.month;syncPastSelection();persist();render();return;}const record=e.target.closest('[data-past-plan]');if(record){store.pastId=record.dataset.pastPlan;persist();render();return;}const action=e.target.closest('[data-action]');if(action)handleAction(action.dataset.action,action.dataset.id);if(e.target.closest('#registerClass'))registerClass();});
$('#editor').addEventListener('input',e=>{if(store.view!=='draft')return;const t=e.target,p=draft();if(t.dataset.field!==undefined){p[t.dataset.field]=t.value;if(t.dataset.field==='className')$('#pageTitle').textContent=t.value||'Nova aula';if(t.dataset.field==='notes')$('#editor .notes-print').textContent=t.value;persist();}else if(t.dataset.stepTitle){p.steps.find(s=>s.id===t.dataset.stepTitle).title=t.value;persist();}else if(t.dataset.activity){p.steps.find(s=>s.id===t.dataset.activity).activity=t.value;t.nextElementSibling.textContent=t.value;persist();}else if(t.dataset.subName){const [sid,pid]=t.dataset.subName.split(':');p.steps.find(s=>s.id===sid).subdivisions.find(x=>x.id===pid).name=t.value;persist();}else if(t.dataset.fightOrg){p.steps.find(s=>s.id===t.dataset.fightOrg).fight.organization=t.value;persist();}});
$('#editor').addEventListener('change',e=>{if(store.view!=='draft')return;const t=e.target;if(t.dataset.stepTime)changeStepTime(t.dataset.stepTime,t.value);else if(t.dataset.subTime){const [sid,pid]=t.dataset.subTime.split(':');changeSubTime(sid,pid,t.value);}else if(t.dataset.fight){const [sid,key]=t.dataset.fight.split(':'),s=draft().steps.find(x=>x.id===sid),n=Number(t.value);if(!Number.isInteger(n)||n<(key==='intervalMinutes'?0:1)){toast('Use um número inteiro válido.');render();return;}s.fight[key]=n;persist();render();}});
$('#planList').addEventListener('click',e=>{const button=e.target.closest('[data-plan]');if(!button)return;if(store.view==='past')store.pastId=button.dataset.plan;else store.activeId=button.dataset.plan;persist();render();closeSidebar();});
$('#draftTab').onclick=()=>setView('draft');$('#pastTab').onclick=()=>setView('past');
$('#newPlan').onclick=()=>{const p=template(true);store.drafts.push(p);store.activeId=p.id;store.view='draft';persist();render();closeSidebar();};
$('#duplicatePlan').onclick=()=>{const p=structuredClone(current());p.id=uid();p.recordedAt=null;p.className=`${p.className||'Aula'} (cópia)`;p.updatedAt=Date.now();store.drafts.push(p);store.activeId=p.id;store.view='draft';persist();render();toast('Cópia aberta para montagem.');};
$('#deletePlan').onclick=()=>{const isPast=store.view==='past',p=current();if(!p||!confirm(`Excluir ${isPast?'este registro':'este rascunho'}?`))return;if(isPast){store.past=store.past.filter(x=>x.id!==p.id);store.pastId=null;syncPastSelection();}else{store.drafts=store.drafts.filter(x=>x.id!==p.id);if(!store.drafts.length)store.drafts=[template(true)];store.activeId=store.drafts[0].id;}persist();render();toast(isPast?'Registro excluído.':'Rascunho excluído.');};
$('#printButton').onclick=()=>{if(!current())return;window.print();};
$('#exportBackup').onclick=()=>{const blob=new Blob([JSON.stringify({format:'budo-plans',version:2,exportedAt:new Date().toISOString(),drafts:store.drafts,past:store.past},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`budo-aulas-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exportado.');};
$('#importBackup').onclick=()=>$('#backupFile').click();
$('#backupFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=='budo-plans')throw Error('Formato inválido');const drafts=Array.isArray(data.drafts)?data.drafts:Array.isArray(data.plans)?data.plans:null;if(!drafts||!Array.isArray(data.past||[]))throw Error('Formato inválido');if(!confirm('Importar backup? Isso substituirá seus rascunhos e aulas passadas neste navegador.'))return;store={drafts:drafts.map(normalizePlan),past:(data.past||[]).map(normalizePlan),view:'draft',activeId:null,pastId:null,pastMonth:null};if(!store.drafts.length)store.drafts=[template(true)];store.activeId=store.drafts[0].id;syncPastSelection();persist();render();toast('Backup importado.');}catch{toast('Não foi possível importar este backup.');}finally{e.target.value='';}};
function closeSidebar(){$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');}
$('#libraryToggle').onclick=()=>{$('#sidebar').classList.add('open');$('#scrim').classList.add('open');};$('#closeSidebar').onclick=closeSidebar;$('#scrim').onclick=closeSidebar;
render();localStorage.setItem(KEY,JSON.stringify(store));
