from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server.app import Store, make_handler


class APITest(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.database = self.root / "test.sqlite"
        self.store = Store(self.database)
        self.static = self.root / "dist"
        self.static.mkdir()
        (self.static / "index.html").write_text("<html>grooming app</html>")
        handler = make_handler(self.store, self.static)
        handler.log_message = lambda *args: None
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def request(self, method, path, data=None, headers=None):
        raw = json.dumps(data).encode() if data is not None else None
        request = Request(self.url + path, data=raw, method=method, headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def booking(self, **overrides):
        values = {
            "dogName": "두부", "guardianName": "김보호", "phone": "010-1234-5678",
            "breed": "말티즈", "weight": 4.2, "service": "전체 미용", "date": "2026-01-15",
            "time": "10:00", "duration": 90, "price": 70000, "notes": "발 만질 때 주의",
        }
        return self.request("POST", "/api/appointments", {**values, **overrides})

    def test_health_and_empty_state(self):
        self.assertEqual(self.request("GET", "/api/health"), (200, {"status": "ok"}))
        status, state = self.request("GET", "/api/state?month=2026-01")
        self.assertEqual(status, 200)
        self.assertEqual(state["appointments"], [])
        self.assertEqual(state["summary"]["profit"], 0)

    def test_reservation_persists_across_store_reopen(self):
        status, appointment = self.booking()
        self.assertEqual(status, 201)
        self.assertEqual(appointment["source"], "manual")
        self.assertIsNone(appointment["externalId"])
        reopened = Store(self.database)
        self.assertEqual(reopened.state("2026-01")["appointments"][0]["id"], appointment["id"])

    def test_overlap_and_adjacent_slots(self):
        self.assertEqual(self.booking()[0], 201)
        self.assertEqual(self.booking(time="11:00")[0], 409)
        self.assertEqual(self.booking(time="09:30", duration=60)[0], 409)
        self.assertEqual(self.booking(time="11:30")[0], 201)
        self.assertEqual(self.booking(date="2026-01-16")[0], 201)

    def test_cancelled_slot_can_be_reused_but_cannot_be_settled(self):
        _, appointment = self.booking()
        path = f"/api/appointments/{appointment['id']}"
        self.assertEqual(self.request("PATCH", path, {"status": "cancelled"})[0], 200)
        self.assertEqual(self.booking()[0], 201)
        self.assertEqual(self.request("POST", path + "/settle", {"paymentMethod": "card", "paidDate": "2026-01-15"})[0], 409)
        self.assertEqual(self.request("PATCH", path, {"status": "scheduled"})[0], 409)

    def test_edit_checks_overlap_and_keeps_fields(self):
        _, first = self.booking()
        _, second = self.booking(time="14:00")
        path = f"/api/appointments/{second['id']}"
        self.assertEqual(self.request("PATCH", path, {"time": "10:30"})[0], 409)
        status, result = self.request("PATCH", path, {"notes": "수정 메모", "price": 75000})
        self.assertEqual(status, 200)
        self.assertEqual(result["dogName"], first["dogName"])
        self.assertEqual(result["notes"], "수정 메모")

    def test_duplicate_settlement_is_atomic_and_paid_booking_locked(self):
        _, appointment = self.booking()
        path = f"/api/appointments/{appointment['id']}"
        def pay(_):
            return self.request("POST", path + "/settle", {"paymentMethod": "card", "paidDate": "2026-01-15"})[0]
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(pay, range(2))), [200, 409])
        self.assertEqual(self.request("PATCH", path, {"price": 100})[0], 409)
        self.assertEqual(self.request("PATCH", path, {"status": "cancelled"})[0], 409)
        state = self.request("GET", "/api/state?month=2026-01")[1]
        self.assertEqual(state["summary"]["revenue"], 70000)
        self.assertEqual(state["summary"]["paidCount"], 1)

    def test_summary_uses_payment_date_and_actual_expense_month(self):
        _, appointment = self.booking()
        self.request("POST", f"/api/appointments/{appointment['id']}/settle", {"paymentMethod": "transfer", "paidDate": "2026-02-01"})
        self.booking(time="13:00", price=45000)
        self.request("POST", "/api/expenses", {"date": "2026-02-02", "category": "미용 용품", "amount": 12000, "memo": "샴푸"})
        january = self.request("GET", "/api/state?month=2026-01")[1]["summary"]
        february = self.request("GET", "/api/state?month=2026-02")[1]["summary"]
        self.assertEqual(january, {"revenue": 0, "totalExpenses": 0, "profit": 0, "unpaidAmount": 45000, "paidCount": 0, "shampooCost": 0})
        self.assertEqual(february, {"revenue": 70000, "totalExpenses": 12000, "profit": 58000, "unpaidAmount": 0, "paidCount": 1, "shampooCost": 0})

    def test_validation_rejects_invalid_dates_times_money_and_external_source(self):
        cases = [
            {"date": "2026-02-30"}, {"time": "24:00"}, {"time": "23:30"},
            {"duration": 0}, {"duration": True}, {"price": -1}, {"price": 1.5},
            {"price": True}, {"dogName": " "}, {"guardianName": ""},
            {"weight": -3}, {"weight": float("nan")}, {"weight": 10**400},
            {"weight": -(10**400)}, {"status": []},
            {"source": "naver"}, {"externalId": "upstream-1"}, {"paymentStatus": "paid"},
        ]
        for case in cases:
            with self.subTest(case=case):
                self.assertEqual(self.booking(**case)[0], 400)
        self.assertEqual(self.request("GET", "/api/state?month=2026-99")[0], 400)

    def test_expense_add_delete_and_validation(self):
        data = {"date": "2026-01-15", "category": "소모품", "amount": 20000, "memo": "샴푸"}
        status, expense = self.request("POST", "/api/expenses", data)
        self.assertEqual(status, 201)
        self.assertEqual(self.request("GET", "/api/state?month=2026-01")[1]["summary"]["profit"], -20000)
        for bad in [-1, 0, 1.1, True]:
            self.assertEqual(self.request("POST", "/api/expenses", {**data, "amount": bad})[0], 400)
        self.assertEqual(self.request("DELETE", f"/api/expenses/{expense['id']}")[0], 200)
        self.assertEqual(self.request("DELETE", f"/api/expenses/{expense['id']}", {})[0], 404)
        self.assertEqual(self.request("GET", "/api/state?month=2026-01")[1]["summary"]["profit"], 0)

    def test_settlement_validation_and_missing_resource(self):
        _, appointment = self.booking()
        path = f"/api/appointments/{appointment['id']}/settle"
        self.assertEqual(self.request("POST", path, {"paymentMethod": "crypto", "paidDate": "2026-01-15"})[0], 400)
        self.assertEqual(self.request("POST", path, {"paymentMethod": "cash", "paidDate": "9999-01-15"})[0], 400)
        self.assertEqual(self.request("PATCH", "/api/appointments/" + "0" * 32, {"notes": "x"})[0], 404)

    def test_pricing_put_and_itemized_quote_round_trip(self):
        pricing = self.request("GET", "/api/state?month=2026-01")[1]["pricing"]
        pricing["breedRules"] = [{"id": "poodle", "breed": "푸들", "amount": 5000}]
        self.assertEqual(self.request("PUT", "/api/pricing", pricing), (200, pricing))
        status, appointment = self.booking(
            price=85000, basePrice=70000, breedSurcharge=5000,
            weightSurcharge=0, extraCharges=[{"label": "엉킴", "amount": 10000}],
        )
        self.assertEqual(status, 201)
        self.assertEqual(appointment["staffId"], "owner")
        state = self.request("GET", "/api/state?month=2026-01")[1]
        self.assertEqual(state["appointments"][0]["extraCharges"], [{"label": "엉킴", "amount": 10000}])
        self.assertEqual(state["pricing"], pricing)
        self.assertEqual(state["summary"]["unpaidAmount"], 85000)
        self.assertEqual(self.request("PUT", "/api/pricing", {**pricing, "services": []})[0], 400)

    def test_customer_pet_shampoo_endpoints_and_paid_history_link(self):
        status, customer = self.request("POST", "/api/customers", {"name": "보호자", "phone": "010-0000-0000"})
        self.assertEqual(status, 201)
        status, pet = self.request("POST", "/api/pets", {"customerId": customer["id"], "name": "콩이", "neutered": False})
        self.assertEqual(status, 201)
        self.assertFalse(pet["neutered"])
        status, shampoo = self.request("POST", "/api/shampoos", {"name": "저자극 샴푸", "purchasePrice": 10000, "volumeMl": 1000, "dilutionWaterRatio": 10})
        self.assertEqual(status, 201)
        status, appointment = self.booking(
            basePrice=65000, price=70000,
            shampooUsage=[{"shampooId": shampoo["id"], "usedMl": 12.5, "customerCharge": 5000}],
        )
        self.assertEqual(status, 201)
        self.assertEqual(appointment["shampooCost"], 125)
        self.assertEqual(appointment["shampooSurcharge"], 5000)
        self.assertEqual(self.request("POST", f"/api/appointments/{appointment['id']}/settle", {"paymentMethod": "card", "paidDate": "2026-01-15"})[0], 200)
        status, linked = self.request("POST", f"/api/appointments/{appointment['id']}/link-pet", {"petId": pet["id"]})
        self.assertEqual(status, 200)
        self.assertEqual(linked["customerId"], customer["id"])
        self.assertEqual(linked["dogName"], "두부")
        self.assertEqual(linked["price"], 70000)
        self.assertEqual(self.request("PATCH", f"/api/customers/{customer['id']}", {"notes": "픽업 연락"})[0], 200)
        self.assertEqual(self.request("PATCH", f"/api/pets/{pet['id']}", {"allergies": "향료 주의"})[0], 200)
        self.assertEqual(self.request("PATCH", f"/api/shampoos/{shampoo['id']}", {"archived": True})[0], 200)
        state = self.request("GET", "/api/state?month=2026-01")[1]
        self.assertEqual(state["summary"]["shampooCost"], 125)
        self.assertEqual(state["summary"]["profit"], 70000)
        self.assertEqual(state["customers"][0]["notes"], "픽업 연락")
        self.assertEqual(state["pets"][0]["allergies"], "향료 주의")
        self.assertTrue(state["shampoos"][0]["archived"])

    def test_concurrent_overlap_is_prevented(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: self.booking()[0], range(2)))
        self.assertEqual(sorted(statuses), [201, 409])

    def test_cross_origin_writes_and_path_traversal_rejected(self):
        status, _ = self.request("POST", "/api/appointments", {}, {"Origin": "https://malicious.example"})
        self.assertEqual(status, 403)
        status, _ = self.request("GET", "/%2e%2e/test.sqlite")
        self.assertEqual(status, 403)
        (self.static / "nested").mkdir()
        (self.static / "nested" / "index.html").symlink_to(self.database)
        self.assertEqual(self.request("GET", "/nested/")[0], 403)
        with urlopen(self.url + "/reservations", timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"grooming app", response.read())


if __name__ == "__main__":
    unittest.main()
