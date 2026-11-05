import { config } from './config.js';
import { demoWeather } from './demo.js';
import {
  placeUrl,
  readPlace,
  readWeather,
  shoppingMessage,
  swipeTarget,
  weatherUrl,
} from './household.js';
import { todayInMadrid } from './lunch.js';
import {
  currentSubscription,
  pushSupported,
  subscribeToPush,
  subscriptionRow,
} from './push.js';
import {
  dashboardScreen,
  errorScreen,
  homeScreen,
  notMemberScreen,
  scheduleScreen,
  signInScreen,
  todayScreen,
  weekScreen,
} from './screens.js';
import { getClient, isDemo, loadAccess, signIn, signOut } from './session.js';
import { createDemoStore, createSupabaseStore } from './store.js';

const root = document.querySelector('#app');
const SCREENS = {
  avui: todayScreen,
  setmana: weekScreen,
  horari: scheduleScreen,
  casa: homeScreen,
};

const wideScreen = window.matchMedia('(min-width: 1000px) and (orientation: landscape)');

const SNAPSHOT_KEY = 'family-snapshot';
const WEATHER_KEY = 'family-weather-v2';
const WEATHER_MAX_AGE = 30 * 60 * 1000;

const state = {
  demo: isDemo(),
  today: todayInMadrid(),
  now: new Date(),
  members: [],
  weeklyLunches: [],
  overrides: [],
  menus: [],
  settings: [],
  agenda: [],
  assignees: [],
  shopping: [],
  tasks: [],
  weather: null,
  email: null,
  push: 'hidden',
  weekOffset: 0,
  userAgent: navigator.userAgent,
  offline: false,
  notice: '',
  sheet: null,
};

let store = null;

// El mòbil pot no permetre desar res: l'app ha de funcionar igualment.
const readSaved = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sense memòria local només es perd l'accés a les últimes dades.
  }
};
const forget = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Res a esborrar.
  }
};

function render({ keepScroll = true } = {}) {
  const scroll = window.scrollY;
  const columns = [...root.querySelectorAll('.column')].map((column) => column.scrollTop);
  const name = location.hash.slice(1);
  // La setmana tipus és una pantalla pròpia també a la tauleta.
  const screen = wideScreen.matches && name !== 'horari'
    ? dashboardScreen
    : (SCREENS[name] ?? todayScreen);
  root.innerHTML = screen(state);
  window.scrollTo(0, keepScroll ? scroll : 0);
  root.querySelectorAll('.column').forEach((column, index) => {
    column.scrollTop = columns[index] ?? 0;
  });
}

const isTyping = () =>
  Boolean(state.sheet) || ['INPUT', 'SELECT'].includes(document.activeElement?.tagName);

async function refresh() {
  state.today = todayInMadrid();
  state.now = new Date();
  try {
    const data = await store.load();
    Object.assign(state, data, { offline: false });
    if (!state.demo) save(SNAPSHOT_KEY, data);
  } catch (error) {
    const saved = readSaved(SNAPSHOT_KEY);
    if (!saved) throw error;
    Object.assign(state, saved, { offline: true });
  }
  if (!isTyping()) render();
}

function showNotice(message) {
  state.notice = message;
  render();
  setTimeout(() => {
    state.notice = '';
    if (!isTyping()) render();
  }, 4000);
}

/** Desa un canvi i actualitza la pantalla. */
async function change(operation) {
  if (state.offline) {
    showNotice('Per fer canvis cal connexió.');
    return;
  }
  try {
    await operation();
    await refresh();
  } catch {
    showNotice('No s\'ha pogut desar. Torna-ho a provar.');
  }
}

