// Pantalles de l'app. Cada funció retorna HTML; els textos variables passen per escapeHtml.
import {
  eventDate,
  eventTime,
  eventsOn,
  newEventLink,
  nextEvent,
  pendingTasks,
  toBuy,
  usualByCategory,
  visibleTasks,
} from './household.js';
import { addDays, allTogether, isAtHome, isoWeekday, weekDates } from './lunch.js';
import { APP_VERSION } from './version.js';

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
  cloud: '<path d="M7 19h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 10.5 4.3 4.3 0 0 0 7 19z"></path>',
  sun: '<circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M5 19l1.8-1.8M17.2 6.8L19 5"></path>',
  partly: '<circle cx="8.5" cy="8.5" r="3.5"></circle><path d="M8.5 2v1.5M2 8.5h1.5M3.8 3.8l1 1M13.2 3.8l-1 1"></path><path d="M9 20h8.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.5-.6A3.8 3.8 0 0 0 9 20z"></path>',
  fog: '<path d="M7 13h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 6 3.5 3.5 0 0 0 7 13z"></path><path d="M4 17h16M7 21h10"></path>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5 4.3 4.3 0 0 0 7 15z"></path><path d="M8 18l-1 3M13 18l-1 3M18 18l-1 3"></path>',
  snow: '<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14z"></path><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"></path>',
  storm: '<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14z"></path><path d="M13 13l-3 5h4l-3 4"></path>',
};

const weatherIcon = (kind, size) => icon(ICONS[kind] ?? ICONS.cloud, size);

const TABS = [
  { id: 'avui', label: 'Avui' },
  { id: 'setmana', label: 'Setmana' },
  { id: 'casa', label: 'Casa' },
];

const WEEKDAYS = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];

