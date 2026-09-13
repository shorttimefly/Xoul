import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import server
from server import build_type_assignment_messages, image_hash, run_product_type_assignment


class TypeAssignmentTests(unittest.TestCase):
    def test_type_assignment_prompt_is_strict_and_candidates_are_bounded(self):
        messages = build_type_assignment_messages('你是一个咖啡机助手。', [{'id': 'machine', 'name': '设备 / 机器'}])
        self.assertIn('type_id', messages[0]['content'])
        self.assertIn('machine', messages[1]['content'])
        self.assertIn('咖啡机助手', messages[1]['content'])

    def test_product_type_assignment_saves_selected_catalog_id(self):
        class Upstream(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                body = {'choices': [{'message': {'content': json.dumps({'type_id': 'machine'})}}]}
                self.wfile.write(json.dumps(body).encode())

            def log_message(self, *_):
                pass

        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        threading.Thread(target=upstream.serve_forever, daemon=True).start()
        original = server.STORE
        server.STORE = server.ROOT / '.test-xoul-type-assignment.json'
        prompt = '你是一个咖啡机助手。'
        server.save_store({'products': [{'id': 'p1', 'prompt': prompt, 'type': 'other', 'model_profile_id': 'm1'}], 'catalog': {'types': [{'id': 'machine', 'name': '设备 / 机器'}], 'models': [{'id': 'm1', 'base_url': 'http://127.0.0.1:%d' % upstream.server_address[1], 'model': 'classifier', 'api_key': 'secret'}]}})
        try:
            run_product_type_assignment('p1', image_hash(prompt))
            saved = server.load_store()['products'][0]
            self.assertEqual(saved['type'], 'machine')
            self.assertEqual(saved['product_type_assignment']['status'], 'ready')
        finally:
            upstream.shutdown()
            upstream.server_close()
            server.STORE = original
            try:
                (server.ROOT / '.test-xoul-type-assignment.json').unlink()
            except FileNotFoundError:
                pass


if __name__ == '__main__':
    unittest.main()
