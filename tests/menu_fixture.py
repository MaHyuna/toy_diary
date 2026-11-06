from server.menu_booking import sources, identity
MENU={'columns':['목욕','전체 미용'],'sections':[{'title':'소형견 미용','breeds':'말티즈, 푸들','note':'','content':'','items':[], 'rows':[{'weight':'4kg 미만','prices':['15000','35000']},{'weight':'4~6kg 미만','prices':['20000','40000']}]}]}
def configure(store):
    store.save_price_menu(MENU)
    rules=[]
    for s in sources(MENU):
        row=int(s['id'].split(':')[2])
        rules.append({'source':identity(s),'minWeight':row*4,'maxWeight':4 if row==0 else 6,'duration':60 if s['service']=='목욕' else 120})
    store.save_menu_booking({'rules':rules})
    return store.booking_catalog()
