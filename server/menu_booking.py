"""Explicit booking references to published menu cells. Never infer ranges or prices."""
import hashlib
import json
import math
import re


def sources(menu):
    result = []
    if not menu:
        return result
    for si, section in enumerate(menu['sections']):
        for ri, row in enumerate(section['rows']):
            for ci, column in enumerate(menu['columns']):
                result.append({'id': f'cell:{si}:{ri}:{ci}', 'group': section['title'], 'service': column,
                               'band': row['weight'], 'value': row['prices'][ci]})
        for ii, item in enumerate(section['items']):
            result.append({'id': f'item:{si}:{ii}', 'group': section['title'], 'service': item['label'],
                           'band': '', 'value': item['value']})
    return result


def fixed_price(value):
    value = value.strip()
    if not re.fullmatch(r'(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:원)?', value):
        return None
    number = int(value.removesuffix('원').replace(',', ''))
    return number if number <= 100_000_000 else None


def identity(source):
    return {k: source[k] for k in ('id', 'group', 'service', 'band')}


def validate_rules(data, menu, error):
    if not isinstance(data, dict) or set(data) != {'rules'} or not isinstance(data['rules'], list) or len(data['rules']) > 300:
        raise error('예약 요금 연결 항목을 확인해 주세요.')
    available = {s['id']: s for s in sources(menu)}
    result = []
    for rule in data['rules']:
        if not isinstance(rule, dict) or set(rule) != {'source', 'minWeight', 'maxWeight', 'duration'}:
            raise error('예약 요금 연결 항목을 확인해 주세요.')
        source = available.get(rule['source'].get('id')) if isinstance(rule['source'], dict) and isinstance(rule['source'].get('id'), str) else None
        if not source or identity(source) != rule['source'] or fixed_price(source['value']) is None:
            raise error('표 항목이 바뀌었거나 단일 금액이 아닙니다. 요금표를 확인해 주세요.')
        low, high, duration = rule['minWeight'], rule['maxWeight'], rule['duration']
        if any(type(v) not in (int, float) or not 0 <= v <= 150 or not math.isfinite(v) for v in (low, high)) or not 0 <= low < high <= 150:
            raise error('체중 범위는 0 이상 150kg 이하로 입력해 주세요.')
        if type(duration) is not int or not 10 <= duration <= 480:
            raise error('소요 시간은 10~480분으로 입력해 주세요.')
        if len(source['group']+' · '+source['service']) > 80:
            raise error('예약에 사용할 분류와 서비스 이름을 합쳐 80자 이내로 줄여 주세요.')
        for prev in result:
            if prev['source']['id'] == source['id'] or (prev['source']['group'] == source['group'] and prev['source']['service'] == source['service'] and low < prev['maxWeight'] and prev['minWeight'] < high):
                raise error('같은 서비스의 체중 범위가 겹치거나 항목이 중복됩니다.')
        result.append({'source': identity(source), 'minWeight': low, 'maxWeight': high, 'duration': duration})
    return result


def catalog(menu, rules):
    available = {s['id']: s for s in sources(menu)}
    offers = []
    for rule in rules:
        source = available.get(rule['source']['id'])
        if not source or identity(source) != rule['source'] or fixed_price(source['value']) is None:
            continue  # Moved/renamed/consultation cells need explicit owner review.
        offers.append({**rule, 'id': source['id'], 'name': source['group']+' · '+source['service'],
                       'group': source['group'], 'service': source['service'], 'band': source['band'],
                       'price': fixed_price(source['value'])})
    revision = hashlib.sha256(json.dumps([menu, rules], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return {'revision': revision, 'offers': offers, 'unavailableCount': len(rules)-len(offers)}


def select_offer(current, identifier, revision, weight, error):
    if revision != current['revision']:
        raise error('요금표가 변경됐어요. 최신 요금과 시간을 다시 확인해 주세요.', 409)
    offer = next((item for item in current['offers'] if item['id'] == identifier), None)
    if not offer:
        raise error('예약 가능한 요금 항목을 다시 선택해 주세요.')
    if not (offer['minWeight'] <= weight < offer['maxWeight'] or weight == offer['maxWeight'] == 150):
        raise error('입력한 몸무게에 맞는 요금 항목을 선택해 주세요.')
    return offer
