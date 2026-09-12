"""XOUL local API: an OpenAI-compatible streaming proxy for the H5 chat UI.

Run with: python3 server.py (the static UI is served from the same process).
Keys stay in .xoul.local.json and are never included in public responses.
"""
import json
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
STORE = ROOT / ".xoul.local.json"
MAX_BODY = 2 * 1024 * 1024


def normalize_chat_url(base_url):
    value = str(base_url or "").strip().rstrip("/")
    if value.endswith("/chat/completions"):
        return value
    if value.endswith("/v1"):
        return value + "/chat/completions"
    return value + "/v1/chat/completions"


def extract_delta(data):
    if data == "[DONE]":
        return None
    try:
        payload = json.loads(data)
    except (TypeError, ValueError):
        return ""
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not choices:
        return ""
    first = choices[0] if isinstance(choices[0], dict) else {}
    delta = first.get("delta") if isinstance(first.get("delta"), dict) else {}
    content = delta.get("content")
    if content is None:
        message = first.get("message") if isinstance(first.get("message"), dict) else {}
        content = message.get("content")
    return content if isinstance(content, str) else ""


def build_messages(type_config, agent_config, entries, history, message):
    type_config = type_config or {}
    agent_config = agent_config or {}
    knowledge = "\n\n".join("【%s】\n%s" % (x.get("title", "产品知识"), x.get("content", "")) for x in (entries or []) if x.get("content"))
    parts = [x for x in [type_config.get("prompt"), agent_config.get("role"), agent_config.get("rules"), "产品知识：\n" + knowledge if knowledge else ""] if x]
    system = "\n\n".join(parts) or "你是一个友好的产品伙伴，请准确回答用户问题。"
    safe_history = []
    for item in (history or [])[-20:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant") and isinstance(item.get("content"), str):
            safe_history.append({"role": item["role"], "content": item["content"]})
    return [{"role": "system", "content": system}] + safe_history + [{"role": "user", "content": str(message)}]


def redact_profile(profile):
    return {k: v for k, v in (profile or {}).items() if k not in ("api_key", "key", "token", "secret")}


def load_store():
    if not STORE.exists():
        return {"products": [], "catalog": {"types": [], "models": []}}
    try:
        value = json.loads(STORE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {"products": [], "catalog": {"types": [], "models": []}}
    except (OSError, ValueError):
        return {"products": [], "catalog": {"types": [], "models": []}}


def save_store(value):
    fd, name = tempfile.mkstemp(prefix="xoul-", suffix=".json", dir=str(ROOT))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
        os.replace(name, STORE)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def public_product(product, catalog):
    model_id = product.get("model_profile_id") or ""
    model = next((x for x in catalog.get("models", []) if x.get("id") == model_id), {})
    return {
        "status": "inactive" if product.get("enabled") is False else "active",
        "product": {"id": product.get("id"), "name": product.get("name"), "description": product.get("intro", ""), "image": product.get("image", ""), "type": product.get("type", "")},
        "experience": {"id": "local_" + str(product.get("id", ""))},
        "agent": {"name": (product.get("agent") or {}).get("name"), "welcome": (product.get("agent") or {}).get("welcome")},
        "knowledge": {"entries": [{"title": x.get("title", ""), "content": x.get("body", "")} for x in product.get("knowledge", [])]},
        "cards": [{"id": x.get("id", "card_%d" % i), "title": x.get("title", ""), "prompt": x.get("prompt", ""), "enabled": x.get("enabled", True), "capability_id": x.get("capability", "custom")} for i, x in enumerate(product.get("cards", []))],
        "model": {"id": model_id, "name": model.get("name") or (product.get("model") or {}).get("name", ""), "provider": model.get("provider") or (product.get("model") or {}).get("provider", ""), "configured": bool(model.get("api_key") or (product.get("model") or {}).get("api_key"))},
    }


def find_product(slug, store):
    return next((p for p in store.get("products", []) if p.get("slug") == slug), None)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        return

    def send_json(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY:
            raise ValueError("request too large")
        data = self.rfile.read(length)
        value = json.loads(data.decode("utf-8") or "{}")
        if not isinstance(value, dict):
            raise ValueError("object required")
        return value

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/v1/health":
            return self.send_json(200, {"ok": True, "service": "xoul-local-api"})
        match = re.fullmatch(r"/api/v1/public/entrypoints/(.+)", path)
        if match:
            store = load_store(); product = find_product(unquote(match.group(1)), store)
            if not product:
                return self.send_json(404, {"error": {"code": "ENTRYPOINT_NOT_FOUND", "message": "入口不存在"}})
            return self.send_json(200, public_product(product, store.get("catalog", {})))
        self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_json()
        except (ValueError, OSError):
            return self.send_json(400, {"error": {"code": "INVALID_JSON", "message": "请求格式无效"}})
        if path == "/api/v1/admin/sync":
            save_store({"products": body.get("products", []), "catalog": body.get("catalog", {})})
            return self.send_json(200, {"ok": True})
        match = re.fullmatch(r"/api/v1/public/experiences/(.+)/chat", path)
        if match:
            return self.chat(unquote(match.group(1)), body)
        self.send_error(404)

    def chat(self, slug, body):
        store = load_store(); product = find_product(slug, store)
        if not product or product.get("enabled") is False:
            return self.send_json(404, {"error": {"code": "ENTRYPOINT_UNAVAILABLE", "message": "产品入口不可用"}})
        catalog = store.get("catalog", {}); product_model = product.get("model") or {}
        profile_id = product.get("model_profile_id")
        profile = next((x for x in catalog.get("models", []) if x.get("id") == profile_id), {})
        profile = {**product_model, **profile}
        base_url, model, api_key = profile.get("base_url", ""), profile.get("model", "") or profile.get("name", ""), profile.get("api_key", "")
        if not base_url or not model or not api_key:
            return self.send_json(503, {"error": {"code": "MODEL_NOT_CONFIGURED", "message": "尚未配置可用的模型地址、模型标识或 API Key"}})
        type_config = next((x for x in catalog.get("types", []) if x.get("id") == product.get("type")), {})
        messages = build_messages(type_config, product.get("agent"), [{"title": x.get("title"), "content": x.get("body")} for x in product.get("knowledge", [])], body.get("messages"), body.get("message", ""))
        payload = {"model": model, "messages": messages, "temperature": profile.get("temperature", .3), "max_tokens": profile.get("max_tokens", 2048), "stream": True}
        authorization = api_key if api_key.lower().startswith("bearer ") else "Bearer " + api_key
        request = urllib.request.Request(normalize_chat_url(base_url), data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json", "Accept": "text/event-stream", "Authorization": authorization}, method="POST")
        try:
            upstream = urllib.request.urlopen(request, timeout=120)
        except urllib.error.HTTPError as error:
            return self.send_json(error.code, {"error": {"code": "UPSTREAM_HTTP_ERROR", "message": "模型服务返回 HTTP %d" % error.code}})
        except (urllib.error.URLError, TimeoutError):
            return self.send_json(502, {"error": {"code": "UPSTREAM_UNREACHABLE", "message": "模型服务无法连接"}})
        self.send_response(200); self.send_header("Content-Type", "text/event-stream; charset=utf-8"); self.send_header("Cache-Control", "no-cache"); self.send_header("Connection", "close"); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
        try:
            for raw in upstream:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip(); delta = extract_delta(data)
                if delta:
                    packet = json.dumps({"type": "delta", "text": delta}, ensure_ascii=False)
                    self.wfile.write(("data: " + packet + "\n\n").encode("utf-8")); self.wfile.flush()
                if data == "[DONE]":
                    break
            self.wfile.write(b"data: [DONE]\n\n"); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            upstream.close()


def run():
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("XOUL_API_PORT", "8780"))), Handler)
    print("XOUL API listening on http://127.0.0.1:%d" % server.server_address[1], flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run()
