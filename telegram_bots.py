"""LeadBot and EventBot: Telegram runners using only Python's standard library.

Browser demos are separate. This runner needs BOT_TOKEN and an always-on process.
It replies only in the initiating private chat; sessions expire after 30 minutes.
"""
from __future__ import annotations

import json
import os
import secrets
import time
import urllib.error
import urllib.request
from collections import OrderedDict, deque
from dataclasses import dataclass, field


class ApiError(RuntimeError):
    def __init__(self, code: int = 0):
        self.code = code
        super().__init__(f"Telegram API error ({code}); no credentials logged")


class TelegramAPI:
    def __init__(self, token: str):
        self._token = token

    def call(self, method: str, **payload):
        request = urllib.request.Request(
            f"https://api.telegram.org/bot{self._token}/{method}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise ApiError(error.code) from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            raise ApiError() from None
        if not result.get("ok"):
            raise ApiError(result.get("error_code", 0))
        return result.get("result")


@dataclass
class Session:
    nonce: str = field(default_factory=lambda: secrets.token_hex(4))
    answers: list[str] = field(default_factory=list)
    touched: float = field(default_factory=time.monotonic)


class DemoBot:
    def __init__(self, api, mode="lead"):
        if mode not in {"lead", "event"}:
            raise ValueError("BOT_MODE must be lead or event")
        self.api = api
        self.mode = mode
        self.sessions: dict[int, Session] = {}
        self._traffic = OrderedDict()
        self._global_traffic = deque()

    def prune_sessions(self):
        now = time.monotonic()
        for chat in list(self.sessions):
            if now - self.sessions[chat].touched >= 1800:
                self.sessions.pop(chat, None)
        for chat, recent in list(self._traffic.items()):
            if not recent or now - recent[-1] >= 10:
                self._traffic.pop(chat, None)

    def allow_update(self, chat):
        now = time.monotonic()
        while self._global_traffic and now - self._global_traffic[0] >= 1:
            self._global_traffic.popleft()
        recent = self._traffic.get(chat, deque())
        while recent and now - recent[0] >= 10:
            recent.popleft()
        if len(recent) >= 12 or len(self._global_traffic) >= 20:
            return False
        if chat not in self._traffic and len(self._traffic) >= 2000:
            self._traffic.popitem(last=False)
        recent.append(now)
        self._traffic[chat] = recent
        self._traffic.move_to_end(chat)
        self._global_traffic.append(now)
        return True

    def send(self, chat, text, keyboard=None):
        payload = {"chat_id": chat, "text": text}
        if keyboard:
            payload["reply_markup"] = {"inline_keyboard": keyboard}
        self.api.call("sendMessage", **payload)

    def questions(self, session):
        if self.mode == "event":
            onsite = session.answers and session.answers[0] == "Очно"
            return [
                ("Выберите формат вымышленного события.", ["Онлайн", "Очно"]),
                ("Какая сессия интересна?", ["Практикум по сайтам", "Автоматизация заявок"] if onsite else ["Веб-дизайн в прямом эфире", "Боты для малого бизнеса"]),
                ("Выберите тему интереса.", ["Сайты", "Боты", "Работа с клиентами"]),
            ]
        task = session.answers[0] if session.answers else ""
        goals = ["Представить услугу", "Собрать заявки", "Показать работы"]
        if task == "Telegram-бот":
            goals = ["Собрать параметры заявки", "Ответить на вопросы", "Подготовить бриф"]
        elif task == "Доработка сайта":
            goals = ["Исправить отображение", "Добавить форму", "Обновить текст"]
        return [
            ("Что хотите обсудить?", ["Лендинг", "Telegram-бот", "Доработка сайта"]),
            ("Какие материалы есть?", ["Тексты и пример", "Только идея", "Уточним вместе"]),
            ("Какой результат важнее?", goals),
        ]

    def prompt(self, chat, session):
        session.nonce = secrets.token_hex(4)
        step = len(session.answers)
        if step < 3:
            text, options = self.questions(session)[step]
            rows = [[{"text": label, "callback_data": f"{session.nonce}:{step}:{i}"}]
                    for i, label in enumerate(options)]
        else:
            text = "Добавьте короткие детали (до 500 символов) или пропустите. Используйте учебные данные, без личных контактов."
            rows = [[{"text": "Пропустить", "callback_data": f"{session.nonce}:3:skip"}]]
        if step:
            rows.append([{"text": "Назад", "callback_data": f"{session.nonce}:{step}:back"}])
        self.send(chat, text + "\n/cancel — отменить; /start — заново.", rows)

    def finish(self, chat, session, details):
        labels = ["Задача", "Материалы", "Цель"] if self.mode == "lead" else ["Формат", "Сессия", "Интерес"]
        title = "ДЕМО-БРИФ / LEADBOT" if self.mode == "lead" else "ДЕМО-РЕГИСТРАЦИЯ / EVENTBOT"
        lines = [title] + [f"{label}: {value}" for label, value in zip(labels, session.answers)]
        lines += [f"Детали: {details or 'Не указаны'}", "Результат показан только в этом чате."]
        lines += ["Состав работы, срок и стоимость согласуются отдельно." if self.mode == "lead"
                  else "Событие вымышленное. Реальный билет или бронь не выданы."]
        lines += ["/start — пройти ещё раз."]
        self.send(chat, "\n".join(lines))
        self.sessions.pop(chat, None)

    def handle(self, update):
        self.prune_sessions()
        if not isinstance(update, dict):
            return
        callback = update.get("callback_query")
        if callback is not None and not isinstance(callback, dict):
            return
        message = callback.get("message", {}) if callback else update.get("message", {})
        if not isinstance(message, dict) or not isinstance(message.get("chat"), dict):
            return
        chat_info = message["chat"]
        chat = chat_info.get("id")
        sender = callback.get("from", {}) if callback else message.get("from", {})
        if (chat_info.get("type") != "private" or type(chat) is not int or chat <= 0
                or not isinstance(sender, dict) or sender.get("id") != chat or sender.get("is_bot")):
            return
        if callback and (not isinstance(callback.get("id"), str)
                         or not isinstance(callback.get("data"), str)
                         or not callback["data"].isascii()
                         or len(callback["data"]) > 64):
            return
        if not callback and not isinstance(message.get("text", ""), str):
            return
        if not self.allow_update(chat):
            return
        previous = self.sessions.get(chat)
        snapshot = Session(previous.nonce, list(previous.answers), previous.touched) if previous else None
        try:
            self._handle(update)
        except ApiError:
            words = message.get("text", "").strip().split(maxsplit=1) if not callback else []
            cancelled = not callback and bool(words) and words[0].split("@", 1)[0] == "/cancel"
            if snapshot is not None and not cancelled:
                self.sessions[chat] = snapshot
            else:
                self.sessions.pop(chat, None)
            raise

    def _handle(self, update):
        now = time.monotonic()
        callback = update.get("callback_query")
        message = callback.get("message", {}) if callback else update.get("message", {})
        chat_info = message.get("chat", {})
        chat = chat_info.get("id")
        if callback:
            try:
                self.api.call("answerCallbackQuery", callback_query_id=callback["id"])
            except ApiError as error:
                if error.code != 400:
                    raise
        if chat_info.get("type") != "private" or not isinstance(chat, int):
            return
        sender = callback.get("from", {}) if callback else message.get("from", {})
        if sender.get("id") != chat or sender.get("is_bot"):
            return
        text = message.get("text", "").strip() if not callback else ""
        command = text.split(maxsplit=1)[0].split("@")[0] if text else ""
        if command == "/start":
            if chat not in self.sessions and len(self.sessions) >= 1000:
                self.send(chat, "Сейчас много диалогов. Попробуйте позже.")
                return
            session = Session()
            self.sessions[chat] = session
            self.send(chat, "Это учебный сценарий. Ответы временно хранятся в памяти процесса и показываются только вам.")
            self.prompt(chat, session)
            return
        if command == "/cancel":
            self.sessions.pop(chat, None)
            self.send(chat, "Диалог отменён. /start — начать заново.")
            return
        session = self.sessions.get(chat)
        if not session:
            self.send(chat, "Нажмите /start для нового сценария.")
            return
        session.touched = now
        step = len(session.answers)
        if callback:
            parts = callback.get("data", "").split(":")
            if len(parts) != 3 or parts[0] != session.nonce or parts[1] != str(step):
                self.send(chat, "Эта кнопка относится к прежнему шагу. Используйте последнюю анкету.")
                return
            choice = parts[2]
            if choice == "back" and step:
                session.answers.pop()
            elif step == 3 and choice == "skip":
                self.finish(chat, session, "")
                return
            elif step < 3 and choice in [str(i) for i in range(len(self.questions(session)[step][1]))]:
                session.answers.append(self.questions(session)[step][1][int(choice)])
            else:
                self.send(chat, "Выберите вариант в последней анкете.")
                return
            self.prompt(chat, session)
        elif step == 3 and text and not text.startswith("/"):
            if len(text) > 500:
                self.send(chat, "Пожалуйста, сократите детали до 500 символов.")
            else:
                self.finish(chat, session, text)
        else:
            self.prompt(chat, session)


def main():
    token = os.environ.get("BOT_TOKEN", "").strip()
    mode = os.environ.get("BOT_MODE", "lead").strip()
    if not token:
        raise SystemExit("Set BOT_TOKEN privately in the process environment. Never commit it.")
    api = TelegramAPI(token)
    bot = DemoBot(api, mode)
    if api.call("getWebhookInfo").get("url"):
        raise SystemExit("An existing webhook is active. This runner did not change it; use a separate demo bot.")
    api.call("getMe")
    print(f"{mode} demo runner started; Ctrl+C to stop. No message content is logged.")
    offset = 0
    delay = 2
    while True:
        try:
            bot.prune_sessions()
            updates = api.call("getUpdates", offset=offset, timeout=25,
                               allowed_updates=["message", "callback_query"])
            for update in updates:
                try:
                    bot.handle(update)
                except ApiError as error:
                    if error.code not in {400, 403}:
                        raise
                    print(str(error))
                offset = update["update_id"] + 1
            delay = 2
        except ApiError as error:
            if error.code in {401, 403, 409}:
                raise SystemExit(str(error)) from None
            print(str(error))
            time.sleep(delay)
            delay = min(delay * 2, 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped; in-memory sessions discarded.")
