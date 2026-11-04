// Configuració pública de l'app.
// Si supabaseUrl és buit, l'app funciona en mode demostració, sense dades reals.
// La clau publicable és pública per disseny: la protecció són les regles de l'esquema family.
// Aquí no hi pot anar mai la clau secreta ni la service_role.
export const config = {
  supabaseUrl: 'https://lsiggkxtgrjeilfhyewe.supabase.co',
  supabaseAnonKey: 'sb_publishable_cvSlpcKD4k4OCG0-xHnPzA_zKc_uSmF',
};
