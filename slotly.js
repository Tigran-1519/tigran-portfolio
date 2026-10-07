(() => {
  'use strict';
  const KEY = 'tigran.slotly.v1';
  const $ = (id) => document.getElementById(id);
  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const services = [
    { id: 'intro', name: 'Знакомство с задачей', description: 'Идея, цель и первые вводные. Определим, что хочется получить.', duration: 20, symbol: '↗' },
    { id: 'website', name: 'Разбор страницы', description: 'Структура, форма заявки и удобство на телефоне.', duration: 40, symbol: '▤' },
    { id: 'bot', name: 'План Telegram-бота', description: 'Шаги диалога, нужные данные и передача заявки.', duration: 45, symbol: '⌘' }
  ];
  const times = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
  // Fixed demo data by day offset (tomorrow is 0). No external calendar is queried.
  const busyByDay = [['09:00', '12:00'], ['10:30'], ['14:00', '17:00'], ['09:00', '15:30'], ['12:00'], ['10:30', '14:00', '17:00'], ['15:30']];
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + index + 1); const closed = date.getDay() === 0; return { date, key: dateKey(date), closed, busy: closed ? [...times] : busyByDay[index] }; });
  const firstAvailableDay = days.find((day) => !day.closed).key;
  const serviceById = (id) => services.find((service) => service.id === id);
  let serviceId = services[0].id;
  let selectedDay = firstAvailableDay;
  let selectedTime = '';
  let confirmed = false;
  let storageFailed = false;
  let initialNotice = '';
  const announce = (message) => { $('announcement').textContent = message; };
  const getDay = () => days.find((day) => day.key === selectedDay) || days[0];
  const fullDate = (date) => date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  function validateStored(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 || typeof data.serviceId !== 'string' || !serviceById(data.serviceId) || typeof data.date !== 'string' || typeof data.time !== 'string' || !times.includes(data.time) || typeof data.confirmedAt !== 'string' || data.confirmedAt.length > 30 || !Number.isFinite(Date.parse(data.confirmedAt))) throw new Error('invalid');
    const day = days.find((item) => item.key === data.date);
    if (!day) throw new Error('expired');
    if (day.closed) throw new Error('closed');
    if (day.busy.includes(data.time)) throw new Error('invalid');
    return { serviceId: data.serviceId, date: day.key, time: data.time };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null && raw.length > 4096) throw new Error('Stored data too large');
    if (raw !== null) {
      const previous = validateStored(JSON.parse(raw));
      serviceId = previous.serviceId; selectedDay = previous.date; selectedTime = previous.time; confirmed = true;
      initialNotice = 'Восстановлен ваш локальный выбор. Реальная встреча не забронирована.';
    }
  } catch (error) {
    if (error.message === 'expired') initialNotice = 'Предыдущая дата вне ближайшей недели. Выберите новый день и интервал.';
    else if (error.message === 'closed') initialNotice = 'Воскресенье — выходной. Выберите другой день и интервал.';
    else { storageFailed = true; initialNotice = 'Не удалось прочитать сохранённый выбор. Демо работает без восстановления данных.'; }
  }
  function markChanged() { confirmed = false; announce('Выбор изменён. Подтвердите его, чтобы сохранить на устройстве.'); }
  function renderServices() {
    $('service-options').replaceChildren();
    for (const service of services) {
      const button = node('button', 'service-option'); button.type = 'button'; button.setAttribute('aria-pressed', String(service.id === serviceId));
      const symbol = node('span', 'service-symbol', service.symbol); symbol.setAttribute('aria-hidden', 'true');
      const check = node('span', 'service-check', '✓'); check.setAttribute('aria-hidden', 'true');
      button.append(symbol, node('strong', '', service.name), node('span', 'service-description', service.description), node('span', 'service-duration', `${service.duration} минут · онлайн`), check);
      button.addEventListener('click', () => { if (serviceId !== service.id) { serviceId = service.id; markChanged(); } render(); $('service-options').querySelector('button[aria-pressed="true"]').focus(); });
      $('service-options').append(button);
    }
  }
  function renderCalendar() {
    $('calendar-days').replaceChildren();
    for (const day of days) {
      const button = node('button', 'day-option'); button.type = 'button'; button.disabled = day.closed; button.setAttribute('aria-pressed', String(day.key === selectedDay));
      button.setAttribute('aria-label', `${fullDate(day.date)}, ${day.closed ? 'выходной, ' : ''}доступно демо-интервалов: ${times.length - day.busy.length}`);
      button.append(node('span', 'weekday', day.date.toLocaleDateString('ru-RU', { weekday: 'short' })), node('span', 'day-number', String(day.date.getDate())), node('span', 'day-month', day.closed ? 'выходной' : day.date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')), node('span', 'day-availability', day.closed ? '0 окон' : `${times.length - day.busy.length} окна`));
      button.addEventListener('click', () => { if (selectedDay !== day.key) { selectedDay = day.key; selectedTime = ''; markChanged(); } render(); $('calendar-days').querySelector('button[aria-pressed="true"]').focus(); });
      $('calendar-days').append(button);
    }
    const first = days[0].date; const last = days[days.length - 1].date;
    $('calendar-range').textContent = `${first.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    $('calendar-month').textContent = first.getMonth() === last.getMonth() ? first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : `${first.toLocaleDateString('ru-RU', { month: 'long' })} / ${last.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`;
  }
  function renderTimes() {
    const day = getDay(); $('time-date').textContent = fullDate(day.date); $('time-options').replaceChildren();
    for (const time of times) {
      const busy = day.busy.includes(time); const chosen = time === selectedTime;
      const button = node('button', 'time-option'); button.type = 'button'; button.disabled = busy; button.setAttribute('aria-pressed', String(chosen));
      button.setAttribute('aria-label', `${time}, ${busy ? 'занято в демонстрации' : chosen ? 'выбранный демо-интервал' : 'доступный демо-интервал'}`);
      button.append(node('strong', '', time), node('span', '', busy ? 'Занято' : chosen ? 'Выбрано ✓' : 'Доступно'));
      button.addEventListener('click', () => { if (selectedTime !== time) { selectedTime = time; markChanged(); } render(); $('time-options').querySelector('button[aria-pressed="true"]').focus(); });
      $('time-options').append(button);
    }
  }
  function renderSummary() {
    const service = serviceById(serviceId); const day = getDay();
    $('summary-icon').textContent = service.symbol;
    $('summary-service').textContent = service.name;
    $('summary-duration').textContent = `${service.duration} минут`;
    $('summary-date').textContent = day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    if (selectedTime) {
      const [hour, minute] = selectedTime.split(':').map(Number);
      const end = hour * 60 + minute + service.duration;
      $('summary-time').textContent = `${selectedTime} — ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    } else $('summary-time').textContent = 'Выберите интервал';
    $('confirm-choice').disabled = !selectedTime;
    $('confirm-choice').hidden = confirmed;
    $('confirmation').hidden = !confirmed;
    $('edit-choice').hidden = !confirmed;
    $('storage-note').textContent = storageFailed ? 'Сохранение в браузере недоступно. Выбор действует до закрытия страницы.' : confirmed ? 'Выбор восстановится при открытии на этом устройстве.' : 'Данные остаются на этом устройстве.';
    $('storage-note').classList.toggle('error', storageFailed);
  }
  function render() { renderServices(); renderCalendar(); renderTimes(); renderSummary(); }
  $('confirm-choice').addEventListener('click', () => {
    const day = getDay();
    if (!selectedTime || day.busy.includes(selectedTime)) { announce('Выберите доступный демонстрационный интервал.'); return; }
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, serviceId, date: selectedDay, time: selectedTime, confirmedAt: new Date().toISOString() })); storageFailed = false; }
    catch (error) { storageFailed = true; }
    confirmed = true; renderSummary();
    announce(storageFailed ? 'Выбор подтверждён только в этой вкладке: сохранение недоступно. Реальная встреча не забронирована.' : 'Выбор сохранён на этом устройстве. Для настоящей встречи согласуйте время с Тиграном.');
    $('edit-choice').focus();
  });
  $('edit-choice').addEventListener('click', () => { confirmed = false; renderSummary(); announce('Можно изменить услугу, день или время. Затем подтвердите новый выбор.'); $('service-options').querySelector('button[aria-pressed="true"]').focus(); });
  $('reset-choice').addEventListener('click', () => { $('reset-dialog').showModal(); $('cancel-reset').focus(); });
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
  $('accept-reset').addEventListener('click', () => {
    serviceId = services[0].id; selectedDay = firstAvailableDay; selectedTime = ''; confirmed = false;
    try { localStorage.removeItem(KEY); storageFailed = false; } catch (error) { storageFailed = true; }
    $('reset-dialog').close(); render(); announce(storageFailed ? 'Выбор сброшен в текущей вкладке. Сохранённые данные браузера удалить не удалось.' : 'Локальный выбор удалён. Начните с услуги и даты.'); $('service-options').querySelector('button').focus();
  });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'часовой пояс устройства';
  $('timezone-note').textContent = `Время по настройкам устройства · ${zone}. Слоты демонстрационные.`;
  for (const day of days) $('busy-list').append(node('li', '', `${day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}: ${day.closed ? 'воскресенье — выходной, интервалов нет' : day.busy.join(', ')}`));
  render(); if (initialNotice) announce(initialNotice);
})();
