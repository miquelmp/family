import { demo } from './demo.js';
import { isAtHome, todayInMadrid } from './lunch.js';
import {
  errorScreen,
  homeScreen,
  memberHome,
  notMemberScreen,
  shoppingMessage,
  signInScreen,
  todayScreen,
  weekScreen,
} from './screens.js';
import { isDemo, loadAccess, signIn, signOut } from './session.js';

const root = document.querySelector('#app');
const SCREENS = { avui: todayScreen, setmana: weekScreen, casa: homeScreen };

const demoState = {
  ...structuredClone(demo),
  overrides: [],
  today: todayInMadrid(),
};

function renderDemo() {
  const screen = SCREENS[location.hash.slice(1)] ?? todayScreen;
  root.innerHTML = screen(demoState);
  window.scrollTo(0, 0);
}

async function renderReal() {
  const access = await loadAccess();
  if (access.status === 'signedOut') root.innerHTML = signInScreen();
  else if (access.status === 'notMember') root.innerHTML = notMemberScreen(access.email);
  else if (access.status === 'error') root.innerHTML = errorScreen(access.message);
  else root.innerHTML = memberHome({ ...access, today: todayInMadrid() });
}

function toggleLunch({ member, date }) {
  const state = demoState;
  const atHome = isAtHome(member, date, state.weeklyLunches, state.overrides);
  state.overrides = state.overrides.filter(
    (row) => !(row.member_id === member && row.lunch_date === date),
  );
  state.overrides.push({ member_id: member, lunch_date: date, at_home: !atHome });
  renderDemo();
}

function toggleItem(list, id, field) {
  const item = list.find((entry) => entry.id === id);
  item[field] = !item[field];
  renderDemo();
}

async function shareList() {
  const text = shoppingMessage(demoState.shopping);
  // En un mòbil, el menú de compartir permet triar directament WhatsApp.
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    }
    return;
  }
  location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const ACTIONS = {
  'toggle-lunch': toggleLunch,
  'toggle-product': ({ id }) => toggleItem(demoState.shopping, id, 'onList'),
  'toggle-task': ({ id }) => toggleItem(demoState.tasks, id, 'done'),
  'share-list': shareList,
  'sign-in': signIn,
  'sign-out': async () => {
    await signOut();
    await renderReal();
  },
  reload: () => location.reload(),
};

root.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) ACTIONS[button.dataset.action]?.(button.dataset);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (isDemo()) {
  window.addEventListener('hashchange', renderDemo);
  renderDemo();
} else {
  renderReal();
}
