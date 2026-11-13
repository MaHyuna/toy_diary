"""Two isolated browser profiles against real local Firebase emulators; no production account."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import json,subprocess,urllib.request,io
from PIL import Image
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
subprocess.run(['node','--input-type=module','-e',"import {build} from 'esbuild';await build({entryPoints:['scripts/firebase/test-entry.js'],bundle:true,format:'esm',minify:true,outfile:'/tmp/price-firebase-test-sdk.mjs'});"],cwd=root,check=True)
user={'email':'price-test@example.test','password':'test-password-only','returnSecureToken':True}
request=urllib.request.Request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',json.dumps(user).encode(),{'Content-Type':'application/json'})
try:urllib.request.urlopen(request).read()
except urllib.error.HTTPError as e:
 if b'EMAIL_EXISTS' not in e.read():raise
config={'enabled':True,'apiKey':'demo-key','authDomain':'localhost','projectId':'demo-price-studio','appId':'demo-app','storageBucket':'demo-price-studio.appspot.com'}
wrapper='''export * from './firebase-test-sdk.mjs';
import * as sdk from './firebase-test-sdk.mjs';
export function initializeApp(config){const app=sdk.initializeApp(config);sdk.connectAuthEmulator(sdk.getAuth(app),'http://127.0.0.1:9099',{disableWarnings:true});sdk.connectFirestoreEmulator(sdk.getFirestore(app),'127.0.0.1',8787);sdk.connectStorageEmulator(sdk.getStorage(app),'127.0.0.1',9199);return app;}
export const signInWithPopup=auth=>sdk.signInWithEmailAndPassword(auth,'price-test@example.test','test-password-only');'''
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  path=self.path.split('?')[0]
  content=None
  if path.endswith('/firebase-config.json'):content=json.dumps(config).encode();mime='application/json'
  elif path.endswith('/vendor/firebase.mjs'):content=wrapper.encode();mime='text/javascript'
  elif path.endswith('/vendor/firebase-test-sdk.mjs'):content=Path('/tmp/price-firebase-test-sdk.mjs').read_bytes();mime='text/javascript'
  if content is not None:
   self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(content);return
  super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  pc=browser.new_context(viewport={'width':1440,'height':1000});phone=browser.new_context(viewport={'width':390,'height':900},is_mobile=True,has_touch=True)
  a,b=pc.new_page(),phone.new_page();errors=[]
  for page in [a,b]:
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
  def name(page,value):
   page.locator('[data-open-inspector="brand"]').click();page.get_by_label('매장 이름',exact=True).fill(value);page.locator('#inspector-close').click()
   page.wait_for_function('(name)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).brand.name===name',arg=value)
  name(a,'PC 첫 작업')
  for page in [a,b]:
   page.locator('#cloud-open').click();expect(page.locator('#cloud-login')).to_be_enabled(timeout=30000);page.locator('#cloud-login').click()
   expect(page.locator('#cloud-choices')).to_be_visible(timeout=30000)
   page.locator('#cloud-local' if page==a else '#cloud-remote').click()
   expect(page.locator('#cloud-status')).to_contain_text('저장됨',timeout=30000);page.locator('#cloud-close').click()
  b.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.name==='PC 첫 작업'")
  name(a,'PC에서 수정');b.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.name==='PC에서 수정'",timeout=30000)
  # Offline work must survive and stop overwriting a newer remote revision.
  phone.set_offline(True);name(b,'모바일 오프라인 수정');b.wait_for_timeout(1400)
  name(a,'PC 최신 수정');a.locator('#cloud-open').click();expect(a.locator('#cloud-status')).to_contain_text('저장됨',timeout=30000);a.locator('#cloud-close').click()
  phone.set_offline(False);b.locator('#cloud-open').click();expect(b.locator('#cloud-choices')).to_be_visible(timeout=30000)
  assert b.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.name")=='모바일 오프라인 수정'
  with b.expect_download() as backup:b.locator('#cloud-remote').click()
  assert json.loads(Path(backup.value.path()).read_text())['brand']['name']=='모바일 오프라인 수정'
  b.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.name==='PC 최신 수정'",timeout=30000)
  b.locator('#cloud-close').click()
  # Private logo upload and retrieval across devices use Storage, not a >1MB Firestore field.
  png=io.BytesIO();Image.new('RGBA',(30,30),(120,80,130,160)).save(png,format='PNG')
  a.locator('[data-open-inspector="brand"]').click();a.get_by_label('매장 로고 파일').set_input_files({'name':'test-logo.png','mimeType':'image/png','buffer':png.getvalue()});a.locator('#inspector-close').click()
  a.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.logo.length<2000")
  image=a.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.logo")
  b.wait_for_function('(logo)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).brand.logo===logo',arg=image,timeout=30000)
  b.reload(wait_until='domcontentloaded');b.wait_for_function("document.querySelector('#cloud-open').textContent==='클라우드 저장됨'",timeout=30000)
  assert b.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).brand.logo")==image
  assert not errors,errors
  browser.close()
 print('PASS real Firebase emulators: login, two-device sync, offline conflict preservation, backup-before-reload, private logo sync and reload')
finally:server.shutdown();server.server_close()
