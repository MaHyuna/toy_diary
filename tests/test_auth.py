"""Owner sessions protect the HTTP boundary; care links grant read-only public scope."""
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server.app import Store, make_handler


class AuthTest(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.store = Store(root / "auth.sqlite")
        self.static = root / "static"
        self.static.mkdir()
        (self.static / "index.html").write_text("<html>public application shell</html>")
        self.clock = [100.0]
        self.url = self.start_server()

    def start_server(self, **overrides):
        options = {"owner_password": "test-owner-password", "secure_cookies": False,
                   "auth_clock": lambda: self.clock[0], **overrides}
        handler = make_handler(self.store, self.static, **options)
        handler.log_message = lambda *args: None
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}"

    def request(self, method, path, body=None, cookie=None, headers=None, url=None):
        request = Request((url or self.url) + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **({"Cookie": cookie} if cookie else {}), **(headers or {})})
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response), response.headers
        except HTTPError as error:
            return error.code, json.load(error), error.headers

    def login(self, cookie=None, url=None):
        status, result, headers = self.request("POST", "/api/auth/login", {"password": "test-owner-password"}, cookie=cookie, url=url)
        self.assertEqual(status, 200)
        self.assertEqual(result, {"authenticated": True, "role": "owner", "configured": True})
        self.assertEqual(headers["Cache-Control"], "no-store")
        return headers["Set-Cookie"].split(";", 1)[0], headers["Set-Cookie"]

    def visit(self):
        return self.store.create_appointment({"dogName": "PRIVATE_DOG", "guardianName": "PRIVATE_GUARDIAN",
            "phone": "010-9999-8888", "breed": "말티즈", "weight": 3.2, "service": "전체 미용",
            "date": "2026-01-15", "time": "10:00", "duration": 60, "basePrice": 65000, "notes": "PRIVATE_NOTE"})

    def test_price_poster_publication_requires_owner_and_valid_image(self):
        cookie, _ = self.login()
        poster = {"image": "data:image/jpeg;base64,/9j/2Q==", "description": "소형견 미용 · 4kg 미만 목욕 15,000"}
        self.assertIsNone(self.request("GET", "/api/public/price-poster")[1])
        for method in ("PUT", "DELETE"):
            self.assertEqual(self.request(method, "/api/price-poster", poster)[0], 401)
        self.assertEqual(self.request("PUT", "/api/price-poster", poster, cookie=cookie)[0], 200)
        self.assertEqual(self.request("GET", "/api/public/price-poster")[1], poster)
        self.assertEqual(self.request("PUT", "/api/price-poster", {**poster,"image":"data:image/svg+xml,<svg/>"}, cookie=cookie)[0], 400)
        self.assertEqual(self.store.price_poster(), poster)
        self.assertEqual(self.request("DELETE", "/api/price-poster", cookie=cookie)[0], 200)
        self.assertIsNone(self.request("GET", "/api/public/price-poster")[1])

    def test_only_owner_can_publish_notices_and_drafts_stay_private(self):
        cookie, _ = self.login()
        visible = {"id": "public", "title": "예약 변경 안내", "body": "변경은 매장에 문의해 주세요.", "published": True}
        hidden = {"id": "private", "title": "PRIVATE_DRAFT", "body": "아직 공개하지 않은 공지", "published": False}
        self.assertEqual(self.request("PUT", "/api/notices", {"notices": [visible, hidden]}, cookie=cookie)[0], 200)
        self.assertEqual(self.request("GET", "/api/public/catalog")[1]["notices"], [visible])
        self.assertEqual(Store(self.store.database).notices(), [visible, hidden])
        status, _, _ = self.request("PUT", "/api/notices", {"notices": [visible, visible]}, cookie=cookie)
        self.assertEqual(status, 400)
        self.assertEqual(self.store.notices(), [visible, hidden])
        status, _, _ = self.request("PUT", "/api/notices", {"notices": [{**visible, "published": "true"}]}, cookie=cookie)
        self.assertEqual(status, 400)
        self.request("PUT", "/api/notices", {"notices": [{**visible, "published": False}, hidden]}, cookie=cookie)
        self.assertEqual(self.request("GET", "/api/public/catalog")[1]["notices"], [])

    def test_anonymous_requests_cannot_read_or_write_any_owner_resource(self):
        visit = self.visit()
        before = self.store.state("2026-01")
        paths = [("GET", "/api/state?month=2026-01"), ("GET", "/api/booking-requests"),
            ("GET", "/api/notices"), ("PUT", "/api/notices"), ("GET", "/api/health"), ("GET", f"/api/appointments/{visit['id']}/care"),
            ("POST", "/api/appointments"), ("PATCH", f"/api/appointments/{visit['id']}"),
            ("POST", f"/api/appointments/{visit['id']}/settle"), ("PUT", "/api/pricing"),
            ("POST", "/api/customers"), ("PATCH", "/api/pets/" + "0" * 32),
            ("POST", f"/api/appointments/{visit['id']}/care/publish"), ("DELETE", "/api/expenses/" + "0" * 32),
            ("GET", "/api/public/state"), ("GET", "/api/auth/unknown")]
        for method, path in paths:
            with self.subTest(method=method, path=path):
                status, response, _ = self.request(method, path, {} if method != "GET" else None)
                self.assertEqual(status, 401)
                self.assertNotIn("PRIVATE_", json.dumps(response))
        self.assertEqual(self.store.state("2026-01"), before)

    def test_cookie_login_rotation_and_logout_revoke_previous_authority(self):
        self.assertEqual(self.request("GET", "/api/auth/session")[1], {"authenticated": False, "role": None, "configured": True})
        cookie, raw = self.login()
        for attribute in ("HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=28800"):
            self.assertIn(attribute, raw)
        self.assertNotIn("Secure", raw)
        self.assertNotIn("test-owner-password", raw)
        self.assertEqual(self.request("GET", "/api/state?month=2026-01", cookie=cookie)[0], 200)
        self.assertTrue(self.request("GET", "/api/auth/session", cookie=cookie)[1]["authenticated"])
        rotated, _ = self.login(cookie)
        self.assertNotEqual(rotated, cookie)
        self.assertEqual(self.request("GET", "/api/state", cookie=cookie)[0], 401)
        self.assertEqual(self.request("GET", "/api/state", cookie=rotated)[0], 200)
        status, response, headers = self.request("POST", "/api/auth/logout", cookie=rotated)
        self.assertEqual(status, 200)
        self.assertFalse(response["authenticated"])
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        self.assertEqual(self.request("GET", "/api/state", cookie=rotated)[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/logout")[0], 200)

    def test_sessions_expire_without_changing_data(self):
        url = self.start_server(session_seconds=60)
        cookie, _ = self.login(url=url)
        before = self.store.state("2026-01")
        self.clock[0] += 61
        self.assertEqual(self.request("GET", "/api/state", cookie=cookie, url=url)[0], 401)
        self.assertFalse(self.request("GET", "/api/auth/session", cookie=cookie, url=url)[1]["authenticated"])
        self.assertEqual(self.store.state("2026-01"), before)

    def test_missing_configuration_fails_closed_while_public_catalog_stays_available(self):
        url = self.start_server(owner_password="")
        self.assertEqual(self.request("GET", "/api/auth/session", url=url)[1], {"authenticated": False, "role": None, "configured": False})
        self.assertEqual(self.request("GET", "/api/state", url=url)[0], 503)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "anything"}, url=url)[0], 503)
        self.assertEqual(self.request("GET", "/api/public/catalog", url=url)[0], 200)

    def test_valid_customer_care_token_cannot_be_used_as_owner_authority(self):
        visit = self.visit()
        self.store.save_care(visit["id"], {"beforeNotes": "公開前", "homeCare": "발을 잘 말려 주세요."})
        record = self.store.publish_care(visit["id"], {})
        token = record["shareToken"]
        status, public, _ = self.request("GET", "/api/public/care/" + token)
        self.assertEqual(status, 200)
        self.assertEqual(public["report"]["homeCare"], "발을 잘 말려 주세요.")
        self.assertNotIn("PRIVATE_GUARDIAN", json.dumps(public))
        self.assertNotIn("PRIVATE_NOTE", json.dumps(public))
        for headers in ({}, {"Authorization": "Bearer " + token}):
            self.assertEqual(self.request("GET", "/api/state?token=" + token, headers=headers)[0], 401)
        self.assertEqual(self.request("GET", "/api/state", cookie="mongle_owner_session=" + token)[0], 401)
        self.assertEqual(self.request("DELETE", f"/api/appointments/{visit['id']}/care/publish", cookie="mongle_owner_session=" + token)[0], 401)
        self.assertEqual(self.request("GET", "/api/public/care/" + token + "/state")[0], 401)
        self.assertEqual(self.request("GET", "/api/public/catalog")[0], 200)

    def test_cross_origin_login_logout_and_mutations_are_rejected(self):
        for origin in ("https://evil.invalid", self.url.replace("http:", "https:"), "null", "http://["):
            self.assertEqual(self.request("POST", "/api/auth/login", {"password": "test-owner-password"}, headers={"Origin": origin})[0], 403)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "test-owner-password"}, headers={"Sec-Fetch-Site": "cross-site"})[0], 403)
        cookie, _ = self.login()
        self.assertEqual(self.request("POST", "/api/auth/logout", cookie=cookie, headers={"Origin": "https://evil.invalid"})[0], 403)
        self.assertEqual(self.request("POST", "/api/customers", {"name": "must not save"}, cookie=cookie, headers={"Origin": "https://evil.invalid"})[0], 403)
        self.assertTrue(self.request("GET", "/api/auth/session", cookie=cookie)[1]["authenticated"])
        self.assertEqual(self.store.state("2026-01")["customers"], [])
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "test-owner-password"}, headers={"Origin": self.url})[0], 200)

    def test_repeated_bad_passwords_are_rate_limited_and_recover_after_window(self):
        for _ in range(5):
            self.assertEqual(self.request("POST", "/api/auth/login", {"password": "wrong"})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "test-owner-password"})[0], 429)
        self.clock[0] += 61
        self.login()

    def test_secure_cookie_is_explicit_for_tls_proxy_configuration(self):
        url = self.start_server(secure_cookies=True)
        _, raw = self.login(url=url)
        self.assertIn("Secure", raw)

    def test_invalid_cookie_and_login_payload_do_not_grant_authority(self):
        for cookie in ("mongle_owner_session=forged", "mongle_owner_session=" + "a" * 43, "role=owner"):
            self.assertEqual(self.request("GET", "/api/state", cookie=cookie)[0], 401)
        for payload in ({}, {"password": "test-owner-password", "role": "owner"}):
            self.assertEqual(self.request("POST", "/api/auth/login", payload)[0], 400)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": None})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "x" * 257})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"password": "\ud800"})[0], 401)
        self.login()
