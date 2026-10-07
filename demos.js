"use strict";

// The demos use only the current page. No network requests or persistent storage.
async function copyDemoText(textarea, status) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(textarea.value);
    status.textContent = "Текст скопирован. Ничего не отправлено.";
  } catch {
    textarea.focus();
    textarea.select();
    status.textContent = "Текст выделен. Скопируйте его через Ctrl+C или меню браузера.";
  }
}

const furnitureForm = document.querySelector("#furniture-form");
if (furnitureForm) {
  const result = document.querySelector("#furniture-result");
  const resultText = document.querySelector("#furniture-result-text");
  const status = document.querySelector("#furniture-status");
  const copyStatus = document.querySelector("#furniture-copy-status");
  const getSelection = () => ({
    product: furnitureForm.elements.product.value,
    finish: furnitureForm.elements.finish.value,
    width: furnitureForm.elements.width.value,
    height: furnitureForm.elements.height.value,
    depth: furnitureForm.elements.depth.value,
    room: furnitureForm.elements.room.value,
    note: furnitureForm.elements.note.value.trim()
  });
  const updateFurniture = () => {
    const data = getSelection();
    const drawing = document.querySelector("#config-drawing");
    drawing.dataset.product = data.product;
    drawing.dataset.finish = data.finish;
    document.querySelector("#config-product-title").textContent = data.product;
    document.querySelector("#config-selection").textContent = `${data.finish} · ${data.width || "—"} × ${data.height || "—"} × ${data.depth || "—"} см`;
    document.querySelector("#config-finish-label").textContent = data.finish;
    document.querySelector("#config-room-label").textContent = data.room;
    if (!result.hidden) {
      result.hidden = true;
      status.textContent = "Параметры изменены. Соберите заявку снова, чтобы получить актуальный текст.";
    }
  };
  furnitureForm.addEventListener("input", updateFurniture);
  furnitureForm.addEventListener("change", updateFurniture);
  document.querySelectorAll("[data-product-preset]").forEach(link => {
    link.addEventListener("click", () => {
      furnitureForm.elements.product.value = link.dataset.productPreset;
      if (link.dataset.productPreset === "Стол") {
        furnitureForm.elements.width.value = "140";
        furnitureForm.elements.height.value = "75";
        furnitureForm.elements.depth.value = "80";
      } else {
        furnitureForm.elements.width.value = "120";
        furnitureForm.elements.height.value = "180";
        furnitureForm.elements.depth.value = "35";
      }
      updateFurniture();
    });
  });
  furnitureForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!furnitureForm.reportValidity()) return;
    const data = getSelection();
    resultText.value = [
      "ДЕМО-ЗАЯВКА / ТИХИЙ ДОМ",
      `Изделие: ${data.product}`,
      `Отделка: ${data.finish}`,
      `Ширина: ${data.width} см`,
      `Высота: ${data.height} см`,
      `Глубина: ${data.depth} см`,
      `Помещение: ${data.room}`,
      `Комментарий: ${data.note || "Не указан"}`,
      "Следующий шаг: обсудить конструкцию и стоимость.",
      "Статус: локальная демонстрация, ничего не отправлено."
    ].join("\n");
    copyStatus.textContent = "";
    result.hidden = false;
    status.textContent = "Демо-заявка собрана. Структурированный текст доступен ниже формы.";
    result.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    resultText.focus({ preventScroll: true });
  });
  document.querySelector("#furniture-copy").addEventListener("click", () => copyDemoText(resultText, copyStatus));
  document.querySelector("#furniture-reset").addEventListener("click", () => {
    furnitureForm.reset();
    updateFurniture();
    resultText.value = "";
    copyStatus.textContent = "";
    status.textContent = "Исходный демонстрационный пример восстановлен.";
    furnitureForm.elements.product[0].focus();
  });
}

