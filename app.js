"use strict";

(() => {
  const form = document.querySelector("#editor-form");
  if (!form) return;
  const headline = form.elements.headline;
  const description = form.elements.description;
  const contact = form.elements.contact;
  const customerName = form.elements.customerName;
  const consent = form.elements.consent;
  const button = document.querySelector('#preview-button');
  const reset = document.querySelector('#editor-reset');
  const endpoint = 'https://tigran-portfolio-requests.tigran-shogoyan.chatgpt.site/api/requests';
  let attempt = null, pending = false, delivered = false;
  const note = document.querySelector("#preview-action-note");
  const preview = document.querySelector("#preview-description");
  const error = document.querySelector("#request-form-error");
  const initialNote = note.textContent;
  function busy(value) {
    pending = value;
    button.disabled = value || delivered;
    reset.disabled = value;
    for (const field of [headline, description, contact, customerName, consent]) field.disabled = value;
    form.setAttribute('aria-busy', String(value));
    button.textContent = value ? 'Отправляем…' : delivered ? 'Задача отправлена ✓' : 'Отправить задачу';
  }

  function updatePreview() {
    document.querySelector("#preview-headline").textContent = headline.value.trim() || "Название вашей задачи";
    preview.textContent = description.value.trim() || "Здесь появится описание. Заполните поля — и проверьте текст перед отправкой.";
    document.querySelector("#description-count").textContent = `${description.value.length.toLocaleString("ru-RU")} / 6 000`;
    description.style.height = "auto";
    description.style.height = `${Math.min(Math.max(description.scrollHeight, 280), 600)}px`;
    preview.tabIndex = preview.scrollHeight > preview.clientHeight ? 0 : -1;
  }

  form.addEventListener("input", () => {
    delivered = false; busy(false); contact.setCustomValidity('');
    headline.setCustomValidity("");
    description.setCustomValidity("");
    error.hidden = true;
    note.textContent = initialNote;
    updatePreview();
  });
  document.querySelector("#editor-reset").addEventListener("click", () => {
    if (pending) return;
    attempt = null; delivered = false; busy(false); contact.setCustomValidity('');
    form.reset();
    headline.setCustomValidity("");
    description.setCustomValidity("");
    error.hidden = true;
    note.textContent = initialNote;
    updatePreview();
    headline.focus();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending || delivered) return;
    headline.setCustomValidity(!headline.value.trim() ? "Укажите название задачи." : headline.value.length > 100 ? "Название должно быть не длиннее 100 символов." : "");
    description.setCustomValidity(description.value.trim().length < 20 ? "Опишите задачу хотя бы в 20 символах." : description.value.length > 6000 ? "Описание должно быть не длиннее 6 000 символов." : "");
    const contactOk = /^(?:@|https:\/\/t\.me\/)[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact.value.trim()) || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.value.trim());
    const phoneOk = /^\+?[\d() .-]+$/.test(contact.value.trim()) && /^[0-9]{7,15}$/.test(contact.value.replace(/\D/g,''));
    contact.setCustomValidity((contactOk || phoneOk) && contact.value.length <= 160 ? '' : 'Укажите телефон с кодом страны, Telegram в формате @username или email.');
    if (!form.reportValidity()) return;
    const fields = {headline:headline.value.trim(),description:description.value.trim(),name:customerName.value.trim(),contact:contact.value.trim(),consent:consent.checked,website:form.elements.website.value};
    const fingerprint = JSON.stringify(fields);
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = {fingerprint,requestId:crypto.randomUUID()};
    error.hidden = true; busy(true);
    note.textContent = 'Передаём вашу задачу в Telegram…';
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),20000);
    try {
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:attempt.requestId}),credentials:'omit',redirect:'error',signal:controller.signal});
      const result = await response.json();
      if (response.ok && result.ok === true && result.requestId === attempt.requestId) {
        delivered = true;
        note.textContent = 'Задача отправлена мне в Telegram. Спасибо! Отвечу на указанный вами контакт.';
      } else {
        const messages = {
          RATE_LIMITED:'Слишком много отправок. Подождите 15 минут или напишите мне в Telegram.',
          INVALID_CONTACT:'Проверьте телефон, Telegram или email для ответа.',
          INVALID_INPUT:'Проверьте поля: название до 100 символов, описание от 20 до 6 000 и контакт для ответа.',
          DELIVERY_FAILED:'Telegram не принял заявку. Напишите мне напрямую по ссылке ниже.',
          DELIVERY_UNKNOWN:'Подтверждение доставки не получено. Можно повторить отправку без изменения текста — проверим эту же заявку. Либо напишите напрямую.',
          REQUEST_CONFLICT:'Не удалось сверить заявку. Скопируйте текст и напишите мне напрямую.',
          UNAVAILABLE:'Отправка временно недоступна. Попробуйте позже или напишите мне напрямую.'
        };
        throw new Error(messages[result.error] || 'Не удалось подтвердить отправку. Текст остался в форме. Попробуйте ещё раз или напишите напрямую.');
      }
    } catch (e) {
      error.textContent = e instanceof TypeError || e.name === 'AbortError' ? 'Связь прервалась, подтверждение доставки не получено. Текст остался в форме. Повторите отправку без изменений — проверим ту же заявку.' : e.message;
      error.hidden = false; note.textContent = 'Доставка пока не подтверждена.';
    } finally { clearTimeout(timeout); busy(false); }
  });
  window.addEventListener("resize", updatePreview);
  updatePreview();
})();
