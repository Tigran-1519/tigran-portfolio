"""Offline regression checks for static-page security boundaries."""
import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


class Tags(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class StaticSecurity(unittest.TestCase):
    def test_all_pages_have_enforced_policy_before_resources(self):
        for page in ROOT.glob('*.html'):
            with self.subTest(page=page.name):
                tags = Tags(page.read_text(encoding='utf-8')).tags
                policies = [(i, a['content']) for i, (t, a) in enumerate(tags)
                            if t == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy']
                self.assertEqual(len(policies), 1)
                position, policy = policies[0]
                for directive in ["default-src 'none'", "connect-src 'none'", "base-uri 'none'",
                                  "object-src 'none'", "form-action 'none'", "script-src-attr 'none'"]:
                    self.assertIn(directive, policy)
                script_policy = next(d for d in policy.split(';') if d.strip().startswith('script-src '))
                self.assertNotIn('unsafe-inline', script_policy)
                self.assertNotIn('unsafe-eval', script_policy)
                for i, (tag, attrs) in enumerate(tags):
                    if tag in ('script', 'link', 'style', 'iframe'):
                        self.assertLess(position, i)
                    self.assertFalse(any(k.startswith('on') for k in attrs), (page.name, attrs))

    def test_frames_do_not_share_origin_or_allow_top_navigation(self):
        frames = [a for t, a in Tags((ROOT/'index.html').read_text(encoding='utf-8')).tags if t == 'iframe']
        self.assertEqual(len(frames), 6)
        for frame in frames:
            self.assertEqual(set(frame['sandbox'].split()), {'allow-scripts', 'allow-forms'})
            self.assertEqual(frame['referrerpolicy'], 'no-referrer')

    def test_inline_script_hash_matches_actual_memobook_code(self):
        import re
        html = (ROOT/'memobook.html').read_text(encoding='utf-8')
        policy = next(a['content'] for t, a in Tags(html).tags
                      if t == 'meta' and a.get('http-equiv') == 'Content-Security-Policy')
        for script in re.findall(r'<script>([\s\S]*?)</script>', html):
            digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
            self.assertIn("'sha256-" + digest + "'", policy)


if __name__ == '__main__':
    unittest.main()
