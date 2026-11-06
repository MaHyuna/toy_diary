"""Single-shop application server with owner sessions and scoped public care links."""

from __future__ import annotations

import argparse
import base64
import binascii
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import CookieError, SimpleCookie
import hashlib
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import secrets
import ssl
import sqlite3
from threading import Lock
import time
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
PET_FIELDS = {"photos", "customerId", "name", "breed", "weight", "birthDate", "sex", "neutered", "allergies", "healthNotes", "behaviorNotes", "preferredStyle", "visitIntervalWeeks"}
SHAMPOO_FIELDS = {"photo", "name", "purchasePrice", "volumeMl", "dilutionWaterRatio", "notes", "archived"}
CARE_FIELDS = {"beforeNotes", "afterNotes", "groomerOpinion", "homeCare", "nextVisitDate", "photos"}
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
    photos = data.get("photos", [])
    if not isinstance(photos, list) or len(photos) > 6:
        raise APIError("사진은 아이당 6장까지 저장할 수 있습니다.")
    result["photos"] = []
    for photo in photos:
        if not isinstance(photo, dict) or set(photo) != {"id", "src", "caption", "date"}:
            raise APIError("사진 항목을 확인해 주세요.")
        src = photo["src"]
        if not isinstance(src, str) or len(src) > 350000 or not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/]+=*", src):
            raise APIError("JPEG 사진을 선택해 주세요.")
        try:
            image_bytes = base64.b64decode(src.split(",", 1)[1], validate=True)
        except (ValueError, binascii.Error):
            raise APIError("사진 데이터를 읽을 수 없습니다.") from None
        if not image_bytes.startswith(b"\xff\xd8") or not image_bytes.endswith(b"\xff\xd9"):
            raise APIError("JPEG 사진을 선택해 주세요.")
        result["photos"].append({"id": text_field(photo, "id", "사진 ID", required=True, maximum=80), "src": src, "caption": text_field(photo, "caption", "사진 설명", maximum=120), "date": valid_date(photo["date"], "촬영일")})
    return result


