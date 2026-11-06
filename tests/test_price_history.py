import copy
import json
import sqlite3
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from server.app import Store, APIError
from tests.menu_fixture import MENU, configure

class PriceHistoryTest(unittest.TestCase):
    def setUp(self):
        self.folder=TemporaryDirectory();self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)/'test.sqlite';self.store=Store(self.path)
    def changed(self, price):
        value=copy.deepcopy(MENU);value['sections'][0]['rows'][0]['prices'][0]=str(price);return value
    def write(self, menu, version, note=''):
        return self.store.save_price_menu({'menu':menu,'expectedVersion':version,'note':note},versioned=True)
    def test_migration_keeps_legacy_menu_and_records_baseline_once(self):
        with self.store.connect(write=True) as db:db.execute("INSERT INTO settings VALUES('price-menu',?)",(json.dumps(MENU),))
        reopened=Store(self.path);history=reopened.price_menu_history()
        self.assertEqual(history['total'],1);self.assertEqual(history['entries'][0]['kind'],'baseline')
        self.assertEqual(reopened.price_menu_version(1)['menu'],MENU)
        self.assertEqual(Store(self.path).price_menu_history()['total'],1)
    def test_restore_appends_and_preserves_reservations(self):
        configure(self.store)
        appointment=self.store.create_appointment({'dogName':'두부','guardianName':'보호자','service':'목욕','date':'2030-01-20','time':'09:00','duration':60,'basePrice':15000})
        first=self.store.price_menu_version(1)
        changed=self.write(self.changed(18000),1,'가격 조정')
        self.assertEqual(changed['version'],2)
        restored=self.store.save_price_menu({'expectedVersion':2,'note':'가격 조정 철회'},versioned=True,restore=1)
        self.assertEqual(restored,{'menu':MENU,'version':3});self.assertEqual(self.store.price_menu_version(1),first)
        self.assertEqual(self.store.price_menu_version(3)['restoredFrom'],1)
        self.assertEqual(self.store.price_menu_version(2)['note'],'가격 조정')
        self.assertEqual(self.store.state('2030-01')['appointments'][0],appointment)
        self.assertEqual(Store(self.path).price_menu_state(),restored)
        with self.assertRaises(APIError):self.store.save_price_menu({'expectedVersion':3},versioned=True,restore=999)
        self.assertEqual(self.store.price_menu_state(),restored)
    def test_stale_writer_and_simultaneous_writers_cannot_overwrite(self):
        self.write(MENU,0)
        def submit(price):
            try:return self.write(self.changed(price),1)['version']
            except APIError as error:return error.status
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(submit,[17000,19000]))
        self.assertEqual(sorted(results),[2,409]);self.assertEqual(self.store.price_menu_history()['total'],2)
        with self.assertRaises(APIError) as caught:self.store.save_price_menu({'expectedVersion':1},versioned=True,restore=1)
        self.assertEqual(caught.exception.status,409)
    def test_snapshot_failure_rolls_back_current_menu(self):
        self.write(MENU,0)
        with self.store.connect(write=True) as db:db.execute("CREATE TRIGGER fail_history BEFORE INSERT ON price_menu_history BEGIN SELECT RAISE(ABORT,'disk error'); END")
        with self.assertRaises(sqlite3.IntegrityError):self.write(self.changed(17000),1)
        self.assertEqual(self.store.price_menu_state(),{'menu':MENU,'version':1})
    def test_noop_invalid_and_pagination(self):
        self.write(MENU,0)
        self.assertEqual(self.write(MENU,1)['version'],1)
        with self.assertRaises(APIError):self.write({'columns':[], 'sections':[{}]},1)
        with self.assertRaises(APIError):self.write(self.changed(19000),1,'x'*501)
        for version in range(1,23):self.write(self.changed(16000+version),version)
        first=self.store.price_menu_history();second=self.store.price_menu_history(20)
        self.assertEqual(first['total'],23);self.assertEqual(len(first['entries']),20)
        self.assertEqual([r['version'] for r in second['entries']],[3,2,1])
