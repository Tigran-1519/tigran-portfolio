"use strict";

const editorDefaults = {
  headline: "Место для ваших идей",
  description: "Одна понятная страница: расскажите об услуге и помогите посетителю сделать следующий шаг.",
  button: "Обсудить задачу"
};
const editorForm = document.querySelector("#editor-form");
const editorNote = document.querySelector("#preview-action-note");
const updateEditor = () => {
  document.querySelector("#preview-headline").textContent = editorForm.elements.headline.value || "Ваш заголовок";
  document.querySelector("#preview-description").textContent = editorForm.elements.description.value || "Здесь появится описание вашей услуги.";
  document.querySelector("#preview-button").textContent = editorForm.elements.button.value || "Текст кнопки";
  editorNote.textContent = "Кнопка показывает демонстрационное действие.";
};
if (editorForm) {
  editorForm.addEventListener("submit", event => event.preventDefault());
  editorForm.addEventListener("input", updateEditor);
  document.querySelector("#editor-reset").addEventListener("click", () => {
    Object.entries(editorDefaults).forEach(([key, value]) => { editorForm.elements[key].value = value; });
    updateEditor();
  });
  document.querySelector("#preview-button").addEventListener("click", () => {
    editorNote.textContent = "Демонстрационное действие выполнено. Ничего не отправлено.";
  });
}
