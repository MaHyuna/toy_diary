import json
import unittest
import test_auth as support

class GuardianTest(unittest.TestCase):
    setUp=support.AuthTest.setUp
    start_server=support.AuthTest.start_server
    request=support.AuthTest.request
    login=support.AuthTest.login

    def signup(self,phone='01012345678'):
        status,_,headers=self.request('POST','/api/guardian/signup',{'name':'보호자','phone':phone,'password':'correct-horse-123'})
        self.assertEqual(status,200)
        self.assertIn('HttpOnly',headers['Set-Cookie'])
        return headers['Set-Cookie'].split(';')[0]

    def test_signup_link_scope_revoke_logout_and_roles(self):
        owner,_=self.login()
        guardian=self.signup()
        other=self.signup('01088887777')
        self.assertEqual(self.request('GET','/api/guardian/notebook')[0],401)
        self.assertEqual(self.request('GET','/api/state',cookie=guardian)[0],401)
        self.assertEqual(self.request('GET','/api/guardian-links',cookie=guardian)[0],401)
        self.assertEqual(self.request('GET','/api/guardian/notebook',cookie=owner)[0],401)
        customer=self.store.create_customer({'name':'보호자','phone':'010-1234-5678','notes':'PRIVATE'})
        pet=self.store.create_pet({'customerId':customer['id'],'name':'몽이','breed':'말티즈','healthNotes':'PRIVATE'})
        visit=self.store.create_appointment({'dogName':'몽이','guardianName':'보호자','phone':customer['phone'],'petId':pet['id'],'breed':'말티즈','weight':3.2,'service':'전체 미용','date':'2026-01-01','time':'09:00','duration':60,'basePrice':65000,'notes':'PRIVATE'})
        self.store.save_care(visit['id'],{'beforeNotes':'미용 전','afterNotes':'미용 후','groomerOpinion':'피부 확인','homeCare':'빗질해 주세요','nextVisitDate':'','photos':[]})
        accounts=self.request('GET','/api/guardian-links',cookie=owner)[1]['accounts']
        account=next(a for a in accounts if a['phone']=='01012345678')['id']
        link={'accountId':account,'customerId':customer['id'],'linked':True}
        self.assertEqual(self.request('PUT','/api/guardian-links',link,cookie=guardian)[0],401)
        self.assertEqual(self.request('GET','/api/guardian/notebook',cookie=guardian)[1]['pets'],[])
        self.assertEqual(self.request('PUT','/api/guardian-links',link,cookie=owner)[0],200)
        notebook=self.request('GET','/api/guardian/notebook',cookie=guardian)[1]
        self.assertEqual(notebook['pets'][0]['name'],'몽이');self.assertEqual(notebook['records'],[])
        self.store.publish_care(visit['id'],{})
        notebook=self.request('GET','/api/guardian/notebook',cookie=guardian)[1]
        self.assertEqual(len(notebook['records']),1)
        self.assertNotIn('PRIVATE',json.dumps(notebook));self.assertNotIn('shareToken',json.dumps(notebook));self.assertNotIn('basePrice',json.dumps(notebook))
        self.assertEqual(self.request('GET','/api/guardian/notebook',cookie=other)[1]['records'],[])
        self.request('PUT','/api/guardian-links',{**link,'linked':False},cookie=owner)
        self.assertEqual(self.request('GET','/api/guardian/notebook',cookie=guardian)[1]['records'],[])
        self.request('POST','/api/guardian/logout',{},cookie=guardian)
        self.assertEqual(self.request('GET','/api/guardian/notebook',cookie=guardian)[0],401)
        self.assertEqual(self.request('POST','/api/guardian/login',{'phone':'01012345678','password':'wrong-password'})[0],401)
        self.assertEqual(self.request('POST','/api/guardian/login',{'phone':'01012345678','password':'correct-horse-123'})[0],200)

    def test_cross_origin_and_password_hash(self):
        self.assertEqual(self.request('POST','/api/guardian/signup',{'name':'보호자','phone':'01012345678','password':'correct-horse-123'},headers={'Origin':'https://evil.invalid'})[0],403)
        self.signup()
        with self.store.connect() as c:
            account=dict(c.execute('SELECT * FROM guardian_accounts').fetchone())
        self.assertNotIn('correct-horse-123',json.dumps(account))
        self.assertEqual(len(account['passwordHash']),128)
