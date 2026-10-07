"use strict";

// A local interface demonstration: no network calls, contact collection or storage.
const eventSessions = {
  venue: [
    { id: "v-process", time: "10:00", duration: "45 мин", title: "Меньше рутины. Больше смысла.", description: "Практикум: найти первый процесс для автоматизации." },
    { id: "v-web", time: "11:00", duration: "50 мин", title: "Страница, с которой всё начинается", description: "Разбор понятного пути от интереса до заявки." },
    { id: "v-ai", time: "12:15", duration: "45 мин", title: "AI как рабочий инструмент", description: "Обсуждение задач, проверки результата и границ." }
  ],
  online: [
    { id: "o-process", time: "14:00", duration: "35 мин", title: "Первая автоматизация без перегруза", description: "Короткий разбор: выбрать задачу и определить результат." },
    { id: "o-web", time: "14:45", duration: "40 мин", title: "Клиентский путь на одном экране", description: "Онлайн-разбор структуры страницы и её действий." },
    { id: "o-ai", time: "15:40", duration: "35 мин", title: "Вопросы к AI. Вопросы к результату.", description: "Дискуссия о полезных сценариях и проверке качества." }
  ]
};
const eventState = { step: 0, format: "venue", session: "v-process", interest: "Автоматизация рутины", question: "" };
const eventForm = document.querySelector("#registration-form");
const eventPanels = [document.querySelector("#format-panel"), document.querySelector("#session-panel"), document.querySelector("#interest-panel")];
const programList = document.querySelector("#program-list");
const sessionOptions = document.querySelector("#session-options");
const messages = document.querySelector("#messages");
const previousButton = document.querySelector("#previous-step");
const nextButton = document.querySelector("#next-step");
const result = document.querySelector("#result");
const resultText = document.querySelector("#result-text");
const copyStatus = document.querySelector("#copy-status");
const interestField = document.querySelector("#interest");
const questionField = document.querySelector("#question");
const stepTitles = ["Формат участия", "Сессия", "Ваш интерес", "Пример готов"];
const formatName = () => eventState.format === "venue" ? "Очно" : "Онлайн";
const selectedSession = () => eventSessions[eventState.format].find(session => session.id === eventState.session) || eventSessions[eventState.format][0];
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function renderProgram() {
  document.querySelector("#program-format").textContent = formatName();
  document.querySelector("#program-location").textContent = eventState.format === "venue" ? "Демонстрационный зал" : "Демонстрационная трансляция";
  programList.replaceChildren();
  eventSessions[eventState.format].forEach((session, index) => {
    const chosen = eventState.step > 0 && eventState.session === session.id;
    const item = element("li", `program-item${chosen ? " is-selected" : ""}`);
    const time = element("div", "program-time", session.time);
    time.append(element("small", "", session.duration));
    const description = element("div", "program-session");
    description.append(element("h3", "", session.title), element("p", "", session.description));
    const number = element("span", "program-index", chosen ? "✓" : String(index + 1).padStart(2, "0"));
    if (chosen) number.setAttribute("aria-label", "Выбранная сессия");
    else number.setAttribute("aria-hidden", "true");
    item.append(time, description, number);
    programList.append(item);
  });
}

function renderSessions() {
  sessionOptions.replaceChildren();
  eventSessions[eventState.format].forEach(session => {
    const label = element("label", "session-option");
    const radio = element("input");
    radio.type = "radio";
    radio.name = "session";
    radio.value = session.id;
    radio.checked = eventState.session === session.id;
    const card = element("span", "session-card");
    card.append(element("strong", "", session.title), element("small", "", `${session.time} / ${session.duration} / ${formatName()}`));
    label.append(radio, card);
    sessionOptions.append(label);
  });
}

function addMessage(text, answer = false) {
  const message = element("div", `message${answer ? " is-answer" : ""}`);
  message.append(element("span", "message-author", answer ? "ВАШ ВЫБОР" : "EVENTBOT"), element("p", "message-content", text));
  messages.append(message);
}

function renderMessages() {
  messages.replaceChildren();
  addMessage("Привет! Соберём пример участия в SHIFT. Сначала выберите формат — от него зависит программа.");
  if (eventState.step > 0) {
    addMessage(formatName(), true);
    addMessage(eventState.format === "venue" ? "Для очного формата подготовлен практикум и два разбора. Что вам ближе?" : "В онлайн-программе — короткие разборы и дискуссия. Выберите одну сессию.");
  }
  if (eventState.step > 1) {
    const session = selectedSession();
    addMessage(`${session.time} — ${session.title}`, true);
    addMessage("Осталось выбрать тему интереса. Если хотите, добавьте пример вопроса спикеру. Контакты не нужны.");
  }
  if (eventState.step > 2) {
    addMessage(`${eventState.interest}${eventState.question ? `. Вопрос: ${eventState.question}` : ""}`, true);
    addMessage("Пример готов! Ниже — демонстрационный бейдж и сводка. Это не билет: ничего не зарегистрировано и не отправлено.");
  }
  messages.scrollTop = messages.scrollHeight;
}

