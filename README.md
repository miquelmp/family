# Family

Tauler de logística familiar per al mòbil: agenda, dinars, compra i tasques.

És una web instal·lable sense compilació: HTML, CSS i JavaScript servits per GitHub Pages.
Les dades són a Supabase, a l'esquema `family`.

Aquest repositori és públic. **No hi posis mai noms reals, correus ni claus secretes.**

## Estat

Si `js/config.js` és buit, l'app funciona en mode demostració amb dades inventades.
Amb la configuració actual, les pantalles treballen amb dades reals: dinars, setmana tipus, menú, compra, tasques,
meteo, exportació i agenda copiada de Google Calendar cada 15 minuts.

## Posada en marxa

### 1. Base de dades

A l'editor SQL de Supabase:

1. Executa, per ordre, els fitxers de `supabase/migrations/`.
2. Copia `supabase/members.example.sql`, posa-hi les dades reals i executa-ho. No desis la còpia aquí.

A **Project Settings > Data API > Exposed schemas**, afegeix `family`.

### 2. Entrada amb Google

1. A Google Cloud, crea un client OAuth de tipus web amb la URL de retorn que indica Supabase.
2. A **Authentication > Sign In / Providers**, activa Google amb aquest client.
3. A **Authentication > URL Configuration**, afegeix `https://miquelmp.github.io/family/`
   a les URL de redirecció. No canviïs la Site URL.

### 3. Abans de publicar la clau

La clau publicable es publica en aquest repositori, i serveix per a tot el projecte Supabase.
Comprova que totes les taules dels altres esquemes exposats tenen RLS activa.

### 4. Configuració de l'app

`js/config.js` té la URL del projecte i la clau publicable.
No hi posis mai la clau `secret` ni la `service_role`.

### 5. Publicació

A GitHub, **Settings > Pages**, tria **Deploy from a branch**, branca `main`, carpeta `/ (root)`.
L'app quedarà a `https://miquelmp.github.io/family/`.

### 6. Instal·lació al mòbil

- **Android:** obre l'adreça amb Chrome i tria **Instal·la l'aplicació**.
- **iPhone:** obre l'adreça amb Safari i tria **Comparteix > Afegeix a la pantalla d'inici**.

### 7. Agenda

La funció `family-agenda-sync` copia els propers 60 dies del calendari Family.

1. A **Edge Functions**, crea la funció `family-agenda-sync` amb el codi de
   `supabase/functions/family-agenda-sync/index.ts`, i desactiva la verificació de JWT.
2. A **Edge Functions > Secrets**, crea `FAMILY_ICAL_URL` i `FAMILY_CRON_SECRET`.
3. Executa una còpia de `supabase/agenda-sync.example.sql` amb el secret real.

### 8. Avisos

La funció `family-reminders` envia a les 8 h les cites i tasques del dia, i a les 20 h les cites de demà.
Una cita només s'avisa als membres marcats a l'app. Si no n'hi ha, als convidats de la família, i si tampoc n'hi ha, a tothom.

1. Genera les claus a `tools/vapid.html`.
2. Afegeix la clau pública a `js/config.js`, com a `vapidPublicKey`.
3. Crea la funció `family-reminders` amb el codi de `supabase/functions/family-reminders/index.ts`
   i desactiva la verificació de JWT.
4. A **Edge Functions > Secrets**, crea `FAMILY_VAPID_PUBLIC_KEY`, `FAMILY_VAPID_PRIVATE_KEY`
   i `FAMILY_VAPID_SUBJECT`, amb el format `mailto:el-teu-correu`.
5. Executa una còpia de `supabase/reminders.example.sql` amb el secret real.

### 9. Grup de WhatsApp (opcional)

Amb l'enllaç d'invitació del grup, l'app copia la llista i obre el grup:

```sql
insert into family.settings (key, value)
values ('whatsapp_group_url', 'ENLLAÇ_D_INVITACIÓ');
```

## Separació de simlabedu

- Totes les taules van a l'esquema `family`, i cap a `public`.
- Les funcions i les tasques programades porten el prefix `family-`.
- Les migracions i les funcions són en aquest repositori.
- Les regles exigeixen ser membre, no només tenir sessió.

Per traslladar-ho a un projecte propi: executa la migració al projecte nou, copia les dades,
torna a configurar l'entrada i canvia `js/config.js`. Cada membre haurà de tornar a entrar.

## Vistes

En pantalles apaisades d'almenys 1000 px, com una tauleta, Avui, Setmana i Casa surten una al costat de l'altra.

## Proves

```sh
node --test tests/*.test.mjs   # regles dels dinars, la compra, l'agenda i la meteo
tests/rls/run.sh               # regles d'accés, amb un Postgres local
node tests/e2e.mjs             # navegador, amb Playwright (vegeu el fitxer)
```

A cada publicació, canvia `APP_VERSION` a `js/version.js`: és el número que es veu al final de Casa.
Quan afegeixis o treguis fitxers de l'app, actualitza `SHELL` i `VERSION` a `sw.js`.
