// Prova l'app en mida de mòbil amb Playwright. Sense Supabase real: es fa servir un simulador.
// Ús: serveix el directori pare del repositori i executa
// BASE_URL=http://localhost:8123/family/ SHOTS=carpeta NODE_PATH=... node tests/e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE_URL = process.env.BASE_URL;
const SHOTS = process.env.SHOTS;

const browser = await chromium.launch();

// Les proves de demostració no han de dependre de la configuració publicada.
const DEMO_CONFIG = "export const config = { supabaseUrl: '', supabaseAnonKey: '', vapidPublicKey: '' };";
const useDemoConfig = (page) =>
  page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: DEMO_CONFIG }),
  );

async function newPage(width = 390, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await useDemoConfig(page);
  return { page, context, errors };
}

const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const smallTargets = (page) =>
  page.$$eval('button, nav a, a.link-button', (nodes) =>
    nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.height < 28 || box.width < 28).length,
  );

async function checkDemo(width) {
  const { page, context, errors } = await newPage(width);
  await page.goto(BASE_URL);
  await page.waitForSelector('.tabs');
  assert.ok(await page.getByText('Mode demostració').isVisible());
  assert.ok(await page.getByText('Weather data by Open-Meteo.com').isVisible());
  assert.ok(await noSideScroll(page), `scroll horitzontal a Avui (${width})`);

  // Marcar tothom fa aparèixer "Tots junts".
  while (await page.locator('.lunch-toggle--away').count()) {
    await page.locator('.lunch-toggle--away').first().click();
  }
  assert.equal(await page.locator('.card--lunch h2').innerText(), 'Tots junts');

  // Menú editable.
  await page.locator('.card--lunch .dish').click();
  await page.fill('.sheet input[name=dish]', 'Sopa <b>');
  await page.getByRole('button', { name: 'Desa' }).click();
  await page.getByRole('button', { name: 'Sopa <b>' }).waitFor();

  // El canvi puntual es veu a Setmana, i només en aquella data.
  await page.click('a[href="#setmana"]');
  await page.waitForSelector('.days');
  assert.ok(await noSideScroll(page), `scroll horitzontal a Setmana (${width})`);
  assert.equal(await page.locator('.day--today .together').count(), 1);
  await page.locator('.day--today .avatar-button').first().click();
  await page.waitForFunction(() => !document.querySelector('.day--today .together'));

  // Setmana següent, i tornada.
  await page.getByRole('button', { name: 'Setmana següent' }).click();
  assert.equal(await page.locator('.day--today').count(), 0);
  await page.getByRole('button', { name: 'Setmana anterior' }).click();
  assert.equal(await page.locator('.day--today').count(), 1);
  assert.ok(await page.getByRole('button', { name: 'Setmana anterior' }).isDisabled());

  // La setmana tipus no anul·la el canvi puntual.
  await page.click('a[href="#horari"]');
  await page.waitForSelector('.grid');
  assert.ok(await noSideScroll(page), `scroll horitzontal a Setmana tipus (${width})`);
  await page.locator('.grid__cell--away').first().click();
  await page.click('a[href="#setmana"]');
  await page.waitForSelector('.days');
  assert.equal(await page.locator('.day--today .together').count(), 0);

  await page.click('a[href="#casa"]');
  await page.waitForSelector('.products');
  assert.ok(await noSideScroll(page), `scroll horitzontal a Casa (${width})`);

  // Producte habitual: un toc l'afegeix i comprar-lo el treu sense perdre'l.
  const list = page.locator('section[aria-label="Llista de la compra"] li');
  assert.equal(await list.count(), 3);
  await page.getByRole('button', { name: 'Aigua' }).click();
  await page.getByRole('button', { name: 'Comprat: Aigua' }).click();
  await page.getByRole('button', { name: 'Comprat: Aigua' }).waitFor({ state: 'detached' });
  assert.equal(await page.locator('.product', { hasText: 'Aigua' }).count(), 1);

  // Sense duplicats, encara que canviïn les majúscules.
  await page.fill('#new-product', 'Sabó');
  await page.getByRole('button', { name: 'Afegeix', exact: true }).click();
  await page.getByRole('button', { name: 'Comprat: Sabó' }).waitFor();
  await page.fill('#new-product', ' sabó ');
  await page.getByRole('button', { name: 'Afegeix', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#new-product').value === '');
  assert.equal(await page.getByRole('button', { name: 'Comprat: Sabó' }).count(), 1);

  // Tasques.
  await page.getByRole('button', { name: 'Nova tasca' }).click();
  await page.fill('.sheet input[name=title]', 'Regar');
  await page.getByRole('button', { name: 'Afegeix', exact: true }).last().click();
  await page.getByRole('button', { name: 'Marca com a feta: Regar' }).click();
  await page.getByRole('button', { name: 'Desmarca: Regar' }).waitFor();

  assert.equal(await smallTargets(page), 0, 'hi ha zones tàctils massa petites');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporta les dades' }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^family-\d{4}-\d{2}-\d{2}\.json$/);

  assert.deepEqual(errors, []);
  await context.close();
}

const CONFIG = `export const config = {
  supabaseUrl: 'https://exemple.supabase.co',
  supabaseAnonKey: 'clau-publica',
  vapidPublicKey: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
};`;

// Simulador de Supabase en memòria, amb la forma de crides que fa l'app.
const fakeSupabase = (scenario) => `
  const scenario = ${JSON.stringify(scenario)};
  const keys = {
    lunch_overrides: ['member_id', 'lunch_date'],
    weekly_lunches: ['member_id', 'weekday', 'valid_from'],
    menus: ['lunch_date'],
    push_subscriptions: ['endpoint'],
  };
  const tables = window.tables = {
    members: scenario.members ?? [], weekly_lunches: [], lunch_overrides: [], menus: [],
    agenda_events: scenario.agenda ?? [], shopping_items: scenario.shopping ?? [], tasks: [],
    push_subscriptions: [],
  };
  window.calls = [];
  const query = (name) => {
    let action = 'select', payload, filters = [];
    const run = async () => {
      window.calls.push([action, name, payload]);
      if (scenario.fail) return { data: null, error: { message: scenario.fail } };
      const matches = (row) => filters.every(([field, value]) => row[field] === value);
      const rows = tables[name];
      if (action === 'select') return { data: rows.filter(matches), error: null };
      if (action === 'insert') {
        if (scenario.duplicate) {
          scenario.duplicate = false;
          return { data: null, error: { code: '23505', message: 'duplicate' } };
        }
        rows.push({ id: crypto.randomUUID(), ...payload });
      }
      if (action === 'upsert') {
        const same = (row) => keys[name].every((key) => row[key] === payload[key]);
        tables[name] = rows.filter((row) => !same(row)).concat(payload);
      }
      if (action === 'update') rows.filter(matches).forEach((row) => Object.assign(row, payload));
      if (action === 'delete') tables[name] = rows.filter((row) => !matches(row));
      return { data: null, error: null };
    };
    const builder = {
      select() { return builder; },
      order() { return builder; },
      eq(field, value) { filters.push([field, value]); return builder; },
      insert(row) { action = 'insert'; payload = row; return builder; },
      upsert(row) { action = 'upsert'; payload = row; return builder; },
      update(row) { action = 'update'; payload = row; return builder; },
      delete() { action = 'delete'; return builder; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return builder;
  };
  window.supabase = {
    createClient: (url, key, options) => {
      window.clientOptions = options;
      return {
        auth: {
          getSession: async () => ({ data: { session: scenario.session ?? null }, error: null }),
          signInWithOAuth: async (args) => { window.signInArgs = args; },
          signOut: async () => { window.signedOut = true; },
        },
        from: query,
        channel: (channelName) => {
          const channel = {
            on: (type, filter, callback) => {
              window.channelFilter = filter;
              window.remoteChange = callback;
              return channel;
            },
            subscribe: () => channel,
          };
          return channel;
        },
        removeChannel: () => {},
      };
    },
  };`;

async function realMode(scenario, options, prepare) {
  const { page, context, errors } = await newPage(390, options);
  if (prepare) await prepare(page);
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: CONFIG }),
  );
  await page.route('**/supabase.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: fakeSupabase(scenario) }),
  );
  await page.goto(BASE_URL);
  return { page, context, errors };
}

