import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
import {ref,uploadBytes,getBytes} from 'firebase/storage';
const env=await initializeTestEnvironment({projectId:'demo-price-studio',firestore:{host:'127.0.0.1',port:8787,rules:readFileSync('firebase/firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:readFileSync('firebase/storage.rules','utf8')}});
try{
 await env.clearFirestore();
 const owner=env.authenticatedContext('owner'),other=env.authenticatedContext('other'),anon=env.unauthenticatedContext(),path='users/owner/priceStudio/main';
 const data={schema:1,project:'{}',logo:{kind:'builtin'},revision:1,updatedAt:serverTimestamp()};
 await assertFails(setDoc(doc(anon.firestore(),path),data));
 await assertFails(setDoc(doc(other.firestore(),path),data));
 await assertSucceeds(setDoc(doc(owner.firestore(),path),data));
 await assertFails(getDoc(doc(other.firestore(),path)));
 await assertFails(getDoc(doc(anon.firestore(),path)));
 await assertFails(setDoc(doc(owner.firestore(),path),data));
 await assertSucceeds(setDoc(doc(owner.firestore(),path),{...data,revision:2}));
 await assertFails(setDoc(doc(owner.firestore(),path),{...data,revision:3,logo:{kind:'upload',path:'users/other/price-logos/'+'a'.repeat(64)}}));
 const logo='users/owner/price-logos/'+'b'.repeat(64);
 await assertSucceeds(uploadBytes(ref(owner.storage(),logo),new Uint8Array([137,80,78,71]),{contentType:'image/png'}));
 await assertFails(getBytes(ref(other.storage(),logo)));
 await assertFails(uploadBytes(ref(owner.storage(),'users/owner/price-logos/'+'c'.repeat(64)),new Uint8Array([1]),{contentType:'text/html'}));
 console.log('PASS Firebase rules: user isolation, authenticated access, revision checks and private image storage');
}finally{await env.cleanup();}
