from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest

from server.app import APIError, Store


class CRMTest(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database = Path(self.directory.name) / "crm.sqlite"
        self.store = Store(self.database)

    def customer(self, **overrides):
        return self.store.create_customer({"name": "김보호", "phone": "010-1234-5678", "notes": "오후 연락 선호", **overrides})

    def pet(self, customer_id, **overrides):
        return self.store.create_pet({
            "customerId": customer_id, "name": "두부", "breed": "말티즈", "weight": 4.2,
            "birthDate": "2021-03-15", "sex": "male", "neutered": True,
            "allergies": "향료 알레르기", "healthNotes": "슬개골 주의", "behaviorNotes": "발 만질 때 예민함",
            "preferredStyle": "얼굴 둥글게", "visitIntervalWeeks": 6, **overrides,
        })

    def shampoo(self, **overrides):
        return self.store.create_shampoo({
            "name": "저자극 샴푸", "purchasePrice": 10000, "volumeMl": 100,
            "dilutionWaterRatio": 10, "notes": "충분히 헹굼", "archived": False, **overrides,
        })

    def booking_data(self, **overrides):
        return {
            "dogName": "예약 당시 두부", "guardianName": "예약 당시 보호자", "phone": "010-1111-2222",
            "breed": "말티즈", "weight": 4.2, "service": "전체 미용", "date": "2026-01-15",
            "time": "10:00", "duration": 120, "notes": "기존 예약 메모", "basePrice": 65000,
            **overrides,
        }

    def assert_bad_request(self, function, *args):
        with self.assertRaises(APIError) as raised:
            function(*args)
        self.assertEqual(raised.exception.status, 400)

    def test_customer_and_pet_details_persist_and_support_partial_edits(self):
        owner = self.customer()
        pet = self.pet(owner["id"])
        self.store.update_customer(owner["id"], {"notes": "변경된 연락 메모"})
        self.store.update_pet(pet["id"], {"behaviorNotes": "드라이어 소리에 민감", "visitIntervalWeeks": 8})
        state = Store(self.database).state("2026-01")
        saved_owner = state["customers"][0]
        saved_pet = state["pets"][0]
        self.assertEqual(saved_owner["id"], owner["id"])
        self.assertEqual(saved_owner["name"], "김보호")
        self.assertEqual(saved_owner["notes"], "변경된 연락 메모")
        self.assertEqual(saved_pet["id"], pet["id"])
        self.assertEqual(saved_pet["customerId"], owner["id"])
        self.assertEqual(saved_pet["allergies"], "향료 알레르기")
        self.assertEqual(saved_pet["preferredStyle"], "얼굴 둥글게")
        self.assertEqual(saved_pet["visitIntervalWeeks"], 8)
        self.assertEqual(saved_pet["behaviorNotes"], "드라이어 소리에 민감")
        self.assertIs(saved_pet["neutered"], True)

    def test_photos_persist_across_edits_reopen_and_reject_invalid_inputs(self):
        owner = self.customer()
        pet = self.pet(owner["id"])
        photo = {"id": "test-photo", "src": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0+iiiuI5z/9k=", "caption": "미용 후 · 곰돌이 컷", "date": "2026-01-15"}
        saved = self.store.update_pet(pet["id"], {"photos": [photo]})
        self.assertEqual(saved["photos"], [photo])
        self.store.update_pet(pet["id"], {"preferredStyle": "둥근 얼굴"})
        reopened = Store(self.database).state("2026-01")["pets"][0]
        self.assertEqual(reopened["photos"], [photo])
        for invalid in [[photo] * 7, [{**photo, "src": "data:image/svg+xml;base64,AAAA"}], [{**photo, "src": "data:image/jpeg;base64,AAAA"}], [{**photo, "date": "invalid"}]]:
            self.assert_bad_request(self.store.update_pet, pet["id"], {"photos": invalid})
        self.assertEqual(Store(self.database).state("2026-01")["pets"][0]["photos"], [photo])
        self.store.update_pet(pet["id"], {"photos": []})
        self.assertEqual(Store(self.database).state("2026-01")["pets"][0]["photos"], [])

    def test_customer_pet_validation_rejects_bad_records(self):
        with self.assertRaises(APIError) as raised:
            self.customer(name=" ")
        self.assertEqual(raised.exception.status, 400)
        owner = self.customer()
        cases = [
            {"name": ""}, {"weight": 0}, {"weight": float("nan")}, {"weight": True},
            {"birthDate": "2026-02-30"}, {"birthDate": "9999-01-01"},
            {"sex": "other"}, {"neutered": "yes"}, {"visitIntervalWeeks": 0},
            {"visitIntervalWeeks": 105}, {"visitIntervalWeeks": True},
            {"allergies": "x" * 2001}, {"customerId": "missing-customer"},
        ]
        for case in cases:
            with self.subTest(case=case):
                with self.assertRaises(APIError) as raised:
                    self.pet(owner["id"], **case)
                self.assertEqual(raised.exception.status, 400)
        self.assertEqual(self.store.state("2026-01")["pets"], [])
        pet = self.pet(owner["id"], birthDate="", neutered=None, visitIntervalWeeks=None)
        self.assertEqual(pet["birthDate"], "")
        self.assertIsNone(pet["neutered"])

    def test_appointment_links_resolve_owner_and_preserve_name_snapshots(self):
        owner = self.customer()
        pet = self.pet(owner["id"])
        booking = self.store.create_appointment(self.booking_data(petId=pet["id"]))
        self.assertEqual(booking["customerId"], owner["id"])
        self.assertEqual(booking["petId"], pet["id"])
        self.store.update_customer(owner["id"], {"name": "변경된 보호자"})
        self.store.update_pet(pet["id"], {"name": "변경된 반려견"})
        snapshot = self.store.state("2026-01")["appointments"][0]
        self.assertEqual(snapshot["dogName"], booking["dogName"])
        self.assertEqual(snapshot["guardianName"], booking["guardianName"])
        self.assertEqual(snapshot["phone"], booking["phone"])
        self.assertEqual(snapshot["price"], 65000)

    def test_missing_and_conflicting_customer_associations_are_rejected(self):
        owner = self.customer()
        other = self.customer(name="다른 보호자")
        pet = self.pet(owner["id"])
        for values in [
            {"petId": "missing-pet"}, {"customerId": "missing-owner"},
            {"petId": pet["id"], "customerId": other["id"]},
        ]:
            with self.subTest(values=values):
                self.assert_bad_request(self.store.create_appointment, self.booking_data(**values))
        self.assertEqual(self.store.state("2026-01")["appointments"], [])

    def test_clearing_pet_link_also_clears_derived_customer_link(self):
        owner = self.customer()
        pet = self.pet(owner["id"])
        booking = self.store.create_appointment(self.booking_data(petId=pet["id"]))
        unlinked = self.store.update_appointment(booking["id"], {"petId": None})
        self.assertIsNone(unlinked["petId"])
        self.assertIsNone(unlinked["customerId"])
        for key in ("dogName", "guardianName", "phone", "price"):
            self.assertEqual(unlinked[key], booking[key])
        persisted = Store(self.database).state("2026-01")["appointments"][0]
        self.assertIsNone(persisted["petId"])
        self.assertIsNone(persisted["customerId"])

    def test_pet_owner_cannot_change_once_booking_history_is_linked(self):
        owner = self.customer()
        other_owner = self.customer(name="다른 보호자")
        pet = self.pet(owner["id"])
        self.store.create_appointment(self.booking_data(petId=pet["id"]))
        with self.assertRaises(APIError) as raised:
            self.store.update_pet(pet["id"], {"customerId": other_owner["id"]})
        self.assertEqual(raised.exception.status, 409)
        state = self.store.state("2026-01")
        self.assertEqual(state["pets"][0]["customerId"], owner["id"])
        self.assertEqual(state["appointments"][0]["customerId"], owner["id"])

    def test_shampoo_catalog_persists_and_validates_inputs(self):
        shampoo = self.shampoo()
        changed = self.store.update_shampoo(shampoo["id"], {"name": "새 이름", "archived": True})
        self.assertEqual(changed["purchasePrice"], 10000)
        self.assertIs(changed["archived"], True)
        self.assertEqual(Store(self.database).state("2026-01")["shampoos"][0], changed)
        for values in [
            {"name": ""}, {"purchasePrice": -1}, {"purchasePrice": True},
            {"volumeMl": 0}, {"volumeMl": 1_000_001}, {"volumeMl": float("inf")},
            {"dilutionWaterRatio": -1}, {"dilutionWaterRatio": 1001},
            {"archived": "yes"},
        ]:
            with self.subTest(values=values):
                with self.assertRaises(APIError) as raised:
                    self.shampoo(**values)
                self.assertEqual(raised.exception.status, 400)

    def test_shampoo_cost_uses_half_up_rounding_and_customer_charge(self):
        shampoo = self.shampoo(purchasePrice=5, volumeMl=2, dilutionWaterRatio=100)
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[{
            "shampooId": shampoo["id"], "usedMl": 1, "customerCharge": 2000,
        }]))
        self.assertEqual(booking["shampooCost"], 3)
        self.assertEqual(booking["shampooSurcharge"], 2000)
        self.assertEqual(booking["price"], 67000)
        usage = booking["shampooUsage"][0]
        self.assertEqual(usage["cost"], 3)
        self.assertEqual(usage["name"], shampoo["name"])
        self.assertEqual(usage["purchasePrice"], 5)
        self.assertEqual(usage["volumeMl"], 2)
        self.assertEqual(Store(self.database).state("2026-01")["appointments"][0]["shampooUsage"], booking["shampooUsage"])

    def test_catalog_edit_and_unchanged_usage_preserve_original_cost_snapshot(self):
        shampoo = self.shampoo()
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[{
            "shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000,
        }]))
        self.assertEqual(booking["shampooCost"], 1000)
        self.store.update_shampoo(shampoo["id"], {"purchasePrice": 20000, "name": "리뉴얼 샴푸"})
        snapshot = self.store.state("2026-01")["appointments"][0]
        self.assertEqual(snapshot["shampooUsage"], booking["shampooUsage"])
        notes_change = self.store.update_appointment(booking["id"], {"notes": "메모만 변경"})
        self.assertEqual(notes_change["shampooUsage"], booking["shampooUsage"])
        same_usage = self.store.update_appointment(booking["id"], {"shampooUsage": booking["shampooUsage"]})
        self.assertEqual(same_usage["shampooCost"], 1000)
        self.assertEqual(same_usage["shampooUsage"][0]["name"], "저자극 샴푸")
        changed = self.store.update_appointment(booking["id"], {"shampooUsage": [{
            "shampooId": shampoo["id"], "usedMl": 20, "customerCharge": 8000,
        }]})
        self.assertEqual(changed["shampooCost"], 4000)
        self.assertEqual(changed["shampooUsage"][0]["name"], "리뉴얼 샴푸")
        self.assertEqual(changed["price"], 73000)

    def test_charge_only_change_preserves_physical_shampoo_snapshot_after_archiving(self):
        shampoo = self.shampoo()
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[{
            "shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000,
        }]))
        self.store.update_shampoo(shampoo["id"], {
            "purchasePrice": 20000, "name": "리뉴얼 샴푸", "archived": True,
        })
        changed = self.store.update_appointment(booking["id"], {"shampooUsage": [{
            "shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 8000,
        }]})
        original_usage = booking["shampooUsage"][0]
        changed_usage = changed["shampooUsage"][0]
        for key in ("shampooId", "name", "usedMl", "purchasePrice", "volumeMl", "cost"):
            self.assertEqual(changed_usage[key], original_usage[key], key)
        self.assertEqual(changed_usage["customerCharge"], 8000)
        self.assertEqual(changed["shampooCost"], 1000)
        self.assertEqual(changed["shampooSurcharge"], 8000)
        self.assertEqual(changed["price"], 73000)

    def test_oversized_integer_measurements_return_validation_errors(self):
        owner = self.customer()
        shampoo = self.shampoo()
        for value in (10 ** 400, -(10 ** 400)):
            with self.subTest(field="volumeMl", sign=value > 0):
                self.assert_bad_request(lambda: self.shampoo(volumeMl=value))
            with self.subTest(field="dilutionWaterRatio", sign=value > 0):
                self.assert_bad_request(lambda: self.shampoo(dilutionWaterRatio=value))
            with self.subTest(field="weight", sign=value > 0):
                self.assert_bad_request(lambda: self.pet(owner["id"], weight=value))
            with self.subTest(field="usedMl", sign=value > 0):
                self.assert_bad_request(self.store.create_appointment, self.booking_data(shampooUsage=[{
                    "shampooId": shampoo["id"], "usedMl": value, "customerCharge": 5000,
                }]))

    def test_client_cannot_forge_shampoo_cost_or_total(self):
        shampoo = self.shampoo()
        usage = {"shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000}
        for totals in [{"shampooCost": 1}, {"shampooSurcharge": 0}, {"price": 65000}]:
            with self.subTest(totals=totals):
                self.assert_bad_request(self.store.create_appointment, self.booking_data(shampooUsage=[usage], **totals))
        forged = {**usage, "cost": 1, "name": "가짜 이름", "purchasePrice": 1, "volumeMl": 1000000}
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[forged]))
        self.assertEqual(booking["shampooCost"], 1000)
        self.assertEqual(booking["shampooUsage"][0]["name"], shampoo["name"])
        self.assertEqual(booking["price"], 70000)

    def test_shampoo_usage_validation_and_archived_catalog_behavior(self):
        shampoo = self.shampoo()
        usage = {"shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000}
        invalid = [
            [{**usage, "shampooId": "missing"}], [{**usage, "usedMl": 0}],
            [{**usage, "usedMl": float("nan")}], [{**usage, "usedMl": True}],
            [{**usage, "usedMl": 1000001}], [{**usage, "customerCharge": -1}],
            [{**usage, "customerCharge": True}], [usage, usage], [usage] * 21,
        ]
        for usages in invalid:
            with self.subTest(usages=usages):
                self.assert_bad_request(self.store.create_appointment, self.booking_data(shampooUsage=usages))
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[usage]))
        self.store.update_shampoo(shampoo["id"], {"archived": True})
        self.assert_bad_request(self.store.create_appointment, self.booking_data(time="14:00", shampooUsage=[usage]))
        preserved = self.store.update_appointment(booking["id"], {"shampooUsage": [usage], "notes": "기존 사용 내역 유지"})
        self.assertEqual(preserved["shampooCost"], 1000)

    def test_monthly_shampoo_cost_follows_paid_date_without_double_deducting_profit(self):
        shampoo = self.shampoo()
        usage = [{"shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000}]
        paid = self.store.create_appointment(self.booking_data(shampooUsage=usage))
        self.store.create_appointment(self.booking_data(time="14:00", shampooUsage=usage))
        self.store.settle(paid["id"], {"paymentMethod": "card", "paidDate": "2026-02-01"})
        self.store.create_expense({"date": "2026-02-01", "category": "미용 용품", "amount": 10000, "memo": "샴푸 구입"})
        january = self.store.state("2026-01")["summary"]
        february = self.store.state("2026-02")["summary"]
        self.assertEqual(january["shampooCost"], 0)
        self.assertEqual(february["shampooCost"], 1000)
        self.assertEqual(february["revenue"], 70000)
        self.assertEqual(february["totalExpenses"], 10000)
        self.assertEqual(february["profit"], 60000)

    def test_paid_history_can_be_linked_without_changing_financial_or_name_snapshots(self):
        shampoo = self.shampoo()
        booking = self.store.create_appointment(self.booking_data(shampooUsage=[{
            "shampooId": shampoo["id"], "usedMl": 10, "customerCharge": 5000,
        }]))
        paid = self.store.settle(booking["id"], {"paymentMethod": "cash", "paidDate": "2026-01-15"})
        owner = self.customer()
        pet = self.pet(owner["id"])
        linked = self.store.link_pet(paid["id"], {"petId": pet["id"]})
        self.assertEqual(linked["petId"], pet["id"])
        self.assertEqual(linked["customerId"], owner["id"])
        for key, value in paid.items():
            if key not in {"petId", "customerId"}:
                self.assertEqual(linked[key], value, key)
        self.assertEqual(self.store.link_pet(paid["id"], {"petId": pet["id"]}), linked)
        second_pet = self.pet(owner["id"], name="다른 반려견")
        with self.assertRaises(APIError) as raised:
            self.store.link_pet(paid["id"], {"petId": second_pet["id"]})
        self.assertEqual(raised.exception.status, 409)
        with self.assertRaises(APIError) as raised:
            self.store.update_appointment(paid["id"], {"shampooUsage": []})
        self.assertEqual(raised.exception.status, 409)

    def test_legacy_database_migration_preserves_totals_and_defaults_crm_fields(self):
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
        state = Store(old_database).state("2026-01")
        appointment = state["appointments"][0]
        self.assertIsNone(appointment["petId"])
        self.assertIsNone(appointment["customerId"])
        self.assertEqual(appointment["shampooUsage"], [])
        self.assertEqual(appointment["shampooSurcharge"], 0)
        self.assertEqual(appointment["shampooCost"], 0)
        self.assertEqual(appointment["price"], 72000)
        self.assertEqual(state["summary"]["revenue"], 72000)
        self.assertEqual(state["summary"]["shampooCost"], 0)
        self.assertEqual(state["customers"], [])
        self.assertEqual(state["pets"], [])
        self.assertEqual(state["shampoos"], [])
        self.assertEqual(Store(old_database).state("2026-01"), state)


if __name__ == "__main__":
    unittest.main()