const members = [
  { id: 'm1', email: 'una@example.com', display_name: 'Una', short_label: 'Un', color: '#1D4ED8', sort_order: 1 },
  { id: 'm2', email: 'dos@example.com', display_name: 'Dos', short_label: 'Do', color: '#C2410C', sort_order: 2 },
];
const session = (email) => ({ user: { email } });

async function checkAccess() {
  {
    const { page, context } = await realMode({});
    await page.getByRole('button', { name: 'Entra amb Google' }).click();
    const args = await page.evaluate(() => window.signInArgs);
    assert.equal(args.provider, 'google');
    assert.ok(args.options.redirectTo.endsWith('/family/'));
    const options = await page.evaluate(() => window.clientOptions);
    assert.equal(options.db.schema, 'family');
    assert.equal(options.auth.persistSession, true);
    await context.close();
  }
  {
    const { page, context } = await realMode({ session: session('alie@example.com'), members });
    await page.getByText('Sense accés').waitFor();
    assert.equal(await page.locator('.tabs').count(), 0);
    await context.close();
  }
  {
    const { page, context } = await realMode({
      session: session('una@example.com'), fail: 'esquema no exposat',
    });
    await page.getByText('esquema no exposat').waitFor();
    await context.close();
  }
}

async function checkRealData() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const { page, context, errors } = await realMode({
    session: session('UNA@example.com'),
    members,
    shopping: [
      { id: 'u1', name: 'Llet', category: 'Begudes', is_usual: true, on_list: false },
      { id: 'u2', name: 'Piles', is_usual: false, on_list: true },
    ],
    agenda: [{ uid: 'e1', title: 'Cita real', starts_at: `${today}T23:00:00Z`, all_day: false }],
  });
  await page.waitForSelector('.tabs');
  assert.equal(await page.getByText('Mode demostració').count(), 0);
  assert.equal(await page.getByText('Persona 1').count(), 0);
  assert.equal(
    await page.evaluate(() => window.channelFilter.schema), 'family',
    'els canvis al moment han d\'escoltar l\'esquema family',
  );

  // Dinar: un toc desa un canvi puntual per a aquesta data.
  await page.locator('.lunch-toggle').first().click();
  await page.waitForFunction(() => window.tables.lunch_overrides.length === 1);
  assert.deepEqual(await page.evaluate(() => window.tables.lunch_overrides), [
    { member_id: 'm1', lunch_date: today, at_home: true },
  ]);
  await page.waitForFunction(() => document.querySelector('.card--lunch h2').innerText === 'Una persona a taula');

  // Setmana tipus: es desa amb la data d'avui.
  await page.goto(`${BASE_URL}#horari`);
  await page.waitForSelector('.grid');
  await page.locator('.grid__cell--away').first().click();
  await page.waitForFunction(() => window.tables.weekly_lunches.length === 1);
  assert.deepEqual(await page.evaluate(() => window.tables.weekly_lunches), [
    { member_id: 'm1', weekday: 1, valid_from: today, at_home: true },
  ]);

  // Compra: un producte puntual comprat desapareix; un habitual es conserva.
  await page.click('a[href="#setmana"]');
  await page.click('a[href="#casa"]');
  await page.getByRole('button', { name: 'Comprat: Piles' }).click();
  await page.waitForFunction(() => window.tables.shopping_items.length === 1);
  await page.locator('.product', { hasText: 'Llet' }).click();
  await page.getByRole('button', { name: 'Comprat: Llet' }).click();
  await page.waitForFunction(() => window.tables.shopping_items[0].on_list === false);

  // Tasca assignada a un membre, i marcada com a feta.
  await page.getByRole('button', { name: 'Nova tasca' }).click();
  await page.fill('.sheet input[name=title]', 'Regar');
  await page.selectOption('.sheet select', 'm2');
  await page.getByRole('button', { name: 'Afegeix', exact: true }).last().click();
  await page.getByRole('button', { name: 'Marca com a feta: Regar' }).click();
  await page.waitForFunction(() => window.tables.tasks[0].done_at);
  assert.equal(await page.evaluate(() => window.tables.tasks[0].assignee_id), 'm2');

  // Un canvi d'una altra persona apareix sense tocar res.
  await page.evaluate(() => {
    window.tables.shopping_items[0].on_list = true;
    window.remoteChange();
  });
  await page.getByRole('button', { name: 'Comprat: Llet' }).waitFor();

  assert.deepEqual(errors, []);
  await context.close();
}

