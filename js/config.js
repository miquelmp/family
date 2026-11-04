// Configuració pública de l'app.
// Si supabaseUrl és buit, l'app funciona en mode demostració, sense dades reals.
// La clau anon és pública per disseny: la protecció són les regles de l'esquema family.
// Aquí no hi pot anar mai la clau service_role.
export const config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
