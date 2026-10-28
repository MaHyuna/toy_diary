"""Single-owner local application server. Bind to loopback until authentication is added."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
from pathlib import Path
import re
import sqlite3
import traceback
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent.parent
SEOUL = ZoneInfo("Asia/Seoul")
EDITABLE_FIELDS = {
    "dogName", "guardianName", "phone", "breed", "weight", "service", "date",
    "time", "duration", "price", "notes", "status", "staffId",
    "basePrice", "breedSurcharge", "weightSurcharge", "extraCharges",
    "customerId", "petId", "shampooUsage", "shampooSurcharge", "shampooCost",
}
PAYMENT_METHODS = {"card", "cash", "transfer"}
BREAKDOWN_FIELDS = {"basePrice", "breedSurcharge", "weightSurcharge", "extraCharges"}
CUSTOMER_FIELDS = {"name", "phone", "notes"}
PET_FIELDS = {"customerId", "name", "breed", "weight", "birthDate", "sex", "neutered", "allergies", "healthNotes", "behaviorNotes", "preferredStyle", "visitIntervalWeeks"}
SHAMPOO_FIELDS = {"name", "purchasePrice", "volumeMl", "dilutionWaterRatio", "notes", "archived"}
DEFAULT_PRICING = {
    "services": [
        {"id": "full", "name": "전체 미용", "basePrice": 65000, "duration": 120},
        {"id": "bath", "name": "목욕 · 위생 미용", "basePrice": 35000, "duration": 60},
        {"id": "partial", "name": "부분 미용", "basePrice": 25000, "duration": 40},
        {"id": "spotting", "name": "스포팅", "basePrice": 80000, "duration": 150},
    ],
    "breedRules": [],
    "weightRules": [],
}


class APIError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def today() -> str:
    return datetime.now(SEOUL).date().isoformat()


def timestamp() -> str:
    return datetime.now(SEOUL).isoformat(timespec="seconds")


def valid_date(value, label="날짜") -> str:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise APIError(f"{label}를 올바르게 입력해 주세요.")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise APIError(f"{label}를 올바르게 입력해 주세요.") from None
    return value


def valid_month(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}", value):
        raise APIError("조회할 월을 YYYY-MM 형식으로 입력해 주세요.")
    valid_date(value + "-01", "조회할 월")
    return value


def text_field(data, key, label, *, required=False, maximum=200):
    value = data.get(key, "")
    if not isinstance(value, str):
        raise APIError(f"{label}를 올바르게 입력해 주세요.")
    value = value.strip()
    if required and not value:
        raise APIError(f"{label}를 입력해 주세요.")
    if len(value) > maximum:
        raise APIError(f"{label}는 {maximum}자 이내로 입력해 주세요.")
    return value


def integer(value, label, *, minimum=0, maximum=100_000_000):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise APIError(f"{label}는 {minimum:,}~{maximum:,} 사이의 정수로 입력해 주세요.")
    return value


def number(value, label, *, minimum=0, maximum=1_000_000, allow_minimum=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value > maximum or (value < minimum if allow_minimum else value <= minimum) or not math.isfinite(value):
        raise APIError(f"{label}의 범위를 확인해 주세요.")
    return value


def validate_customer(data):
    return {
        "name": text_field(data, "name", "보호자 이름", required=True, maximum=80),
        "phone": text_field(data, "phone", "연락처", maximum=40),
        "notes": text_field(data, "notes", "보호자 메모", maximum=2000),
    }


def validate_pet(data):
    result = {
        "customerId": text_field(data, "customerId", "보호자", required=True, maximum=80),
        "name": text_field(data, "name", "반려견 이름", required=True, maximum=80),
        "breed": text_field(data, "breed", "견종", maximum=80),
    }
    result["weight"] = None if data.get("weight") is None else number(data["weight"], "몸무게", maximum=150)
    birth = data.get("birthDate", "")
    if birth != "":
        valid_date(birth, "생일")
        if birth > today():
            raise APIError("생일은 오늘 이후로 지정할 수 없습니다.")
    result["birthDate"] = birth
    sex = data.get("sex", "unknown")
    if not isinstance(sex, str) or sex not in {"unknown", "male", "female"}:
        raise APIError("성별을 확인해 주세요.")
    result["sex"] = sex
    neutered = data.get("neutered")
    if neutered is not None and not isinstance(neutered, bool):
        raise APIError("중성화 여부를 확인해 주세요.")
    result["neutered"] = neutered
    for key, label in (("allergies", "알레르기"), ("healthNotes", "건강 정보"), ("behaviorNotes", "성향 정보"), ("preferredStyle", "선호 스타일")):
        result[key] = text_field(data, key, label, maximum=2000)
    interval = data.get("visitIntervalWeeks")
    result["visitIntervalWeeks"] = None if interval is None else integer(interval, "방문 주기(주)", minimum=1, maximum=104)
    return result


def validate_shampoo(data):
    result = {
        "name": text_field(data, "name", "샴푸 이름", required=True, maximum=100),
        "purchasePrice": integer(data.get("purchasePrice"), "구매 금액"),
        "volumeMl": number(data.get("volumeMl"), "제품 용량"),
        "dilutionWaterRatio": number(data.get("dilutionWaterRatio", 0), "물 희석비", maximum=1000, allow_minimum=True),
        "notes": text_field(data, "notes", "샴푸 메모", maximum=2000),
    }
    archived = data.get("archived", False)
    if not isinstance(archived, bool):
        raise APIError("샴푸 사용 중지 여부를 확인해 주세요.")
    result["archived"] = archived
    return result


def validate_breakdown(data):
    result = {
        "basePrice": integer(data.get("basePrice", data.get("price")), "기본 요금"),
        "breedSurcharge": integer(data.get("breedSurcharge", 0), "견종 추가 요금"),
        "weightSurcharge": integer(data.get("weightSurcharge", 0), "몸무게 추가 요금"),
    }
    extras = data.get("extraCharges", [])
    if not isinstance(extras, list) or len(extras) > 20:
        raise APIError("추가 요금은 최대 20개까지 입력해 주세요.")
    normalized = []
    for extra in extras:
        if not isinstance(extra, dict) or set(extra) != {"label", "amount"}:
            raise APIError("추가 요금의 항목과 금액을 입력해 주세요.")
        normalized.append({
            "label": text_field(extra, "label", "추가 요금 항목", required=True, maximum=100),
            "amount": integer(extra.get("amount"), "추가 요금"),
        })
    total = sum(result.values()) + sum(extra["amount"] for extra in normalized) + integer(data.get("shampooSurcharge", 0), "샴푸 고객 추가 요금")
    result["extraCharges"] = normalized
    result["price"] = integer(total, "예약 총액")
    if "price" in data and integer(data["price"], "예약 금액") != total:
        raise APIError("예약 총액과 요금 상세 합계가 일치하지 않습니다.")
    return result


def validate_pricing(data):
    if not isinstance(data, dict) or set(data) != {"services", "breedRules", "weightRules"}:
        raise APIError("서비스·견종·몸무게 요금표를 모두 입력해 주세요.")
    result = {}
    for key, maximum in (("services", 30), ("breedRules", 100), ("weightRules", 100)):
        rows = data[key]
        if not isinstance(rows, list) or len(rows) > maximum or (key == "services" and not rows):
            raise APIError("서비스는 1~30개, 견종·몸무게 규칙은 각각 100개 이하로 입력해 주세요.")
        items, ids, names = [], set(), set()
        for row in rows:
            fields = {
                "services": {"id", "name", "basePrice", "duration"},
                "breedRules": {"id", "breed", "amount"},
                "weightRules": {"id", "minWeight", "maxWeight", "amount"},
            }[key]
            if not isinstance(row, dict) or set(row) != fields:
                raise APIError("요금표 입력 항목을 확인해 주세요.")
            item_id = text_field(row, "id", "요금 항목 ID", required=True, maximum=80)
            if item_id in ids:
                raise APIError("요금 항목 ID가 중복되었습니다.")
            ids.add(item_id)
            item = {"id": item_id}
            if key in {"services", "breedRules"}:
                name_key = "name" if key == "services" else "breed"
                name = text_field(row, name_key, "서비스 이름" if key == "services" else "견종", required=True, maximum=100 if key == "services" else 80)
                if name.casefold() in names:
                    raise APIError("같은 서비스 이름 또는 견종을 중복해서 등록할 수 없습니다.")
                names.add(name.casefold())
                item[name_key] = name
            if key == "services":
                item["basePrice"] = integer(row.get("basePrice"), "서비스 기본 요금")
                item["duration"] = integer(row.get("duration"), "서비스 소요 시간(분)", minimum=1, maximum=480)
            else:
                item["amount"] = integer(row.get("amount"), "추가 요금")
            if key == "weightRules":
                low, high = row.get("minWeight"), row.get("maxWeight")
                if any(isinstance(value, bool) or not isinstance(value, (int, float)) or (isinstance(value, float) and not math.isfinite(value)) for value in (low, high)) or not 0 <= low < high <= 150:
                    raise APIError("몸무게 범위는 0~150kg 안에서 최소보다 최대가 커야 합니다.")
                item.update({"minWeight": low, "maxWeight": high})
            items.append(item)
        if key == "weightRules":
            ordered = sorted(items, key=lambda item: item["minWeight"])
            if any(previous["maxWeight"] > current["minWeight"] for previous, current in zip(ordered, ordered[1:])):
                raise APIError("몸무게 요금 구간이 겹칩니다. 경계를 확인해 주세요.")
        result[key] = items
    return result


def validate_appointment(data):
    result = {
        "dogName": text_field(data, "dogName", "반려견 이름", required=True, maximum=80),
        "guardianName": text_field(data, "guardianName", "보호자 이름", required=True, maximum=80),
        "phone": text_field(data, "phone", "연락처", maximum=40),
        "breed": text_field(data, "breed", "견종", maximum=80),
        "service": text_field(data, "service", "서비스", required=True, maximum=100),
        "notes": text_field(data, "notes", "메모", maximum=2000),
        "date": valid_date(data.get("date"), "예약 날짜"),
        "duration": integer(data.get("duration"), "소요 시간(분)", minimum=1, maximum=480),
    }
    result.update(validate_breakdown(data))
    result.update({
        "customerId": data.get("customerId"), "petId": data.get("petId"),
        "shampooUsage": data.get("shampooUsage", []),
        "shampooSurcharge": data.get("shampooSurcharge", 0),
        "shampooCost": data.get("shampooCost", 0),
    })
    if data.get("staffId", "owner") != "owner":
        raise APIError("현재는 원장님 한 명의 예약만 관리할 수 있습니다.")
    result["staffId"] = "owner"
    time = data.get("time")
    if not isinstance(time, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", time):
        raise APIError("예약 시간을 HH:MM 형식으로 입력해 주세요.")
    if minutes(time) + result["duration"] > 1440:
        raise APIError("예약은 같은 날짜 안에 끝나도록 입력해 주세요.")
    result["time"] = time
    weight = data.get("weight")
    if weight is not None and (
        isinstance(weight, bool) or not isinstance(weight, (float, int))
        or not 0 < weight <= 150 or not math.isfinite(weight)
    ):
        raise APIError("몸무게는 0kg 초과 150kg 이하로 입력해 주세요.")
    result["weight"] = weight
    status = data.get("status", "scheduled")
    if not isinstance(status, str) or status not in {"scheduled", "completed", "cancelled"}:
        raise APIError("예약 상태가 올바르지 않습니다.")
    result["status"] = status
    return result


def minutes(value):
    hour, minute = map(int, value.split(":"))
    return hour * 60 + minute


class Store:
    def __init__(self, database: str | Path):
        self.database = Path(database)
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with self.connect(write=True) as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS appointments (
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
                CREATE INDEX IF NOT EXISTS appointment_date ON appointments(date, time);
                CREATE UNIQUE INDEX IF NOT EXISTS external_reservation
                    ON appointments(source, externalId) WHERE externalId IS NOT NULL;
                CREATE TABLE IF NOT EXISTS expenses (
                    id TEXT PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL,
                    amount INTEGER NOT NULL, memo TEXT NOT NULL, createdAt TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS expense_date ON expenses(date);
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
                    notes TEXT NOT NULL, createdAt TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS pets (
                    id TEXT PRIMARY KEY, customerId TEXT NOT NULL, name TEXT NOT NULL,
                    breed TEXT NOT NULL, weight REAL, birthDate TEXT NOT NULL,
                    sex TEXT NOT NULL, neutered INTEGER,
                    allergies TEXT NOT NULL, healthNotes TEXT NOT NULL,
                    behaviorNotes TEXT NOT NULL, preferredStyle TEXT NOT NULL,
                    visitIntervalWeeks INTEGER, createdAt TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS pet_customer ON pets(customerId);
                CREATE TABLE IF NOT EXISTS shampoos (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, purchasePrice INTEGER NOT NULL,
                    volumeMl REAL NOT NULL, dilutionWaterRatio REAL NOT NULL,
                    notes TEXT NOT NULL, archived INTEGER NOT NULL, createdAt TEXT NOT NULL
                );
            """)
            # executescript commits its surrounding transaction. Keep all migrations atomic.
            connection.execute("BEGIN IMMEDIATE")
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(appointments)")}
            additions = {
                "staffId": "TEXT NOT NULL DEFAULT 'owner'",
                "basePrice": "INTEGER NOT NULL DEFAULT 0",
                "breedSurcharge": "INTEGER NOT NULL DEFAULT 0",
                "weightSurcharge": "INTEGER NOT NULL DEFAULT 0",
                "extraCharges": "TEXT NOT NULL DEFAULT '[]'",
                "customerId": "TEXT",
                "petId": "TEXT",
                "shampooUsage": "TEXT NOT NULL DEFAULT '[]'",
                "shampooSurcharge": "INTEGER NOT NULL DEFAULT 0",
                "shampooCost": "INTEGER NOT NULL DEFAULT 0",
            }
            for name, declaration in additions.items():
                if name not in columns:
                    connection.execute(f"ALTER TABLE appointments ADD COLUMN {name} {declaration}")
                    if name == "basePrice":
                        connection.execute("UPDATE appointments SET basePrice = price")
            connection.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing', ?)",
                (json.dumps(DEFAULT_PRICING, ensure_ascii=False),),
            )
            connection.execute("CREATE INDEX IF NOT EXISTS appointment_pet ON appointments(petId)")

    @contextmanager
    def connect(self, *, write=False):
        connection = sqlite3.connect(self.database, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def appointment_from_row(row):
        result = dict(row)
        result["extraCharges"] = json.loads(result["extraCharges"])
        result["shampooUsage"] = json.loads(result["shampooUsage"])
        return result

    @staticmethod
    def appointment_values(appointment):
        return tuple(json.dumps(value, ensure_ascii=False) if key in {"extraCharges", "shampooUsage"} else value for key, value in appointment.items())

    @staticmethod
    def master_from_row(row):
        result = dict(row)
        for field in ("neutered", "archived"):
            if field in result and result[field] is not None:
                result[field] = bool(result[field])
        return result

    @staticmethod
    def find_master(connection, table, record_id, missing_status=404):
        if not isinstance(record_id, str) or not record_id:
            raise APIError("연결할 항목을 선택해 주세요.")
        row = connection.execute(f"SELECT * FROM {table} WHERE id = ?", (record_id,)).fetchone()
        if row is None:
            raise APIError("연결할 고객·반려견 또는 샴푸를 찾을 수 없습니다.", missing_status)
        return Store.master_from_row(row)

    def save_master(self, table, data, fields, validator, record_id=None):
        if not data or set(data) - fields:
            raise APIError("입력 항목을 확인해 주세요.")
        with self.connect(write=True) as connection:
            current = {} if record_id is None else self.find_master(connection, table, record_id)
            values = validator({**current, **data})
            if table == "pets":
                self.find_master(connection, "customers", values["customerId"], 400)
                if current and current["customerId"] != values["customerId"] and connection.execute("SELECT 1 FROM appointments WHERE petId = ? LIMIT 1", (record_id,)).fetchone():
                    raise APIError("예약 내역이 있는 반려견의 보호자는 변경할 수 없습니다.", 409)
            if record_id is None:
                values.update({"id": uuid4().hex, "createdAt": timestamp()})
                connection.execute(f"INSERT INTO {table} ({', '.join(values)}) VALUES ({', '.join('?' for _ in values)})", tuple(values.values()))
                return values
            assignments = ", ".join(f"{key} = ?" for key in values)
            connection.execute(f"UPDATE {table} SET {assignments} WHERE id = ?", (*values.values(), record_id))
            return self.find_master(connection, table, record_id)

    def create_customer(self, data):
        return self.save_master("customers", data, CUSTOMER_FIELDS, validate_customer)

    def update_customer(self, record_id, data):
        return self.save_master("customers", data, CUSTOMER_FIELDS, validate_customer, record_id)

    def create_pet(self, data):
        return self.save_master("pets", data, PET_FIELDS, validate_pet)

    def update_pet(self, record_id, data):
        return self.save_master("pets", data, PET_FIELDS, validate_pet, record_id)

    def create_shampoo(self, data):
        return self.save_master("shampoos", data, SHAMPOO_FIELDS, validate_shampoo)

    def update_shampoo(self, record_id, data):
        return self.save_master("shampoos", data, SHAMPOO_FIELDS, validate_shampoo, record_id)

    def prepare_appointment(self, connection, data, supplied, current=None):
        result = dict(data)
        pet_id = result.get("petId")
        customer_id = result.get("customerId")
        if "petId" in supplied and pet_id is None and "customerId" not in supplied:
            customer_id = None
        if pet_id is not None:
            pet = self.find_master(connection, "pets", pet_id, 400)
            if "customerId" in supplied and supplied["customerId"] is not None and supplied["customerId"] != pet["customerId"]:
                raise APIError("선택한 반려견과 보호자가 일치하지 않습니다.")
            customer_id = pet["customerId"]
        if customer_id is not None:
            self.find_master(connection, "customers", customer_id, 400)
        result.update({"petId": pet_id, "customerId": customer_id})
        usage = result.get("shampooUsage", [])
        if not isinstance(usage, list) or len(usage) > 20:
            raise APIError("샴푸 사용 내역은 최대 20개까지 등록해 주세요.")
        prior = {item["shampooId"]: item for item in (current or {}).get("shampooUsage", [])}
        seen, snapshots = set(), []
        for item in usage:
            if not isinstance(item, dict) or set(item) - {"shampooId", "usedMl", "customerCharge", "name", "purchasePrice", "volumeMl", "cost"}:
                raise APIError("샴푸 사용 내역을 확인해 주세요.")
            shampoo_id = item.get("shampooId")
            if not isinstance(shampoo_id, str) or not shampoo_id or shampoo_id in seen:
                raise APIError("샴푸를 선택하고 동일 제품은 한 번만 입력해 주세요.")
            seen.add(shampoo_id)
            used = number(item.get("usedMl"), "샴푸 원액 사용량")
            charge = integer(item.get("customerCharge", 0), "샴푸 고객 추가 요금")
            old = prior.get(shampoo_id)
            if old is not None and old["usedMl"] == used:
                # Editing the customer fee does not change the physical product consumed.
                snapshots.append({**old, "customerCharge": charge})
                continue
            product = self.find_master(connection, "shampoos", shampoo_id, 400)
            if product["archived"]:
                raise APIError("사용 중지한 샴푸는 새 사용 내역에 추가할 수 없습니다.")
            cost = (Decimal(str(product["purchasePrice"])) * Decimal(str(used)) / Decimal(str(product["volumeMl"]))).to_integral_value(rounding=ROUND_HALF_UP)
            if cost > 100_000_000:
                raise APIError("샴푸 사용원가가 허용 범위를 넘었습니다.")
            snapshots.append({"shampooId": shampoo_id, "name": product["name"], "usedMl": used, "purchasePrice": product["purchasePrice"], "volumeMl": product["volumeMl"], "cost": int(cost), "customerCharge": charge})
        shampoo_cost = integer(sum(item["cost"] for item in snapshots), "샴푸 사용원가 합계")
        shampoo_surcharge = integer(sum(item["customerCharge"] for item in snapshots), "샴푸 고객 추가 요금 합계")
        for field, amount in (("shampooCost", shampoo_cost), ("shampooSurcharge", shampoo_surcharge)):
            if field in supplied and integer(supplied[field], "샴푸 합계") != amount:
                raise APIError("샴푸 상세 내역과 합계가 일치하지 않습니다.")
        result.update({"shampooUsage": snapshots, "shampooCost": shampoo_cost, "shampooSurcharge": shampoo_surcharge})
        return result

    @staticmethod
    def find(connection, appointment_id):
        row = connection.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
        if row is None:
            raise APIError("예약을 찾을 수 없습니다.", 404)
        return Store.appointment_from_row(row)

    @staticmethod
    def check_overlap(connection, appointment, exclude_id=""):
        if appointment["status"] == "cancelled":
            return
        rows = connection.execute(
            "SELECT time, duration FROM appointments WHERE date = ? AND staffId = ? AND status != 'cancelled' AND id != ?",
            (appointment["date"], appointment["staffId"], exclude_id),
        )
        start = minutes(appointment["time"])
        end = start + appointment["duration"]
        for row in rows:
            other_start = minutes(row["time"])
            if start < other_start + row["duration"] and end > other_start:
                raise APIError("같은 시간에 다른 예약이 있습니다. 예약 시간을 확인해 주세요.", 409)

    def create_appointment(self, data):
        unknown = set(data) - EDITABLE_FIELDS - {"source", "externalId"}
        if unknown:
            raise APIError("예약에 지원하지 않는 입력 항목이 있습니다.")
        if data.get("source", "manual") != "manual" or data.get("externalId") is not None:
            raise APIError("외부 예약 연동은 아직 지원하지 않습니다.")
        with self.connect(write=True) as connection:
            appointment = validate_appointment(self.prepare_appointment(connection, data, data))
            appointment.update({
                "id": uuid4().hex, "source": "manual", "externalId": None,
                "paymentStatus": "unpaid", "paymentMethod": None,
                "paidDate": None, "createdAt": timestamp(),
            })
            self.check_overlap(connection, appointment)
            columns = ", ".join(appointment)
            values = ", ".join("?" for _ in appointment)
            connection.execute(f"INSERT INTO appointments ({columns}) VALUES ({values})", self.appointment_values(appointment))
        return appointment

    def update_appointment(self, appointment_id, data):
        if not data or set(data) - EDITABLE_FIELDS:
            raise APIError("수정할 예약 항목이 올바르지 않습니다.")
        with self.connect(write=True) as connection:
            current = self.find(connection, appointment_id)
            if current["paymentStatus"] == "paid":
                raise APIError("정산 완료된 예약은 수정하거나 취소할 수 없습니다.", 409)
            merged = self.prepare_appointment(connection, {**current, **data}, data, current)
            if "price" in data and not (BREAKDOWN_FIELDS | {"shampooUsage"}).intersection(data):
                # A legacy total-only edit preserves surcharges and changes the base portion.
                surcharges = current["breedSurcharge"] + current["weightSurcharge"] + sum(extra["amount"] for extra in current["extraCharges"]) + merged["shampooSurcharge"]
                merged["basePrice"] = integer(data["price"], "예약 금액") - surcharges
            elif (BREAKDOWN_FIELDS | {"shampooUsage"}).intersection(data) and "price" not in data:
                # Partial breakdown edits should recompute total, not compare with the old total.
                merged.pop("price", None)
            changes = validate_appointment(merged)
            self.check_overlap(connection, changes, appointment_id)
            assignments = ", ".join(f"{column} = ?" for column in changes)
            connection.execute(f"UPDATE appointments SET {assignments} WHERE id = ?", (*self.appointment_values(changes), appointment_id))
            return self.find(connection, appointment_id)

    def link_pet(self, appointment_id, data):
        if set(data) != {"petId"}:
            raise APIError("연결할 반려견을 선택해 주세요.")
        with self.connect(write=True) as connection:
            appointment = self.find(connection, appointment_id)
            pet = self.find_master(connection, "pets", data["petId"], 400)
            if appointment["petId"] is not None and appointment["petId"] != pet["id"]:
                raise APIError("이미 다른 반려견과 연결된 예약입니다.", 409)
            connection.execute("UPDATE appointments SET petId = ?, customerId = ? WHERE id = ?", (pet["id"], pet["customerId"], appointment_id))
            return self.find(connection, appointment_id)

    def update_pricing(self, data):
        pricing = validate_pricing(data)
        with self.connect(write=True) as connection:
            connection.execute("UPDATE settings SET value = ? WHERE key = 'pricing'", (json.dumps(pricing, ensure_ascii=False),))
        return pricing

    def settle(self, appointment_id, data):
        if set(data) - {"paymentMethod", "paidDate"}:
            raise APIError("정산 입력 항목이 올바르지 않습니다.")
        method = data.get("paymentMethod")
        if not isinstance(method, str) or method not in PAYMENT_METHODS:
            raise APIError("결제 수단을 선택해 주세요.")
        paid_date = valid_date(data.get("paidDate"), "결제 날짜")
        if paid_date > today():
            raise APIError("결제 날짜는 오늘 이후로 지정할 수 없습니다.")
        with self.connect(write=True) as connection:
            current = self.find(connection, appointment_id)
            if current["paymentStatus"] == "paid":
                raise APIError("이미 정산 완료된 예약입니다.", 409)
            if current["status"] == "cancelled":
                raise APIError("취소된 예약은 정산할 수 없습니다.", 409)
            connection.execute(
                "UPDATE appointments SET status = 'completed', paymentStatus = 'paid', paymentMethod = ?, paidDate = ? WHERE id = ?",
                (method, paid_date, appointment_id),
            )
            return self.find(connection, appointment_id)

    def create_expense(self, data):
        if set(data) - {"date", "category", "amount", "memo"}:
            raise APIError("지출에 지원하지 않는 입력 항목이 있습니다.")
        expense = {
            "id": uuid4().hex,
            "date": valid_date(data.get("date"), "지출 날짜"),
            "category": text_field(data, "category", "지출 분류", required=True, maximum=80),
            "amount": integer(data.get("amount"), "지출 금액", minimum=1),
            "memo": text_field(data, "memo", "지출 메모", maximum=2000),
            "createdAt": timestamp(),
        }
        if expense["date"] > today():
            raise APIError("실제 지출 날짜는 오늘 이후로 지정할 수 없습니다.")
        with self.connect(write=True) as connection:
            connection.execute(
                "INSERT INTO expenses (id, date, category, amount, memo, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
                tuple(expense.values()),
            )
        return expense

    def delete_expense(self, expense_id):
        with self.connect(write=True) as connection:
            cursor = connection.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
            if not cursor.rowcount:
                raise APIError("지출 내역을 찾을 수 없습니다.", 404)

    def state(self, month):
        month = valid_month(month)
        with self.connect() as connection:
            # Read both tables from one snapshot for consistent financial totals.
            connection.execute("BEGIN")
            appointments = [self.appointment_from_row(row) for row in connection.execute("SELECT * FROM appointments ORDER BY date, time, createdAt")]
            expenses = [dict(row) for row in connection.execute("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC")]
            pricing = json.loads(connection.execute("SELECT value FROM settings WHERE key = 'pricing'").fetchone()["value"])
            masters = {table: [self.master_from_row(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY createdAt, id")] for table in ("customers", "pets", "shampoos")}
        paid = [a for a in appointments if a["paymentStatus"] == "paid" and a["paidDate"].startswith(month)]
        revenue = sum(a["price"] for a in paid)
        total_expenses = sum(e["amount"] for e in expenses if e["date"].startswith(month))
        unpaid = sum(a["price"] for a in appointments if a["date"].startswith(month) and a["status"] != "cancelled" and a["paymentStatus"] == "unpaid")
        return {
            "appointments": appointments,
            "expenses": expenses,
            "pricing": pricing,
            **masters,
            "summary": {
                "revenue": revenue, "totalExpenses": total_expenses,
                "profit": revenue - total_expenses, "unpaidAmount": unpaid,
                "paidCount": len(paid),
                "shampooCost": sum(appointment["shampooCost"] for appointment in paid),
            },
        }


def make_handler(store: Store, static_dir: Path):
    static_root = static_dir.resolve()

    class Handler(BaseHTTPRequestHandler):
        server_version = "GroomingStudio/0.1"

        def send_json(self, data, status=200):
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(payload)

        def validate_origin(self):
            origin = self.headers.get("Origin")
            if origin and urlsplit(origin).netloc != self.headers.get("Host"):
                raise APIError("다른 사이트에서는 데이터를 변경할 수 없습니다.", 403)

        def read_json(self):
            self.validate_origin()
            if self.headers.get_content_type() != "application/json":
                raise APIError("JSON 형식으로 요청해 주세요.", 415)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise APIError("요청 크기가 올바르지 않습니다.") from None
            if length <= 0 or length > 65_536:
                raise APIError("요청 내용이 없거나 너무 큽니다.", 413)
            try:
                data = json.loads(self.rfile.read(length))
            except (UnicodeDecodeError, ValueError):
                raise APIError("JSON 요청을 읽을 수 없습니다.") from None
            if not isinstance(data, dict):
                raise APIError("요청은 JSON 객체여야 합니다.")
            return data

        def do_GET(self):
            self.route("GET")

        def do_POST(self):
            self.route("POST")

        def do_PATCH(self):
            self.route("PATCH")

        def do_PUT(self):
            self.route("PUT")

        def do_DELETE(self):
            self.route("DELETE")

        def route(self, method):
            try:
                parsed = urlsplit(self.path)
                path = parsed.path
                if method == "GET" and path == "/api/health":
                    with store.connect() as connection:
                        connection.execute("SELECT 1").fetchone()
                    return self.send_json({"status": "ok"})
                if method == "GET" and path == "/api/state":
                    month = parse_qs(parsed.query, keep_blank_values=True).get("month", [today()[:7]])[0]
                    return self.send_json(store.state(month))
                if method == "POST" and path == "/api/appointments":
                    return self.send_json(store.create_appointment(self.read_json()), 201)
                if method == "PUT" and path == "/api/pricing":
                    return self.send_json(store.update_pricing(self.read_json()))
                for resource, create, update in (
                    ("customers", store.create_customer, store.update_customer),
                    ("pets", store.create_pet, store.update_pet),
                    ("shampoos", store.create_shampoo, store.update_shampoo),
                ):
                    if method == "POST" and path == f"/api/{resource}":
                        return self.send_json(create(self.read_json()), 201)
                    master_match = re.fullmatch(rf"/api/{resource}/([a-f0-9]{{32}})", path)
                    if method == "PATCH" and master_match:
                        return self.send_json(update(master_match.group(1), self.read_json()))
                match = re.fullmatch(r"/api/appointments/([a-f0-9]{32})", path)
                if method == "PATCH" and match:
                    return self.send_json(store.update_appointment(match.group(1), self.read_json()))
                match = re.fullmatch(r"/api/appointments/([a-f0-9]{32})/settle", path)
                if method == "POST" and match:
                    return self.send_json(store.settle(match.group(1), self.read_json()))
                match = re.fullmatch(r"/api/appointments/([a-f0-9]{32})/link-pet", path)
                if method == "POST" and match:
                    return self.send_json(store.link_pet(match.group(1), self.read_json()))
                if method == "POST" and path == "/api/expenses":
                    return self.send_json(store.create_expense(self.read_json()), 201)
                match = re.fullmatch(r"/api/expenses/([a-f0-9]{32})", path)
                if method == "DELETE" and match:
                    # Browsers preflight cross-origin DELETE; also enforce origin explicitly.
                    self.validate_origin()
                    store.delete_expense(match.group(1))
                    return self.send_json({"deleted": True})
                if path.startswith("/api/") or method != "GET":
                    raise APIError("요청한 경로를 찾을 수 없습니다.", 404)
                self.serve_static(path)
            except APIError as error:
                self.send_json({"error": str(error)}, error.status)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                traceback.print_exc()
                self.send_json({"error": "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}, 500)

        def serve_static(self, path):
            target = (static_root / unquote(path).lstrip("/")).resolve()
            if not target.is_relative_to(static_root):
                raise APIError("이 경로에는 접근할 수 없습니다.", 403)
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file() and not Path(path).suffix:
                target = static_root / "index.html"
            target = target.resolve()
            if not target.is_relative_to(static_root):
                raise APIError("이 경로에는 접근할 수 없습니다.", 403)
            if not target.is_file():
                raise APIError("화면 파일이 없습니다. 프런트엔드를 먼저 빌드해 주세요.", 404)
            payload = target.read_bytes()
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(payload)

    return Handler


def main():
    parser = argparse.ArgumentParser(description="애견미용실 예약·정산 로컬 개발 서버")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--db", type=Path, default=ROOT / "data" / "grooming.sqlite")
    parser.add_argument("--static-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(Store(args.db), args.static_dir))
    print(f"Grooming Studio listening on {args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