async function checkDuplicateRace() {
  const { page, context } = await realMode({
    session: session('una@example.com'),
    members,
    duplicate: true,
    shopping: [],
  });
  await page.click('a[href="#casa"]');
  await page.waitForSelector('#new-product');
  await page.evaluate(() => {
    window.tables.shopping_items.push({ id: 'x', name: 'Sal', is_usual: false, on_list: false });
  });
  await page.fill('#new-product', 'Sal');
  await page.getByRole('button', { name: 'Afegeix', exact: true }).click();
  await page.getByRole('button', { name: 'Comprat: Sal' }).waitFor();
  await context.close();
}

async function checkOfflineData() {
  const scenario = { session: session('una@example.com'), members };
  const { page, context } = await realMode(scenario);
  await page.waitForSelector('.tabs');

  await page.unroute('**/supabase.js');
  await page.route('**/supabase.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: fakeSupabase({ ...scenario, fail: 'Failed to fetch' }),
    }),
  );
  await page.reload();
  await page.getByText('Sense connexió').waitFor();
  assert.ok(await page.locator('.lunch-toggle').first().isVisible());
  await page.locator('.lunch-toggle').first().click();
  await page.locator('.notice').waitFor();
  assert.equal(await page.evaluate(() => window.tables.lunch_overrides.length), 0);
  await context.close();
}

