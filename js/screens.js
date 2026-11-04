// Pantalles de l'app. Cada funció retorna HTML; els textos variables passen per escapeHtml.
import { allTogether, isAtHome, isoWeekday, weekDates } from './lunch.js';

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

const icon = (body, size = 22) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  avui: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"></path>',
  setmana: '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  casa: '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-6h4v6"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  share: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5z"></path>',
};

const TABS = [
  { id: 'avui', label: 'Avui' },
  { id: 'setmana', label: 'Setmana' },
  { id: 'casa', label: 'Casa' },
];

const WEEKDAY_SHORT = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];

function formatToday(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat('ca', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const day = new Intl.DateTimeFormat('ca', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return { weekday: weekday[0].toUpperCase() + weekday.slice(1), day };
}

function avatar(member, { size = 'md', present = true } = {}) {
  const label = escapeHtml(member.short_label);
  const name = escapeHtml(member.display_name);
  if (!present) {
    return `<span class="avatar avatar--${size} avatar--away" title="${name} no hi és">${label}</span>`;
  }
  return `<span class="avatar avatar--${size}" style="background:${escapeHtml(member.color)}" title="${name}">${label}</span>`;
}

function shell(activeTab, content, { banner = '' } = {}) {
  const tabs = TABS.map(
    (tab) => `
      <a class="tab" href="#${tab.id}" ${tab.id === activeTab ? 'aria-current="page"' : ''}>
        ${icon(ICONS[tab.id])}${tab.label}
      </a>`,
  ).join('');
  return `
    <div class="screen">
      ${banner}
      <main class="content">${content}</main>
      <nav class="tabs" aria-label="Navegació">${tabs}</nav>
    </div>`;
}

const DEMO_BANNER = '<p class="banner">Mode demostració: dades inventades que no es desen.</p>';

function lunchButtons(state, date) {
  return state.members
    .map((member) => {
      const atHome = isAtHome(member.id, date, state.weeklyLunches, state.overrides);
      const style = atHome ? `style="background:${escapeHtml(member.color)}"` : '';
      return `
        <button class="lunch-toggle ${atHome ? '' : 'lunch-toggle--away'}" ${style}
          aria-pressed="${atHome}" data-action="toggle-lunch"
          data-member="${escapeHtml(member.id)}" data-date="${date}">
          ${escapeHtml(member.display_name)}
        </button>`;
    })
    .join('');
}

function lunchSummary(count, total) {
  if (count === 0) return 'Ningú a taula';
  if (count === total) return 'Tots junts';
  return count === 1 ? 'Una persona a taula' : `${count} persones a taula`;
}

export function todayScreen(state) {
  const { today, members, weeklyLunches, overrides } = state;
  const { weekday, day } = formatToday(today);
  const byId = Object.fromEntries(members.map((member) => [member.id, member]));
  const atHomeCount = members.filter((member) =>
    isAtHome(member.id, today, weeklyLunches, overrides),
  ).length;

  const agenda = state.agenda
    .map(
      (event) => `
        <li class="row">
          <span class="row__time">${escapeHtml(event.time)}</span>
          <span class="row__main">
            <strong>${escapeHtml(event.title)}</strong>
            <small>${escapeHtml(event.note)}</small>
          </span>
          ${avatar(byId[event.memberId], { size: 'sm' })}
        </li>`,
    )
    .join('');

  const toBuy = state.shopping.filter((item) => item.onList);
  const pending = state.tasks.filter((task) => !task.done);

  return shell(
    'avui',
    `
    <header class="header">
      <div>
        <h1>${escapeHtml(weekday)}</h1>
        <p>${escapeHtml(day)}</p>
      </div>
      <div class="avatars" aria-label="Membres de la família">
        ${members.map((member) => avatar(member)).join('')}
      </div>
    </header>

    <section class="card card--lunch" aria-label="Dinar d'avui">
      <div class="card__top">
        <div>
          <p class="eyebrow">Dinar d'avui</p>
          <h2>${lunchSummary(atHomeCount, members.length)}</h2>
        </div>
        <p class="dish">${escapeHtml(state.menusByWeekday[isoWeekday(today)])}</p>
      </div>
      <div class="lunch-grid">${lunchButtons(state, today)}</div>
    </section>

    <section class="card" aria-label="Agenda d'avui">
      <h2 class="card__title">Agenda d'avui</h2>
      <ul class="list">${agenda}</ul>
    </section>

    <div class="tiles">
      <a class="tile tile--blue" href="#casa">
        <b>${toBuy.length}</b><span>A la compra</span>
      </a>
      <a class="tile tile--lilac" href="#casa">
        <b>${pending.length}</b><span>Tasques pendents</span>
      </a>
    </div>`,
    { banner: DEMO_BANNER },
  );
}

export function weekScreen(state) {
  const { today, members, weeklyLunches, overrides } = state;
  const dates = weekDates(today);
  const memberIds = members.map((member) => member.id);

  const rows = dates
    .map((date, index) => {
      const together = allTogether(memberIds, date, weeklyLunches, overrides);
      const dish = escapeHtml(state.menusByWeekday[index + 1]);
      const people = members
        .map((member) => {
          const present = isAtHome(member.id, date, weeklyLunches, overrides);
          return `
            <button class="avatar-button" aria-pressed="${present}"
              aria-label="${escapeHtml(member.display_name)}, ${date}"
              data-action="toggle-lunch" data-member="${escapeHtml(member.id)}" data-date="${date}">
              ${avatar(member, { size: 'sm', present })}
            </button>`;
        })
        .join('');
      return `
        <li class="day ${date === today ? 'day--today' : ''}">
          <span class="day__date">
            <small>${date === today ? 'Avui' : WEEKDAY_SHORT[index]}</small>
            <b>${Number(date.slice(8))}</b>
          </span>
          <span class="day__main">
            ${together ? '<strong class="together">Tots junts</strong>' : ''}
            <span>${dish}</span>
          </span>
          <span class="day__people">${people}</span>
        </li>`;
    })
    .join('');

  return shell(
    'setmana',
    `
    <header class="header">
      <div>
        <h1>Setmana</h1>
        <p>Toca una persona per fer un canvi puntual</p>
      </div>
    </header>
    <section class="card" aria-label="Qui dina a casa">
      <h2 class="card__title">Qui dina a casa</h2>
      <ol class="days">${rows}</ol>
    </section>`,
    { banner: DEMO_BANNER },
  );
}

export function homeScreen(state) {
  const byId = Object.fromEntries(state.members.map((member) => [member.id, member]));
  const toBuy = state.shopping.filter((item) => item.onList);

  const products = state.shopping
    .map(
      (item) => `
        <button class="product ${item.onList ? 'product--on' : ''}" aria-pressed="${item.onList}"
          data-action="toggle-product" data-id="${escapeHtml(item.id)}">
          ${escapeHtml(item.name)}
        </button>`,
    )
    .join('');

  const tasks = state.tasks
    .map(
      (task) => `
        <li class="row">
          <button class="check ${task.done ? 'check--done' : ''}" aria-pressed="${task.done}"
            aria-label="${task.done ? 'Desmarca' : 'Marca com a feta'}: ${escapeHtml(task.title)}"
            data-action="toggle-task" data-id="${escapeHtml(task.id)}">
            <span>${task.done ? icon(ICONS.check, 16) : ''}</span>
          </button>
          <span class="row__main ${task.done ? 'row__main--done' : ''}">${escapeHtml(task.title)}</span>
          ${avatar(byId[task.memberId], { size: 'sm' })}
        </li>`,
    )
    .join('');

  return shell(
    'casa',
    `
    <header class="header">
      <div>
        <h1>Casa</h1>
        <p>Compra i tasques</p>
      </div>
    </header>

    <section class="card" aria-label="Compra">
      <div class="card__heading">
        <h2 class="card__title">S'ha acabat?</h2>
        <small>${toBuy.length} a la llista</small>
      </div>
      <div class="products">${products}</div>
      <button class="primary" data-action="share-list">
        ${icon(ICONS.share, 20)} Comparteix al grup de WhatsApp
      </button>
    </section>

    <section class="card" aria-label="Tasques">
      <h2 class="card__title">Tasques</h2>
      <ul class="list">${tasks}</ul>
    </section>`,
    { banner: DEMO_BANNER },
  );
}

/** Pantalla d'un membre real mentre les funcions de la fase 2 no estan fetes. */
export function memberHome({ members, me, today }) {
  const { weekday, day } = formatToday(today);
  return `
    <div class="screen">
      <main class="content">
        <header class="header">
          <div>
            <h1>${escapeHtml(weekday)}</h1>
            <p>${escapeHtml(day)}</p>
          </div>
          <div class="avatars" aria-label="Membres de la família">
            ${members.map((member) => avatar(member)).join('')}
          </div>
        </header>
        <section class="card card--message">
          <h2>Hola, ${escapeHtml(me.display_name)}</h2>
          <p>La sessió funciona. Les pantalles amb dades reals arribaran a la fase 2.</p>
          <button class="secondary" data-action="sign-out">Tanca la sessió</button>
        </section>
      </main>
    </div>`;
}

export function signInScreen() {
  return `
    <div class="center">
      <h1>Family</h1>
      <p>Entra una vegada amb el teu compte de Google. Aquest mòbil te'n recordarà.</p>
      <button class="primary" data-action="sign-in">Entra amb Google</button>
    </div>`;
}

export function notMemberScreen(email) {
  return `
    <div class="center">
      <h1>Sense accés</h1>
      <p>El compte ${escapeHtml(email ?? '')} no forma part de la família.</p>
      <button class="secondary" data-action="sign-out">Canvia de compte</button>
    </div>`;
}

export function errorScreen(message) {
  return `
    <div class="center">
      <h1>No s'ha pogut carregar</h1>
      <p>${escapeHtml(message)}</p>
      <button class="primary" data-action="reload">Torna-ho a provar</button>
    </div>`;
}

/** Text que s'enviarà al grup de WhatsApp. */
export function shoppingMessage(items) {
  const names = items.filter((item) => item.onList).map((item) => `- ${item.name}`);
  return ['Llista de la compra:', ...names].join('\n');
}
