// Entrada amb Google a través de Supabase.
// La sessió queda desada al dispositiu i es renova sola,
// així que cada membre només entra una vegada a cada mòbil.
import { config } from './config.js';

// Versió fixada: actualitza-la conscientment.
const SUPABASE_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

function loadScript(src) {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('No s\'ha pogut carregar Supabase'));
    document.head.append(script);
  });
}

export const isDemo = () => !config.supabaseUrl;

let client = null;

async function getClient() {
  if (client) return client;
  await loadScript(SUPABASE_SCRIPT);
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    db: { schema: 'family' },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'family-auth',
    },
  });
  return client;
}

/**
 * Retorna l'estat d'accés:
 * - signedOut: cal entrar
 * - notMember: té sessió però no és de la família
 * - member: pot fer servir l'app, amb members i user
 * - error: no s'ha pogut comprovar, amb message
 */
export async function loadAccess() {
  try {
    const supabase = await getClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session) return { status: 'signedOut' };

    const { data: members, error } = await supabase
      .from('members')
      .select('id, email, display_name, short_label, color, sort_order')
      .order('sort_order');
    if (error) throw error;

    const email = data.session.user.email?.toLowerCase();
    const me = members.find((member) => member.email === email);
    if (!me) return { status: 'notMember', email };
    return { status: 'member', members, me };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export async function signIn() {
  const supabase = await getClient();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}` },
  });
}

export async function signOut() {
  const supabase = await getClient();
  await supabase.auth.signOut();
}