async function checkWeather() {
  const { page, context } = await realMode(
    { session: session('una@example.com'), members },
    { geolocation: { latitude: 41.38789, longitude: 2.16992 }, permissions: ['geolocation'] },
  );
  let url = '';
  await page.route('https://api.open-meteo.com/**', (route) => {
    url = route.request().url();
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current: { temperature_2m: 15.2, weather_code: 3, time: '2026-11-04T12:00' },
        daily: { temperature_2m_max: [19], temperature_2m_min: [9] },
        hourly: { time: ['2026-11-04T20:00'], precipitation_probability: [80] },
      }),
    });
  });
  await page.getByRole('button', { name: 'Activa la meteo' }).click();
  await page.getByText('15°').waitFor();
  await page.getByText('Pluja cap a les 20:00').waitFor();
  assert.match(url, /latitude=41\.39/);
  await context.close();
}

async function checkWeatherDenied() {
  const { page, context } = await realMode(
    { session: session('una@example.com'), members },
    { permissions: [] },
  );
  await page.getByRole('button', { name: 'Activa la meteo' }).click();
  await page.getByText('Cal el permís d\'ubicació').waitFor();
  await context.close();
}

// Simula el mòbil: un servei d'avisos que registra qui s'hi subscriu.
const fakePush = (permission) => `
  let current = null;
  const pushManager = {
    getSubscription: async () => current,
    subscribe: async (options) => {
      window.subscribeOptions = options;
      current = {
        endpoint: 'https://push.example.com/mobil',
        toJSON: () => ({
          endpoint: 'https://push.example.com/mobil',
          keys: { p256dh: 'clau', auth: 'secret' },
        }),
        unsubscribe: async () => { current = null; },
      };
      return current;
    },
  };
  window.PushManager = function PushManager() {};
  window.Notification = { permission: '${permission}', requestPermission: async () => 'granted' };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({ pushManager }),
      controller: null,
      addEventListener() {},
      register: async () => ({}),
    },
  });
`;

