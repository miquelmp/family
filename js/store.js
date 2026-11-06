// Accés a les dades. La demostració i Supabase ofereixen les mateixes operacions,
// així les pantalles no han de saber d'on venen les dades.
import { demoData } from './demo.js';
import { findProduct } from './household.js';

const now = () => new Date().toISOString();

export function createDemoStore(today) {
  const data = demoData(today);
  let nextId = 1;
  const newId = () => `nou-${nextId++}`;

  return {
    load: async () => structuredClone(data),
    subscribe: () => () => {},

    async setOverride(member_id, lunch_date, at_home) {
      data.overrides = data.overrides.filter(
        (row) => !(row.member_id === member_id && row.lunch_date === lunch_date),
      );
      data.overrides.push({ member_id, lunch_date, at_home });
    },

    async setWeekly(member_id, weekday, valid_from, at_home) {
      data.weeklyLunches = data.weeklyLunches.filter(
        (row) =>
          !(row.member_id === member_id && row.weekday === weekday && row.valid_from === valid_from),
      );
      data.weeklyLunches.push({ member_id, weekday, valid_from, at_home });
    },

    async setMenu(lunch_date, dish) {
      data.menus = data.menus.filter((row) => row.lunch_date !== lunch_date);
      if (dish) data.menus.push({ lunch_date, dish });
    },

    async markRead(ids) {
      for (const item of data.inbox) {
        if (ids.includes(item.id)) item.read_at = now();
      }
    },

    async setAssignee(event_uid, member_id, assigned) {
      data.assignees = data.assignees.filter(
        (row) => !(row.event_uid === event_uid && row.member_id === member_id),
      );
      if (assigned) data.assignees.push({ event_uid, member_id });
    },

    async addProduct(name) {
      const existing = findProduct(data.shopping, name);
      if (existing) existing.on_list = true;
      else data.shopping.push({ id: newId(), name, is_usual: false, on_list: true });
    },

    async setOnList(id, on_list) {
      data.shopping.find((item) => item.id === id).on_list = on_list;
    },

    async markBought(id) {
      const item = data.shopping.find((entry) => entry.id === id);
      if (item.is_usual) item.on_list = false;
      else data.shopping = data.shopping.filter((entry) => entry.id !== id);
    },

    async addTask(task) {
      data.tasks.push({ id: newId(), done_at: null, ...task });
    },

    async setTaskDone(id, done) {
      data.tasks.find((task) => task.id === id).done_at = done ? now() : null;
    },

    savePush: async () => {},
    removePush: async () => {},
  };
}

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export function createSupabaseStore(client) {
  const table = (name) => client.from(name);

  return {
    async load() {
      const [members, weeklyLunches, overrides, menus, agenda, assignees, shopping, tasks, settings, inbox] = await Promise.all([
        table('members').select('id, email, display_name, short_label, color, sort_order').order('sort_order'),
        table('weekly_lunches').select('*').order('valid_from'),
        table('lunch_overrides').select('*').order('lunch_date'),
        table('menus').select('*').order('lunch_date'),
        table('agenda_events').select('*').order('starts_at'),
        table('event_assignees').select('*').order('event_uid'),
        table('shopping_items').select('*').order('name'),
        table('tasks').select('*').order('created_at'),
        table('settings').select('*').order('key'),
        table('reminder_inbox').select('*').order('created_at'),
      ]);
      return {
        members: check(members),
        weeklyLunches: check(weeklyLunches),
        overrides: check(overrides),
        menus: check(menus),
        agenda: check(agenda),
        assignees: check(assignees),
        shopping: check(shopping),
        tasks: check(tasks),
        // La configuració és opcional: sense ella, l'app funciona igualment.
        settings: settings.error ? [] : settings.data,
        inbox: inbox.error ? [] : inbox.data,
      };
    },

    /** Avisa quan una altra persona canvia alguna cosa. */
    subscribe(onChange) {
      const channel = client
        .channel('family-changes')
        .on('postgres_changes', { event: '*', schema: 'family' }, onChange)
        .subscribe();
      return () => client.removeChannel(channel);
    },

    async setOverride(member_id, lunch_date, at_home) {
      check(await table('lunch_overrides').upsert({ member_id, lunch_date, at_home }));
    },

    async setWeekly(member_id, weekday, valid_from, at_home) {
      check(await table('weekly_lunches').upsert({ member_id, weekday, valid_from, at_home }));
    },

    async setMenu(lunch_date, dish) {
      check(
        dish
          ? await table('menus').upsert({ lunch_date, dish })
          : await table('menus').delete().eq('lunch_date', lunch_date),
      );
    },

    async markRead(ids) {
      check(
        await table('reminder_inbox').update({ read_at: now() }).in('id', ids),
      );
    },

    async setAssignee(event_uid, member_id, assigned) {
      check(
        assigned
          ? await table('event_assignees').upsert({ event_uid, member_id })
          : await table('event_assignees')
              .delete()
              .eq('event_uid', event_uid)
              .eq('member_id', member_id),
      );
    },

    async addProduct(name, items) {
      const existing = findProduct(items, name);
      if (existing) return this.setOnList(existing.id, true);

      const { error } = await table('shopping_items').insert({
        name,
        is_usual: false,
        on_list: true,
      });
      if (!error) return undefined;
      // Una altra persona l'acaba d'afegir: n'hi ha prou que sigui a la llista.
      if (error.code !== '23505') throw error;
      const { shopping } = await this.load();
      return this.setOnList(findProduct(shopping, name).id, true);
    },

    async setOnList(id, on_list) {
      check(
        await table('shopping_items').update({ on_list, updated_at: now() }).eq('id', id),
      );
    },

    async markBought(id, items) {
      const item = items.find((entry) => entry.id === id);
      if (item.is_usual) return this.setOnList(id, false);
      check(await table('shopping_items').delete().eq('id', id));
      return undefined;
    },

    async addTask(task) {
      check(await table('tasks').insert(task));
    },

    async setTaskDone(id, done) {
      check(await table('tasks').update({ done_at: done ? now() : null }).eq('id', id));
    },

    async savePush(row) {
      check(await table('push_subscriptions').upsert(row));
    },

    async removePush(endpoint) {
      check(await table('push_subscriptions').delete().eq('endpoint', endpoint));
    },
  };
}
