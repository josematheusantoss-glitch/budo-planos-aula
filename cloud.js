/* A chave publicável identifica o site; o acesso aos dados depende do login e das políticas RLS. */
const budoCloud = (() => {
  const base = 'https://jzqoyddbebrydckzvjuu.supabase.co';
  const key = 'sb_publishable_hD-4KXJWQLEx_3oUMwhvFA_oxAPyjMG';
  const sessionKey = 'budo-cloud-session-v1';
  let session;
  try { session = JSON.parse(localStorage.getItem(sessionKey)); } catch { session = null; }
  let refreshing;
  const saveSession = value => { session = value; if (value) localStorage.setItem(sessionKey, JSON.stringify(value)); else localStorage.removeItem(sessionKey); };
  const identity = () => session?.user?.id || null;
  const username = () => session?.user?.email?.split('@')[0] || '';
  async function authRequest(path, body) {
    const response = await fetch(base + '/auth/v1/' + path, {method:'POST', headers:{apikey:key,'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const data = await response.json();
    if (!response.ok) throw Error(data.msg || data.message || data.error_description || 'Falha no acesso');
    return data;
  }
  async function refresh() {
    if (!session?.refresh_token) throw Error('Sessão expirada');
    if (!refreshing) refreshing = authRequest('token?grant_type=refresh_token', {refresh_token:session.refresh_token}).then(data => {saveSession({...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in});return session;}).finally(() => {refreshing=null;});
    return refreshing;
  }
  async function token() {
    if (!session?.access_token) throw Error('Entre na sua conta');
    if (session.expires_at && session.expires_at < Date.now()/1000+60) await refresh();
    return session.access_token;
  }
  async function request(path, options={}, retry=true) {
    const access=await token();
    const response=await fetch(base+path,{...options,headers:{apikey:key,Authorization:'Bearer '+access,...options.headers}});
    if (response.status===401 && retry) {await refresh();return request(path,options,false);}
    if (!response.ok) {const body=await response.text();throw Error(body||`Erro ${response.status}`);}
    if (response.status===204 || response.headers.get('content-length')==='0') return null;
    return response.headers.get('content-type')?.includes('application/json') ? response.json() : response.blob();
  }
  async function signIn(name,password) {
    const clean=String(name||'').trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(clean)) throw Error('Informe um usuário válido');
    const data=await authRequest('token?grant_type=password',{email:`${clean}@budo-planos.internal`,password});
    saveSession({...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in});
    try {await assertInstructor();} catch(error) {saveSession(null);throw error;}
    return clean;
  }
  async function assertInstructor() {
    const rows=await request(`/rest/v1/instructors?select=username&user_id=eq.${encodeURIComponent(identity())}`);
    if (!rows?.length || !rows[0].username) throw Error('Usuário sem acesso às aulas');
    return rows[0].username;
  }
  async function restore() {if (!session?.refresh_token)return false;try {await assertInstructor();return true;}catch{saveSession(null);return false;}}
  async function signOut() {try {await request('/auth/v1/logout',{method:'POST'});}catch{}saveSession(null);}
  async function listLessons() {return request('/rest/v1/lessons?select=id,plan,updated_at&order=updated_at.desc');}
  async function saveLesson(plan) {return request('/rest/v1/lessons?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:plan.id,plan,updated_at:new Date(plan.updatedAt||Date.now()).toISOString(),updated_by:identity()})});}
  async function deleteLesson(id) {return request(`/rest/v1/lessons?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});}
  async function uploadVideo(id,file) {return request(`/storage/v1/object/lesson-videos/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file});}
  async function downloadVideo(id) {return request(`/storage/v1/object/authenticated/lesson-videos/${encodeURIComponent(id)}`);}
  async function deleteVideo(id) {return request('/storage/v1/object/lesson-videos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[id]})});}
  return {identity,username,restore,signIn,signOut,listLessons,saveLesson,deleteLesson,uploadVideo,downloadVideo,deleteVideo};
})();
