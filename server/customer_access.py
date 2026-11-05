"""Guardian credentials, owner-approved customer links, and scoped notebook reads."""
import hashlib
import json
import re
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie, CookieError
from threading import Lock

class CustomerAccess:
    cookie_name = 'mongle_guardian_session'
    def __init__(self, store, error, secure=False, clock=time.monotonic):
        self.store, self.error, self.secure, self.clock = store, error, secure, clock
        self.sessions, self.attempts, self.lock = {}, {}, Lock()
        with store.connect(write=True) as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS guardian_accounts(id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, passwordHash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS guardian_links(accountId TEXT NOT NULL, customerId TEXT UNIQUE NOT NULL, PRIMARY KEY(accountId,customerId));''')

    def token(self, handler):
        try:
            cookie=SimpleCookie(handler.headers.get('Cookie',''));value=cookie.get(self.cookie_name)
            return value.value if value else ''
        except CookieError: return ''

    def cookie(self, token=''):
        cookie=SimpleCookie();cookie[self.cookie_name]=token
        v=cookie[self.cookie_name];v['path']='/';v['httponly']=True;v['samesite']='Strict';v['max-age']=2592000 if token else 0
        if self.secure:v['secure']=True
        return v.OutputString()

    def identity(self, handler, required=True):
        key=hashlib.sha256(self.token(handler).encode()).hexdigest()
        with self.lock:
            now=self.clock();self.sessions={k:v for k,v in self.sessions.items() if v[1]>now}
            entry=self.sessions.get(key)
        if not entry:
            if required:raise self.error('보호자 로그인이 필요합니다.',401)
            return None
        return entry[0]

    def credentials(self,data):
        phone=re.sub(r'[-\s]','',str(data.get('phone','')))
        password=data.get('password')
        if not re.fullmatch(r'01[016789][0-9]{7,8}',phone) or not isinstance(password,str) or not 10<=len(password)<=128:
            raise self.error('휴대폰 번호와 10~128자 비밀번호를 입력해 주세요.')
        return phone,password

    def login(self,handler,data,signup):
        client=handler.client_address[0]
        with self.lock:
            now=self.clock();self.attempts={k:[t for t in v if t>now-60] for k,v in self.attempts.items() if any(t>now-60 for t in v)}
            attempts=self.attempts.get(client,[])
            if len(attempts)>=5:raise self.error('잠시 후 다시 시도해 주세요.',429)
            self.attempts[client]=[*attempts,now]
        phone,password=self.credentials(data)
        with self.store.connect(write=True) as c:
            if signup:
                name=data.get('name','').strip() if isinstance(data.get('name'),str) else ''
                if not 1<=len(name)<=80:raise self.error('보호자 이름을 입력해 주세요.')
                salt=secrets.token_hex(16);hashed=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
                try:c.execute('INSERT INTO guardian_accounts VALUES(?,?,?,?,?)',(secrets.token_hex(16),name,phone,salt,hashed))
                except sqlite3.IntegrityError:raise self.error('가입 정보를 확인하거나 기존 계정으로 로그인해 주세요.',409) from None
            account=c.execute('SELECT * FROM guardian_accounts WHERE phone=?',(phone,)).fetchone()
            salt=account['salt'] if account else '00'*16
            supplied=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
            if not account or not secrets.compare_digest(supplied,account['passwordHash']):raise self.error('휴대폰 번호와 비밀번호를 확인해 주세요.',401)
        token=secrets.token_urlsafe(32)
        with self.lock:
            self.sessions.pop(hashlib.sha256(self.token(handler).encode()).hexdigest(),None)
            while len(self.sessions)>=2048:self.sessions.pop(next(iter(self.sessions)))
            self.sessions[hashlib.sha256(token.encode()).hexdigest()]=(account['id'],self.clock()+2592000)
        return token

    def notebook(self,account):
        with self.store.connect() as c:
            user=c.execute('SELECT name FROM guardian_accounts WHERE id=?',(account,)).fetchone()
            # Never return master health/behavior notes, guardian details, money or share tokens.
            pets=[dict(p) for p in c.execute('SELECT p.id,p.name,p.breed FROM pets p JOIN guardian_links l ON l.customerId=p.customerId WHERE l.accountId=?',(account,))]
            records=[]
            for row in c.execute('''SELECT r.payload FROM care_records r JOIN pets p ON json_extract(r.payload,'$.publishedSnapshot.petId')=p.id JOIN guardian_links l ON l.customerId=p.customerId WHERE l.accountId=? AND json_extract(r.payload,'$.published')=1''',(account,)):
                snapshot=json.loads(row['payload']).get('publishedSnapshot')
                if snapshot:records.append(snapshot)
        return {'name':user['name'],'pets':pets,'records':sorted(records,key=lambda r:r['date'],reverse=True)}

    def links(self,data=None):
        with self.store.connect(write=True) as c:
            if data is not None:
                if set(data)!={'accountId','customerId','linked'} or type(data['linked']) is not bool:raise self.error('연결 항목을 확인해 주세요.')
                account=c.execute('SELECT phone FROM guardian_accounts WHERE id=?',(data['accountId'],)).fetchone()
                customer=c.execute('SELECT phone FROM customers WHERE id=?',(data['customerId'],)).fetchone()
                if not account or not customer:raise self.error('보호자와 고객 정보를 확인해 주세요.')
                if data['linked']:
                    if re.sub(r'\D','',customer['phone'])!=account['phone']:raise self.error('등록된 연락처가 일치하지 않습니다. 고객대장을 확인해 주세요.')
                    try:c.execute('INSERT INTO guardian_links VALUES(?,?)',(data['accountId'],data['customerId']))
                    except sqlite3.IntegrityError:raise self.error('이미 연결된 고객입니다.',409) from None
                else:c.execute('DELETE FROM guardian_links WHERE accountId=? AND customerId=?',(data['accountId'],data['customerId']))
            accounts=[dict(a) for a in c.execute('SELECT id,name,phone FROM guardian_accounts')]
            links=[dict(l) for l in c.execute('SELECT * FROM guardian_links')]
            customers=[dict(cu) for cu in c.execute('SELECT id,name,phone FROM customers')]
        return {'accounts':accounts,'links':links,'customers':customers}

    def handle(self,handler,method,path):
        if not path.startswith('/api/guardian/'):return False
        route=path.removeprefix('/api/guardian/')
        if method=='POST' and route in ('signup','login'):
            token=self.login(handler,handler.read_json(maximum=4096),route=='signup')
            handler.send_json({'authenticated':True},headers={'Set-Cookie':self.cookie(token)});return True
        if method=='POST' and route=='logout':
            handler.validate_origin()
            with self.lock:self.sessions.pop(hashlib.sha256(self.token(handler).encode()).hexdigest(),None)
            handler.send_json({'authenticated':False},headers={'Set-Cookie':self.cookie()});return True
        if method=='GET' and route=='session':
            handler.send_json({'authenticated':self.identity(handler,False) is not None});return True
        if method=='GET' and route=='notebook':
            handler.send_json(self.notebook(self.identity(handler)));return True
        raise self.error('요청을 찾을 수 없습니다.',404)
