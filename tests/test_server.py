import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import server
from server import build_messages, build_vision_messages, extract_delta, image_hash, merge_catalog, normalize_chat_url, redact_profile, run_image_understanding


class OpenAICompatTests(unittest.TestCase):
    def test_url_normalization_accepts_common_base_forms(self):
        self.assertEqual(normalize_chat_url('https://api.example.com'), 'https://api.example.com/v1/chat/completions')
        self.assertEqual(normalize_chat_url('https://api.example.com/v1/'), 'https://api.example.com/v1/chat/completions')
        self.assertEqual(normalize_chat_url('https://api.example.com/v1/chat/completions'), 'https://api.example.com/v1/chat/completions')

    def test_extracts_openai_stream_delta_and_done(self):
        chunk = {'choices': [{'delta': {'content': '你好'}}]}
        self.assertEqual(extract_delta(json.dumps(chunk)), '你好')
        self.assertIsNone(extract_delta('[DONE]'))

    def test_build_messages_puts_entity_prompt_before_history(self):
        messages = build_messages(
            {'prompt': '我是一个温和的健身伙伴。'},
            {'role': '你是教练', 'rules': '先提醒安全'},
            [{'title': '动作', 'content': '背部保持中立'}],
            [{'role': 'user', 'content': '之前的问题'}],
            '现在怎么做？',
            {'name': '深蹲训练器 318', 'intro': '陪用户安全训练。', 'prompt': '产品自己的陪练人格。', 'image_understanding': {'status': 'ready', 'subject': '深蹲训练器', 'scene': '健身房', 'use_cases': ['腿部训练']}},
        )
        self.assertEqual(messages[0]['role'], 'system')
        self.assertIn('背部保持中立', messages[0]['content'])
        self.assertIn('深蹲训练器', messages[0]['content'])
        self.assertIn('健身房', messages[0]['content'])
        self.assertIn('产品自己的陪练人格', messages[0]['content'])
        self.assertEqual(messages[-1], {'role': 'user', 'content': '现在怎么做？'})

    def test_edited_image_understanding_text_overrides_structured_result(self):
        messages = build_messages({}, {}, [], [], '怎么用？', {'name': '产品', 'image_understanding': {'status': 'ready', 'raw_text': '这是用户修订后的识别说明。'}})
        self.assertIn('用户修订后的识别说明', messages[0]['content'])

    def test_vision_prompt_requests_structured_entity_expansion(self):
        messages = build_vision_messages('data:image/webp;base64,abc')
        self.assertEqual(messages[0]['role'], 'system')
        self.assertIn('主体', messages[0]['content'])
        self.assertIn('适用人群', messages[0]['content'])
        self.assertEqual(messages[1]['content'][1]['type'], 'image_url')

    def test_catalog_sync_does_not_erase_existing_secret_when_stale_browser_is_blank(self):
        merged = merge_catalog({'models': [{'id': 'm1', 'name': 'demo', 'api_key': ''}]}, {'models': [{'id': 'm1', 'api_key': 'secret'}]})
        self.assertEqual(merged['models'][0]['api_key'], 'secret')

    def test_image_understanding_saves_structured_expansion(self):
        class Vision(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
                content = json.dumps({'subject': '深蹲训练器', 'scene': '健身房', 'use_cases': ['腿部训练'], 'suitable_for': ['健身初学者'], 'usage_method': '站稳后缓慢下蹲', 'safety': '量力而行'})
                self.wfile.write(json.dumps({'choices': [{'message': {'content': content}}]}).encode())
            def log_message(self, *_): pass
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Vision); threading.Thread(target=upstream.serve_forever, daemon=True).start()
        original = server.STORE; server.STORE = server.ROOT / '.test-xoul.local.json'; image = 'data:image/webp;base64,abc'
        server.save_store({'products': [{'id': 'p1', 'image': image, 'model_profile_id': 'm1'}], 'catalog': {'models': [{'id': 'm1', 'base_url': 'http://127.0.0.1:%d' % upstream.server_address[1], 'model': 'vision', 'api_key': 'secret'}]}})
        try:
            run_image_understanding('p1', image_hash(image)); result = server.load_store()['products'][0]['image_understanding']
            self.assertEqual(result['status'], 'ready'); self.assertEqual(result['subject'], '深蹲训练器'); self.assertIn('健身初学者', result['suitable_for'])
        finally:
            upstream.shutdown(); upstream.server_close(); server.STORE = original
            try: (server.ROOT / '.test-xoul.local.json').unlink()
            except FileNotFoundError: pass

    def test_redaction_never_exposes_api_key(self):
        safe = redact_profile({'name': 'demo', 'api_key': 'secret'})
        self.assertNotIn('api_key', safe)
        self.assertEqual(safe['name'], 'demo')

    def test_local_chat_proxies_openai_sse_and_keeps_key_private(self):
        received = {}
        class Upstream(BaseHTTPRequestHandler):
            def do_POST(self):
                received['auth'] = self.headers.get('Authorization')
                received['body'] = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
                for text in ('你', '好'):
                    self.wfile.write(('data: ' + json.dumps({'choices': [{'delta': {'content': text}}]}) + '\n\n').encode()); self.wfile.flush()
                self.wfile.write(b'data: [DONE]\n\n')
            def log_message(self, *_): pass
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        threading.Thread(target=upstream.serve_forever, daemon=True).start()
        original = server.STORE
        server.STORE = server.ROOT / '.test-xoul.local.json'
        server.save_store({'products': [{'id': 'p1', 'slug': 'p1', 'name': 'P1', 'enabled': True, 'type': 't1', 'agent': {}, 'knowledge': [], 'cards': [], 'model_profile_id': 'm1'}], 'catalog': {'types': [], 'models': [{'id': 'm1', 'name': 'test', 'base_url': 'http://127.0.0.1:%d' % upstream.server_address[1], 'model': 'demo', 'api_key': 'secret'}]}})
        api = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        threading.Thread(target=api.serve_forever, daemon=True).start()
        try:
            import urllib.request
            request = urllib.request.Request('http://127.0.0.1:%d/api/v1/public/experiences/p1/chat' % api.server_address[1], data=json.dumps({'message': 'hi', 'messages': []}).encode(), headers={'Content-Type': 'application/json'})
            response = urllib.request.urlopen(request); body = response.read().decode()
            self.assertIn('"text": "你"', body); self.assertIn('"text": "好"', body); self.assertEqual(received['auth'], 'Bearer secret'); self.assertEqual(received['body']['stream'], True)
        finally:
            api.shutdown(); api.server_close(); upstream.shutdown(); upstream.server_close(); server.STORE = original
            try: (server.ROOT / '.test-xoul.local.json').unlink()
            except FileNotFoundError: pass


if __name__ == '__main__':
    unittest.main()
