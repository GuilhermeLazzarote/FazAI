import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key (não a anon!)
const KIRVANO_TOKEN = process.env.KIRVANO_TOKEN;

// Mapeamento Product ID Kirvano → plano interno
const PRODUCT_PLAN_MAP = {
  'c8343685-8080-4783-8ae3-473a9215ba58': 'starter',
  '921de17f-e968-48e6-975f-644b3e283e4e': 'pro',
  '91341bf2-4f37-45ef-8ea2-eb4abda2ac49': 'office',
  // Fallback via env (opcional)
  ...(process.env.KIRVANO_PRODUCT_STARTER ? {[process.env.KIRVANO_PRODUCT_STARTER]:'starter'} : {}),
  ...(process.env.KIRVANO_PRODUCT_PRO    ? {[process.env.KIRVANO_PRODUCT_PRO]:'pro'}         : {}),
  ...(process.env.KIRVANO_PRODUCT_OFFICE ? {[process.env.KIRVANO_PRODUCT_OFFICE]:'office'}   : {}),
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Validar token secreto do Kirvano
  const token = req.headers['x-kirvano-token'] || req.headers['authorization'];
  if (KIRVANO_TOKEN && token !== KIRVANO_TOKEN) {
    console.error('Token inválido:', token);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;
  const event = body?.event;

  console.log('Kirvano webhook recebido:', event, JSON.stringify(body));

  try {
    const sb = createClient(SB_URL, SB_SERVICE_KEY);

    // ── COMPRA APROVADA ─────────────────────────────────────
    if (event === 'purchase.approved' || event === 'subscription.activated') {
      const email      = body?.customer?.email?.toLowerCase().trim();
      const productId  = body?.product?.id || body?.subscription?.product_id;
      const subscId    = body?.subscription?.id || body?.purchase?.id;

      if (!email) return res.status(400).json({ error: 'E-mail não encontrado no payload' });

      const plan = PRODUCT_PLAN_MAP[productId];
      if (!plan) {
        console.error('Produto não mapeado:', productId);
        return res.status(400).json({ error: 'Produto não reconhecido: ' + productId });
      }

      // Calcular vencimento: 35 dias (mês + 5 dias de tolerância)
      const expires = new Date();
      expires.setDate(expires.getDate() + 35);

      // Buscar usuário pelo e-mail
      const { data: users, error: userErr } = await sb
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(1);

      if (userErr || !users?.length) {
        // Usuário ainda não existe — salvar numa fila para quando ele se cadastrar
        console.warn('Usuário não encontrado para e-mail:', email, '— registrando para aplicação futura');
        await sb.from('pending_plans').upsert({
          email,
          plan,
          plan_expires_at: expires.toISOString(),
          kirvano_subscription_id: subscId,
          created_at: new Date().toISOString()
        }, { onConflict: 'email' });
        return res.status(200).json({ ok: true, note: 'pending' });
      }

      const userId = users[0].id;
      const { error: updateErr } = await sb
        .from('profiles')
        .update({
          plan,
          plan_expires_at: expires.toISOString(),
          kirvano_subscription_id: subscId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      console.log(`Plano ${plan} ativado para ${email} até ${expires.toISOString()}`);
      return res.status(200).json({ ok: true, plan, email });
    }

    // ── CANCELAMENTO / EXPIRAÇÃO ─────────────────────────────
    if (event === 'subscription.canceled' || event === 'subscription.expired') {
      const email = body?.customer?.email?.toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'E-mail não encontrado' });

      const { error } = await sb
        .from('profiles')
        .update({
          plan: 'free',
          plan_expires_at: null,
          kirvano_subscription_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (error) throw error;

      console.log(`Plano cancelado para ${email}`);
      return res.status(200).json({ ok: true, plan: 'free', email });
    }

    // Evento não tratado — retornar 200 para o Kirvano não retentar
    console.log('Evento não tratado:', event);
    return res.status(200).json({ ok: true, note: 'event_ignored' });

  } catch (err) {
    console.error('Erro no webhook Kirvano:', err);
    return res.status(500).json({ error: err.message });
  }
}