async function checkPush() {
  const enter = async (permission) => {
    const session_ = { session: session('una@example.com'), members };
    const opened = await realMode(session_, undefined, (page) =>
      page.addInitScript(fakePush(permission)),
    );
    await opened.page.waitForSelector('.tabs');
    await opened.page.click('a[href="#casa"]');
    await opened.page.waitForSelector('.products, .empty');
    return opened;
  };

  {
    const { page, context, errors } = await enter('default');
    await page.getByRole('button', { name: 'Activa els avisos' }).click();
    await page.getByRole('button', { name: 'Desactiva els avisos' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.tables.push_subscriptions), [{
      endpoint: 'https://push.example.com/mobil', member_id: 'm1', p256dh: 'clau', auth: 'secret',
    }]);
    assert.equal(await page.evaluate(() => window.subscribeOptions.userVisibleOnly), true);

    await page.getByRole('button', { name: 'Desactiva els avisos' }).click();
    await page.getByRole('button', { name: 'Activa els avisos' }).waitFor();
    assert.equal(await page.evaluate(() => window.tables.push_subscriptions.length), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context } = await enter('denied');
    await page.getByText('bloquejats').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Activa els avisos' }).count(), 0);
    await context.close();
  }
}

async function checkSmartThings() {
  const { page, context } = await newPage();
  await page.goto(`${BASE_URL}#casa`);
  const link = page.getByRole('link', { name: 'Obre SmartThings' });
  assert.match(await link.getAttribute('href'), /^intent:.*com\.samsung\.android\.oneconnect/);
  await context.close();

  const iphone = await newPage(390, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
  await iphone.page.goto(`${BASE_URL}#casa`);
  assert.match(
    await iphone.page.getByRole('link', { name: 'Obre SmartThings' }).getAttribute('href'),
    /apps\.apple\.com\/app\/id1222822904/,
  );
  await iphone.context.close();
}

async function checkOfflineShell() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(BASE_URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  // Sense connexió ni sessió desada, l'app s'obre i explica el problema.
  await page.waitForSelector('.tabs, .center h1');
  await context.close();
}

// Simula un mòbil amb una versió antiga guardada: ha de rebre la nova en obrir l'app.
async function checkUpdate() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(BASE_URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    const [name] = await caches.keys();
    const cache = await caches.open(name);
    await cache.put('js/household.js', new Response('export const antic = true;', {
      headers: { 'content-type': 'text/javascript' },
    }));
  });
  const fresh = await page.evaluate(async () => (await fetch('js/household.js')).text());
  assert.ok(fresh.includes('eventLastDate'), 'ha de rebre la versió de la xarxa');
  await context.close();
}

async function screenshots() {
  if (!SHOTS) return;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await useDemoConfig(page);
  for (const name of ['avui', 'setmana', 'horari', 'casa']) {
    await page.goto(`${BASE_URL}#${name}`);
    await page.waitForSelector('.tabs');
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  }
  await context.close();
}

for (const width of [360, 390, 430]) await checkDemo(width);
await checkAccess();
await checkRealData();
await checkDuplicateRace();
await checkOfflineData();
await checkWeather();
await checkWeatherDenied();
await checkPush();
await checkSmartThings();
await checkOfflineShell();
await checkUpdate();
await screenshots();
await browser.close();
console.log('Proves de navegador superades');