def validate_shampoo(data):
    photo = data.get("photo", "")
    if not isinstance(photo,str) or len(photo)>350000:
        raise APIError("제품 사진 크기를 확인해 주세요.")
    if photo:
        if not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/]+=*", photo):
            raise APIError("제품 사진은 JPEG 형식이어야 합니다.")
        try:
            raw = base64.b64decode(photo.split(",",1)[1], validate=True)
        except (ValueError,binascii.Error):
            raise APIError("제품 사진을 읽을 수 없습니다.") from None
        if not raw.startswith(b"\xff\xd8") or not raw.endswith(b"\xff\xd9"):
            raise APIError("제품 사진은 JPEG 형식이어야 합니다.")
    result = {"photo":photo,
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


def validate_care(data):
    result = {key: text_field(data, key, label, maximum=2000) for key, label in (
        ("beforeNotes", "미용 전 상태"), ("afterNotes", "미용 후 상태"),
        ("groomerOpinion", "미용 소견"), ("homeCare", "보호자 관리사항"),
    )}
    next_date = data.get("nextVisitDate", "")
    result["nextVisitDate"] = valid_date(next_date, "다음 권장 방문일") if next_date != "" else ""
    photos = data.get("photos", [])
    if not isinstance(photos, list) or len(photos) > 8:
        raise APIError("미용 사진은 전·후 각각 4장까지 저장할 수 있습니다.")
    result["photos"], seen, counts = [], set(), {"before": 0, "after": 0}
    for photo in photos:
        if not isinstance(photo, dict) or set(photo) != {"id", "src", "caption", "stage"}:
            raise APIError("미용 사진 항목을 확인해 주세요.")
        image_id = text_field(photo, "id", "사진 ID", required=True, maximum=80)
        stage = photo.get("stage")
        if not isinstance(stage, str) or stage not in counts or image_id in seen:
            raise APIError("미용 전·후 구분과 사진 ID를 확인해 주세요.")
        counts[stage] += 1
        if counts[stage] > 4:
            raise APIError("미용 사진은 전·후 각각 4장까지 저장할 수 있습니다.")
        seen.add(image_id)
        src = photo.get("src")
        if not isinstance(src, str) or len(src) > 350000 or not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/]+=*", src):
            raise APIError("JPEG 사진을 선택해 주세요.")
        try:
            image_bytes = base64.b64decode(src.split(",", 1)[1], validate=True)
        except (ValueError, binascii.Error):
            raise APIError("사진 데이터를 읽을 수 없습니다.") from None
        if not image_bytes.startswith(b"\xff\xd8") or not image_bytes.endswith(b"\xff\xd9"):
            raise APIError("JPEG 사진을 선택해 주세요.")
        result["photos"].append({"id": image_id, "src": src, "caption": text_field(photo, "caption", "사진 설명", maximum=120), "stage": stage})
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
                CREATE TABLE IF NOT EXISTS booking_requests (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS care_records (
                    appointmentId TEXT PRIMARY KEY REFERENCES appointments(id),
                    payload TEXT NOT NULL, shareToken TEXT UNIQUE
                );
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
            from server.price_history import SCHEMA
            connection.executescript(SCHEMA)
            # executescript commits its surrounding transaction. Keep all migrations atomic.
            connection.execute("BEGIN IMMEDIATE")
            shampoo_columns = {row["name"] for row in connection.execute("PRAGMA table_info(shampoos)")}
            if "photo" not in shampoo_columns:
                connection.execute("ALTER TABLE shampoos ADD COLUMN photo TEXT NOT NULL DEFAULT ''")
            pet_columns = {row["name"] for row in connection.execute("PRAGMA table_info(pets)")}
            if "photos" not in pet_columns:
                connection.execute("ALTER TABLE pets ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'")
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
            from server.price_history import ensure_baseline
            ensure_baseline(connection, self.menu_in(connection))

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
        if "photos" in result:
            result["photos"] = json.loads(result["photos"])
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
                connection.execute(f"INSERT INTO {table} ({', '.join(values)}) VALUES ({', '.join('?' for _ in values)})", tuple(json.dumps(value, ensure_ascii=False) if key == "photos" else value for key, value in values.items()))
                return values
            assignments = ", ".join(f"{key} = ?" for key in values)
            connection.execute(f"UPDATE {table} SET {assignments} WHERE id = ?", (*(json.dumps(value, ensure_ascii=False) if key == "photos" else value for key, value in values.items()), record_id))
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

    @staticmethod
    def menu_in(connection):
        row = connection.execute("SELECT value FROM settings WHERE key='price-menu'").fetchone()
        if row: return json.loads(row[0])
        row = connection.execute("SELECT value FROM settings WHERE key='price-poster'").fetchone()
        return json.loads(row[0]).get('menu') if row else None

    def price_menu(self):
        with self.connect() as connection:
            return self.menu_in(connection)

    @staticmethod
    def booking_rules_in(connection):
        row = connection.execute("SELECT value FROM settings WHERE key='menu-booking'").fetchone()
        return json.loads(row[0]) if row else []

    def menu_booking(self):
        with self.connect() as connection:
            return {'rules': self.booking_rules_in(connection)}

    def save_menu_booking(self, data):
        from server.menu_booking import validate_rules
        with self.connect(write=True) as connection:
            rules = validate_rules(data, self.menu_in(connection), APIError)
            connection.execute("INSERT INTO settings(key,value) VALUES('menu-booking',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(rules, ensure_ascii=False),))
        return {'rules': rules}

    def booking_catalog_in(self, connection):
        from server.menu_booking import catalog
        return catalog(self.menu_in(connection), self.booking_rules_in(connection))

    def price_menu_state(self):
        from server.price_history import ensure_baseline, state
        with self.connect(write=True) as connection:
            menu = self.menu_in(connection)
            ensure_baseline(connection, menu)
            return state(connection, menu)

    def price_menu_history(self, offset=0):
        if type(offset) is not int or offset < 0:
            raise APIError("이력 페이지를 확인해 주세요.")
        from server.price_history import ensure_baseline, current_version
        with self.connect(write=True) as connection:
            ensure_baseline(connection, self.menu_in(connection))
            rows = connection.execute("SELECT version,savedAt,kind,restoredFrom,note FROM price_menu_history ORDER BY version DESC LIMIT 20 OFFSET ?", (offset,)).fetchall()
            return {'entries': [dict(row) for row in rows], 'total': connection.execute('SELECT COUNT(*) FROM price_menu_history').fetchone()[0], 'currentVersion': current_version(connection)}

    def price_menu_version(self, version):
        from server.price_history import detail
        with self.connect() as connection:
            return detail(connection, version, APIError)

    def save_price_menu(self, data, *, versioned=False, restore=None):
        from server.price_menu import validate_menu
        from server.price_history import ensure_baseline, check_version, note_value, detail, append, state
        with self.connect(write=True) as connection:
            current = self.menu_in(connection)
            ensure_baseline(connection, current)
            if versioned:
                check_version(connection, data.get('expectedVersion'), APIError)
            note = note_value(data, APIError) if versioned else ''
            menu = validate_menu(detail(connection, restore, APIError)['menu'] if restore is not None else data.get('menu') if versioned else data, APIError)
            if menu != current or restore is not None:
                connection.execute("INSERT INTO settings(key,value) VALUES('price-menu',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(menu, ensure_ascii=False),))
                append(connection, menu, 'restore' if restore is not None else 'save', note, restore)
            return state(connection, menu) if versioned else menu

    def price_poster(self):
        with self.connect() as connection:
            row = connection.execute("SELECT value FROM settings WHERE key='price-poster'").fetchone()
            return json.loads(row[0]) if row else None

    def save_price_poster(self, data):
        if data is not None:
            if not {"image", "description"} <= set(data) or set(data) - {"image", "description", "menu"}:
                raise APIError("요금표 입력 항목을 확인해 주세요.")
            image = text_field(data, "image", "요금표 이미지", required=True, maximum=2500000)
            if not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/]+=*", image):
                raise APIError("JPEG 요금표를 사용해 주세요.")
            try:
                raw = base64.b64decode(image.split(",", 1)[1], validate=True)
            except (ValueError, binascii.Error):
                raise APIError("이미지를 읽을 수 없습니다.") from None
            if not raw.startswith(b"\xff\xd8") or not raw.endswith(b"\xff\xd9"):
                raise APIError("JPEG 요금표를 사용해 주세요.")
            menu = data.get("menu")
            if menu is not None:
                try:
                    def words(v):
                        if not isinstance(v, str) or len(v) > 2000: raise ValueError()
                        return v
                    def rows(v, maximum):
                        if not isinstance(v, list) or len(v) > maximum: raise ValueError()
                        return v
                    columns = [words(c) for c in rows(menu["columns"], 8)]
                    sections = []
                    for section in rows(menu["sections"], 24):
                        entry = {k: words(section[k]) for k in ("title", "breeds", "note", "content")}
                        entry["rows"] = [{"weight": words(r["weight"]), "prices": [words(p) for p in rows(r["prices"], 8)]} for r in rows(section["rows"], 30)]
                        if any(len(r["prices"]) != len(columns) for r in entry["rows"]): raise ValueError()
                        entry["items"] = [{"label": words(i["label"]), "value": words(i["value"])} for i in rows(section["items"], 40)]
                        sections.append(entry)
                    menu = {"columns": columns, "sections": sections}
                except (KeyError, TypeError, ValueError):
                    raise APIError("모바일 요금표 형식을 확인해 주세요.") from None
            data = {"image": image, "description": text_field(data, "description", "요금표 내용", required=True, maximum=30000)}
            if menu is not None:
                data["menu"] = menu
        with self.connect(write=True) as connection:
            from server.price_history import ensure_baseline
            previous = self.menu_in(connection)
            ensure_baseline(connection, previous)
            if previous is not None:
                connection.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('price-menu',?)", (json.dumps(previous, ensure_ascii=False),))
            if data is None:
                connection.execute("DELETE FROM settings WHERE key='price-poster'")
            else:
                connection.execute("INSERT INTO settings(key,value) VALUES('price-poster',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(data, ensure_ascii=False),))
            ensure_baseline(connection, self.menu_in(connection))
        return data

    def notices(self):
        with self.connect() as connection:
            row = connection.execute("SELECT value FROM settings WHERE key='notices'").fetchone()
            return json.loads(row[0]) if row else []

    def update_notices(self, data):
        if set(data) != {"notices"} or not isinstance(data["notices"], list) or len(data["notices"]) > 20:
            raise APIError("공지는 최대 20개까지 저장할 수 있습니다.")
        result, ids = [], set()
        for item in data["notices"]:
            if not isinstance(item, dict) or set(item) != {"id", "title", "body", "published"}:
                raise APIError("공지 입력 항목을 확인해 주세요.")
            identifier = text_field(item, "id", "공지 ID", required=True, maximum=80)
            if not re.fullmatch(r"[A-Za-z0-9_-]+", identifier) or identifier in ids or not isinstance(item["published"], bool):
                raise APIError("공지 ID와 공개 상태를 확인해 주세요.")
            ids.add(identifier)
            result.append({"id": identifier, "title": text_field(item, "title", "공지 제목", required=True, maximum=80),
                           "body": text_field(item, "body", "공지 내용", required=True, maximum=2000), "published": item["published"]})
        with self.connect(write=True) as connection:
            connection.execute("INSERT INTO settings(key,value) VALUES('notices',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(result, ensure_ascii=False),))
        return result

    def public_catalog(self):
        return {"booking": self.booking_catalog(), "hours": "09:00–19:00", "name": "몽글 미용실", "notices": [item for item in self.notices() if item["published"]]}

    def booking_catalog(self):
        with self.connect() as connection:
            return self.booking_catalog_in(connection)

    def booking_requests(self):
        with self.connect() as connection:
            rows = connection.execute("SELECT * FROM booking_requests ORDER BY createdAt")
            return [{**json.loads(row["payload"]), "id": row["id"], "status": row["status"], "createdAt": row["createdAt"]} for row in rows]

    @staticmethod
    def public_day(value):
        value = valid_date(value, "예약 날짜")
        if not today() <= value <= (date.fromisoformat(today()) + timedelta(days=90)).isoformat():
            raise APIError("예약은 오늘부터 90일 이내로 선택해 주세요.")
        return value

    @staticmethod
    def booking_slots(connection, day, duration, exclude=""):
        occupied = [(row["time"], row["duration"]) for row in connection.execute("SELECT time,duration FROM appointments WHERE date=? AND status!='cancelled'", (day,))]
        for row in connection.execute("SELECT id,payload FROM booking_requests WHERE status='pending'"):
            item = json.loads(row["payload"])
            if item["date"] == day and row["id"] != exclude:
                occupied.append((item["time"], item["duration"]))
        now = datetime.now(SEOUL).strftime("%H:%M")
        return [f"{start//60:02d}:{start%60:02d}" for start in range(540, 1140-duration+1, 30)
                if (day != today() or f"{start//60:02d}:{start%60:02d}" > now)
                and all(not (start < minutes(time)+length and start+duration > minutes(time)) for time,length in occupied)]

    def public_availability(self, day, service_id):
        day = self.public_day(day)
        with self.connect() as connection:
            service = next((s for s in self.booking_catalog_in(connection)['offers'] if s['id'] == service_id), None)
            if service is None:
                raise APIError("예약 가능한 요금 항목을 다시 선택해 주세요.")
            return {"slots": self.booking_slots(connection, day, service["duration"])}

    def request_booking(self, data):
        from server.menu_booking import select_offer
        if set(data) - {"serviceId","revision","date","time","dogName","guardianName","phone","breed","weight","notes","consent"} or data.get("consent") is not True:
            raise APIError("예약 정보와 개인정보 수집 동의를 확인해 주세요.")
        day = self.public_day(data.get("date"))
        with self.connect(write=True) as connection:
            weight = number(data.get("weight"), "몸무게", maximum=150)
            service = select_offer(self.booking_catalog_in(connection), data.get('serviceId'), data.get('revision'), weight, APIError)
            phone = text_field(data,"phone","연락처",required=True,maximum=40)
            if len(re.sub(r"\D", "", phone)) not in {10,11}:
                raise APIError("연락 가능한 전화번호를 입력해 주세요.")
            booking = validate_appointment({**data,"date":day,"service":service["name"],"duration":service["duration"],"basePrice":service["price"],"breedSurcharge":0,"weightSurcharge":0,"extraCharges":[],"price":service["price"],"weight":weight,"phone":phone})
            booking['quoteSnapshot'] = {'revision': data['revision'], 'offer': service}
            if booking["time"] not in self.booking_slots(connection, day, booking["duration"]):
                raise APIError("방금 선택한 시간이 마감됐어요. 다른 시간을 선택해 주세요.",409)
            request_id = uuid4().hex
            connection.execute("INSERT INTO booking_requests VALUES(?,?,?,?)",(request_id,json.dumps(booking,ensure_ascii=False),"pending",timestamp()))
        return {"id":request_id,"status":"pending","date":day,"time":booking["time"],"price":booking["price"]}

    def decide_booking(self, request_id, data):
        if set(data) != {"decision"} or data["decision"] not in {"accept","reject"}:
            raise APIError("확정 또는 거절을 선택해 주세요.")
        with self.connect(write=True) as connection:
            row = connection.execute("SELECT * FROM booking_requests WHERE id=?",(request_id,)).fetchone()
            if row is None or row["status"] != "pending":
                raise APIError("이미 처리했거나 찾을 수 없는 신청입니다.",409)
            item = json.loads(row["payload"])
            if data["decision"] == "accept":
                self.public_day(item["date"])
                if item["time"] not in self.booking_slots(connection,item["date"],item["duration"],request_id):
                    raise APIError("다른 예약과 겹칩니다. 시간을 확인해 주세요.",409)
                item.update({"id":uuid4().hex,"source":"website","externalId":request_id,"paymentStatus":"unpaid","paymentMethod":None,"paidDate":None,"createdAt":timestamp()})
                item.pop("quoteSnapshot", None)  # Preserved in booking_requests as the immutable quote audit.
                columns=", ".join(item);values=", ".join("?" for _ in item)
                connection.execute(f"INSERT INTO appointments ({columns}) VALUES ({values})",self.appointment_values(item))
            connection.execute("UPDATE booking_requests SET status=? WHERE id=?",("accepted" if data["decision"] == "accept" else "rejected",request_id))
        return {"status":"accepted" if data["decision"] == "accept" else "rejected"}

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
            if set(data) == {"notes"}:
                notes = text_field(data, "notes", "메모", maximum=2000)
                connection.execute("UPDATE appointments SET notes = ? WHERE id = ?", (notes, appointment_id))
                return self.find(connection, appointment_id)
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
        if set(data) - {"paymentMethod", "paidDate", "changes"}:
            raise APIError("정산 입력 항목이 올바르지 않습니다.")
        changes = data.get("changes", {})
        if not isinstance(changes, dict) or set(changes) - {"basePrice", "extraCharges", "notes"}:
            raise APIError("정산 시에는 기본요금·추가요금·미용 메모만 수정할 수 있습니다.")
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
            if changes:
                merged = {**current, **changes}
                if {"basePrice", "extraCharges"}.intersection(changes):
                    merged.pop("price", None)
                updated = validate_appointment(merged)
                assignments = ", ".join(f"{column} = ?" for column in updated)
                connection.execute(f"UPDATE appointments SET {assignments} WHERE id = ?", (*self.appointment_values(updated), appointment_id))
            connection.execute(
                "UPDATE appointments SET status = 'completed', paymentStatus = 'paid', paymentMethod = ?, paidDate = ? WHERE id = ?",
                (method, paid_date, appointment_id),
            )
            return self.find(connection, appointment_id)

    @staticmethod
    def write_care(connection, record):
        connection.execute(
            "INSERT INTO care_records (appointmentId, payload, shareToken) VALUES (?, ?, ?) "
            "ON CONFLICT(appointmentId) DO UPDATE SET payload = excluded.payload, shareToken = excluded.shareToken",
            (record["appointmentId"], json.dumps(record, ensure_ascii=False), record["shareToken"]),
        )

    def get_care(self, appointment_id):
        with self.connect() as connection:
            self.find(connection, appointment_id)
            row = connection.execute("SELECT payload FROM care_records WHERE appointmentId = ?", (appointment_id,)).fetchone()
            return json.loads(row["payload"]) if row else None

    def save_care(self, appointment_id, data):
        if not data or set(data) - CARE_FIELDS:
            raise APIError("미용 기록 입력 항목을 확인해 주세요.")
        with self.connect(write=True) as connection:
            appointment = self.find(connection, appointment_id)
            row = connection.execute("SELECT payload FROM care_records WHERE appointmentId = ?", (appointment_id,)).fetchone()
            current = json.loads(row["payload"]) if row else {
                "id": appointment_id, "appointmentId": appointment_id,
                "published": False, "shareToken": None, "publishedSnapshot": None,
            }
            record = {**current, **validate_care({**current, **data}), "updatedAt": timestamp()}
            if record["nextVisitDate"] and record["nextVisitDate"] < appointment["date"]:
                raise APIError("다음 권장 방문일은 이번 방문일 이후로 선택해 주세요.")
            self.write_care(connection, record)
            return record

    def publish_care(self, appointment_id, data):
        if data:
            raise APIError("먼저 미용 기록을 저장한 뒤 공유해 주세요.")
        with self.connect(write=True) as connection:
            appointment = self.find(connection, appointment_id)
            row = connection.execute("SELECT payload FROM care_records WHERE appointmentId = ?", (appointment_id,)).fetchone()
            if not row:
                raise APIError("먼저 미용 기록을 작성해 주세요.", 404)
            record = json.loads(row["payload"])
            care = validate_care(record)
            if care["nextVisitDate"] and care["nextVisitDate"] < appointment["date"]:
                raise APIError("다음 권장 방문일은 이번 방문일 이후로 선택해 주세요.")
            if not care["photos"] and not any(care[key] for key in ("beforeNotes", "afterNotes", "groomerOpinion", "homeCare")):
                raise APIError("공유할 미용 기록이나 사진을 먼저 남겨 주세요.")
            # Deliberate allowlist: never include money, contact information or internal notes.
            snapshot = {"id": appointment_id, **{key: appointment[key] for key in ("petId", "dogName", "breed", "weight", "date", "service")}, **care, "publishedAt": timestamp()}
            record.update({"published": True, "shareToken": record.get("shareToken") or uuid4().hex, "publishedSnapshot": snapshot})
            self.write_care(connection, record)
            return record

    def unpublish_care(self, appointment_id):
        with self.connect(write=True) as connection:
            self.find(connection, appointment_id)
            row = connection.execute("SELECT payload FROM care_records WHERE appointmentId = ?", (appointment_id,)).fetchone()
            if not row:
                raise APIError("미용 기록을 찾을 수 없습니다.", 404)
            record = json.loads(row["payload"])
            record.update({"published": False, "shareToken": None, "publishedSnapshot": None})
            self.write_care(connection, record)
            return record

    def public_care(self, token):
        if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{32}", token):
            raise APIError("공유된 미용 기록을 찾을 수 없습니다.", 404)
        with self.connect() as connection:
            connection.execute("BEGIN")
            row = connection.execute("SELECT payload FROM care_records WHERE shareToken = ?", (token,)).fetchone()
            record = json.loads(row["payload"]) if row else None
            if not record or not record["published"] or not record["publishedSnapshot"]:
                raise APIError("공유가 종료되었거나 존재하지 않는 미용 기록입니다.", 404)
            report = record["publishedSnapshot"]
            history = [{key: report[key] for key in ("id", "petId", "dogName", "date", "service", "weight")} | {"shareToken": token}]
            if report["petId"]:
                # Return only small history summaries, never every visit's photo payload.
                history = [dict(item) for item in connection.execute("""SELECT
                    json_extract(payload, '$.publishedSnapshot.id') AS id,
                    json_extract(payload, '$.publishedSnapshot.petId') AS petId,
                    json_extract(payload, '$.publishedSnapshot.dogName') AS dogName,
                    json_extract(payload, '$.publishedSnapshot.date') AS date,
                    json_extract(payload, '$.publishedSnapshot.service') AS service,
                    json_extract(payload, '$.publishedSnapshot.weight') AS weight, shareToken
                    FROM care_records WHERE shareToken IS NOT NULL
                    AND json_extract(payload, '$.published') = 1
                    AND json_extract(payload, '$.publishedSnapshot.petId') = ?
                    ORDER BY date DESC, id DESC""", (report["petId"],))]
            return {"report": report, "history": history}

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

    def state(self, month, care_summary=False):
        month = valid_month(month)
        with self.connect() as connection:
            # Read both tables from one snapshot for consistent financial totals.
            connection.execute("BEGIN")
            appointments = [self.appointment_from_row(row) for row in connection.execute("SELECT * FROM appointments ORDER BY date, time, createdAt")]
            expenses = [dict(row) for row in connection.execute("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC")]
            pricing = json.loads(connection.execute("SELECT value FROM settings WHERE key = 'pricing'").fetchone()["value"])
            masters = {table: [self.master_from_row(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY createdAt, id")] for table in ("customers", "pets", "shampoos")}
            if care_summary:
                care_records = [{**dict(row), "published": bool(row["published"])} for row in connection.execute("""SELECT appointmentId,
                    json_extract(payload, '$.published') AS published,
                    json_array_length(payload, '$.photos') AS photoCount,
                    json_extract(payload, '$.updatedAt') AS updatedAt
                    FROM care_records ORDER BY appointmentId""")]
            else:
                care_records = [json.loads(row["payload"]) for row in connection.execute("SELECT payload FROM care_records ORDER BY appointmentId")]
        paid = [a for a in appointments if a["paymentStatus"] == "paid" and a["paidDate"].startswith(month)]
        revenue = sum(a["price"] for a in paid)
        total_expenses = sum(e["amount"] for e in expenses if e["date"].startswith(month))
        unpaid = sum(a["price"] for a in appointments if a["date"].startswith(month) and a["status"] != "cancelled" and a["paymentStatus"] == "unpaid")
        return {
            "appointments": appointments,
            "expenses": expenses,
            "pricing": pricing,
            **masters,
            "careRecordSummaries" if care_summary else "careRecords": care_records,
            "summary": {
                "revenue": revenue, "totalExpenses": total_expenses,
                "profit": revenue - total_expenses, "unpaidAmount": unpaid,
                "paidCount": len(paid),
                "shampooCost": sum(appointment["shampooCost"] for appointment in paid),
            },
        }


class OwnerSessions:
    """Opaque session cookies; only token hashes and expiry live on the server."""

    cookie_name = "mongle_owner_session"

    def __init__(self, password, *, lifetime=8 * 60 * 60, clock=time.monotonic):
        self.configured = isinstance(password, str) and 0 < len(password) <= 256
        try:
            self.password_hash = hashlib.sha256(password.encode()).digest() if self.configured else None
        except UnicodeEncodeError:
            self.configured = False
            self.password_hash = None
        self.lifetime = lifetime
        self.clock = clock
        self.sessions = {}
        self.failures = {}
        self.lock = Lock()

    @staticmethod
    def token_hash(token):
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
            return None
        return hashlib.sha256(token.encode()).digest()

    def authenticated(self, token):
        hashed = self.token_hash(token)
        with self.lock:
            now = self.clock()
            self.sessions = {key: expiry for key, expiry in self.sessions.items() if expiry > now}
            return self.configured and hashed in self.sessions

    def login(self, password, client, previous_token=None):
        if not self.configured:
            raise APIError("매장 로그인 설정이 필요합니다.", 503)
        with self.lock:
            now = self.clock()
            self.failures = {key: [stamp for stamp in attempts if stamp > now - 60]
                             for key, attempts in self.failures.items() if any(stamp > now - 60 for stamp in attempts)}
            attempts = self.failures.get(client, [])
            if len(attempts) >= 5:
                raise APIError("잠시 후 다시 로그인해 주세요.", 429)
            valid = isinstance(password, str) and len(password) <= 256
            try:
                supplied = hashlib.sha256(password.encode()).digest() if valid else b""
            except UnicodeEncodeError:
                supplied = b""
            if not secrets.compare_digest(supplied, self.password_hash):
                self.failures[client] = [*attempts, now]
                raise APIError("비밀번호를 확인해 주세요.", 401)
            self.failures.pop(client, None)
            self.sessions = {key: expiry for key, expiry in self.sessions.items() if expiry > now}
            self.sessions.pop(self.token_hash(previous_token), None)
            while len(self.sessions) >= 256:
                self.sessions.pop(next(iter(self.sessions)))
            token = secrets.token_urlsafe(32)
            self.sessions[self.token_hash(token)] = now + self.lifetime
            return token

    def logout(self, token):
        with self.lock:
            self.sessions.pop(self.token_hash(token), None)


def make_handler(store: Store, static_dir: Path, *, owner_password=None, secure_cookies=None, session_seconds=8 * 60 * 60, auth_clock=time.monotonic):
    static_root = static_dir.resolve()
    sessions = OwnerSessions(os.environ.get("MONGLE_OWNER_PASSWORD") if owner_password is None else owner_password,
                             lifetime=session_seconds, clock=auth_clock)
    if secure_cookies is None:
        secure_cookies = os.environ.get("MONGLE_SECURE_COOKIES", "").lower() in {"1", "true", "yes"}

    from server.customer_access import CustomerAccess
    guardians = CustomerAccess(store, APIError, secure=secure_cookies, clock=auth_clock)

    class Handler(BaseHTTPRequestHandler):
        server_version = "GroomingStudio/0.1"

        def send_json(self, data, status=200, headers=None):
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(payload)

        def session_token(self):
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                value = cookie.get(sessions.cookie_name)
                return value.value if value else None
            except CookieError:
                return None

        def session_cookie(self, token=None):
            cookie = SimpleCookie()
            cookie[sessions.cookie_name] = token or ""
            value = cookie[sessions.cookie_name]
            value["path"] = "/"
            value["httponly"] = True
            value["samesite"] = "Strict"
            value["max-age"] = sessions.lifetime if token else 0
            if secure_cookies or isinstance(self.connection, ssl.SSLSocket):
                value["secure"] = True
            return value.OutputString()

        def auth_status(self):
            authenticated = bool(sessions.authenticated(self.session_token()))
            return {"authenticated": authenticated, "role": "owner" if authenticated else None, "configured": sessions.configured}

        def require_owner(self):
            if not sessions.configured:
                raise APIError("매장 로그인 설정이 필요합니다.", 503)
            if not sessions.authenticated(self.session_token()):
                raise APIError("사장님 로그인이 필요합니다.", 401)

        def validate_origin(self):
            origin = self.headers.get("Origin")
            expected_scheme = "https" if secure_cookies or isinstance(self.connection, ssl.SSLSocket) else "http"
            try:
                parsed = urlsplit(origin) if origin else None
            except ValueError:
                raise APIError("다른 사이트에서는 데이터를 변경할 수 없습니다.", 403) from None
            if self.headers.get("Sec-Fetch-Site") == "cross-site" or parsed and (parsed.netloc != self.headers.get("Host") or parsed.scheme != expected_scheme or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
                raise APIError("다른 사이트에서는 데이터를 변경할 수 없습니다.", 403)

        def read_json(self, maximum=2_200_000):
            self.validate_origin()
            if self.headers.get_content_type() != "application/json":
                raise APIError("JSON 형식으로 요청해 주세요.", 415)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise APIError("요청 크기가 올바르지 않습니다.") from None
            if length <= 0 or length > maximum:
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
                if method == "GET" and path == "/api/auth/session":
                    return self.send_json(self.auth_status())
                if method == "POST" and path == "/api/auth/login":
                    self.validate_origin()
                    if not sessions.configured:
                        raise APIError("매장 로그인 설정이 필요합니다.", 503)
                    data = self.read_json(maximum=4096)
                    if set(data) != {"password"}:
                        raise APIError("비밀번호를 입력해 주세요.")
                    token = sessions.login(data["password"], self.client_address[0], self.session_token())
                    return self.send_json({"authenticated": True, "role": "owner", "configured": True}, headers={"Set-Cookie": self.session_cookie(token)})
                if method == "POST" and path == "/api/auth/logout":
                    self.validate_origin()
                    sessions.logout(self.session_token())
                    return self.send_json({"authenticated": False, "role": None, "configured": sessions.configured}, headers={"Set-Cookie": self.session_cookie()})
                if guardians.handle(self, method, path):
                    return
                care_public_match = re.fullmatch(r"/api/public/care/([a-f0-9]{32})", path)
                public = (method, path) in {
                    ("GET", "/api/public/price-menu"), ("GET", "/api/public/catalog"), ("GET", "/api/public/price-poster"), ("GET", "/api/public/availability"),
                    ("POST", "/api/public/requests"),
                } or method == "GET" and care_public_match is not None
                if path.startswith("/api/") and not public:
                    self.require_owner()
                if path == "/api/guardian-links" and method in {"GET", "PUT"}:
                    return self.send_json(guardians.links(self.read_json() if method == "PUT" else None))
                if method == "GET" and path == "/api/health":
                    with store.connect() as connection:
                        connection.execute("SELECT 1").fetchone()
                    return self.send_json({"status": "ok"})
                if method == "GET" and path == "/api/menu-booking":
                    return self.send_json(store.menu_booking())
                if method == "PUT" and path == "/api/menu-booking":
                    return self.send_json(store.save_menu_booking(self.read_json()))
                if method == "GET" and path == "/api/price-menu/state":
                    return self.send_json(store.price_menu_state())
                if method == "GET" and path == "/api/price-menu/history":
                    offset = parse_qs(parsed.query).get('offset', ['0'])[0]
                    if not offset.isdigit(): raise APIError('이력 페이지를 확인해 주세요.')
                    return self.send_json(store.price_menu_history(int(offset)))
                history_match = re.fullmatch(r"/api/price-menu/history/([1-9][0-9]*)(/restore)?", path)
                if history_match and method == 'GET' and not history_match.group(2):
                    return self.send_json(store.price_menu_version(int(history_match.group(1))))
                if history_match and method == 'POST' and history_match.group(2):
                    return self.send_json(store.save_price_menu(self.read_json(), versioned=True, restore=int(history_match.group(1))))
                if method == 'POST' and path == '/api/price-menu/revisions':
                    return self.send_json(store.save_price_menu(self.read_json(), versioned=True))
                if method == "GET" and path == "/api/public/price-menu":
                    return self.send_json(store.price_menu())
                if method == "PUT" and path == "/api/price-menu":
                    return self.send_json(store.save_price_menu(self.read_json()))
                if method == "GET" and path == "/api/public/catalog":
                    return self.send_json(store.public_catalog())
                if method == "GET" and care_public_match:
                    return self.send_json(store.public_care(care_public_match.group(1)))
                if method == "GET" and path == "/api/public/availability":
                    query = parse_qs(parsed.query)
                    return self.send_json(store.public_availability(query.get("date",[""])[0],query.get("serviceId",[""])[0]))
                if method == "POST" and path == "/api/public/requests":
                    return self.send_json(store.request_booking(self.read_json()),201)
                if method == "GET" and path == "/api/public/price-poster":
                    return self.send_json(store.price_poster())
                if method == "PUT" and path == "/api/price-poster":
                    return self.send_json(store.save_price_poster(self.read_json(maximum=2600000)))
                if method == "DELETE" and path == "/api/price-poster":
                    self.validate_origin()
                    return self.send_json(store.save_price_poster(None))
                if method == "GET" and path == "/api/notices":
                    return self.send_json(store.notices())
                if method == "PUT" and path == "/api/notices":
                    return self.send_json(store.update_notices(self.read_json()))
                if method == "GET" and path == "/api/booking-requests":
                    return self.send_json(store.booking_requests())
                booking_match = re.fullmatch(r"/api/booking-requests/([a-f0-9]{32})",path)
                if method == "POST" and booking_match:
                    return self.send_json(store.decide_booking(booking_match.group(1), self.read_json()))
                if method == "GET" and path == "/api/state":
                    query = parse_qs(parsed.query, keep_blank_values=True)
                    month = query.get("month", [today()[:7]])[0]
                    return self.send_json(store.state(month, care_summary=query.get("care", [""])[0] == "summary"))
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
                care_match = re.fullmatch(r"/api/appointments/([a-f0-9]{32})/care(/publish)?", path)
                if care_match:
                    appointment_id, publication = care_match.groups()
                    if method == "GET" and not publication:
                        return self.send_json(store.get_care(appointment_id))
                    if method in {"POST", "PATCH"} and not publication:
                        return self.send_json(store.save_care(appointment_id, self.read_json(maximum=3_000_000)))
                    if method == "POST" and publication:
                        return self.send_json(store.publish_care(appointment_id, self.read_json()))
                    if method == "DELETE" and publication:
                        self.validate_origin()
                        return self.send_json(store.unpublish_care(appointment_id))
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