async function loadWeather({ ask }) {
  if (state.demo) {
    state.weather = demoWeather;
    render();
    return;
  }
  const saved = readSaved(WEATHER_KEY);
  // Les dades desades abans d'afegir les icones no serveixen.
  const usable = saved?.weather?.days?.[0]?.kind;
  if (usable && Date.now() - saved.at < WEATHER_MAX_AGE) {
    state.weather = saved.weather;
    render();
    return;
  }
  if (!ask && !saved) return;

  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: WEATHER_MAX_AGE }),
    );
    const { latitude, longitude } = position.coords;
    const response = await fetch(weatherUrl(latitude, longitude));
    if (!response.ok) throw new Error('meteo');
    state.weather = readWeather(await response.json());
    // El nom del lloc és un afegit: si falla, la meteo es mostra igualment.
    try {
      const place = await fetch(placeUrl(latitude, longitude));
      if (place.ok) state.weather.place = readPlace(await place.json());
    } catch {
      state.weather.place = '';
    }
    save(WEATHER_KEY, { at: Date.now(), weather: state.weather });
  } catch (error) {
    state.weather = {
      failed:
        error.code === 1
          ? 'Cal el permís d\'ubicació per veure la meteo.'
          : 'Ara no s\'ha pogut carregar la meteo.',
    };
  }
  if (!isTyping()) render();
}

