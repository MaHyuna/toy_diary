"""Validate actual outlined files, physical print sizes, and unchanged editor geometry."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import json,math,xml.etree.ElementTree as ET
import fitz
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
out=Path('/tmp/price-print-check');out.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
  expect(page.locator('#download')).to_be_enabled();expect(page.locator('#render-error')).to_be_empty()
  original=page.locator('#preview').evaluate('c=>[c.width,c.height,c.toDataURL()]')
  page.locator('#download').click()
  for name in ['A1','A2','A3','A4','A5','A6','A0','B4','B5','Letter']:
   page.locator('#print-paper').select_option(name);expect(page.locator('#export-current')).to_be_enabled()
   assert name in page.locator('#export-summary').inner_text()
  page.locator('#print-paper').select_option('A4')
  for format in ['svg','pdf','png','jpg']:
   page.locator('#print-format').select_option(format)
   if format in ['png','jpg']:page.locator('#print-dpi').select_option('150')
   with page.expect_download(timeout=120000) as pending:page.locator('#export-current').click()
   pending.value.save_as(out/('price.'+format))
   expect(page.locator('#export-current')).to_be_enabled(timeout=10000)
  assert original==page.locator('#preview').evaluate('c=>[c.width,c.height,c.toDataURL()]'),'Export resized the editor'
  svg=ET.parse(out/'price.svg').getroot();ns='{http://www.w3.org/2000/svg}'
  assert not list(svg.iter(ns+'text'))
  assert len(list(svg.iter(ns+'path')))>100
  images=list(svg.iter(ns+'image'));assert len(images)==1 and images[0].attrib['href'].startswith('data:image/png;base64,')
  assert svg.attrib['width']=='210mm' and svg.attrib['height']=='297mm'
  doc=fitz.open(out/'price.pdf');assert len(doc)==1
  sheet=doc[0];assert abs(sheet.rect.width*25.4/72-210)<.01 and abs(sheet.rect.height*25.4/72-297)<.01
  assert not sheet.get_text().strip(),'PDF contains unoutlined text'
  assert not sheet.get_fonts(),'Outlined PDF must not depend on fonts'
  assert len(sheet.get_drawings())>100,'PDF must have vector paths'
  assert [(i[2],i[3]) for i in sheet.get_images()]==[(1254,1254)],'Original logo resolution changed'
  sheet.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(str(out/'pdf-preview.png'))
  for format in ['png','jpg']:
   img=Image.open(out/('price.'+format));assert img.size==(1240,1754),img.size
   assert abs(img.info['dpi'][0]-150)<.1,img.info
  # Custom landscape, bleed, crop marks and actual PDF page boxes.
  page.locator('#print-format').select_option('pdf');page.locator('#print-paper').select_option('custom')
  page.locator('#print-width').fill('300');page.locator('#print-width').dispatch_event('change')
  page.locator('#print-height').fill('400');page.locator('#print-height').dispatch_event('change')
  page.locator('#print-orientation').select_option('landscape')
  page.locator('.print-extra summary').click();page.locator('#print-bleed').select_option('3');page.locator('#print-cropMarks').check()
  with page.expect_download(timeout=120000) as pending:page.locator('#export-current').click()
  pending.value.save_as(out/'custom.pdf')
  custom=fitz.open(out/'custom.pdf')[0]
  assert abs(custom.rect.width*25.4/72-416)<.01
  assert abs(custom.rect.height*25.4/72-316)<.01
  assert abs(custom.trimbox.width*25.4/72-400)<.01
  assert abs(custom.bleedbox.width*25.4/72-406)<.01
  # Oversized bitmap is rejected visibly, while the same A1 vector remains available.
  page.locator('#print-paper').select_option('A1');page.locator('#print-format').select_option('png');page.locator('#print-dpi').select_option('300')
  expect(page.locator('#export-current')).to_be_disabled();assert 'dpi' in page.locator('#export-error').inner_text()
  page.locator('#print-format').select_option('svg');expect(page.locator('#export-current')).to_be_enabled()
  page.locator('#export-close').click()
  # Every new ornament draws and retains its settings after a reload.
  page.locator('#view-form').click();page.locator('[data-tab="design"]').click()
  for shape in ['paw','heart','star','sparkle','diamond','circle','leaf','flower']:
   page.locator('[data-design="markerShape"]').select_option(shape)
   page.locator('[data-design="markerSize"]').fill('30')
   expect(page.locator('#render-error')).to_be_empty()
  page.locator('[data-inspector-tab="border"]').click();page.locator('[data-border-pick="rounded"]').click()
  page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.border==='rounded'")
  page.reload(wait_until='networkidle');expect(page.locator('#render-error')).to_be_empty()
  assert page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).print.paper")=='A1'
  page.locator('#download').click();page.screenshot(path=str(out/'export-dialog.png'))
  assert not errors,errors
  # Mobile dialog must fit the viewport and retain reachable controls.
  mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  mobile.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
  mobile.locator('#download-mobile').click();mobile.locator('#print-format').select_option('svg')
  mobile.locator('#export-current').scroll_into_view_if_needed();expect(mobile.locator('#export-current')).to_be_visible()
  assert mobile.locator('#export-menu').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  mobile.screenshot(path=str(out/'mobile-dialog.png'))
  browser.close()
 print('PASS outlined SVG/PDF, physical sizes and page boxes, PNG/JPG dpi, all paper sizes, export isolation, decorations, persistence, mobile dialog')
finally:server.shutdown();server.server_close()
