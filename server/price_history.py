"""Append-only price menu snapshots. Caller owns the SQLite transaction."""
import json
from datetime import datetime, timezone

SCHEMA = '''CREATE TABLE IF NOT EXISTS price_menu_history (
 version INTEGER PRIMARY KEY AUTOINCREMENT,
 savedAt TEXT NOT NULL, kind TEXT NOT NULL, restoredFrom INTEGER,
 note TEXT NOT NULL, menu TEXT NOT NULL
);'''

def append(connection, menu, kind='save', note='', restored_from=None):
    connection.execute('INSERT INTO price_menu_history(savedAt,kind,restoredFrom,note,menu) VALUES(?,?,?,?,?)',
        (datetime.now(timezone.utc).isoformat(), kind, restored_from, note, json.dumps(menu, ensure_ascii=False)))

def current_version(connection):
    return connection.execute('SELECT COALESCE(MAX(version),0) FROM price_menu_history').fetchone()[0]

def ensure_baseline(connection, menu):
    row = connection.execute('SELECT menu FROM price_menu_history ORDER BY version DESC LIMIT 1').fetchone()
    if menu is not None and (row is None or json.loads(row[0]) != menu):
        append(connection, menu, 'baseline', '이력 도입 시 기존 저장본 보존 · 최초 작성일은 알 수 없습니다.')

def state(connection, menu):
    return {'menu': menu, 'version': current_version(connection)}

def check_version(connection, value, error):
    if type(value) is not int or value < 0:
        raise error('수정 기준 버전을 확인해 주세요.')
    if value != current_version(connection):
        raise error('다른 화면에서 요금표가 변경되었습니다. 입력 내용은 유지됩니다. 최신 목록을 다시 불러온 뒤 수정해 주세요.', 409)

def note_value(data, error):
    value = data.get('note', '')
    if not isinstance(value, str) or len(value) > 500:
        raise error('변경 사유는 500자 이내로 입력해 주세요.')
    return value.strip()

def detail(connection, version, error):
    row = connection.execute('SELECT * FROM price_menu_history WHERE version=?', (version,)).fetchone()
    if row is None:
        raise error('요금표 버전을 찾을 수 없습니다.', 404)
    value = dict(row)
    value['menu'] = json.loads(value['menu'])
    return value