function renderResult() {
  const session = selectedSession();
  document.querySelector("#badge-format").textContent = formatName().toUpperCase();
  document.querySelector("#badge-session-title").textContent = session.title;
  document.querySelector("#badge-session-time").textContent = `16 апреля 2030 / ${session.time} / ${session.duration}`;
  resultText.value = [
    "EVENTBOT / ДЕМОНСТРАЦИОННЫЙ ПРИМЕР",
    "Событие: SHIFT — вымышленный форум",
    "Организатор: вымышленная студия «Сдвиг»",
    "Дата: 16 апреля 2030 (условная)",
    `Формат: ${formatName()}`,
    `Сессия: ${session.title}`,
    `Время: ${session.time} / ${session.duration} (условное)`,
    `Тема интереса: ${eventState.interest}`,
    `Вопрос: ${eventState.question || "Не указан"}`,
    "Статус: локальная демонстрация. Это не билет.",
    "Ничего не отправлено и не сохранено. Контакты не собираются."
  ].join("\n");
  copyStatus.textContent = "";
}

function renderStep(moveFocus = false) {
  const completed = eventState.step === 3;
  eventPanels.forEach((panel, index) => {
    panel.hidden = eventState.step !== index;
    panel.disabled = eventState.step !== index;
  });
  eventForm.hidden = completed;
  result.hidden = !completed;
  previousButton.disabled = eventState.step === 0;
  nextButton.replaceChildren(document.createTextNode(eventState.step === 0 ? "Выбрать сессию " : eventState.step === 1 ? "Добавить интерес " : "Создать пример "));
  const arrow = element("span", "", eventState.step === 2 ? "↗" : "→");
  arrow.setAttribute("aria-hidden", "true");
  nextButton.append(arrow);
  const percent = Math.round(Math.min(eventState.step + 1, 3) / 3 * 100);
  document.querySelector("#step-number").textContent = completed ? "03 / 03 ✓" : `${String(eventState.step + 1).padStart(2, "0")} / 03`;
  document.querySelector("#step-title").textContent = stepTitles[eventState.step];
  document.querySelector("#step-completion").textContent = `${percent}%`;
  document.querySelector("#step-track-fill").style.width = `${percent}%`;
  renderProgram();
  renderMessages();
  if (completed) renderResult();
  if (moveFocus) {
    document.querySelector("#step-status").textContent = completed ? "Демонстрационный пример готов. Это не билет." : `Шаг ${eventState.step + 1} из 3. ${stepTitles[eventState.step]}.`;
    const focusTarget = completed ? document.querySelector("#result-title") : eventPanels[eventState.step].querySelector("input:checked, select, textarea, input");
    focusTarget?.focus();
  }
}

eventForm.addEventListener("change", event => {
  if (event.target.name === "format") {
    const newFormat = event.target.value;
    if (eventState.format !== newFormat) {
      eventState.format = newFormat;
      eventState.session = eventSessions[newFormat][0].id;
      renderSessions();
      renderProgram();
      document.querySelector("#step-status").textContent = `Показана программа: ${formatName()}.`;
    }
  } else if (event.target.name === "session") {
    eventState.session = event.target.value;
    renderProgram();
  } else if (event.target.name === "interest") eventState.interest = event.target.value;
});
questionField.addEventListener("input", () => {
  eventState.question = questionField.value.trim();
  document.querySelector("#question-count").textContent = `${questionField.value.length} / 180`;
});
eventForm.addEventListener("submit", event => {
  event.preventDefault();
  if (eventState.step >= 3) return;
  eventState.interest = interestField.value;
  eventState.question = questionField.value.trim();
  eventState.step += 1;
  renderStep(true);
});
previousButton.addEventListener("click", () => {
  if (eventState.step > 0) {
    eventState.step -= 1;
    renderStep(true);
  }
});
document.querySelector("#edit-result").addEventListener("click", () => {
  eventState.step = 2;
  renderStep(true);
});
function restartEvent() {
  Object.assign(eventState, { step: 0, format: "venue", session: "v-process", interest: "Автоматизация рутины", question: "" });
  eventForm.reset();
  interestField.value = eventState.interest;
  questionField.value = "";
  document.querySelector("#question-count").textContent = "0 / 180";
  resultText.value = "";
  copyStatus.textContent = "";
  renderSessions();
  renderStep(true);
}
document.querySelector("#restart-top").addEventListener("click", restartEvent);
document.querySelector("#restart-result").addEventListener("click", restartEvent);
document.querySelector("#copy-result").addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(resultText.value);
    copyStatus.textContent = "Пример скопирован. Ничего не отправлено.";
  } catch {
    resultText.focus();
    resultText.select();
    copyStatus.textContent = "Текст выделен. Скопируйте через Ctrl+C или меню браузера.";
  }
});
renderSessions();
renderStep();
