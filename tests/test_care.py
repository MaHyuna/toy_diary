import base64
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server.app import APIError, Store, make_handler


PHOTO = "data:image/jpeg;base64,/9j/2Q=="


class CareTest(unittest.TestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.database = Path(self.folder.name) / "care.sqlite"
        self.store = Store(self.database)
        self.owner = self.store.create_customer({"name": "PRIVATE GUARDIAN", "phone": "010-9999-8888", "notes": "PRIVATE OWNER NOTE"})
        self.pet = self.store.create_pet({"customerId": self.owner["id"], "name": "몽이", "breed": "말티즈", "weight": 3.2, "healthNotes": "PRIVATE HEALTH NOTE"})

    def visit(self, *, pet=None, date="2026-01-05", time="09:00", **changes):
        chosen = pet or self.pet
        return self.store.create_appointment({"dogName": chosen["name"], "guardianName": self.owner["name"], "phone": self.owner["phone"],
            "petId": chosen["id"], "breed": chosen["breed"], "weight": chosen["weight"], "date": date, "time": time,
            "service": "전체 미용", "duration": 60, "basePrice": 65000, "notes": "PRIVATE VISIT NOTE", **changes})

    def draft(self, **changes):
        return {"beforeNotes": "눈 주변과 발끝 상태 확인", "afterNotes": "눈 주변 정리와 목욕을 마쳤어요.",
            "groomerOpinion": "드라이 중 잠시 쉬면서 진행했어요.", "homeCare": "발이 젖으면 충분히 말려 주세요.",
            "nextVisitDate": "2026-02-05", "photos": [{"id": "before-1", "src": PHOTO, "caption": "미용 전", "stage": "before"},
                {"id": "after-1", "src": PHOTO, "caption": "미용 후", "stage": "after"}], **changes}

    def test_paid_visit_draft_persists_without_changing_financial_or_customer_records(self):
        visit = self.visit()
        self.store.settle(visit["id"], {"paymentMethod": "card", "paidDate": "2026-01-05"})
        before = self.store.state("2026-01")
        self.assertIsNone(self.store.get_care(visit["id"]))
        record = self.store.save_care(visit["id"], self.draft())
        self.assertFalse(record["published"])
        self.assertIsNone(record["shareToken"])
        reopened = Store(self.database).state("2026-01")
        self.assertEqual(reopened["careRecords"], [record])
        for field in ("appointments", "customers", "pets", "summary", "expenses"):
            self.assertEqual(reopened[field], before[field])

    def test_opt_in_state_care_summary_omits_record_body_photos_and_tokens(self):
        visit = self.visit()
        self.store.save_care(visit["id"], self.draft())
        record = self.store.publish_care(visit["id"], {})
        full = self.store.state("2026-01")
        lean = self.store.state("2026-01", care_summary=True)
        self.assertNotIn("careRecords", lean)
        self.assertNotIn("careRecordSummaries", full)
        self.assertEqual(lean["careRecordSummaries"], [{"appointmentId": visit["id"], "published": True, "photoCount": 2, "updatedAt": record["updatedAt"]}])
        self.assertNotIn(PHOTO, json.dumps(lean))
        self.assertNotIn(record["shareToken"], json.dumps(lean))
        self.assertEqual({k: v for k, v in lean.items() if k != "careRecordSummaries"}, {k: v for k, v in full.items() if k != "careRecords"})
        self.assertEqual(self.store.get_care(visit["id"]), record)

    def test_explicit_publish_allowlist_and_draft_isolation(self):
        visit = self.visit()
        saved = self.store.save_care(visit["id"], self.draft())
        published = self.store.publish_care(visit["id"], {})
        self.assertRegex(published["shareToken"], r"^[a-f0-9]{32}$")
        token = published["shareToken"]
        original = self.store.public_care(token)["report"]
        self.assertEqual(set(original), {"id", "petId", "dogName", "breed", "weight", "date", "service", "beforeNotes", "afterNotes", "groomerOpinion", "homeCare", "nextVisitDate", "photos", "publishedAt"})
        self.assertNotIn("PRIVATE", json.dumps(self.store.public_care(token)))
        self.assertEqual(original["photos"], saved["photos"])
        self.store.save_care(visit["id"], {"homeCare": "아직 고객에게 공개하지 않은 새 초안"})
        self.assertEqual(self.store.public_care(token)["report"], original)
        updated = self.store.publish_care(visit["id"], {})
        self.assertEqual(updated["shareToken"], token)
        self.assertEqual(self.store.public_care(token)["report"]["homeCare"], "아직 고객에게 공개하지 않은 새 초안")

    def test_history_contains_only_same_pet_published_summaries(self):
        first = self.visit()
        second = self.visit(date="2026-02-05", weight=3.5)
        unpublished = self.visit(date="2026-03-05")
        other = self.store.create_pet({"customerId": self.owner["id"], "name": "다른 아이", "breed": "말티즈", "weight": 3.2})
        other_visit = self.visit(pet=other, date="2026-04-05")
        for visit in (first, second, unpublished, other_visit):
            self.store.save_care(visit["id"], self.draft(nextVisitDate=""))
        reports = {visit["id"]: self.store.publish_care(visit["id"], {}) for visit in (first, second, other_visit)}
        response = self.store.public_care(reports[first["id"]]["shareToken"])
        self.assertEqual([item["id"] for item in response["history"]], [second["id"], first["id"]])
        self.assertEqual([item["weight"] for item in response["history"]], [3.5, 3.2])
        for item in response["history"]:
            self.assertEqual(set(item), {"id", "petId", "dogName", "date", "service", "weight", "shareToken"})
            self.assertEqual(self.store.public_care(item["shareToken"])["report"]["id"], item["id"])
        unlinked = self.visit(date="2026-05-05", petId=None, customerId=None)
        self.store.save_care(unlinked["id"], self.draft(nextVisitDate=""))
        shared = self.store.publish_care(unlinked["id"], {})
        self.assertEqual(len(self.store.public_care(shared["shareToken"])["history"]), 1)

    def test_revoke_invalidates_token_and_reshare_rotates_it(self):
        visit = self.visit()
        self.store.save_care(visit["id"], self.draft())
        token = self.store.publish_care(visit["id"], {})["shareToken"]
        ended = self.store.unpublish_care(visit["id"])
        self.assertFalse(ended["published"])
        self.assertIsNone(ended["publishedSnapshot"])
        self.assertIsNone(ended["shareToken"])
        with self.assertRaises(APIError) as error:
            self.store.public_care(token)
        self.assertEqual(error.exception.status, 404)
        new_token = self.store.publish_care(visit["id"], {})["shareToken"]
        self.assertNotEqual(new_token, token)
        for invalid in (token, visit["id"], "bad-token"):
            with self.assertRaises(APIError):
                self.store.public_care(invalid)

    def test_invalid_edits_do_not_replace_draft_or_published_snapshot(self):
        visit = self.visit()
        self.store.save_care(visit["id"], self.draft())
        record = self.store.publish_care(visit["id"], {})
        photo = self.draft()["photos"][0]
        invalid = [{"homeCare": "x" * 2001}, {"price": 1}, {"published": True}, {"nextVisitDate": "2026-01-04"},
            {"nextVisitDate": "2026-02-30"}, {"photos": [{**photo, "src": "https://invalid.test/photo.jpg"}]},
            {"photos": [{**photo, "src": "data:image/svg+xml;base64,AAAA"}]}, {"photos": [photo, photo]},
            {"photos": [{**photo, "stage": "unknown"}]}, {"photos": [{**photo, "id": str(i)} for i in range(5)]}]
        for changes in invalid:
            with self.subTest(changes=str(changes)[:80]):
                with self.assertRaises(APIError):
                    self.store.save_care(visit["id"], changes)
                self.assertEqual(self.store.get_care(visit["id"]), record)
        with self.assertRaises(APIError):
            self.store.publish_care(visit["id"], {"homeCare": "저장 없이 덮어쓰기 금지"})
        self.assertEqual(self.store.get_care(visit["id"]), record)

    def test_http_routes_enforce_origin_and_accept_eight_compressed_photos(self):
        visit = self.visit()
        root = Path(self.folder.name) / "static"
        root.mkdir()
        handler = make_handler(self.store, root, owner_password="test-owner-password", secure_cookies=False)
        handler.log_message = lambda *args: None
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join)
        self.addCleanup(server.shutdown)
        cookie = ""
        def request(method, path, body=None, origin=None):
            nonlocal cookie
            req = Request(f"http://127.0.0.1:{server.server_port}" + path, method=method,
                data=json.dumps(body).encode() if body is not None else None,
                headers={"Content-Type": "application/json", "Cookie": cookie, **({"Origin": origin} if origin else {})})
            try:
                with urlopen(req, timeout=5) as response:
                    if response.headers.get("Set-Cookie"):
                        cookie = response.headers["Set-Cookie"].split(";", 1)[0]
                    return response.status, json.load(response)
            except HTTPError as error:
                return error.code, json.load(error)
        self.assertEqual(request("POST", "/api/auth/login", {"password": "test-owner-password"})[0], 200)
        path = f"/api/appointments/{visit['id']}/care"
        self.assertEqual(request("GET", path), (200, None))
        self.assertEqual(request("PATCH", path, self.draft(), "https://evil.invalid")[0], 403)
        src = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"\0" * 250000 + b"\xff\xd9").decode()
        photos = [{"id": str(i), "src": src, "stage": "before" if i < 4 else "after", "caption": ""} for i in range(8)]
        self.assertEqual(request("POST", path, self.draft(photos=photos))[0], 200)
        status, record = request("POST", path + "/publish", {})
        self.assertEqual(status, 200)
        status, lean = request("GET", "/api/state?month=2026-01&care=summary")
        self.assertEqual(status, 200)
        self.assertNotIn("careRecords", lean)
        self.assertEqual(lean["careRecordSummaries"], [{"appointmentId": visit["id"], "published": True, "photoCount": 8, "updatedAt": record["updatedAt"]}])
        public_path = "/api/public/care/" + record["shareToken"]
        self.assertEqual(request("GET", public_path)[0], 200)
        self.assertEqual(request("DELETE", path + "/publish", origin="https://evil.invalid")[0], 403)
        self.assertEqual(request("DELETE", path + "/publish")[0], 200)
        self.assertEqual(request("GET", public_path)[0], 404)
        # An oversized length is rejected before reading the body. Sending megabytes
        # with urllib races that rejection and can produce a client-side BrokenPipe.
        connection = HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
        try:
            connection.putrequest("POST", path)
            connection.putheader("Content-Type", "application/json")
            connection.putheader("Content-Length", "3000001")
            connection.putheader("Cookie", cookie)
            connection.endheaders()
            self.assertEqual(connection.getresponse().status, 413)
        finally:
            connection.close()