const formatDate = (isoDate, options) =>
  new Intl.DateTimeFormat('ca', { ...options, timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );

const shortDate = (isoDate) => formatDate(isoDate, { day: 'numeric', month: 'short' });

function avatar(member, { size = 'md', present = true } = {}) {
  const label = escapeHtml(member.short_label);
  const name = escapeHtml(member.display_name);
  if (!present) {
    return `<span class="avatar avatar--${size} avatar--away" title="${name} no hi és">${label}</span>`;
  }
  return `<span class="avatar avatar--${size}" style="background:${escapeHtml(member.color)}" title="${name}">${label}</span>`;
}

const dishOn = (state, date) =>
  state.menus.find((row) => row.lunch_date === date)?.dish ?? '';

function shell(state, activeTab, content) {
  const tabs = TABS.map(
    (tab) => `
      <a class="tab" href="#${tab.id}" ${tab.id === activeTab ? 'aria-current="page"' : ''}>
        ${icon(ICONS[tab.id])}${tab.label}
      </a>`,
  ).join('');
  const banner = state.offline
    ? '<p class="banner banner--offline" role="status">Sense connexió. Veus les últimes dades desades i no pots fer canvis.</p>'
    : state.demo
      ? '<p class="banner">Mode demostració: dades inventades que no es desen.</p>'
      : '';
  const notice = state.notice ? `<p class="notice" role="status">${escapeHtml(state.notice)}</p>` : '';
  return `
    <div class="screen">
      ${banner}
      <main class="content">${content}</main>
      ${notice}
      <nav class="tabs" aria-label="Navegació">${tabs}</nav>
    </div>
    ${sheet(state)}`;
}

function assigneeButtons(state, uid) {
  return state.members
    .map((member) => {
      const assigned = state.assignees.some(
        (row) => row.event_uid === uid && row.member_id === member.id,
      );
      return `
        <button class="avatar-button" aria-pressed="${assigned}"
          aria-label="${assigned ? 'Treu' : 'Assigna'}: ${escapeHtml(member.display_name)} (${escapeHtml(member.short_label)})"
          data-action="toggle-assignee" data-event="${escapeHtml(uid)}"
          data-member="${escapeHtml(member.id)}" data-next="${!assigned}">
          ${avatar(member, { size: 'sm', present: assigned })}
        </button>`;
    })
    .join('');
}

const audience = (state, uid) =>
  state.assignees.some((row) => row.event_uid === uid)
    ? 'Avisa només les persones marcades'
    : 'Avisa tothom';

function weatherSheet({ weather }) {
  const rows = weather.days
    .map(
      (day, index) => `
        <li class="forecast">
          <span class="forecast__day">${index === 0 ? 'Avui' : escapeHtml(formatDate(day.date, { weekday: 'short', day: 'numeric' }))}</span>
          <span class="forecast__icon">${weatherIcon(day.kind, 26)}</span>
          <span class="forecast__label">${escapeHtml(day.label)}<small>Pluja ${day.rain}%</small></span>
          <span class="forecast__range">${day.max}° / ${day.min}°</span>
        </li>`,
    )
    .join('');
  return `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Previsió">
      <div class="sheet__panel">
        <h2>${escapeHtml(weather.place || 'Previsió')}</h2>
        <ul class="list">${rows}</ul>
        <a class="source" href="https://open-meteo.com">Weather data by Open-Meteo.com</a>
        <button class="primary" data-action="close-sheet">Tanca</button>
      </div>
    </div>`;
}

function sheet(state) {
  if (!state.sheet) return '';
  if (state.sheet.type === 'weather') return weatherSheet(state);
  if (state.sheet.type === 'event') {
    const event = state.agenda.find((entry) => entry.uid === state.sheet.uid);
    if (!event) return '';
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Assigna la cita">
        <div class="sheet__panel">
          <h2>${escapeHtml(event.title)}</h2>
          <p class="hint">${escapeHtml(shortDate(eventDate(event)))} · ${escapeHtml(eventTime(event))}</p>
          <div class="assignees">${assigneeButtons(state, event.uid)}</div>
          <p class="hint">${audience(state, event.uid)}</p>
          <button class="primary" data-action="close-sheet">Fet</button>
        </div>
      </div>`;
  }
  if (state.sheet.type === 'menu') {
    const { date } = state.sheet;
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Menú del dia">
        <form class="sheet__panel" data-form="menu" data-date="${date}">
          <h2>Menú del ${escapeHtml(shortDate(date))}</h2>
          <label class="field">Plat
            <input name="dish" value="${escapeHtml(dishOn(state, date))}" maxlength="80" autocomplete="off">
          </label>
          <div class="sheet__actions">
            <button type="button" class="secondary" data-action="close-sheet">Cancel·la</button>
            <button class="primary">Desa</button>
          </div>
        </form>
      </div>`;
  }
  const options = state.members
    .map(
      (member) =>
        `<option value="${escapeHtml(member.id)}">${escapeHtml(member.display_name)} (${escapeHtml(member.short_label)})</option>`,
    )
    .join('');
  return `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Nova tasca">
      <form class="sheet__panel" data-form="task">
        <h2>Nova tasca</h2>
        <label class="field">Què cal fer?
          <input name="title" required maxlength="120" autocomplete="off">
        </label>
        <label class="field">Responsable
          <select name="assignee">${options}</select>
        </label>
        <label class="field">Data (opcional)
          <input name="due" type="date">
        </label>
        <div class="sheet__actions">
          <button type="button" class="secondary" data-action="close-sheet">Cancel·la</button>
          <button class="primary">Afegeix</button>
        </div>
      </form>
    </div>`;
}

function weatherCard(state) {
  const { weather } = state;
  const source = '<a href="https://open-meteo.com">Weather data by Open-Meteo.com</a>';
  if (!weather) {
    return `
      <section class="card card--weather" aria-label="Meteo">
        <p>Mostra el temps d'on ets, segons la ubicació del mòbil.</p>
        <button class="secondary secondary--light" data-action="enable-weather">Activa la meteo</button>
        <div class="weather__foot">${source}</div>
      </section>`;
  }
  if (weather.failed) {
    return `
      <section class="card card--weather" aria-label="Meteo">
        <p>${escapeHtml(weather.failed)}</p>
        <button class="secondary secondary--light" data-action="enable-weather">Torna-ho a provar</button>
        <div class="weather__foot">${source}</div>
      </section>`;
  }
  return `
    <section class="card card--weather" aria-label="Meteo">
      <button class="weather__open" data-action="open-weather" aria-label="Veure la previsió">
      ${weather.place ? `<span class="weather__place">${escapeHtml(weather.place)}</span>` : ''}
      <div class="weather__top">
        <div class="weather__now">
          ${weatherIcon(weather.kind, 42)}
          <div>
            <b>${weather.temperature}°</b>
            <span>${escapeHtml(weather.label)}</span>
          </div>
        </div>
        <span class="weather__range">Màx. ${weather.max}°<br>Mín. ${weather.min}°</span>
      </div>
      </button>
      <div class="weather__foot">
        <span>${weather.rainAt ? `Pluja cap a les ${escapeHtml(weather.rainAt)}` : 'Sense pluja prevista'}</span>
        ${source}
      </div>
    </section>`;
}

function lunchSummary(count, total) {
  if (count === 0) return 'Ningú a taula';
  if (count === total) return 'Tots junts';
  return count === 1 ? 'Una persona a taula' : `${count} persones a taula`;
}

function lunchButtons(state, date) {
  return state.members
    .map((member) => {
      const atHome = isAtHome(member.id, date, state.weeklyLunches, state.overrides);
      const style = atHome ? `style="background:${escapeHtml(member.color)}"` : '';
      return `
        <button class="lunch-toggle ${atHome ? '' : 'lunch-toggle--away'}" ${style}
          aria-pressed="${atHome}" data-action="toggle-lunch"
          data-member="${escapeHtml(member.id)}" data-date="${date}" data-next="${!atHome}">
          ${escapeHtml(member.display_name)}
        </button>`;
    })
    .join('');
}

function agendaRows(state, events) {
  return events
    .map(
      (event) => `
        <li class="row row--event">
          <span class="row__time ${event.all_day ? 'row__time--wide' : ''}">${escapeHtml(eventTime(event))}</span>
          <span class="row__main">
            <strong>${escapeHtml(event.title)}</strong>
            <small>${audience(state, event.uid)}</small>
          </span>
          <span class="assignees">${assigneeButtons(state, event.uid)}</span>
        </li>`,
    )
    .join('');
}

export function todayScreen(state) {
  const { today, members, weeklyLunches, overrides, agenda } = state;
  const atHomeCount = members.filter((member) =>
    isAtHome(member.id, today, weeklyLunches, overrides),
  ).length;
  const weekday = formatDate(today, { weekday: 'long' });
  const events = eventsOn(agenda, today);
  const dish = dishOn(state, today);

  return shell(
    state,
    'avui',
    `
    <header class="header">
      <div>
        <h1>${escapeHtml(weekday[0].toUpperCase() + weekday.slice(1))}</h1>
        <p>${escapeHtml(formatDate(today, { day: 'numeric', month: 'long' }))}</p>
      </div>
      <div class="avatars" aria-label="Membres de la família">
        ${members.map((member) => avatar(member)).join('')}
      </div>
    </header>

    ${weatherCard(state)}

    <section class="card card--lunch" aria-label="Dinar d'avui">
      <div class="card__top">
        <div>
          <p class="eyebrow">Dinar d'avui</p>
          <h2>${lunchSummary(atHomeCount, members.length)}</h2>
        </div>
        <button class="dish" data-action="edit-menu" data-date="${today}">
          ${escapeHtml(dish || 'Afegeix el menú')}
        </button>
      </div>
      <div class="lunch-grid">${lunchButtons(state, today)}</div>
    </section>

    <section class="card" aria-label="Agenda d'avui">
      <h2 class="card__title">Agenda d'avui</h2>
      ${events.length ? `<ul class="list">${agendaRows(state, events)}</ul>` : '<p class="empty">Avui no hi ha res a l\'agenda.</p>'}
    </section>

    <div class="tiles">
      <a class="tile tile--blue" href="#casa">
        <b>${toBuy(state.shopping).length}</b><span>A la compra</span>
      </a>
      <a class="tile tile--lilac" href="#casa">
        <b>${pendingTasks(state.tasks).length}</b><span>Tasques pendents</span>
      </a>
    </div>`,
  );
}

function nextEventCard(state) {
  const event = nextEvent(state.agenda, state.now);
  const date = event && eventDate(event);
  return `
    <section class="card card--next" aria-label="Pròxima cita familiar">
      ${
        event
          ? `<div>
              <small>Pròxima cita familiar</small>
              <strong>${escapeHtml(event.title)}</strong>
              <small>${escapeHtml(shortDate(date))} · ${escapeHtml(eventTime(event))}</small>
            </div>`
          : '<div><small>Pròxima cita familiar</small><strong>Cap cita prevista</strong></div>'
      }
      <a class="link-button" href="${newEventLink(state.today)}" target="_blank" rel="noopener">Nova cita</a>
    </section>`;
}

export function weekScreen(state) {
  const { today, members, weeklyLunches, overrides, weekOffset } = state;
  const anchor = addDays(today, weekOffset * 7);
  const dates = weekDates(anchor);
  const memberIds = members.map((member) => member.id);

  const rows = dates
    .map((date, index) => {
      const together = allTogether(memberIds, date, weeklyLunches, overrides);
      const dish = dishOn(state, date);
      const events = eventsOn(state.agenda, date);
      const people = members
        .map((member) => {
          const present = isAtHome(member.id, date, weeklyLunches, overrides);
          return `
            <button class="avatar-button" aria-pressed="${present}"
              aria-label="${escapeHtml(member.display_name)} (${escapeHtml(member.short_label)}), ${date}"
              data-action="toggle-lunch" data-member="${escapeHtml(member.id)}"
              data-date="${date}" data-next="${!present}">
              ${avatar(member, { size: 'sm', present })}
            </button>`;
        })
        .join('');
      return `
        <li class="day ${date === today ? 'day--today' : ''}">
          <span class="day__date">
            <small>${date === today ? 'Avui' : WEEKDAYS[index]}</small>
            <b>${Number(date.slice(8))}</b>
          </span>
          <span class="day__main">
            ${together ? '<strong class="together">Tots junts</strong>' : ''}
            <button class="dish-link" data-action="edit-menu" data-date="${date}">
              ${escapeHtml(dish || 'Afegeix menú')}
            </button>
            ${events
              .map(
                (event) => `
                  <button class="event-link" data-action="open-event" data-event="${escapeHtml(event.uid)}">
                    ${escapeHtml(eventTime(event))} ${escapeHtml(event.title)}
                  </button>`,
              )
              .join('')}
          </span>
          <span class="day__people">${people}</span>
        </li>`;
    })
    .join('');

  return shell(
    state,
    'setmana',
    `
    <header class="header">
      <div>
        <h1>Setmana</h1>
        <p>Del ${escapeHtml(shortDate(dates[0]))} al ${escapeHtml(shortDate(dates[6]))}</p>
      </div>
      <a class="link-button link-button--light" href="#horari">Setmana tipus</a>
    </header>
    <section class="card" aria-label="Qui dina a casa">
      <div class="card__heading">
        <h2 class="card__title">Qui dina a casa</h2>
        <div class="pager">
          <button aria-label="Setmana anterior" data-action="change-week" data-delta="-1"
            ${weekOffset === 0 ? 'disabled' : ''}>&lsaquo;</button>
          <button aria-label="Setmana següent" data-action="change-week" data-delta="1">&rsaquo;</button>
        </div>
      </div>
      <p class="hint">Toca una persona per a un canvi puntual.</p>
      <ol class="days">${rows}</ol>
    </section>
    ${nextEventCard(state)}`,
  );
}

export function scheduleScreen(state) {
  const { today, members, weeklyLunches } = state;
  const header = WEEKDAYS.map((day) => `<span class="grid__head">${day}</span>`).join('');
  const rows = members
    .map((member) => {
      const cells = WEEKDAYS.map((day, index) => {
        const weekday = index + 1;
        const date = addDays(today, ((weekday - isoWeekday(today)) + 7) % 7);
        const atHome = isAtHome(member.id, date, weeklyLunches, []);
        const style = atHome ? `style="background:${escapeHtml(member.color)}"` : '';
        return `
          <button class="grid__cell ${atHome ? '' : 'grid__cell--away'}" ${style}
            aria-pressed="${atHome}" aria-label="${escapeHtml(member.display_name)}, ${day}"
            data-action="toggle-weekly" data-member="${escapeHtml(member.id)}"
            data-weekday="${weekday}" data-next="${!atHome}">
            ${atHome ? icon(ICONS.check, 16) : ''}
          </button>`;
      }).join('');
      return `<span class="grid__name">${avatar(member, { size: 'sm' })}</span>${cells}`;
    })
    .join('');

  return shell(
    state,
    'setmana',
    `
    <header class="header">
      <div>
        <h1>Setmana tipus</h1>
        <p>Els canvis s'apliquen des d'avui.</p>
      </div>
    </header>
    <section class="card" aria-label="Setmana tipus">
      <div class="grid">
        <span></span>${header}
        ${rows}
      </div>
      <p class="hint">Els dies passats i els canvis puntuals no varien.</p>
    </section>
    <a class="link-button link-button--light" href="#setmana">Torna a Setmana</a>`,
  );
}

const SMARTTHINGS_ANDROID =
  'intent://#Intent;package=com.samsung.android.oneconnect;'
  + 'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.samsung.android.oneconnect;end';
const SMARTTHINGS_IOS = 'https://apps.apple.com/app/id1222822904';

/** A Android obre l'app; a l'iPhone porta a la seva fitxa, que té el botó d'obrir. */
export const smartThingsLink = (userAgent) =>
  /iPhone|iPad|iPod/.test(userAgent) ? SMARTTHINGS_IOS : SMARTTHINGS_ANDROID;

function pushCard(state) {
  const messages = {
    on: {
      text: 'Reps avisos en aquest mòbil.',
      button: '<button class="secondary" data-action="disable-push">Desactiva els avisos</button>',
    },
    off: {
      text: 'Cites i tasques: a les 8 h les del dia, i a les 20 h les de demà.',
      button: '<button class="primary" data-action="enable-push">Activa els avisos</button>',
    },
    blocked: { text: 'Els avisos estan bloquejats a la configuració del mòbil.' },
    unsupported: {
      text: 'Aquest mòbil no admet avisos. A l\'iPhone, primer afegeix l\'app a la pantalla d\'inici.',
    },
  };
  const message = messages[state.push];
  if (!message) return '';
  return `
    <section class="card card--stack" aria-label="Avisos">
      <h2 class="card__title">Avisos</h2>
      <p>${escapeHtml(message.text)}</p>
      ${message.button ?? ''}
    </section>`;
}

export function homeScreen(state) {
  const byId = Object.fromEntries(state.members.map((member) => [member.id, member]));
  const list = toBuy(state.shopping);

  const listRows = list
    .map(
      (item) => `
        <li class="row">
          <button class="check" aria-label="Comprat: ${escapeHtml(item.name)}"
            data-action="mark-bought" data-id="${escapeHtml(item.id)}"><span></span></button>
          <span class="row__main">${escapeHtml(item.name)}</span>
        </li>`,
    )
    .join('');

  const groups = usualByCategory(state.shopping)
    .map(
      ({ category, products }) => `
        <h3 class="group">${escapeHtml(category)}</h3>
        <div class="products">
          ${products
            .map(
              (item) => `
                <button class="product ${item.on_list ? 'product--on' : ''}" aria-pressed="${item.on_list}"
                  data-action="toggle-product" data-id="${escapeHtml(item.id)}" data-next="${!item.on_list}">
                  ${escapeHtml(item.name)}
                </button>`,
            )
            .join('')}
        </div>`,
    )
    .join('');

  const tasks = visibleTasks(state.tasks, state.now)
    .map((task) => {
      const done = Boolean(task.done_at);
      const assignee = byId[task.assignee_id];
      return `
        <li class="row">
          <button class="check ${done ? 'check--done' : ''}" aria-pressed="${done}"
            aria-label="${done ? 'Desmarca' : 'Marca com a feta'}: ${escapeHtml(task.title)}"
            data-action="toggle-task" data-id="${escapeHtml(task.id)}" data-next="${!done}">
            <span>${done ? icon(ICONS.check, 16) : ''}</span>
          </button>
          <span class="row__main ${done ? 'row__main--done' : ''}">
            ${escapeHtml(task.title)}
            ${task.due_date ? `<small>${escapeHtml(shortDate(task.due_date))}</small>` : ''}
          </span>
          ${assignee ? avatar(assignee, { size: 'sm' }) : ''}
        </li>`;
    })
    .join('');

  return shell(
    state,
    'casa',
    `
    <header class="header">
      <div>
        <h1>Casa</h1>
        <p>Compra i tasques</p>
      </div>
    </header>

    <section class="card" aria-label="Llista de la compra">
      <div class="card__heading">
        <h2 class="card__title">A la llista</h2>
        <small>${list.length} ${list.length === 1 ? 'producte' : 'productes'}</small>
      </div>
      ${list.length ? `<ul class="list">${listRows}</ul>` : '<p class="empty">No falta res.</p>'}
      <form class="add" data-form="product">
        <label class="visually-hidden" for="new-product">Producte nou</label>
        <input id="new-product" name="name" placeholder="Afegeix un producte" maxlength="60" required autocomplete="off">
        <button class="secondary">Afegeix</button>
      </form>
      ${
        state.settings.some((row) => row.key === 'whatsapp_group_url')
          ? `<button class="primary" data-action="share-group" ${list.length ? '' : 'disabled'}>
              ${icon(ICONS.share, 20)} Copia la llista i obre el grup
            </button>
            <button class="text-button" data-action="share-list" ${list.length ? '' : 'disabled'}>Comparteix amb una altra persona</button>`
          : `<button class="primary" data-action="share-list" ${list.length ? '' : 'disabled'}>
              ${icon(ICONS.share, 20)} Comparteix a WhatsApp
            </button>`
      }
    </section>

    <section class="card" aria-label="Productes habituals">
      <h2 class="card__title">S'ha acabat?</h2>
      ${groups}
    </section>

    <section class="card" aria-label="Tasques">
      <div class="card__heading">
        <h2 class="card__title">Tasques</h2>
        <button class="link-button" data-action="new-task">Nova tasca</button>
      </div>
      ${tasks ? `<ul class="list">${tasks}</ul>` : '<p class="empty">No hi ha tasques pendents.</p>'}
    </section>

    <section class="card card--stack" aria-label="Electrodomèstics">
      <h2 class="card__title">Electrodomèstics</h2>
      <a class="link-button" href="${smartThingsLink(state.userAgent)}">Obre SmartThings</a>
    </section>

    ${pushCard(state)}

    <button class="secondary" data-action="export-data">Exporta les dades</button>
    ${state.demo ? '' : '<button class="text-button" data-action="sign-out">Tanca la sessió</button>'}
    <p class="version">Versió ${APP_VERSION}</p>`,
  );
}

export function signInScreen() {
  return `
    <div class="center">
      <h1>Family</h1>
      <p>Entra amb el teu compte de Google.</p>
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
