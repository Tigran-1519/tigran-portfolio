(() => {
  'use strict';
  const KEY = 'tigran.briefdesk.v1';
  const STATUSES = { new: 'Новая', progress: 'В работе', done: 'Готово' };
  const $ = (id) => document.getElementById(id);
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const shiftedDate = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return localDate(date); };
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return parts[0] >= 2000 && parts[0] <= 2200 && localDate(date) === value;
  };
  const seed = () => {
    const now = new Date().toISOString();
    return [
      ['demo-room', 'Собрать заявку на мебель', 'ROOM / концепт', 'Тип изделия, размеры и предпочтения. На последнем шаге — понятная сводка для менеджера.', 'new', 'high', 2],
      ['demo-moss', 'Обновить расписание мастерской', 'MOSS / концепт', 'Добавить два занятия и проверить, как длинное название выглядит на телефоне.', 'new', 'normal', 5],
      ['demo-paper', 'Уточнить поля формы', 'PAPER / концепт', 'Оставить только необходимые вводные. Добавить подсказку к полю с размерами.', 'new', 'normal', -1],
      ['demo-lead', 'Проверить сценарий LeadBot', 'LEADBOT / демо', 'Пройти диалог, изменить контакт и вернуться на предыдущий шаг без потери остальных ответов.', 'progress', 'high', 1],
      ['demo-folio', 'Адаптировать карточки проектов', 'ПОРТФОЛИО / демо', 'Проверить сетку на 390 и 768 px, состояние фокуса и контраст подписи.', 'progress', 'normal', 3],
      ['demo-slot', 'Подготовить календарь записи', 'SLOTLY / демо', 'Показать доступные и занятые демонстрационные интервалы. Сохранение только на устройстве.', 'done', 'normal', 0]
    ].map(([id, title, client, note, status, priority, offset], index) => ({ id, title, client, note, status, priority, due: shiftedDate(offset), updatedAt: new Date(Date.parse(now) - index * 60000).toISOString() }));
  };
  const validate = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 || !Array.isArray(data.tasks) || data.tasks.length > 200) throw new Error('Нужен файл BriefDesk версии 1, не более 200 заявок.');
    const ids = new Set();
    return data.tasks.map((item, index) => {
      const bad = () => { throw new Error(`Проверьте поля заявки ${index + 1}. Файл не импортирован.`); };
      if (!item || typeof item !== 'object' || Array.isArray(item)) bad();
      if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) bad();
      for (const [key, max, required] of [['title', 100, true], ['client', 70, true], ['note', 1200, false]]) {
        if (typeof item[key] !== 'string' || item[key].length > max || (required && !item[key].trim())) bad();
      }
      if (!Object.hasOwn(STATUSES, item.status) || !['normal', 'high'].includes(item.priority)) bad();
      if (typeof item.due !== 'string' || (item.due && !validDate(item.due))) bad();
      if (typeof item.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.updatedAt) || !Number.isFinite(Date.parse(item.updatedAt)) || item.updatedAt.length > 30) bad();
      ids.add(item.id);
      return { id: item.id, title: item.title.trim(), client: item.client.trim(), note: item.note, status: item.status, priority: item.priority, due: item.due, updatedAt: new Date(item.updatedAt).toISOString() };
    });
  };
  let tasks = seed();
  let editingId = null;
  let confirmAction = null;
  let storageFailed = false;
  let initialNotice = '';
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null && raw.length > 1048576) throw new Error('Stored data too large');
    if (raw !== null) tasks = validate(JSON.parse(raw));
  } catch (error) {
    storageFailed = true;
    initialNotice = 'Сохранённые данные недоступны или повреждены. Загружен пример; его можно экспортировать.';
  }
  const announce = (message) => { $('announcement').textContent = message; };
  const storageLabel = () => {
    $('storage-status').textContent = storageFailed ? 'Сохранение недоступно · можно экспортировать JSON' : 'Изменения сохраняются на этом устройстве';
    $('storage-status').classList.toggle('warning', storageFailed);
  };
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, tasks })); storageFailed = false; }
    catch (error) { storageFailed = true; announce('Не удалось сохранить в браузере. Изменения доступны до закрытия страницы; сохраните экспорт.'); }
    storageLabel();
  };
  const humanDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };
  const overdue = (task) => task.status !== 'done' && task.due && task.due < localDate(new Date());
  function render() {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === 'done').length;
    $('side-total').textContent = String(total);
    $('metric-total').textContent = String(total);
    $('metric-progress').textContent = String(tasks.filter((task) => task.status === 'progress').length);
    $('metric-done').textContent = String(done);
    $('metric-overdue').textContent = String(tasks.filter(overdue).length);
    const ratio = total ? Math.round(done / total * 100) : 0;
    $('done-bar').style.width = `${ratio}%`;
    $('done-ratio').textContent = `${ratio}% от общего числа`;
    const query = $('search').value.trim().toLocaleLowerCase('ru-RU');
    const filter = $('status-filter').value;
    const visible = tasks.filter((task) => (filter === 'all' || task.status === filter) && `${task.title} ${task.client} ${task.note}`.toLocaleLowerCase('ru-RU').includes(query));
    const order = $('sort-order').value;
    visible.sort((a, b) => order === 'title' ? a.title.localeCompare(b.title, 'ru') : order === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    $('result-count').textContent = `${visible.length} из ${total}`;
    $('board').replaceChildren();
    for (const [status, label] of Object.entries(STATUSES)) {
      if (filter !== 'all' && filter !== status) continue;
      const column = node('section', 'board-column');
      const heading = node('h3', 'column-heading');
      heading.append(node('span', `status-dot ${status}`), node('span', '', label));
      const list = visible.filter((task) => task.status === status);
      heading.append(node('span', 'column-count', String(list.length)));
      column.append(heading);
      const cards = node('div', 'task-list');
      if (!list.length) cards.append(node('p', 'column-empty', 'Пока нет заявок в этом статусе'));
      for (const task of list) cards.append(taskCard(task));
      column.append(cards); $('board').append(column);
    }
    $('board').style.gridTemplateColumns = filter === 'all' ? '' : 'minmax(0, 1fr)';
    $('board-empty').hidden = visible.length > 0;
  }
  function taskCard(task) {
    const card = node('article', 'task-card');
    const top = node('div', 'card-top');
    top.append(node('span', 'client-name', task.client));
    if (task.priority === 'high') top.append(node('span', 'priority', 'Высокий'));
    card.append(top, node('h4', 'task-title', task.title));
    if (task.note) card.append(node('p', 'task-note', task.note));
    const bottom = node('div', 'card-bottom');
    bottom.append(node('span', `due-label${overdue(task) ? ' overdue' : ''}`, task.due ? `${overdue(task) ? 'Срок прошёл · ' : 'До '}${humanDate(task.due)}` : 'Без срока'));
    const edit = node('button', 'edit-button', 'Открыть ↗');
    edit.type = 'button'; edit.setAttribute('aria-label', `Открыть заявку: ${task.title}`); edit.addEventListener('click', () => openEditor(task.id));
    bottom.append(edit); card.append(bottom);
    const select = node('select', 'quick-status');
    select.dataset.taskId = task.id;
    select.setAttribute('aria-label', `Статус заявки: ${task.title}`);
    for (const [value, label] of Object.entries(STATUSES)) { const option = node('option', '', label); option.value = value; select.append(option); }
    select.value = task.status;
    select.addEventListener('change', () => { const next = select.value; task.status = next; task.updatedAt = new Date().toISOString(); persist(); render(); announce(`«${task.title}»: ${STATUSES[next]}.`); const current = Array.from(document.querySelectorAll('.quick-status')).find((element) => element.dataset.taskId === task.id); if (current) current.focus(); else $('status-filter').focus(); });
    card.append(select); return card;
  }
  function openEditor(id = null) {
    editingId = id;
    const task = id ? tasks.find((item) => item.id === id) : null;
    $('task-form').reset();
    $('editor-title').textContent = task ? 'Детали заявки' : 'Новая заявка';
    $('task-title').value = task?.title || '';
    $('task-client').value = task?.client || '';
    $('task-note').value = task?.note || '';
    $('task-status').value = task?.status || 'new';
    $('task-priority').value = task?.priority || 'normal';
    $('task-due').value = task?.due || '';
    $('delete-task').hidden = !task;
    $('form-error').textContent = '';
    $('editor').showModal();
    $('task-title').focus();
  }
  function ask(title, text, action) {
    $('confirm-title').textContent = title; $('confirm-text').textContent = text; confirmAction = action;
    $('confirm-dialog').showModal(); $('confirm-cancel').focus();
  }
  $('add-task').addEventListener('click', () => { if (tasks.length >= 200) { announce('В демо доступно до 200 заявок. Сначала удалите ненужную.'); return; } openEditor(); });
  $('all-nav').addEventListener('click', () => { $('search').value = ''; $('status-filter').value = 'all'; render(); $('search').focus(); });
  $('search').addEventListener('input', render);
  $('status-filter').addEventListener('change', render);
  $('sort-order').addEventListener('change', render);
  for (const id of ['close-editor', 'cancel-editor']) $(id).addEventListener('click', () => $('editor').close());
  $('task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('task-title').value.trim(); const client = $('task-client').value.trim(); const due = $('task-due').value;
    if (!title || !client || (due && !validDate(due))) { $('form-error').textContent = 'Введите название, проект и корректную дату от 2000 до 2200 года.'; return; }
    const task = { id: editingId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title, client, note: $('task-note').value.trim(), status: $('task-status').value, priority: $('task-priority').value, due, updatedAt: new Date().toISOString() };
    try { validate({ version: 1, tasks: [task] }); } catch (error) { $('form-error').textContent = error.message; return; }
    if (editingId) tasks = tasks.map((item) => item.id === editingId ? task : item); else tasks.unshift(task);
    persist(); render(); $('editor').close(); if (!storageFailed) announce('Заявка сохранена на этом устройстве.');
  });
  $('delete-task').addEventListener('click', () => {
    const id = editingId;
    ask('Удалить заявку?', 'Карточка исчезнет из локального списка. Остальные заявки останутся.', () => { tasks = tasks.filter((task) => task.id !== id); $('editor').close(); persist(); render(); if (!storageFailed) announce('Заявка удалена.'); });
  });
  $('confirm-cancel').addEventListener('click', () => { confirmAction = null; $('confirm-dialog').close(); });
  $('confirm-dialog').addEventListener('cancel', () => { confirmAction = null; });
  $('confirm-accept').addEventListener('click', () => { const action = confirmAction; confirmAction = null; $('confirm-dialog').close(); if (action) action(); });
  $('reset-tasks').addEventListener('click', () => ask('Вернуть демонстрационные заявки?', 'Ваш локальный список будет заменён шестью примерами. Для сохранения текущих данных сначала сделайте экспорт.', () => { tasks = seed(); $('search').value = ''; $('status-filter').value = 'all'; persist(); render(); if (!storageFailed) announce('Демонстрационные заявки восстановлены.'); }));
  $('export-tasks').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, tasks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = node('a'); link.href = url; link.download = `briefdesk-${localDate(new Date())}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Экспорт подготовлен. Сохраните файл в удобном месте.');
  });
  $('import-tasks').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 1024 * 1024) { announce('Файл слишком большой. Максимальный размер — 1 МБ.'); return; }
    try {
      const imported = validate(JSON.parse(await file.text()));
      ask('Импортировать список?', `В файле ${imported.length} заявок. Текущие ${tasks.length} будут заменены. Для сохранения старого списка сначала отмените импорт и сделайте экспорт.`, () => { tasks = imported; $('search').value = ''; $('status-filter').value = 'all'; persist(); render(); if (!storageFailed) announce(`Импортировано заявок: ${tasks.length}.`); });
    } catch (error) { announce(error instanceof SyntaxError ? 'Не удалось прочитать JSON. Текущий список не изменён.' : (error.message || 'Файл не импортирован. Текущий список не изменён.')); }
  });
  storageLabel(); render(); if (initialNotice) announce(initialNotice);
})();
