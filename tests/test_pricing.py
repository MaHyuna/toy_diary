from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest

from server.app import APIError, Store


class PricingTest(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database = Path(self.directory.name) / "pricing.sqlite"
        self.store = Store(self.database)

    def rules(self):
        return {
            "services": [{"id": "full", "name": "전체 미용", "basePrice": 65000, "duration": 120}],
            "breedRules": [{"id": "poodle", "breed": "푸들", "amount": 5000}],
            "weightRules": [
                {"id": "small", "minWeight": 0, "maxWeight": 5, "amount": 0},
                {"id": "medium", "minWeight": 5, "maxWeight": 10, "amount": 3000},
            ],
        }

    def booking_data(self, **overrides):
        return {
            "dogName": "콩이", "guardianName": "김보호", "phone": "", "breed": "푸들",
            "weight": 6.2, "service": "전체 미용", "date": "2026-01-15",
            "time": "10:00", "duration": 120, "notes": "", "price": 65000,
            **overrides,
        }

    def quote(self, **overrides):
        return self.booking_data(**{
            "basePrice": 65000, "breedSurcharge": 5000, "weightSurcharge": 3000,
            "extraCharges": [{"label": "엉킴", "amount": 7000}, {"label": "입질", "amount": 8000}],
            "price": 88000, **overrides,
        })

    def assert_bad_request(self, function, *args):
        with self.assertRaises(APIError) as raised:
            function(*args)
        self.assertEqual(raised.exception.status, 400)

    def test_default_pricing_and_saved_rules_survive_reopening(self):
        default = self.store.state("2026-01")["pricing"]
        self.assertEqual(len(default["services"]), 4)
        self.assertEqual(default["breedRules"], [])
        self.assertEqual(default["weightRules"], [])
        rules = self.rules()
        self.assertEqual(self.store.update_pricing(rules), rules)
        self.assertEqual(Store(self.database).state("2026-01")["pricing"], rules)

    def test_pricing_rejects_invalid_rules_without_partial_replacement(self):
        saved = self.rules()
        self.store.update_pricing(saved)
        invalid = []
        invalid.append({**saved, "services": []})
        invalid.append({**saved, "services": [{**saved["services"][0], "duration": 481}]})
        invalid.append({**saved, "services": [{**saved["services"][0], "basePrice": True}]})
        invalid.append({**saved, "services": [{**saved["services"][0], "id": ""}]})
        invalid.append({**saved, "services": [{**saved["services"][0], "id": "x" * 81}]})
        invalid.append({**saved, "services": [saved["services"][0], {**saved["services"][0], "id": "another"}]})
        invalid.append({**saved, "breedRules": [{"id": "a", "breed": "POODLE", "amount": 1}, {"id": "b", "breed": "poodle", "amount": 2}]})
        invalid.append({**saved, "breedRules": [{"id": "a", "breed": "푸들", "amount": -1}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": 5, "maxWeight": 5, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": -1, "maxWeight": 5, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": 0, "maxWeight": 151, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": 0, "maxWeight": float("nan"), "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": False, "maxWeight": 5, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": 0, "maxWeight": 10**400, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": -(10**400), "maxWeight": 5, "amount": 0}]})
        invalid.append({**saved, "weightRules": [{"id": "a", "minWeight": 0, "maxWeight": 6, "amount": 0}, {"id": "b", "minWeight": 5, "maxWeight": 10, "amount": 1000}]})
        invalid.append({**saved, "services": [None]})
        for index, rules in enumerate(invalid):
            with self.subTest(case=index):
                self.assert_bad_request(self.store.update_pricing, rules)
                self.assertEqual(self.store.state("2026-01")["pricing"], saved)

    def test_itemized_total_is_computed_and_snapshot_persisted(self):
        data = self.quote()
        del data["price"]
        booking = self.store.create_appointment(data)
        self.assertEqual(booking["price"], 88000)
        self.assertEqual(booking["staffId"], "owner")
        persisted = Store(self.database).state("2026-01")["appointments"][0]
        for key in ("price", "staffId", "basePrice", "breedSurcharge", "weightSurcharge", "extraCharges"):
            self.assertEqual(persisted[key], booking[key])
        self.assertIsInstance(persisted["extraCharges"], list)

    def test_breakdown_rejects_wrong_totals_and_invalid_extras(self):
        cases = [
            {"price": 87999}, {"basePrice": -1}, {"breedSurcharge": 0.5},
            {"weightSurcharge": True}, {"extraCharges": "엉킴"},
            {"extraCharges": [{"label": " ", "amount": 1000}]},
            {"extraCharges": [{"label": "x" * 101, "amount": 1000}]},
            {"extraCharges": [{"label": "입질", "amount": -1000}]},
            {"extraCharges": [{"label": "입질", "amount": True}]},
            {"extraCharges": [{"label": "입질", "amount": 100_000_001}]},
            {"extraCharges": [None]},
            {"extraCharges": [{"label": "엉킴", "amount": 0}] * 21},
            {"basePrice": 100_000_000},
        ]
        for case in cases:
            with self.subTest(case=case):
                data = {**self.quote(), **case}
                if "price" not in case:
                    data.pop("price")
                self.assert_bad_request(self.store.create_appointment, data)
        self.assertEqual(self.store.state("2026-01")["appointments"], [])

    def test_non_money_patch_preserves_quote_and_partial_breakdown_recalculates(self):
        booking = self.store.create_appointment(self.quote())
        changed = self.store.update_appointment(booking["id"], {"notes": "픽업 전 연락"})
        self.assertEqual(changed["price"], 88000)
        self.assertEqual(changed["extraCharges"], booking["extraCharges"])
        changed = self.store.update_appointment(booking["id"], {"extraCharges": [{"label": "엉킴", "amount": 2000}]})
        self.assertEqual(changed["price"], 75000)
        self.assertEqual(changed["basePrice"], 65000)
        self.assertEqual(changed["breedSurcharge"], 5000)
        self.assertEqual(changed["weightSurcharge"], 3000)

    def test_legacy_price_requests_preserve_surcharges_when_patched(self):
        legacy = self.store.create_appointment(self.booking_data())
        self.assertEqual(legacy["basePrice"], 65000)
        self.assertEqual(legacy["breedSurcharge"], 0)
        self.assertEqual(legacy["weightSurcharge"], 0)
        self.assertEqual(legacy["extraCharges"], [])
        changed = self.store.update_appointment(legacy["id"], {"price": 70000})
        self.assertEqual(changed["basePrice"], 70000)
        itemized = self.store.update_appointment(legacy["id"], {
            "basePrice": 65000, "breedSurcharge": 5000, "weightSurcharge": 3000,
            "extraCharges": [{"label": "엉킴", "amount": 7000}, {"label": "입질", "amount": 8000}],
        })
        self.assertEqual(itemized["price"], 88000)
        changed = self.store.update_appointment(legacy["id"], {"price": 90000})
        self.assertEqual(changed["basePrice"], 67000)
        self.assertEqual(changed["extraCharges"], itemized["extraCharges"])
        self.assert_bad_request(self.store.update_appointment, legacy["id"], {"price": 20000})
        self.assertEqual(self.store.state("2026-01")["appointments"][0]["price"], 90000)

    def test_pricing_updates_do_not_rewrite_quotes_or_completed_settlements(self):
        booking = self.store.create_appointment(self.quote())
        rules = self.rules()
        rules["services"][0]["basePrice"] = 90000
        rules["breedRules"][0]["amount"] = 10000
        self.store.update_pricing(rules)
        snapshot = self.store.state("2026-01")["appointments"][0]
        self.assertEqual(snapshot["price"], 88000)
        self.assertEqual(snapshot["basePrice"], 65000)
        paid = self.store.settle(booking["id"], {"paymentMethod": "card", "paidDate": "2026-01-15"})
        self.assertEqual(paid["price"], 88000)
        self.assertEqual(self.store.state("2026-01")["summary"]["revenue"], 88000)
        with self.assertRaises(APIError) as raised:
            self.store.update_appointment(booking["id"], {"extraCharges": []})
        self.assertEqual(raised.exception.status, 409)
        rules["services"][0]["basePrice"] = 95000
        self.store.update_pricing(rules)
        self.assertEqual(self.store.state("2026-01")["summary"]["revenue"], 88000)

    def test_unregistered_staff_cannot_bypass_reservation_conflict(self):
        self.store.create_appointment(self.booking_data())
        self.assert_bad_request(self.store.create_appointment, self.booking_data(staffId="another"))
        with self.assertRaises(APIError) as raised:
            self.store.create_appointment(self.booking_data(staffId="owner"))
        self.assertEqual(raised.exception.status, 409)

    def test_existing_database_migration_preserves_money_and_is_repeatable(self):
        old_database = Path(self.directory.name) / "legacy.sqlite"
        with sqlite3.connect(old_database) as connection:
            connection.executescript("""
                CREATE TABLE appointments (
                    id TEXT PRIMARY KEY,
                    dogName TEXT NOT NULL, guardianName TEXT NOT NULL,
                    phone TEXT NOT NULL, breed TEXT NOT NULL, weight REAL,
                    service TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
                    duration INTEGER NOT NULL, price INTEGER NOT NULL,
                    notes TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
                    externalId TEXT, status TEXT NOT NULL,
                    paymentStatus TEXT NOT NULL DEFAULT 'unpaid',
                    paymentMethod TEXT, paidDate TEXT, createdAt TEXT NOT NULL
                );
                INSERT INTO appointments VALUES (
                    'legacy-id', '콩이', '김보호', '', '푸들', 6.2, '전체 미용',
                    '2026-01-15', '10:00', 120, 72000, '기존 기록', 'manual',
                    NULL, 'completed', 'paid', 'card', '2026-01-15', '2026-01-15T10:00:00+09:00'
                );
            """)
        migrated = Store(old_database).state("2026-01")
        self.assertEqual(migrated["summary"]["revenue"], 72000)
        appointment = migrated["appointments"][0]
        self.assertEqual(appointment["price"], 72000)
        self.assertEqual(appointment["basePrice"], 72000)
        self.assertEqual(appointment["breedSurcharge"], 0)
        self.assertEqual(appointment["weightSurcharge"], 0)
        self.assertEqual(appointment["extraCharges"], [])
        self.assertEqual(appointment["staffId"], "owner")
        self.assertEqual(appointment["notes"], "기존 기록")
        self.assertEqual(Store(old_database).state("2026-01"), migrated)


if __name__ == "__main__":
    unittest.main()
