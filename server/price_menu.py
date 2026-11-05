def validate_menu(menu, error):
    try:
        def text(v):
            if not isinstance(v,str) or len(v)>2000:raise ValueError()
            return v
        def rows(v,maximum):
            if not isinstance(v,list) or len(v)>maximum:raise ValueError()
            return v
        columns=[text(c) for c in rows(menu['columns'],8)]
        sections=[]
        for s in rows(menu['sections'],24):
            entry={k:text(s[k]) for k in ('title','breeds','note','content')}
            entry['rows']=[{'weight':text(r['weight']),'prices':[text(p) for p in rows(r['prices'],8)]} for r in rows(s['rows'],30)]
            if any(len(r['prices'])!=len(columns) for r in entry['rows']):raise ValueError()
            entry['items']=[{'label':text(i['label']),'value':text(i['value'])} for i in rows(s['items'],40)]
            sections.append(entry)
        return {'columns':columns,'sections':sections}
    except (KeyError,TypeError,ValueError):raise error('요금표 입력 형식을 확인해 주세요.') from None
