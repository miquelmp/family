# Family

Tauler de logística familiar per al mòbil: agenda, dinars, compra i tasques.

És una web instal·lable sense compilació: HTML, CSS i JavaScript servits per GitHub Pages.
Les dades són a Supabase, a l'esquema `family`.

Aquest repositori és públic. **No hi posis mai noms reals, correus ni claus secretes.**

## Estat

Sense configurar Supabase, l'app funciona en mode demostració amb dades inventades que no es desen.
Amb Supabase, les pantalles treballen amb dades reals: dinars, setmana tipus, menú, compra, tasques,
meteo i exportació. L'agenda es llegeix de la taula `agenda_events`, però encara falta la tasca
programada que hi copia Google Calendar.

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

La clau `anon` es publicarà en aquest repositori, i serveix per a tot el projecte Supabase.
Comprova que totes les taules dels altres esquemes exposats tenen RLS activa.

### 4. Configuració de l'app

Omple `js/config.js` amb la URL del projecte i la clau `anon`.
No hi posis mai la clau `service_role`.

### 5. Publicació

A GitHub, **Settings > Pages**, tria **Deploy from a branch**, branca `main`, carpeta `/ (root)`.
L'app quedarà a `https://miquelmp.github.io/family/`.

### 6. Instal·lació al mòbil

- **Android:** obre l'adreça amb Chrome i tria **Instal·la l'aplicació**.
- **iPhone:** obre l'adreça amb Safari i tria **Comparteix > Afegeix a la pantalla d'inici**.

## Separació de simlabedu

- Totes les taules van a l'esquema `family`, i cap a `public`.
- Les funcions i les tasques programades porten el prefix `family-`.
- Les migracions i les funcions són en aquest repositori.
- Les regles exigeixen ser membre, no només tenir sessió.

Per traslladar-ho a un projecte propi: executa la migració al projecte nou, copia les dades,
torna a configurar l'entrada i canvia `js/config.js`. Cada membre haurà de tornar a entrar.

## Proves

```sh
node --test tests/*.test.mjs   # regles dels dinars, la compra, l'agenda i la meteo
tests/rls/run.sh               # regles d'accés, amb un Postgres local
node tests/e2e.mjs             # navegador, amb Playwright (vegeu el fitxer)
```

Quan canviïs fitxers de l'app, augmenta `VERSION` a `sw.js` perquè els mòbils els actualitzin.
