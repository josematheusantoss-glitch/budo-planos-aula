import { buildPushPayload } from 'npm:@block65/webcrypto-web-push@2.0.0';

const base = Deno.env.get('SUPABASE_URL') || '';
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
async function get(path: string) {
  const response = await fetch(`${base}/rest/v1/${path}`, { headers });
  if (!response.ok) throw Error(`Database read ${response.status}`);
  return response.json();
}
async function post(path: string, body: unknown, prefer = 'return=minimal') {
  const response = await fetch(`${base}/rest/v1/${path}`, { method: 'POST', headers: { ...headers, Prefer: prefer }, body: JSON.stringify(body) });
  if (!response.ok) throw Error(`Database write ${response.status}`);
  return response;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST' || !base || !secret) return new Response('Not found', { status: 404 });
    const configResponse = await post('rpc/budo_push_config', {}, 'return=representation');
    const config = (await configResponse.json())[0];
    if (!config?.cron_token || request.headers.get('x-budo-cron') !== config.cron_token) return new Response('Unauthorized', { status: 401 });
    if (!config.vapid_private) throw Error('Missing VAPID configuration');
    const [lessons, subscriptions, alerts] = await Promise.all([
      get('lessons?select=id,plan'),
      get('push_subscriptions?select=id,user_id,subscription'),
      get('push_alerts?select=lesson_id,stage_index,level'),
    ]);
    let sent = 0;
    const now = Date.now();
    for (const lesson of lessons) {
      const plan = lesson.plan;
      const run = plan?.liveRun;
      if (run?.status !== 'running' || !run.startedBy || !Array.isArray(plan.steps)) continue;
      const index = Number(run.stageIndex);
      const stage = plan.steps[index];
      if (!stage) continue;
      const target = Number(stage.minutes) * 60000;
      const elapsed = Math.max(0, Number(run.stageElapsedMs) || 0) + Math.max(0, now - Number(run.segmentStartedAt));
      const ratio = target > 0 ? elapsed / target : 1;
      const level = ratio >= 1 ? 3 : ratio >= 0.9 ? 2 : ratio >= 0.8 ? 1 : 0;
      const previous = alerts.find((row: { lesson_id: string; stage_index: number; level: number }) => row.lesson_id === lesson.id && row.stage_index === index);
      if (!level || level <= (previous?.level || 0)) continue;
      const name = String(stage.title || 'Etapa');
      const body = level === 3 ? `Tempo de ${name} encerrado. Toque em Próxima etapa.` : level === 2 ? `${name}: quase no fim. Prepare a troca.` : `${name}: prepare a troca de etapa.`;
      let delivered = false;
      for (const item of subscriptions.filter((row: { user_id: string }) => row.user_id === run.startedBy)) {
        try {
          const endpoint = new URL(item.subscription.endpoint);
          const trusted = endpoint.protocol === 'https:' && [
            'fcm.googleapis.com', 'fcmregistrations.googleapis.com', 'updates.push.services.mozilla.com',
            'web.push.apple.com', 'wns2-par02p.notify.windows.com',
          ].includes(endpoint.hostname);
          if (!trusted) continue;
          const payload = await buildPushPayload({ data: JSON.stringify({ title: 'Aula Budô', body, tag: `budo-${lesson.id}-${index}-${level}`, url: '/' }), options: { ttl: 120 } }, item.subscription, {
            subject: 'https://budo-planos-aula.vercel.app',
            publicKey: "BPEq7MFvlVwMqplRYDpeGVZsmU2jx_ofrKhrIa4wFgsMdpiySd73ZVnQIf8nd6gppjAIANjSm6txaBnsf7SLDzs",
            privateKey: config.vapid_private,
          });
          const response = await fetch(item.subscription.endpoint, payload);
          if (response.ok) { delivered = true; sent++; }
          else if (response.status === 404 || response.status === 410) {
            await fetch(`${base}/rest/v1/push_subscriptions?id=eq.${item.id}`, { method: 'DELETE', headers });
          }
        } catch (error) { console.error('Push delivery failed', error); }
      }
      if (delivered) await post('push_alerts?on_conflict=lesson_id,stage_index', { lesson_id: lesson.id, stage_index: index, level, sent_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
    }
    return Response.json({ sent });
  } catch (error) {
    console.error('Push worker failed', error);
    return new Response('Internal error', { status: 500 });
  }
});