async function shareList() {
  const text = shoppingMessage(state.shopping);
  // En un mòbil, el menú de compartir permet triar directament WhatsApp.
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (error) {
      if (error.name !== 'AbortError') showNotice('No s\'ha pogut compartir.');
    }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

async function loadPushState() {
  if (state.demo || !config.vapidPublicKey) return;
  if (!pushSupported()) {
    state.push = 'unsupported';
  } else if (Notification.permission === 'denied') {
    state.push = 'blocked';
  } else {
    state.push = (await currentSubscription()) ? 'on' : 'off';
  }
  if (!isTyping()) render();
}

async function enablePush() {
  const me = state.members.find((member) => member.email === state.email);
  await change(async () => {
    const subscription = await subscribeToPush(config.vapidPublicKey);
    if (subscription) await store.savePush(subscriptionRow(subscription, me.id));
  });
  await loadPushState();
}

async function disablePush() {
  await change(async () => {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await store.removePush(subscription.endpoint);
    await subscription.unsubscribe();
  });
  await loadPushState();
}

const groupLink = () =>
  state.settings.find((row) => row.key === 'whatsapp_group_url')?.value;

async function shareToGroup() {
  try {
    await navigator.clipboard.writeText(shoppingMessage(state.shopping));
  } catch {
    showNotice('No s\'ha pogut copiar la llista.');
    return;
  }
  showNotice('Llista copiada. Enganxa-la al grup.');
  window.open(groupLink(), '_blank', 'noopener');
}

function exportData() {
  const { members, weeklyLunches, overrides, menus, agenda, assignees, shopping, tasks } = state;
  const content = JSON.stringify(
    { exported_at: new Date().toISOString(), members, weeklyLunches, overrides, menus, agenda, assignees, shopping, tasks },
    null,
    2,
  );
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `family-${state.today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

const isTrue = (value) => value === 'true';

const ACTIONS = {
  'toggle-lunch': ({ member, date, next }) =>
    change(() => store.setOverride(member, date, isTrue(next))),
  'toggle-weekly': ({ member, weekday, next }) =>
    change(() => store.setWeekly(member, Number(weekday), state.today, isTrue(next))),
  'toggle-assignee': async ({ event, member, next }) => {
    await change(() => store.setAssignee(event, member, isTrue(next)));
    render();
  },
  'open-weather': () => {
    state.sheet = { type: 'weather' };
    render();
  },
  'open-event': ({ event }) => {
    state.sheet = { type: 'event', uid: event };
    render();
  },
  'toggle-product': ({ id, next }) => change(() => store.setOnList(id, isTrue(next))),
  'mark-bought': ({ id }) => change(() => store.markBought(id, state.shopping)),
  'toggle-task': ({ id, next }) => change(() => store.setTaskDone(id, isTrue(next))),
  'edit-menu': ({ date }) => {
    state.sheet = { type: 'menu', date };
    render();
    document.querySelector('.sheet input')?.focus();
  },
  'new-task': () => {
    state.sheet = { type: 'task' };
    render();
    document.querySelector('.sheet input')?.focus();
  },
  'close-sheet': () => {
    state.sheet = null;
    render();
  },
  'change-week': ({ delta }) => {
    state.weekOffset = Math.max(0, state.weekOffset + Number(delta));
    render();
  },
  'enable-weather': () => loadWeather({ ask: true }),
  'enable-push': enablePush,
  'disable-push': disablePush,
  'share-list': shareList,
  'share-group': shareToGroup,
  'export-data': exportData,
  'sign-in': signIn,
  'sign-out': async () => {
    await signOut();
    forget(SNAPSHOT_KEY);
    forget(WEATHER_KEY);
    location.reload();
  },
  reload: () => location.reload(),
};

const FORMS = {
  menu: (form, { date }) => {
    const dish = form.get('dish').trim();
    return store.setMenu(date, dish);
  },
  task: (form) =>
    store.addTask({
      title: form.get('title').trim(),
      assignee_id: form.get('assignee'),
      due_date: form.get('due') || null,
    }),
  product: (form) => store.addProduct(form.get('name').trim(), state.shopping),
};

root.addEventListener('click', (event) => {
  // Tocar fora d'una finestra la tanca sense canviar res.
  if (event.target.classList.contains('sheet')) {
    state.sheet = null;
    render();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (button) ACTIONS[button.dataset.action]?.(button.dataset);
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const { form: name } = event.target.dataset;
  const data = new FormData(event.target);
  const { dataset } = event.target;
  state.sheet = null;
  document.activeElement?.blur();
  change(() => FORMS[name](data, dataset));
});

// Lliscar el dit lateralment canvia de pantalla.
// Les vores es deixen lliures perquè el mòbil les fa servir per tornar enrere.
const SWIPE_EDGE = 24;
let touchStart = null;

root.addEventListener(
  'touchstart',
  (event) => {
    const [touch] = event.touches;
    const fromEdge =
      touch.clientX < SWIPE_EDGE || touch.clientX > window.innerWidth - SWIPE_EDGE;
    const blocked =
      event.touches.length > 1 ||
      fromEdge ||
      wideScreen.matches ||
      state.sheet ||
      event.target.closest('input, select, textarea');
    touchStart = blocked ? null : { x: touch.clientX, y: touch.clientY };
  },
  { passive: true },
);

root.addEventListener(
  'touchend',
  (event) => {
    if (!touchStart) return;
    const [touch] = event.changedTouches;
    const target = swipeTarget(
      location.hash.slice(1),
      touch.clientX - touchStart.x,
      touch.clientY - touchStart.y,
    );
    touchStart = null;
    if (target) location.hash = target;
  },
  { passive: true },
);

// En girar la tauleta canvia la distribució.
wideScreen.addEventListener('change', () => {
  if (store) render({ keepScroll: false });
});

window.addEventListener('hashchange', () => {
  state.sheet = null;
  render({ keepScroll: false });
});

// En tornar a l'app, les dades i el dia poden haver canviat.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store) refresh().catch(() => {});
});
window.addEventListener('online', () => {
  if (store) refresh().catch(() => {});
});

if ('serviceWorker' in navigator) {
  // Quan arriba una versió nova, es recarrega una sola vegada per fer-la servir.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function start() {
  if (state.demo) {
    store = createDemoStore(state.today);
    await refresh();
    await loadWeather({ ask: false });
    return;
  }

  const saved = readSaved(SNAPSHOT_KEY);
  const access = await loadAccess();
  if (access.status === 'signedOut') {
    root.innerHTML = signInScreen();
    return;
  }
  if (access.status === 'notMember') {
    forget(SNAPSHOT_KEY);
    root.innerHTML = notMemberScreen(access.email);
    return;
  }
  if (access.status === 'error' && !saved) {
    root.innerHTML = errorScreen(access.message);
    return;
  }

  state.email = access.email ?? null;
  try {
    const client = await getClient();
    store = createSupabaseStore(client);
    store.subscribe(() => refresh().catch(() => {}));
  } catch {
    // Sense connexió ni biblioteca només es poden mostrar les últimes dades.
    store = { load: () => Promise.reject(new Error('sense connexió')) };
  }
  await refresh();
  await loadWeather({ ask: false });
  await loadPushState();
}

start().catch((error) => {
  root.innerHTML = errorScreen(error.message);
});
