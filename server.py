"""XOUL local API: an OpenAI-compatible streaming proxy for the H5 chat UI.

Run with: python3 server.py (the static UI is served from the same process).
Keys stay in .xoul.local.json and are never included in public responses.
"""
import json
import os
import re
import hashlib
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
STORE_LOCK = threading.RLock()
IMAGE_JOBS = set()


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


def build_messages(type_config, agent_config, entries, history, message, product=None):
    type_config = type_config or {}
    agent_config = agent_config or {}
    knowledge_parts = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "产品知识")
        content = entry.get("content")
        if content:
            knowledge_parts.append("【%s】\n%s" % (title, content))
        image = entry.get("image")
        if isinstance(image, str) and image:
            knowledge_parts.append("【%s】\n（知识库图片已保存，用户需要时由聊天界面展示）" % title)
    knowledge = "\n\n".join(knowledge_parts)
    product = product or {}
    understood = product.get("image_understanding") or {}
    image_context = ""
    if understood.get("status") == "ready":
        image_context = "图片理解：\n" + (understood.get("raw_text") or json.dumps({k: understood.get(k) for k in ("subject", "scene", "use_cases", "suitable_for", "usage_method", "safety") if understood.get(k)}, ensure_ascii=False))
    extra_fields = []
    for field in product.get("extra_fields") or []:
        if not isinstance(field, dict):
            continue
        key, value = str(field.get("key") or "").strip(), field.get("value")
        if key and value is not None and str(value).strip():
            extra_fields.append("%s：%s" % (key, value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)))
    extra_context = "产品扩展字段：\n" + "\n".join(extra_fields) if extra_fields else ""
    workflow = product.get("workflow") or []
    workflow_steps = [step.get("type") if isinstance(step, dict) else step for step in workflow]
    workflow_context = "开放式工作流：根据用户问题选择必要的步骤和知识内容，不必机械执行全部步骤；可用步骤：" + json.dumps(workflow_steps, ensure_ascii=False) if workflow_steps else ""
    knowledge_boundary = "知识边界：优先使用产品知识、图片理解结果和扩展字段；知识库没有覆盖时明确说明不确定，不要补充未经知识库支持的外部事实，不主动引入外网信息。"
    parts = [x for x in [
        "你是有温度的产品实体，请用第一人称与用户交流；称呼自己时使用产品名称。回答准确、自然，不要声称看到了图片之外的信息。",
        "产品名称：" + str(product.get("name", "")), "产品介绍：" + str(product.get("intro", "")),
        knowledge_boundary, workflow_context, product.get("prompt"), type_config.get("prompt"), agent_config.get("role"), agent_config.get("rules"), image_context, extra_context,
        "产品知识：\n" + knowledge if knowledge else ""
    ] if x]
    system = "\n\n".join(parts) or "你是一个友好的产品伙伴，请准确回答用户问题。"
    safe_history = []
    for item in (history or [])[-20:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant"):
            content = item.get("content") if isinstance(item.get("content"), str) else item.get("text")
            if isinstance(content, str):
                safe_history.append({"role": item["role"], "content": content})
    return [{"role": "system", "content": system}] + safe_history + [{"role": "user", "content": str(message)}]


def build_vision_messages(image):
    return [{"role": "system", "content": "你是产品图像理解助手。请识别图片主体并结合场景扩写，严格返回 JSON，字段包括 subject（主体）、scene（场景）、use_cases（使用场景数组）、suitable_for（适用人群数组）、usage_method（使用方法）、safety（安全提示）。无法确认的内容请写空数组或空字符串，不要臆测品牌和型号。"}, {"role": "user", "content": [{"type": "text", "text": "请理解这张产品图片并按要求返回 JSON。"}, {"type": "image_url", "image_url": {"url": image}}]}]


def image_hash(image):
    return hashlib.sha256(str(image).encode("utf-8")).hexdigest()


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
        try:
            os.chmod(STORE, 0o600)
        except OSError:
            pass
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
        "knowledge": {"entries": [{"title": x.get("title", ""), "content": x.get("body", ""), "image": x.get("image", ""), "source": x.get("source", "")} for x in product.get("knowledge", [])]},
        "cards": [{"id": x.get("id", "card_%d" % i), "title": x.get("title", ""), "prompt": x.get("prompt", ""), "enabled": x.get("enabled", True), "capability_id": x.get("capability", "custom")} for i, x in enumerate(product.get("cards", []))],
        "model": {"id": model_id, "name": model.get("name") or (product.get("model") or {}).get("name", ""), "provider": model.get("provider") or (product.get("model") or {}).get("provider", ""), "configured": bool((model.get("base_url") or (product.get("model") or {}).get("base_url")) and (model.get("model") or model.get("name") or (product.get("model") or {}).get("name")) and (model.get("api_key") or (product.get("model") or {}).get("api_key")))},
    }


