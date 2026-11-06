import copy
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import date, timedelta
from server.app import Store, APIError, today
from server.menu_booking import fixed_price, sources, identity
from tests.menu_fixture import configure, MENU

class MenuBookingTest(unittest.TestCase):
    def setUp(self):
        self.folder=TemporaryDirectory();self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)/'test.sqlite';self.store=Store(self.path)
        self.day=(date.fromisoformat(today())+timedelta(days=10)).isoformat()
        self.catalog=configure(self.store)
    def payload(self, **kw):
        return dict(serviceId=self.catalog['offers'][0]['id'],revision=self.catalog['revision'],dogName='두부',guardianName='보호자',phone='01000000000',breed='말티즈',weight=3,date=self.day,time='09:00',consent=True,**kw)
    def test_prices_come_from_menu_not_legacy_and_snapshot_survives_acceptance(self):
        receipt=self.store.request_booking(self.payload());self.assertEqual(receipt['price'],15000)
        changed=copy.deepcopy(MENU);changed['sections'][0]['rows'][0]['prices'][0]='18,000';self.store.save_price_menu(changed)
        current=self.store.public_catalog()['booking'];self.assertEqual(current['offers'][0]['price'],18000)
        with self.assertRaises(APIError) as e:self.store.request_booking(self.payload())
        self.assertEqual(e.exception.status,409)
        self.store.decide_booking(receipt['id'],{'decision':'accept'})
        self.assertEqual(self.store.state(self.day[:7])['appointments'][0]['price'],15000)
        reopened=Store(self.path);self.assertEqual(reopened.booking_requests()[0]['quoteSnapshot']['offer']['price'],15000)
        self.assertEqual(reopened.state(self.day[:7])['summary']['revenue'],0)
    def test_no_config_never_falls_back_to_legacy(self):
        self.store.save_menu_booking({'rules':[]})
        self.assertEqual(self.store.public_catalog()['booking']['offers'],[])
        with self.assertRaises(APIError):self.store.request_booking(self.payload())
    def test_bounds_and_tampered_amount(self):
        for weight in (0,4,150):
            p=self.payload();p['weight']=weight
            with self.assertRaises(APIError):self.store.request_booking(p)
        p=self.payload();p['price']=1
        with self.assertRaises(APIError):self.store.request_booking(p)
        self.assertEqual(self.store.booking_requests(),[])
    def test_consultation_and_moved_cells_disabled_without_altering_old_records(self):
        for value in ('상담','7,000 / 10,000','10000~20000','10000부터'):
            m=copy.deepcopy(MENU);m['sections'][0]['rows'][0]['prices'][0]=value;self.store.save_price_menu(m)
            self.assertEqual(self.store.booking_catalog()['unavailableCount'],1)
        m=copy.deepcopy(MENU);m['sections'][0]['rows'].reverse();self.store.save_price_menu(m)
        self.assertEqual(self.store.booking_catalog()['offers'],[])
    def test_explicit_ranges_and_cat_items(self):
        rules=self.store.menu_booking()['rules'];bad=copy.deepcopy(rules);bad[2]['minWeight']=3
        with self.assertRaises(APIError):self.store.save_menu_booking({'rules':bad})
        self.assertEqual(self.store.menu_booking()['rules'],rules)
        cat={'columns':[], 'sections':[{'title':'고양이 미용','breeds':'','note':'','content':'','rows':[],'items':[{'label':'목욕','value':'50,000원'}]}]}
        self.store.save_price_menu(cat)
        self.store.save_menu_booking({'rules':[{'source':identity(sources(cat)[0]),'minWeight':0,'maxWeight':150,'duration':90}]})
        self.assertEqual(self.store.booking_catalog()['offers'][0]['price'],50000)
    def test_strict_numeric_values(self):
        for v in ('상담','1e4','7,00','-1','1.5','10000/20000','100000001'):
            self.assertIsNone(fixed_price(v))
        self.assertEqual(fixed_price('15,000원'),15000)