const botForm = document.querySelector("#bot-form");
if (botForm) {
  const messages = document.querySelector("#bot-messages");
  const inputArea = document.querySelector("#bot-input-area");
  const result = document.querySelector("#bot-result");
  const resultText = document.querySelector("#bot-result-text");
  const formStatus = document.querySelector("#bot-form-status");
  const copyStatus = document.querySelector("#bot-copy-status");
  const next = document.querySelector("#bot-next");
  let step = 0;
  let brief = {};
  const taskOptions = ["Лендинг для услуги", "Telegram-бот для заявок", "Небольшая доработка сайта"];
  const stepNames = ["Задача", "Материалы", "Детали"];
  const opening = "Здравствуйте! Помогу собрать краткое описание задачи. Что хотите сделать?";
  const addMessage = (message, fromVisitor = false) => {
    const bubble = document.createElement("div");
    bubble.className = `bot-message ${fromVisitor ? "bot-message-out" : "bot-message-in"}`;
    const author = document.createElement("span");
    author.className = "message-author";
    author.textContent = fromVisitor ? "Вы" : "LeadBot";
    const content = document.createElement("p");
    content.textContent = message;
    bubble.append(author, content);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
  };
  const setProgress = () => {
    document.querySelector("#bot-step-label").textContent = step < 3 ? `Шаг ${step + 1} из 3` : "Готово";
    document.querySelector("#bot-step-name").textContent = stepNames[step] || "Заявка собрана";
    document.querySelector("#bot-progress-fill").style.transform = `scaleX(${Math.min(step + 1, 3) / 3})`;
  };
  const radioMarkup = (name, options, title) => `<span class="bot-question-label" id="${name}-label">${title}</span><div class="bot-options" role="radiogroup" aria-labelledby="${name}-label">${options.map((option, index) => `<label class="bot-option"><input type="radio" name="${name}" value="${option}" ${index === 0 ? "checked" : ""}><span>${option}</span></label>`).join("")}</div>`;
  const renderStep = (moveFocus = false) => {
    setProgress();
    formStatus.textContent = "";
    if (step === 0) {
      inputArea.innerHTML = radioMarkup("task", taskOptions, "Что хотите сделать?");
      next.innerHTML = 'Продолжить <span aria-hidden="true">→</span>';
    } else if (step === 1) {
      inputArea.innerHTML = radioMarkup("materials", ["Есть тексты и пример", "Есть только идея", "Нужно уточнить вместе"], "Какие материалы уже есть?");
    } else if (step === 2) {
      const goalOptions = brief.task === taskOptions[1]
        ? ["Собрать параметры заявки", "Ответить на частые вопросы", "Подготовить бриф для менеджера"]
        : brief.task === taskOptions[2]
          ? ["Исправить отображение", "Добавить форму заявки", "Обновить текст или блок"]
          : ["Представить услугу", "Собрать заявки", "Показать примеры работ"];
      inputArea.replaceChildren();
      const goalLabel = document.createElement("label");
      goalLabel.className = "bot-field";
      goalLabel.htmlFor = "bot-goal";
      goalLabel.textContent = "Какой результат важнее?";
      const goalSelect = document.createElement("select");
      goalSelect.id = "bot-goal";
      goalSelect.name = "goal";
      goalOptions.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        goalSelect.append(option);
      });
      goalLabel.append(goalSelect);
      const detailsLabel = document.createElement("label");
      detailsLabel.className = "bot-field";
      detailsLabel.htmlFor = "bot-details";
      detailsLabel.textContent = "Коротко о задаче (необязательно)";
      const details = document.createElement("textarea");
      details.id = "bot-details";
      details.name = "details";
      details.rows = 3;
      details.maxLength = 500;
      details.placeholder = "Например: мастерская мебели, нужны примеры и заявка";
      detailsLabel.append(details);
      const note = document.createElement("p");
      note.className = "field-hint";
      note.textContent = "Используйте демонстрационные данные. Контакты, срок и стоимость обсуждаются отдельно.";
      inputArea.append(goalLabel, detailsLabel, note);
      next.innerHTML = 'Собрать бриф <span aria-hidden="true">✓</span>';
    }
    if (moveFocus) inputArea.querySelector("input, select, textarea")?.focus({ preventScroll: true });
  };
  botForm.addEventListener("submit", event => {
    event.preventDefault();
    if (step === 0) {
      brief.task = botForm.elements.task.value;
      addMessage(brief.task, true);
      addMessage("Отлично. Какие тексты, примеры или материалы уже есть?");
      step = 1;
      renderStep(true);
    } else if (step === 1) {
      brief.materials = botForm.elements.materials.value;
      addMessage(brief.materials, true);
      addMessage("Осталось уточнить цель и пару деталей. После этого соберу текст заявки.");
      step = 2;
      renderStep(true);
    } else if (step === 2) {
      brief.goal = botForm.elements.goal.value;
      brief.details = botForm.elements.details.value.trim();
      addMessage(`${brief.goal}${brief.details ? `. ${brief.details}` : ""}`, true);
      addMessage("Бриф готов. Его можно скопировать и использовать для обсуждения. В этом демо ничего не отправлено.");
      resultText.value = [
        "ДЕМО-БРИФ / LEADBOT",
        `Задача: ${brief.task}`,
        `Материалы: ${brief.materials}`,
        `Основная цель: ${brief.goal}`,
        `Детали: ${brief.details || "Не указаны"}`,
        "Срок и стоимость: обсудить после уточнения объёма.",
        "Контакт: в демо не собирается.",
        "Следующий шаг: согласовать состав первого этапа.",
        "Статус: локальная демонстрация, ничего не отправлено."
      ].join("\n");
      step = 3;
      setProgress();
      botForm.hidden = true;
      result.hidden = false;
      copyStatus.textContent = "";
      resultText.focus({ preventScroll: true });
    }
  });
  const restart = () => {
    step = 0;
    brief = {};
    messages.replaceChildren();
    addMessage(opening);
    result.hidden = true;
    resultText.value = "";
    copyStatus.textContent = "";
    botForm.hidden = false;
    renderStep(true);
  };
  document.querySelector("#bot-restart-top").addEventListener("click", restart);
  document.querySelector("#bot-restart").addEventListener("click", restart);
  document.querySelector("#bot-copy").addEventListener("click", () => copyDemoText(resultText, copyStatus));
  renderStep();
}