def find_product(slug, store):
    return next((p for p in store.get("products", []) if p.get("slug") == slug), None)


def merge_catalog(incoming, existing):
    incoming = incoming if isinstance(incoming, dict) else {}
    existing = existing if isinstance(existing, dict) else {}
    result = {"types": list(incoming.get("types", [])), "models": list(incoming.get("models", []))}
    old_models = {x.get("id"): x for x in existing.get("models", []) if isinstance(x, dict)}
    for model in result["models"]:
        old = old_models.get(model.get("id"), {})
        for key in ("api_key", "token", "secret", "base_url", "model", "provider"):
            if not model.get(key) and old.get(key):
                model[key] = old[key]
    return result


def parse_json_object(text):
    value = str(text or "").strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        match = re.search(r"\{.*\}", value, re.S)
        try:
            parsed = json.loads(match.group(0)) if match else None
            return parsed if isinstance(parsed, dict) else None
        except ValueError:
            return None


def run_image_understanding(product_id, expected_hash):
    try:
        store = load_store(); product = next((p for p in store.get("products", []) if p.get("id") == product_id), None)
        if not product or not product.get("image") or image_hash(product["image"]) != expected_hash:
            IMAGE_JOBS.discard((product_id, expected_hash))
            return
        catalog = store.get("catalog", {}); profile = next((x for x in catalog.get("models", []) if x.get("id") == product.get("model_profile_id")), {})
        if not profile.get("api_key") or not profile.get("base_url") or not (profile.get("model") or profile.get("name")):
            result = {"status": "failed", "image_hash": expected_hash, "error": "请先配置支持视觉输入的模型地址、模型标识和 API Key。"}
        else:
            api_key = str(profile["api_key"]); authorization = api_key if api_key.lower().startswith("bearer ") else "Bearer " + api_key
            payload = {"model": profile.get("model") or profile.get("name"), "messages": build_vision_messages(product["image"]), "temperature": .1, "max_tokens": 1000, "stream": False}
            request = urllib.request.Request(normalize_chat_url(profile["base_url"]), data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": authorization}, method="POST")
            response = urllib.request.urlopen(request, timeout=120); data = json.loads(response.read().decode("utf-8")); response.close()
            choices = data.get("choices") or []; message = choices[0].get("message", {}) if choices else {}; content = message.get("content", "") if isinstance(message, dict) else ""
            understood = parse_json_object(content)
            result = ({"status": "ready", "image_hash": expected_hash, **{key: understood.get(key) for key in ("subject", "scene", "use_cases", "suitable_for", "usage_method", "safety")}} if understood else {"status": "failed", "image_hash": expected_hash, "error": "模型返回的图片理解结果不是有效 JSON。"})
    except urllib.error.HTTPError as error:
        result = {"status": "failed", "image_hash": expected_hash, "error": "图片理解模型返回 HTTP %d。" % error.code}
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        result = {"status": "failed", "image_hash": expected_hash, "error": "图片理解请求失败：" + str(error)[:160]}
    store = load_store(); products = store.get("products", [])
    for item in products:
        if item.get("id") == product_id and image_hash(item.get("image", "")) == expected_hash:
            item["image_understanding"] = result
    save_store(store)
    IMAGE_JOBS.discard((product_id, expected_hash))


def queue_image_understanding(products):
    for product in products:
        image = product.get("image")
        if not image:
            continue
        expected_hash = image_hash(image); current = product.get("image_understanding") or {}
        if current.get("image_hash") == expected_hash and current.get("status") in ("queued", "processing", "ready", "failed"):
            continue
        product["image_understanding"] = {"status": "queued", "image_hash": expected_hash}
        key = (product.get("id"), expected_hash)
        if key not in IMAGE_JOBS:
            IMAGE_JOBS.add(key); threading.Thread(target=run_image_understanding, args=key, daemon=True).start()


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
            previous = load_store(); products = body.get("products", []); catalog = merge_catalog(body.get("catalog", {}), previous.get("catalog", {})); save_store({"products": products, "catalog": catalog}); queue_image_understanding(products)
            return self.send_json(200, {"ok": True})
        match = re.fullmatch(r"/api/v1/admin/products/([^/]+)/image-understanding", path)
        if match:
            store = load_store(); product = next((x for x in store.get("products", []) if x.get("id") == unquote(match.group(1))), None)
            if not product: return self.send_json(404, {"error": {"code": "PRODUCT_NOT_FOUND", "message": "产品不存在"}})
            return self.send_json(200, product.get("image_understanding") or {"status": "idle"})
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
        messages = build_messages(type_config, product.get("agent"), [{"title": x.get("title"), "content": x.get("body"), "image": x.get("image")} for x in product.get("knowledge", [])], body.get("messages"), body.get("message", ""), product)
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
