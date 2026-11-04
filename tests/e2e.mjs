// Prova l'app en mida de mòbil amb Playwright. Sense Supabase real: l'entrada se simula.
// Ús: serveix el directori pare del repositori i executa
// BASE_URL=http://localhost:8123/family/ SHOTS=carpeta NODE_PATH=... node tests/e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE_URL = process.env.BASE_URL;
const SHOTS = process.env.SHOTS;

const browser = await chromium.launch();

async function newPage(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  return { page, context, errors };
}

const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function checkDemo(width) {
  const { page, context, errors } = await newPage(width);
  await page.goto(BASE_URL);
  await page.waitForSelector('.tabs');
  assert.ok(await page.getByText('Mode demostració').isVisible());
  assert.ok(await noSideScroll(page), `scroll horitzontal a Avui (${width})`);

  // Marcar tothom fa aparèixer "Tots junts".
  for (const button of await page.locator('.lunch-toggle--away').all()) {
    await page.locator('.lunch-toggle--away').first().click();
  }
  assert.equal(await page.locator('.card--lunch h2').innerText(), 'Tots junts');

  // El canvi puntual es veu a Setmana, i només en aquella data.
  await page.click('a[href="#setmana"]');
  await page.waitForSelector('.days');
  assert.ok(await noSideScroll(page), `scroll horitzontal a Setmana (${width})`);
  assert.equal(await page.locator('.day--today .together').count(), 1);
  const togetherBefore = await page.locator('.together').count();
  await page.locator('.day--today .avatar-button').first().click();
  assert.equal(await page.locator('.day--today .together').count(), 0);
  assert.equal(await page.locator('.together').count(), togetherBefore - 1);

  await page.click('a[href="#casa"]');
  await page.waitForSelector('.products');
  assert.ok(await noSideScroll(page), `scroll horitzontal a Casa (${width})`);
  const count = await page.locator('.product--on').count();
  await page.locator('.product:not(.product--on)').first().click();
  assert.equal(await page.locator('.product--on').count(), count + 1);
  await page.locator('.check:not(.check--done)').first().click();

  // Zones tàctils d'almenys 44 px.
  const small = await page.$$eval('button, nav a', (nodes) =>
    nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.height < 44 || box.width < 28).length,
  );
  assert.equal(small, 0, 'hi ha zones tàctils massa petites');

  assert.deepEqual(errors, []);
  await context.close();
}

const CONFIG = `export const config = {
  supabaseUrl: 'https://exemple.supabase.co',
  supabaseAnonKey: 'clau-publica',
};`;

// Simula Supabase: la sessió i la resposta les decideix cada cas.
const fakeSupabase = ({ session, members, fail }) => `
  window.supabase = {
    createClient: (url, key, options) => {
      window.clientOptions = options;
      return {
        auth: {
          getSession: async () => ({ data: { session: ${JSON.stringify(session)} }, error: null }),
          signInWithOAuth: async (args) => { window.signInArgs = args; },
          signOut: async () => {},
        },
        from: () => ({ select: () => ({ order: async () => (${JSON.stringify(
          fail ? { data: null, error: { message: fail } } : { data: members, error: null },
        )}) }) }),
      };
    },
  };`;

async function realMode(scenario) {
  const { page, context, errors } = await newPage();
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: CONFIG }),
  );
  await page.route('**/supabase.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: fakeSupabase(scenario) }),
  );
  await page.goto(BASE_URL);
  return { page, context, errors };
}

const member = {
  id: '1', email: 'membre@example.com', display_name: 'Prova',
  short_label: 'Pr', color: '#1D4ED8', sort_order: 1,
};
const session = (email) => ({ user: { email } });

async function checkAccess() {
  {
    const { page, context } = await realMode({ session: null, members: [] });
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
    const { page, context } = await realMode({
      session: session('alie@example.com'), members: [],
    });
    await page.getByText('Sense accés').waitFor();
    assert.equal(await page.locator('.tabs').count(), 0);
    await context.close();
  }
  {
    const { page, context } = await realMode({
      session: session('Membre@Example.com'), members: [member],
    });
    await page.getByText('Hola, Prova').waitFor();
    await context.close();
  }
  {
    const { page, context } = await realMode({
      session: session('membre@example.com'), fail: 'esquema no exposat',
    });
    await page.getByText('esquema no exposat').waitFor();
    await context.close();
  }
}

async function checkOffline() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(BASE_URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('.tabs');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tabs');
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
  for (const [hash, name] of [['avui', 'avui'], ['setmana', 'setmana'], ['casa', 'casa']]) {
    await page.goto(`${BASE_URL}#${hash}`);
    await page.waitForSelector('.tabs');
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  }
  await context.close();
}

for (const width of [360, 390, 430]) await checkDemo(width);
await checkAccess();
await checkOffline();
await screenshots();
await browser.close();
console.log('Proves de navegador superades');
