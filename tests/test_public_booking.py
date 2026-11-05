from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from server.app import Store, APIError, today

class PublicBookingTest(unittest.TestCase):
 def setUp(self):
  self.folder=TemporaryDirectory();self.addCleanup(self.folder.cleanup);self.store=Store(Path(self.folder.name)/'booking.sqlite')
  self.date=(date.fromisoformat(today())+timedelta(days=10)).isoformat();self.service=self.store.public_catalog()['pricing']['services'][0]
 def payload(self,**changes):
  return {'serviceId':self.service['id'],'date':self.date,'time':'09:00','dogName':'테스트 두부','guardianName':'테스트 보호자','phone':'010-0000-0000','breed':'말티즈','weight':3.2,'notes':'체험 예약','consent':True,**changes}
 def test_request_holds_time_and_accepts_once_without_creating_revenue(self):
  self.assertEqual(set(self.store.public_catalog()),{'pricing','name','hours','notices'})
  self.assertIn('09:00',self.store.public_availability(self.date,self.service['id'])['slots'])
  receipt=self.store.request_booking(self.payload())
  self.assertEqual(set(receipt),{'id','status','date','time','price'})
  self.assertNotIn('09:00',self.store.public_availability(self.date,self.service['id'])['slots'])
  with self.assertRaises(APIError):self.store.request_booking(self.payload())
  state=self.store.state(self.date[:7]);self.assertEqual(state['appointments'],[]);self.assertEqual(state['summary']['revenue'],0)
  self.store.decide_booking(receipt['id'],{'decision':'accept'})
  appointment=self.store.state(self.date[:7])['appointments'][0]
  self.assertEqual(appointment['source'],'website');self.assertEqual(appointment['externalId'],receipt['id']);self.assertEqual(appointment['paymentStatus'],'unpaid')
  self.assertEqual(self.store.state(self.date[:7])['summary']['revenue'],0)
  with self.assertRaises(APIError):self.store.decide_booking(receipt['id'],{'decision':'accept'})
 def test_reject_releases_hold_and_invalid_customer_payload_never_saves(self):
  for changes in [{'price':0},{'consent':False},{'phone':'123'},{'date':'2020-01-01'},{'time':'23:00'},{'weight':0}]:
   with self.subTest(changes=changes):
    with self.assertRaises(APIError):self.store.request_booking(self.payload(**changes))
  self.assertEqual(self.store.booking_requests(),[])
  receipt=self.store.request_booking(self.payload());self.store.decide_booking(receipt['id'],{'decision':'reject'})
  self.assertIn('09:00',self.store.public_availability(self.date,self.service['id'])['slots'])
  self.assertEqual(self.store.state(self.date[:7])['appointments'],[])
 def test_confirm_rechecks_manual_overlap_and_original_price_survives_price_change(self):
  receipt=self.store.request_booking(self.payload())
  pricing=self.store.public_catalog()['pricing'];pricing['services'][0]['basePrice']+=10000;self.store.update_pricing(pricing)
  self.store.create_appointment({'dogName':'다른 아이','guardianName':'보호자','date':self.date,'time':'09:00','duration':60,'service':'상담','basePrice':1000})
  with self.assertRaises(APIError):self.store.decide_booking(receipt['id'],{'decision':'accept'})
  self.assertEqual(self.store.booking_requests()[0]['price'],receipt['price']);self.assertEqual(self.store.booking_requests()[0]['status'],'pending')
