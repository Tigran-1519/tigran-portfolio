import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch
import urllib.error

source = pathlib.Path(__file__).resolve().with_name("telegram_bots.py")
spec = importlib.util.spec_from_file_location("portfolio_bots", source)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class FakeAPI:
    def __init__(self):
        self.calls = []

    def call(self, method, **payload):
        self.calls.append((method, payload))
        return {}


def message(text, chat=123, kind="private"):
    return {"message": {"chat": {"id": chat, "type": kind}, "from": {"id": chat}, "text": text}}


def callback(bot, choice, chat=123):
    state = bot.sessions[chat]
    return {"callback_query": {"id": "test", "from": {"id": chat},
            "message": {"chat": {"id": chat, "type": "private"}},
            "data": f"{state.nonce}:{len(state.answers)}:{choice}"}}


class BotFlows(unittest.TestCase):
    def setUp(self):
        self.api = FakeAPI()
        self.bot = module.DemoBot(self.api)
        self.bot.handle(message("/start"))

    def test_lead_brief_reaches_summary(self):
        for choice in ["1", "0", "2", "skip"]:
            self.bot.handle(callback(self.bot, choice))
        result = self.api.calls[-1][1]["text"]
        self.assertIn("Задача: Telegram-бот", result)
        self.assertIn("Цель: Подготовить бриф", result)
        self.assertNotIn(123, self.bot.sessions)

    def test_event_session_depends_on_format(self):
        bot = module.DemoBot(self.api, "event")
        bot.handle(message("/start"))
        for choice in ["1", "0", "1"]:
            bot.handle(callback(bot, choice))
        bot.handle(message("Вопрос о ботах"))
        result = self.api.calls[-1][1]["text"]
        self.assertIn("Формат: Очно", result)
        self.assertIn("Практикум по сайтам", result)
        self.assertIn("Вопрос о ботах", result)

    def test_old_button_cannot_change_revisited_step(self):
        old = callback(self.bot, "0")
        self.bot.handle(old)
        self.bot.handle(callback(self.bot, "back"))
        self.bot.handle(old)
        self.assertEqual(self.bot.sessions[123].answers, [])

    def test_cancel_and_private_chat_isolation(self):
        self.bot.handle(message("/start", chat=124))
        self.bot.handle(message("/cancel"))
        self.bot.handle(message("/start", chat=999, kind="group"))
        self.assertNotIn(123, self.bot.sessions)
        self.assertIn(124, self.bot.sessions)
        self.assertNotIn(999, self.bot.sessions)

    def test_oversize_text_is_rejected_without_losing_session(self):
        for choice in ["0", "0", "0"]:
            self.bot.handle(callback(self.bot, choice))
        self.bot.handle(message("x" * 501))
        self.assertIn(123, self.bot.sessions)
        self.assertIn("500", self.api.calls[-1][1]["text"])

    def test_expired_session_does_not_accept_callback(self):
        old = callback(self.bot, "0")
        self.bot.sessions[123].touched -= 1801
        self.bot.handle(old)
        self.assertNotIn(123, self.bot.sessions)
        self.assertIn("/start", self.api.calls[-1][1]["text"])

    def test_api_error_does_not_expose_token(self):
        api = module.TelegramAPI("PRIVATE_TEST_VALUE")
        with patch.object(module.urllib.request, "urlopen", side_effect=urllib.error.URLError("PRIVATE_TEST_VALUE")):
            with self.assertRaises(module.ApiError) as caught:
                api.call("getMe")
        self.assertNotIn("PRIVATE_TEST_VALUE", str(caught.exception))

    def test_unicode_digit_callback_cannot_crash_runner(self):
        self.bot.handle(callback(self.bot, "²"))
        self.assertEqual(self.bot.sessions[123].answers, [])

    def test_expired_session_is_not_restored_on_delivery_failure(self):
        self.bot.sessions[123].touched -= 1801
        with patch.object(self.api, "call", side_effect=module.ApiError(502)):
            with self.assertRaises(module.ApiError):
                self.bot.handle(message("hello"))
        self.assertNotIn(123, self.bot.sessions)

    def test_idle_cleanup_removes_expired_sessions(self):
        self.bot.sessions[123].touched -= 1801
        self.bot.prune_sessions()
        self.assertNotIn(123, self.bot.sessions)

    def test_flood_is_bounded_and_other_chat_still_works(self):
        for _ in range(100):
            self.bot.handle(message("/start"))
        self.assertLessEqual(len(self.api.calls), 24)
        self.bot.handle(message("/start", chat=124))
        self.assertIn(124, self.bot.sessions)

    def test_callback_from_another_user_is_ignored(self):
        forged = callback(self.bot, "0")
        forged["callback_query"]["from"]["id"] = 124
        before = len(self.api.calls)
        self.bot.handle(forged)
        self.assertEqual(len(self.api.calls), before)
        self.assertEqual(self.bot.sessions[123].answers, [])

    def test_cancel_deletes_data_even_when_confirmation_fails(self):
        with patch.object(self.api, "call", side_effect=module.ApiError(502)):
            with self.assertRaises(module.ApiError):
                self.bot.handle(message("/cancel"))
        self.assertNotIn(123, self.bot.sessions)

    def test_invalid_updates_do_not_crash_or_send(self):
        before = len(self.api.calls)
        for update in [None, [], {"message": None}, {"callback_query": 5},
                       {"message": {"chat": None}}, message(None)]:
            self.bot.handle(update)
        self.assertEqual(len(self.api.calls), before)

    def test_rate_window_recovers(self):
        for _ in range(30):
            self.bot.handle(message("/start"))
        with patch.object(module.time, "monotonic", return_value=module.time.monotonic() + 11):
            before = len(self.api.calls)
            self.bot.handle(message("/start"))
            self.assertEqual(len(self.api.calls), before + 2)

    def test_next_question_recovers_after_temporary_delivery_failure(self):
        original = callback(self.bot, "1")
        real_call = self.api.call
        failed_once = False

        def fail_once(method, **payload):
            nonlocal failed_once
            if method == "sendMessage" and not failed_once:
                failed_once = True
                raise module.ApiError(502)
            return real_call(method, **payload)

        with patch.object(self.api, "call", side_effect=fail_once):
            with self.assertRaises(module.ApiError):
                self.bot.handle(original)
            self.assertEqual(self.bot.sessions[123].answers, [])
            self.bot.handle(original)
        self.assertEqual(self.bot.sessions[123].answers, ["Telegram-бот"])
        self.assertIn("Какие материалы", self.api.calls[-1][1]["text"])


if __name__ == "__main__":
    unittest.main()

