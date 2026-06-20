// THE CUDDLY LANE CRM v8 - app.js

// ==================== UTILITIES ====================
function todayStr(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){if(!d)return'-';try{const dt=new Date(d+'T12:00:00');const dy=String(dt.getDate()).padStart(2,'0');const mo=String(dt.getMonth()+1).padStart(2,'0');const yr=dt.getFullYear();return dy+'/'+mo+'/'+yr;}catch(e){return d;}}
function fmtDateFull(d){if(!d)return'-';try{return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}}
function gv(id){const el=document.getElementById(id);return el?el.value||'':(console.warn('gv:',id),'');}
function calcAge(b){if(!b)return'';try{const dob=new Date(b+'T12:00:00'),now=new Date();let y=now.getFullYear()-dob.getFullYear();if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))y--;return y<1?Math.floor((now-dob)/2592000000)+'mo':y+'yr';}catch(e){return'';}}
function defEmoji(d){const b=(d.breed||'').toLowerCase();if(b.includes('retriever')||b.includes('golden'))return'\u{1F9AE}';if(b.includes('husky'))return'\u{1F43A}';if(b.includes('collie'))return'\u{1F429}';if(b.includes('bulldog')||b.includes('pug')||b.includes('french'))return'\u{1F43E}';if(b.includes('shiba'))return'\u{1F98A}';if(b.includes('lab'))return'\u{1F415}';return'\u{1F436}';}
function genId(n){return 'TCL-'+n.substring(0,2).toUpperCase()+String(Date.now()).slice(-4);}
const VL_A='=IFERROR(VLOOKUP(INDIRECT("A"&ROW()),Dogs!$A:$B,2,FALSE),"")';
function mkHdr(row){const m={};(row||[]).forEach((v,i)=>{if(v)m[v]=i;});return m;}
function rowFromMap(hdrRow,map,fallbackHdr){const h=(hdrRow&&hdrRow.length)?hdrRow:fallbackHdr;return h.map(name=>{const v=map[name];return v===undefined?'':v;});}
function sheetPhone(v){const s=String(v||'').trim();return s.startsWith('+')?`'${s}`:s;}
// Normalise cost dates — handles both YYYY-MM-DD (from date input) and DD/MM/YYYY (manual sheet entry)
function normDate(d){if(!d)return'';if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;if(/^\d{2}\/\d{2}\/\d{4}$/.test(d)){const p=d.split('/');return p[2]+'-'+p[1]+'-'+p[0];}return d;}
// Cash actually received: Prepaid → deposit only; Fully Paid/Credit → full settlement; Quoted/Booked/Canceled → 0
function actualRev(r){if(r.status==='Prepaid')return(r.prepay||0);if(r.status==='Fully Paid'||r.status==='Credit')return(r.prepay||0)+(r.finalPay||0)+(r.tips||0);return 0;}
function ir(k,v){if(!v||!v.toString().trim())return'';const lv=v.toString().toLowerCase().trim();if(lv==='n/a'||lv==='na'||lv==='none'||lv==='-')return'';return '<div class="irow"><span class="ikey">'+k+'</span><span class="ival">'+v+'</span></div>';}
function fmtGBP(n){return '\u00a3'+(parseFloat(n)||0).toFixed(2);}
function copyText(msg){if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(msg).catch(()=>{});}else{const ta=document.createElement('textarea');ta.value=msg;ta.style.cssText='position:fixed;top:-9999px;opacity:0;';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);}}
function maskKey(k){if(!k||k.length<12)return k?'****':'';return k.slice(0,6)+'...****...'+k.slice(-4);}

// ==================== CONSTANTS ====================
const TABS={DOGS:'Dogs',BK:'Bookings',DAILY:'Daily-Log',HEALTH:'Health-Log',FIGHT:'Fight-Log',TRANSPORT:'Transport-Log',TRIAL:'Trial-Log',COSTS:'Costs',TARGETS:'Targets',TRAIN:'Staff-Training',CONSENT:'Consent',TPLS:'Templates',ACTS:'Activities',ACTLOG:'Activity-Log',RATES:'Rates'};
const DR={board_std:38,board_hol:44,board_add:31,board_addh:35.65,day_std:28,day_hol:33,day_add:23,day_addh:26.45,evening_pct:25,t15s:12,t15r:20,t30s:17,t30r:30,t60s:45,t60r:80,walk30:15,walk60:24,walk30a:12,walk60a:19,walk30_11:20,walk60_11:29,dropin30:15,dropin60:24,dropin30a:12,dropin60a:19};
const DEFAULT_RANGES=[{start:'2026-04-03',end:'2026-04-06',label:'Easter 2026'},{start:'2026-05-01',end:'2026-05-04',label:'May Bank Hol'},{start:'2026-05-22',end:'2026-05-25',label:'Late May BH'},{start:'2026-07-24',end:'2026-08-30',label:'Summer 2026'},{start:'2026-12-24',end:'2027-01-03',label:'Christmas 2026'}];
const TP_QUOTE='Hi {{ownerName}},\n\nHere is the rate for our services with THE CUDDLY LANE \u2601\ufe0f\u2728\n\n{{rateBlock}}\n\nHere is your quotation:\n\n{{service}}{{discount}}\n\n*Total: {{total}}*\n\nTo secure your booking, a 50% prepayment will be required (non-refundable, but transferable to other dates). Let us know if you\u2019d like to go ahead!\n\nThank you!\nKatie & Osbert \ud83d\udc3e';
const TP_BOOK='Hi {{ownerName}},\n\nThank you for choosing THE CUDDLY LANE \u2014 we can\u2019t wait to welcome *{{dogs}}*! \ud83d\udc3e\n\nHere is a summary of your booking:\n\n{{service}}{{discount}}\n\n*Total: {{total}}*\n\nTo confirm your spot, please send your 50% prepayment:\n*{{prepayAmt}}*\n\nPayment reference: *{{payRef}}*\n{{payLink}}\n\nThis payment is non-refundable but fully transferable to alternative dates. Once received, your booking is confirmed!\n\nThank you!\nKatie & Osbert \ud83d\udc3e';
const TP_PREPAY='Hi {{ownerName}},\n\nGreat news \u2014 your prepayment has been received and your booking is confirmed! \ud83c\udf89\n\nHere is your booking summary:\n\n{{service}}{{discount}}\n\n*Total: {{total}}*\nPrepayment received: *{{prepayAmt}}*\n*Balance due at drop-off: {{finalAmt}}*\n\nPayment reference: *{{payRef}}*\n{{payLink}}\n\nWe look forward to seeing *{{dogs}}*! \ud83d\udc3e\nKatie & Osbert';
const TP_FINAL='Hi {{ownerName}},\n\nYour booking is coming up soon! \ud83d\udc3e\n\nHere is your final payment summary:\n\n{{service}}{{discount}}\n\n*Total: {{total}}*\nPrepayment received: {{prepayAmt}}\n*Balance due: {{finalAmt}}*\n\nPlease settle the balance before drop-off.\nPayment reference: *{{payRef}}*\n{{payLink}}\n\nLooking forward to seeing *{{dogs}}*!\nKatie & Osbert \ud83d\udc3e';
const TP_AVAIL='Hi {{ownerName}},\n\nThanks for your message! Let me check {{dates}} for {{dogs}} \ud83d\udc3e\n\n{{availability}}\n\n{{overlapBlock}}\nLet me know if you\u2019d like to go ahead and I can put together a quote for you!\n\nThank you!\nKatie & Osbert \ud83d\udc3e';
const MOS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOG_EMOJIS=['\u{1F436}','\u{1F415}','\u{1F9AE}','\u{1F43A}','\u{1F429}','\u{1F43E}','\u{1F98A}','\u{1F431}','\u{1F490}','\u2B50','\u{1F338}','\u{1F3C6}','\u{1F48E}','\u{1F9E1}','\u{1F525}','\u2728','\u{1F308}','\u{1F33B}','\u{1FAB4}','\u{1F344}','\u{1F31F}','\u{1F4A5}','\u{1F63A}','\u{1F9B4}'];

// STATE
let curDog=null,allDogs=[],bookings=[],costs=[],msgTpls=[],activities=[],actLogs=[],trialLogs=[],histCache={},_svcLines=[],_logSelectedActs=[],_actMainCat='',_tplCat='',dailyLogSet=new Set(),dogsHdrRow=[],bkHdrRow=[],dailyHdrRow=[],trialHdrRow=[],actlogHdrRow=[],costsHdrRow=[],healthHdrRow=[],fightHdrRow=[],transportHdrRow=[],actsHdrRow=[];
const WF_STEPS=[
  {k:'whatsapp',l:'WhatsApp group created'},
  {k:'prep',l:'Docs requested / Consent sent / Packing list sent'},
  {k:'docsReceived',l:'Docs received'},
  {k:'consentSigned',l:'Consent signed'},
  {k:'finalpay',l:'Final payment reminder sent'},
  {k:'dropoff',l:'Drop-off reminder sent'},
  {k:'logs',l:'Daily logs completed'},
  {k:'compat',l:'Compatibility / overlap logged'},
  {k:'pickup',l:'Pick-up reminder sent'},
  {k:'reviewReq',l:'Review request sent'},
  {k:'review',l:'Review logged (or marked N/A)'}
];
let _restoreTplKey=null,_delBkId=null,_delBkRi=null,_selDogs=[],_mainDog='';
let _regEmoji='',_emojiCtx='profile',_regPhotoUrl='';
let _cr={total:0,prepayAmt:0,finalAmt:0,lines:[],nights:0,rpn:0,addLine:'',discLine:'',holDates:[],selDogs:[],mainDog:''};

// ==================== PIN ====================
let _pinE='';
function initPin(){const p=localStorage.getItem('tcl_pin');if(!p){skipPin();return;}document.getElementById('pinScreen').classList.add('active');}
function pk(d){_pinE+=d;updPD();if(_pinE.length===4){if(_pinE===localStorage.getItem('tcl_pin')){onPinSuccess();}else{document.getElementById('pinErr').textContent='Incorrect PIN';_pinE='';updPD();setTimeout(()=>document.getElementById('pinErr').textContent='',2000);}}}
function pdel(){_pinE=_pinE.slice(0,-1);updPD();}
function updPD(){for(let i=0;i<4;i++)document.getElementById('pd'+i).classList.toggle('on',i<_pinE.length);}
function skipPin(){document.getElementById('pinScreen').classList.remove('active');refreshBoard();}
function onPinSuccess(){document.getElementById('pinScreen').classList.remove('active');refreshBoard();}

// ==================== CONFIG ====================
function getSID(){return localStorage.getItem('tcl_sid')||'';}
function saveConfig(){
  const f={cfg_sid:'tcl_sid',cfg_email:'tcl_email',cfg_keyid:'tcl_keyid',cfg_key:'tcl_key',cfg_pin:'tcl_pin'};
  Object.entries(f).forEach(([id,k])=>{const v=document.getElementById(id)?.value.trim();if(v)localStorage.setItem(k,v);});
  document.getElementById('cfgStatus').textContent='Saved!';checkCreds();updateKeyPreview();
  setTimeout(()=>document.getElementById('cfgStatus').textContent='',3000);
}
function loadConfig(){
  const m={cfg_sid:'tcl_sid',cfg_email:'tcl_email',cfg_keyid:'tcl_keyid'};
  Object.entries(m).forEach(([id,k])=>{const v=localStorage.getItem(k);const el=document.getElementById(id);if(v&&el)el.value=v;});
  const p=localStorage.getItem('tcl_pin');if(p&&document.getElementById('cfg_pin'))document.getElementById('cfg_pin').value=p;
  updateKeyPreview();
}
function updateKeyPreview(){const k=localStorage.getItem('tcl_key');const prev=document.getElementById('keyPreview');if(!prev)return;if(k){prev.style.display='block';prev.textContent='Key saved: '+maskKey(k);}else prev.style.display='none';}
function toggleSetup(){document.getElementById('setupBar').classList.toggle('open');}
function checkCreds(){const w=document.getElementById('credWarn');if(w)w.style.display=localStorage.getItem('tcl_key')?'none':'block';}

// ==================== GOOGLE AUTH ====================
let _tok=null,_tokExp=0;
async function getToken(){
  if(_tok&&Date.now()<_tokExp)return _tok;
  const email=localStorage.getItem('tcl_email'),rawKey=localStorage.getItem('tcl_key');
  if(!email||!rawKey)throw new Error('No credentials. Open Settings and add your Google service account details.');
  const now=Math.floor(Date.now()/1000);
  const payload={iss:email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now};
  const pem=rawKey.replace(/\\n/g,'\n');
  const b64=pem.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const ck=await crypto.subtle.importKey('pkcs8',bytes.buffer,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const b64u=s=>btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const h=b64u(JSON.stringify({alg:'RS256',typ:'JWT'})),bd=b64u(JSON.stringify(payload)),u=h+'.'+bd;
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',ck,new TextEncoder().encode(u));
  const jwt=u+'.'+b64u(String.fromCharCode(...new Uint8Array(sig)));
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`});
  const d=await r.json();if(!d.access_token)throw new Error(d.error_description||'Auth failed');
  _tok=d.access_token;_tokExp=Date.now()+3500000;return _tok;
}
function qTab(tab){return /[^a-zA-Z0-9]/.test(tab)?"'"+tab+"'":tab;}
async function readSheet(tab,range){const t=await getToken();const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(qTab(tab)+'!'+range),{headers:{Authorization:'Bearer '+t}});const d=await r.json();if(d.error)throw new Error(d.error.message);return d.values||[];}
async function appendRow(tab,vals){const t=await getToken();const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(qTab(tab)+'!A1')+':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({values:[vals]})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d;}
async function updateRow(tab,ri,vals){const t=await getToken();const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(qTab(tab)+'!A'+ri)+'?valueInputOption=USER_ENTERED',{method:'PUT',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({values:[vals]})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d;}
async function clearRow(tab,ri){const t=await getToken();const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(qTab(tab)+'!A'+ri+':Z'+ri)+':clear',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d;}
async function batchUpd(tab,updates){const t=await getToken();const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values:batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'USER_ENTERED',data:updates.map(u=>({range:qTab(tab)+'!A'+u.ri,values:[u.vals]}))})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d;}

// ==================== CREATE SHEET ====================
function confirmCreateSheet(){document.getElementById('sheetInput').value='';document.getElementById('sheetConfirm').classList.add('open');}
async function doCreateSheet(){
  if(document.getElementById('sheetInput').value.trim()!=='CREATE SHEET STRUCTURE'){alert('Please type CREATE SHEET STRUCTURE exactly.');return;}
  document.getElementById('sheetConfirm').classList.remove('open');
  const s=document.getElementById('cfgStatus');s.textContent='Creating structure...';
  const t=await getToken().catch(e=>{s.textContent='Error: '+e.message;return null;});if(!t)return;
  const sheets=[
    {n:TABS.DOGS,h:['CustomerID','Name','Breed','Gender','Birthday','BirthdayType','Weight','Neutered','ChipID','Rescue','Nervous','SepAnxiety','DogFriends','FoodType','FoodMeasure','DietNotes','Allergies','Medical','MedSchedule','Fears','Untouchable','Vaccination','Flea','Behaviour','WalkSchedule','CarSeat','SleepLocation','EscapeAttempts','ToiletTrained','AloneHours','TrainingCommands','PrevSitters','UpdateFrequency','Relationships','AdditionalNotes','Owner1','Phone1','Owner2','Phone2','Owner3','Phone3','Address','Postcode','Emergency','Vet','Insurance','MeetGreetDate','Referral','ReferralNotes','Service','Status','Remarks','Jogging','VaccinationURL','PhotoURL','GenderStatus','Motivation']},
    {n:TABS.BK,h:['CustomerID','DogName','ID','ServiceType','StartDate','StartTime','EndDate','EndTime','DropoffLocation','PickupLocation','Revenue','Tips','Prepayment','FinalPayment','UnitCost','DiscountNotes','RoverCommissionPct','RoverCommissionGBP','Channel','Payment','Status','Private','Month','Rating','Feedback','Rem1','Rem2','Rem3','Rem4','Rem5','WF_WhatsApp','WF_Prep','WF_DocsReceived','WF_ConsentSigned','WF_DropoffReminder','WF_PickupReminder','WF_FinalPayReminder','WF_ReviewRequest','WF_Review','BookingRef','PrepaymentRef','FinalPaymentRef']},
    {n:TABS.DAILY,h:['CustomerID','DogName','Date','Breakfast','MedAM','Dinner','MedPM','Snack','WalkAM','Garden','WalkPM','BeforeSleep','Game','Bowl','Room','Garment','Notes','Private']},
    {n:TABS.HEALTH,h:['CustomerID','DogName','Date','Owner','Issue','Category','Location','Importance','Description','RootCause','NextStep','Private']},
    {n:TABS.FIGHT,h:['CustomerID','DogName','Date','Time','Owner','OtherDogs','Issue','Importance','Injuries','Treatment','Prevention','Private']},
    {n:TABS.TRANSPORT,h:['CustomerID','DogName','Date','Transporter','Vehicle','Plate','JourneyType','Time','Notes','Private','From','To']},
    {n:TABS.TRIAL,h:['CustomerID','DogName','Date','MixedWith','Observations','Suitable','Private']},
    {n:TABS.COSTS,h:['Date','Category','Amount','Notes']},
    {n:TABS.TARGETS,h:['Month','RevTarget','CostTarget']},
    {n:TABS.TRAIN,h:['Date','Staff','Category','Objective','Provider','Learnt','CPDPoints','CertLink','MaterialsLink']},
    {n:TABS.CONSENT,h:['CustomerID','DogName','Date','PhotoConsent','OffLeash','Mixing','WalkOutside','GroupWalk','FeedTogether','Crate','SameRoom','MedCost','VetConsent','TCSigned']},
    {n:TABS.TPLS,h:['Name','Category','Content','LastUpdated']},
    {n:TABS.ACTS,h:['Title','Category','IndoorOutdoor','EnergyLevel','Weather','Location','MapsURL','DurationMins','DistanceMins','Cost','Notes']},
    {n:TABS.ACTLOG,h:['CustomerID','DogName','Date','Activity','Staff','Duration','Notes']},
    {n:TABS.RATES,h:['Key','Value','UpdatedAt']},
  ];
  try{await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+':batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({requests:sheets.map(sh=>({addSheet:{properties:{title:sh.n}}}))})});}catch(e){}
  for(const sh of sheets){try{await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(sh.n+'!A1')+'?valueInputOption=RAW',{method:'PUT',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({values:[sh.h]})});}catch(e){}}
  s.textContent='Sheet structure created!';setTimeout(()=>s.textContent='',5000);
}

// ==================== NAV ====================
let _stk=['sc-board'];
function switchSection(sec){document.querySelectorAll('.snav').forEach(b=>b.classList.remove('active'));document.getElementById('snav-'+sec).classList.add('active');const map={board:'sc-board',quote:'sc-quote',business:'sc-business'};_stk=[map[sec]];showScreen(map[sec],false);}
function showScreen(id,push=true){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');document.getElementById('mainScroll').scrollTop=0;
  if(push)_stk.push(id);
  const isRoot=['sc-board','sc-quote','sc-business'].includes(id);
  document.getElementById('backBtn').style.display=isRoot?'none':'flex';document.getElementById('hdrTitle').style.display=isRoot?'block':'none';
  const subs={'sc-bookings':'Booking Records','sc-costs':'Cost Records','sc-pl':'P&L Dashboard','sc-training':'Staff Training','sc-templates':'Message Templates','sc-activities':'Activities','sc-profile':curDog?curDog.name:'Dog Profile','sc-register':document.getElementById('reg_eid')?.value?'Edit Profile':'Register New Dog'};
  document.getElementById('hdrSub').textContent=subs[id]||'Staff Portal';
  if(id==='sc-bookings')renderBk();if(id==='sc-pl')updatePL();if(id==='sc-costs'){initCostFilters();renderCostTable();};if(id==='sc-templates')syncTplsFromSheet();if(id==='sc-activities')renderActs();if(id==='sc-quote'){buildQDogMS();buildMainDogBtns();}
}
function goBack(){_stk.pop();showScreen(_stk[_stk.length-1]||'sc-board',false);}

// ==================== BOARD ====================
// ==================== PENDING ACTIONS ====================
function bkWfPendingItems(bk){
  const today=todayStr();
  const addDays=(ds,n)=>{const d=new Date(ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const items=[];
  if(bk.status==='Prepaid'){
    if(!wfStepValue(bk,'whatsapp'))items.push({key:'whatsapp',label:'WhatsApp group created'});
    if(!wfStepValue(bk,'prep'))items.push({key:'prep',label:'Send Docs request / Consent / Packing list'});
  }
  if(wfStepValue(bk,'prep')){
    if(!wfStepValue(bk,'docsReceived'))items.push({key:'docsReceived',label:'Docs received'});
    if(!wfStepValue(bk,'consentSigned'))items.push({key:'consentSigned',label:'Consent signed'});
  }
  if(bk.sd&&today>=addDays(bk.sd,-2)){
    if(!wfStepValue(bk,'finalpay'))items.push({key:'finalpay',label:'Send final payment reminder'});
    if(!wfStepValue(bk,'dropoff'))items.push({key:'dropoff',label:'Send drop-off reminder'});
  }
  const ed=bk.ed||bk.sd;
  if(ed&&today>=addDays(ed,-1)){
    if(!wfStepValue(bk,'pickup'))items.push({key:'pickup',label:'Send pick-up reminder'});
  }
  if(ed&&today>=addDays(ed,1)){
    if(!wfStepValue(bk,'reviewReq'))items.push({key:'reviewReq',label:'Send review request'});
    else if(!wfStepValue(bk,'review'))items.push({key:'review',label:'Log review (or mark N/A)'});
  }
  return items;
}
function computePendingActions(){
  const today=todayStr();const yD=new Date(today+'T12:00:00Z');yD.setUTCDate(yD.getUTCDate()-1);const yesterday=yD.toISOString().slice(0,10);
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const missingLogs=[];
  allDogs.forEach(d=>{
    const bks=bookings.filter(b=>!b.priv&&bkMatchesDog(b,d)&&active.includes(b.status)&&b.sd<=today);
    const missingSet=new Set();
    bks.forEach(bk=>{const endD=bk.ed&&bk.ed<today?bk.ed:yesterday;if(bk.sd>endD)return;let dt=new Date(bk.sd+'T12:00:00Z');const end=new Date(endD+'T12:00:00Z');while(dt<=end){const ds=dt.toISOString().slice(0,10);if(!dailyLogSet.has(d.cid+'_'+ds))missingSet.add(ds);dt.setUTCDate(dt.getUTCDate()+1);}});
    if(missingSet.size)missingLogs.push({dog:d,dates:[...missingSet].sort()});
  });
  const pendingCompletion=bookings.filter(b=>!b.priv&&b.ed&&b.ed<today&&!['Cancelled','Canceled','Completed'].includes(b.status));
  const wfTasks=[];
  bookings.filter(b=>!b.priv&&!['Cancelled','Canceled','Completed'].includes(b.status)).forEach(b=>{
    bkWfPendingItems(b).forEach(item=>wfTasks.push({bk:b,...item}));
  });
  return{missingLogs,pendingCompletion,wfTasks};
}
function updatePendingBadge(){
  const b=document.getElementById('pendingBadge');if(!b)return;
  const{missingLogs,pendingCompletion,wfTasks}=computePendingActions();
  const n=missingLogs.length+pendingCompletion.length+wfTasks.length;
  if(n){b.textContent=n;b.style.display='block';}else b.style.display='none';
}
function togglePendingPanel(){
  const p=document.getElementById('pendingPanel');const showing=p.style.display!=='none'&&p.style.display!=='';
  p.style.display=showing?'none':'block';
  if(!showing)renderPendingPanel();
}
async function quickToggleWf(bkId,key,checked){
  if(key==='review'){await toggleWfStep(bkId,'review',checked);}else await toggleWfStep(bkId,key,checked);
  renderPendingPanel();
}
function renderPendingPanel(){
  const el=document.getElementById('pending_results');if(!el)return;
  const{missingLogs,pendingCompletion,wfTasks}=computePendingActions();
  if(!missingLogs.length&&!pendingCompletion.length&&!wfTasks.length){el.innerHTML='<div style="font-size:11px;font-weight:600;color:var(--gn);padding:10px 12px;background:var(--gnl);border-radius:8px;">✅ Nothing pending — all caught up!</div>';return;}
  let html='';
  if(wfTasks.length){
    html+='<div style="font-size:9px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">To-Do by Booking</div>';
    html+=wfTasks.map(({bk,key,label})=>'<label style="display:flex;align-items:flex-start;gap:7px;padding:6px 0;border-bottom:1px solid var(--gr4);cursor:pointer;"><input type="checkbox" onclick="event.stopPropagation()" onchange="quickToggleWf(\''+bk.id+'\',\''+key+'\',this.checked)" style="width:13px;height:13px;accent-color:var(--gr);margin-top:2px;"><span style="flex:1;" onclick="togglePendingPanel();openBkModal(\''+bk.id+'\')"><div style="font-size:11px;font-weight:700;color:var(--bk);">'+label+'</div><div style="font-size:9px;color:var(--gr2);">'+bk.dog+' · '+bk.svc+' · '+fmtDate(bk.sd)+(bk.ed&&bk.ed!==bk.sd?' → '+fmtDate(bk.ed):'')+'</div></span></label>').join('');
  }
  if(missingLogs.length){
    html+='<div style="font-size:9px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;margin:9px 0 4px;">Missing Daily Logs</div>';
    html+=missingLogs.map(({dog,dates})=>'<div onclick="togglePendingPanel();openProfile(allDogs.find(d=>d.cid===\''+dog.cid+'\'))" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--gr4);"><div><div style="font-size:11px;font-weight:700;color:var(--bk);text-decoration:underline;">'+dog.name+'</div><div style="font-size:9px;color:var(--gr2);">'+dates.length+' day'+(dates.length>1?'s':'')+' missing: '+dates.map(fmtDate).join(', ')+'</div></div><span style="font-size:14px;">⚠️</span></div>').join('');
  }
  if(pendingCompletion.length){
    html+='<div style="font-size:9px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;margin:9px 0 4px;">Bookings Awaiting Completion</div>';
    html+=pendingCompletion.map(b=>{const comp=wfCompletion(b);return'<div onclick="togglePendingPanel();openBkModal(\''+b.id+'\')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--gr4);"><div><div style="font-size:11px;font-weight:700;color:var(--bk);text-decoration:underline;">'+b.dog+'</div><div style="font-size:9px;color:var(--gr2);">'+b.svc+' · ended '+fmtDate(b.ed)+' · checklist '+comp.done+'/'+comp.total+'</div></div><span style="font-size:14px;">'+(comp.allDone?'✅':'📋')+'</span></div>';}).join('');
  }
  el.innerHTML=html;
}
function toggleAvailPanel(){
  const p=document.getElementById('availPanel');const showing=p.style.display!=='none'&&p.style.display!=='';
  p.style.display=showing?'none':'block';
  if(!showing){
    const dse=document.getElementById('av_dog_search');if(dse)dse.value='';
    const sel=document.getElementById('av_dog');
    sel.innerHTML='<option value="">— No dog (skip compatibility check) —</option>';
    [...allDogs].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).forEach(d=>sel.add(new Option(d.name+' – '+d.cid,d.name)));
    const td=todayStr();
    if(!document.getElementById('av_sd').value)document.getElementById('av_sd').value=td;
    if(!document.getElementById('av_ed').value)document.getElementById('av_ed').value=td;
  }
}
function filterAvDog(){
  const q=(document.getElementById('av_dog_search')?.value||'').toLowerCase();
  const sel=document.getElementById('av_dog');if(!sel)return;const prev=sel.value;
  sel.innerHTML='<option value="">— No dog (skip compatibility check) —</option>';
  [...allDogs].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).filter(d=>!q||d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)).forEach(d=>sel.add(new Option(d.name+' – '+d.cid,d.name)));
  if(prev&&[...sel.options].some(o=>o.value===prev))sel.value=prev;
}
function runAvailCheck(){
  const sd=document.getElementById('av_sd').value;const st=document.getElementById('av_st').value||'00:00';
  const ed=document.getElementById('av_ed').value;const et=document.getElementById('av_et').value||'23:59';
  const dogName=document.getElementById('av_dog').value;
  const el=document.getElementById('av_results');
  if(!sd||!ed){el.innerHTML='<div style="font-size:10px;color:var(--rd);margin-top:6px;">Please enter start and end dates.</div>';return;}
  const qStart=new Date(sd+'T'+st);const qEnd=new Date(ed+'T'+et);
  if(qEnd<=qStart){el.innerHTML='<div style="font-size:10px;color:var(--rd);margin-top:6px;">End must be after start.</div>';return;}
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const overlaps=bookings.filter(b=>{
    if(!active.includes(b.status)||!b.sd)return false;
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  // Build conflict profiles if dog selected
  let conflictProfiles=[];
  if(dogName){
    const conflicts=trialLogs.filter(t=>{
      const dn=dogName.toLowerCase();
      const isDog=(t.dog||'').toLowerCase()===dn;
      const isMixed=(t.mixedWith||'').toLowerCase().split(/[,;]+/).map(s=>s.trim()).includes(dn);
      return (isDog||isMixed)&&(t.suitable||'').toLowerCase().includes('not');
    });
    conflicts.forEach(t=>{
      const mixed=(t.mixedWith||'').split(/[,;]+/).map(s=>s.trim());
      const others=(t.dog||'').toLowerCase()===dogName.toLowerCase()?mixed:[(t.dog||'')];
      others.forEach(n=>{
        if(!n||n.toLowerCase()===dogName.toLowerCase())return;
        const p=allDogs.find(d=>d.name.toLowerCase()===n.toLowerCase());
        if(p&&!conflictProfiles.find(c=>c.name.toLowerCase()===n.toLowerCase()))conflictProfiles.push(p);
      });
    });
  }
  if(!overlaps.length){el.innerHTML='<div style="font-size:11px;font-weight:600;color:var(--gn);padding:10px 12px;background:var(--gnl);border-radius:8px;margin-top:8px;">✅ No active bookings during this period</div>';return;}
  const rows=overlaps.map(b=>{
    let flag='🟢';let detail='';
    if(dogName&&conflictProfiles.length){
      const bDog=allDogs.find(d=>d.name.toLowerCase()===(b.dog||'').toLowerCase());
      if(conflictProfiles.find(c=>c.name.toLowerCase()===(b.dog||'').toLowerCase())){
        flag='🔴';detail='Known conflict';
      }else if(bDog){
        const attrs=[];
        conflictProfiles.forEach(c=>{
          if(c.breed&&bDog.breed&&c.breed.toLowerCase()===bDog.breed.toLowerCase()&&!attrs.includes('same breed ('+bDog.breed+')'))attrs.push('same breed ('+bDog.breed+')');
          if(c.gender&&bDog.gender&&c.gender.toLowerCase()===bDog.gender.toLowerCase()&&!attrs.includes('same sex ('+bDog.gender+')'))attrs.push('same sex ('+bDog.gender+')');
          if(c.neut&&bDog.neut&&c.neut.toLowerCase()===bDog.neut.toLowerCase()&&!attrs.includes(bDog.neut))attrs.push(bDog.neut);
        });
        if(attrs.length){flag='🟡';detail='Similar: '+attrs.join(' · ');}
      }
    }
    const dateStr=b.sd+(b.ed&&b.ed!==b.sd?' – '+b.ed:'');
    const timeStr=(b.st||'')+(b.et&&b.et!==b.st?' – '+b.et:'');
    const bDogProf=allDogs.find(d=>bkMatchesDog(b,d));
    const clickAttr=bDogProf?' onclick="toggleAvailPanel();openProfile(allDogs.find(d=>d.cid===\''+bDogProf.cid+'\'))" style="cursor:pointer;"':'';
    return'<div'+clickAttr+' style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--gr4);">'
      +'<span style="font-size:15px;flex-shrink:0;line-height:1.4;">'+flag+'</span>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:11px;font-weight:700;color:var(--bk);'+(bDogProf?'text-decoration:underline;':'')+'">'+b.dog+'</div>'
      +'<div style="font-size:9px;color:var(--gr2);">'+b.svc+'&nbsp;·&nbsp;'+dateStr+(timeStr?'&nbsp;·&nbsp;'+timeStr:'')+'</div>'
      +(detail?'<div style="font-size:9px;font-weight:600;color:'+(flag==='🔴'?'var(--rd)':flag==='✅'?'var(--gn)':'#B45309')+';">'+detail+'</div>':'')
      +'</div></div>';
  }).join('');
  const hasRed=overlaps.some((_,i)=>rows.split('🔴').length-1>0);
  el.innerHTML='<div style="font-size:9px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;margin-top:8px;margin-bottom:4px;">'+overlaps.length+' booking'+(overlaps.length>1?'s':'')+' during this period'+(conflictProfiles.length?' · '+conflictProfiles.length+' known conflict dog'+(conflictProfiles.length>1?'s':''):'')+'</div>'+rows;
}
function copyAvailReply(){
  const sd=document.getElementById('av_sd').value;const ed=document.getElementById('av_ed').value;
  const dogName=document.getElementById('av_dog').value;
  if(!sd||!ed){alert('Please run the availability check first.');return;}
  const dog=allDogs.find(d=>d.name===dogName);
  const dates=fmtDate(sd)+(ed&&ed!==sd?' – '+fmtDate(ed):'');
  const t=getTpls();let msg=t.avail||TP_AVAIL;
  const qStart=new Date(sd+'T'+(document.getElementById('av_st').value||'00:00'));
  const qEnd=new Date(ed+'T'+(document.getElementById('av_et').value||'23:59'));
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const overlaps=bookings.filter(b=>{
    if(!active.includes(b.status)||!b.sd)return false;
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  const availability=overlaps.length?'We have some other dogs staying during part of this period — see below for details.':'Good news, we\'re available for these dates! ✅';
  let overlapBlock='';
  if(overlaps.length){
    overlapBlock='Dogs already booked during this period:\n'+overlaps.map(b=>{
      const dateStr=b.sd+(b.ed&&b.ed!==b.sd?' – '+b.ed:'');
      return '• '+b.dog+' ('+(b.svc||'')+', '+dateStr+')';
    }).join('\n')+'\n\n';
  }
  msg=msg.replace(/\{\{ownerName\}\}/g,dog?.owner||'there')
    .replace(/\{\{dates\}\}/g,dates)
    .replace(/\{\{dogs\}\}/g,dogName||'your dog(s)')
    .replace(/\{\{availability\}\}/g,availability)
    .replace(/\{\{overlapBlock\}\}/g,overlapBlock);
  msg=msg.replace(/\n{3,}/g,'\n\n').trim();
  copyText(msg);
  alert('Availability reply copied!');
}
async function refreshBoard(){
  const btn=document.getElementById('refreshBtn');btn.style.opacity='.5';btn.style.pointerEvents='none';
  document.getElementById('todayCards').innerHTML='<div class="empty"><p>Loading...</p></div>';
  try{
    const dogRows=await readSheet(TABS.DOGS,'A1:BG');const dh=mkHdr(dogRows[0]||[]);dogsHdrRow=dogRows[0]||[];allDogs=dogRows.slice(1).map((r,i)=>mapDog(r,i,dh)).filter(d=>d.name.trim());
    const bkRows=await readSheet(TABS.BK,'A1:AO').catch(()=>[]);const bh=mkHdr(bkRows[0]||[]);bkHdrRow=bkRows[0]||[];bookings=bkRows.slice(1).map((r,i)=>mapBk(r,i,bh));
    const cr=await readSheet(TABS.COSTS,'A1:D').catch(()=>[]);costsHdrRow=cr[0]||[];costs=cr.slice(1).map((r,i)=>({date:r[0]||'',cat:r[1]||'',amount:parseFloat(r[2])||0,notes:r[3]||'',ri:i+2}));
    const al=await readSheet(TABS.ACTLOG,'A1:G').catch(()=>[]);actlogHdrRow=al[0]||[];actLogs=al.slice(1).map(r=>({date:r[2]||'',activity:r[3]||'',dogs:r[1]||'',staff:r[4]||'',dur:r[5]||'',notes:r[6]||''}));
    const tl=await readSheet(TABS.TRIAL,'A1:G').catch(()=>[]);const tlh=mkHdr(tl[0]||[]);trialHdrRow=tl[0]||[];trialLogs=tl.slice(1).map(r=>({cid:r[tlh['CustomerID']??0]||'',dog:r[tlh['DogName']??1]||'',date:r[tlh['Date']??2]||'',mixedWith:r[tlh['MixedWith']??3]||'',obs:r[tlh['Observations']??4]||'',suitable:r[tlh['Suitable']??5]||''}));
    const dl=await readSheet(TABS.DAILY,'A1:R').catch(()=>[]);const dlh=mkHdr(dl[0]||[]);dailyHdrRow=dl[0]||[];dailyLogSet=new Set(dl.slice(1).map(r=>(r[dlh['CustomerID']??0]||'')+'_'+(r[dlh['Date']??2]||'')));
    const [hlR,ftR,trR,acR]=await Promise.all([readSheet(TABS.HEALTH,'A1:Z1').catch(()=>[]),readSheet(TABS.FIGHT,'A1:Z1').catch(()=>[]),readSheet(TABS.TRANSPORT,'A1:Z1').catch(()=>[]),readSheet(TABS.ACTS,'A1:Z1').catch(()=>[])]);healthHdrRow=hlR[0]||[];fightHdrRow=ftR[0]||[];transportHdrRow=trR[0]||[];actsHdrRow=acR[0]||[];
    // Sync targets from sheet into localStorage
    syncTargetsFromSheet().catch(()=>{});
    // Sync activities library from sheet so sheet edits show in app
    syncActsFromSheet(true).catch(()=>{});
    // Sync dog photo URLs from Rates sheet so photos work across devices
    readSheet(TABS.RATES,'A2:C').then(rr=>{let changed=false;rr.filter(r=>r[0]&&r[0].startsWith('photo_')).forEach(r=>{const cid=r[0].slice(6);if(r[1]&&localStorage.getItem('dog_photo_'+cid)!==r[1]){localStorage.setItem('dog_photo_'+cid,r[1]);changed=true;}});if(changed){renderBoard();if(curDog){const photo=curDog.photoUrl||localStorage.getItem('dog_photo_'+curDog.cid);if(photo){const w=document.getElementById('profPhotoWrap');let img=w&&w.querySelector('img.pl');if(img){img.src=photo;img.style.display='block';}}}}}).catch(()=>{});
    renderBoard();updatePL();renderCostTable();refreshDogDropdowns();updatePendingBadge();
    await syncCurrentScreen();
  }catch(e){document.getElementById('todayCards').innerHTML='<div class="empty"><p style="color:var(--rd)">'+e.message+'</p></div>';}
  finally{btn.style.opacity='1';btn.style.pointerEvents='';}
}
async function syncCurrentScreen(){
  const active=document.querySelector('.screen.active');if(!active)return;
  const id=active.id;
  if(id==='sc-bookings')renderBk();
  else if(id==='sc-pl')updatePL();
  else if(id==='sc-costs'){initCostFilters();renderCostTable();}
  else if(id==='sc-templates')await syncTplsFromSheet();
  else if(id==='sc-activities')renderActs();
  else if(id==='sc-training')await loadTraining();
  else if(id==='sc-profile'&&curDog){const fresh=allDogs.find(d=>d.cid===curDog.cid);if(fresh)openProfile(fresh);}
  else if(id==='sc-quote'){buildQDogMS();buildMainDogBtns();}
}
function bkMatchesDog(b,d){return b.customerId?b.customerId===d.cid:b.dog.toLowerCase()===(d.name||'').toLowerCase();}
function dogMatchesCidOrName(cid,name,dCid,dName){return cid?cid===dCid:(name||'').toLowerCase()===(dName||'').toLowerCase();}
function mapDog(r,i,h){const g=n=>r[h&&h[n]!==undefined?h[n]:(n==='CustomerID'?0:n==='Name'?1:n==='Breed'?2:n==='Gender'?3:n==='Birthday'?4:n==='BirthdayType'?5:n==='Weight'?6:n==='Neutered'?7:n==='ChipID'?8:n==='Rescue'?9:n==='Nervous'?10:n==='SepAnxiety'?11:n==='DogFriends'?12:n==='FoodType'?13:n==='FoodMeasure'?14:n==='DietNotes'?15:n==='Allergies'?16:n==='Medical'?17:n==='MedSchedule'?18:n==='Fears'?19:n==='Untouchable'?20:n==='Vaccination'?21:n==='Flea'?22:n==='Behaviour'?23:n==='WalkSchedule'?24:n==='CarSeat'?25:n==='SleepLocation'?26:n==='EscapeAttempts'?27:n==='ToiletTrained'?28:n==='AloneHours'?29:n==='TrainingCommands'?30:n==='PrevSitters'?31:n==='UpdateFrequency'?32:n==='UpdateCustom'?33:n==='Relationships'?34:n==='AdditionalNotes'?35:n==='Owner1'?36:n==='Phone1'?37:n==='Owner2'?38:n==='Phone2'?39:n==='Owner3'?40:n==='Phone3'?41:n==='Address'?42:n==='Postcode'?43:n==='Emergency'?44:n==='Vet'?45:n==='Insurance'?46:n==='MeetGreetDate'?47:n==='Referral'?48:n==='ReferralNotes'?49:n==='Service'?50:n==='Status'?51:n==='Remarks'?52:n==='Emoji'?99:n==='Jogging'?53:n==='VaccinationURL'?54:55)]||'';
  return{cid:g('CustomerID')||genId(g('Name')||'Dog'),name:g('Name'),breed:g('Breed'),gender:g('Gender'),birthday:g('Birthday'),bdayType:g('BirthdayType')||'exact',weight:g('Weight'),neut:g('Neutered'),genderStatus:g('GenderStatus'),chip:g('ChipID'),rescue:g('Rescue'),nervous:g('Nervous'),anxiety:g('SepAnxiety'),dogfriends:g('DogFriends'),food:g('FoodType'),foodMeasure:g('FoodMeasure'),dietNotes:g('DietNotes'),allerg:g('Allergies'),med:g('Medical'),medSchedule:g('MedSchedule'),fears:g('Fears'),notouch:g('Untouchable'),vacc:g('Vaccination'),flea:g('Flea'),behav:g('Behaviour'),walk:g('WalkSchedule'),car:g('CarSeat'),sleep:g('SleepLocation'),escape:g('EscapeAttempts'),toilet:g('ToiletTrained'),alone:g('AloneHours'),commands:g('TrainingCommands'),sitters:g('PrevSitters'),updates:g('UpdateFrequency'),rel:g('Relationships'),notes:g('AdditionalNotes'),owner:g('Owner1'),phone:g('Phone1'),owner2:g('Owner2'),phone2:g('Phone2'),owner3:g('Owner3'),phone3:g('Phone3'),addr:g('Address'),postcode:g('Postcode'),emergency:g('Emergency'),vet:g('Vet'),ins:g('Insurance'),meetgreet:g('MeetGreetDate'),referral:g('Referral'),refNotes:g('ReferralNotes'),svc:g('Service'),status:g('Status'),remarks:g('Remarks'),emoji:g('Emoji'),jog:g('Jogging'),vaccUrl:g('VaccinationURL'),photoUrl:g('PhotoURL'),motivation:g('Motivation'),rowIdx:i+2};}
function mapBk(r,i,h){const gi=(n,fb)=>h&&h[n]!==undefined?h[n]:fb;return{id:r[gi('ID',2)]||'',dog:r[gi('DogName',1)]||'',customerId:r[gi('CustomerID',0)]||'',svc:r[gi('ServiceType',3)]||'',sd:r[gi('StartDate',4)]||'',st:r[gi('StartTime',5)]||'',ed:r[gi('EndDate',6)]||'',et:r[gi('EndTime',7)]||'',dropLoc:r[gi('DropoffLocation',8)]||'',pickLoc:r[gi('PickupLocation',9)]||'',rev:parseFloat(r[gi('Revenue',10)])||0,tips:parseFloat(r[gi('Tips',11)])||0,prepay:parseFloat(r[gi('Prepayment',12)])||0,finalPay:parseFloat(r[gi('FinalPayment',13)])||0,unit:parseFloat(r[gi('UnitCost',14)])||0,discNotes:r[gi('DiscountNotes',15)]||'',roverPct:parseFloat(r[gi('RoverCommissionPct',16)])||0,roverAmt:parseFloat(r[gi('RoverCommissionGBP',17)])||0,ch:r[gi('Channel',18)]||'TCL',pay:r[gi('Payment',19)]||'',status:r[gi('Status',20)]||'',priv:r[gi('Private',21)]==='Private',month:r[gi('Month',22)]||'',rating:r[gi('Rating',23)]||'',feedback:r[gi('Feedback',24)]||'',rem:[r[gi('Rem1',25)]||'',r[gi('Rem2',26)]||'',r[gi('Rem3',27)]||'',r[gi('Rem4',28)]||'',r[gi('Rem5',29)]||''],
  wf:{whatsapp:r[gi('WF_WhatsApp',30)]||'',prep:r[gi('WF_Prep',31)]||'',docsReceived:r[gi('WF_DocsReceived',32)]||'',consentSigned:r[gi('WF_ConsentSigned',33)]||'',dropoff:r[gi('WF_DropoffReminder',34)]||'',pickup:r[gi('WF_PickupReminder',35)]||'',finalpay:r[gi('WF_FinalPayReminder',36)]||'',reviewReq:r[gi('WF_ReviewRequest',37)]||'',review:r[gi('WF_Review',38)]||''},
  bookingRef:r[gi('BookingRef',39)]||'',prepayRef:r[gi('PrepaymentRef',40)]||'',finalPayRef:r[gi('FinalPaymentRef',41)]||'',
  ri:i+2};}
function bkFieldMap(bk){const rem=bk.rem||['','','','','']; const wf=bk.wf||{};return{CustomerID:bk.customerId,DogName:bk.dog,ID:bk.id,ServiceType:bk.svc,StartDate:bk.sd,StartTime:bk.st,EndDate:bk.ed,EndTime:bk.et,DropoffLocation:bk.dropLoc,PickupLocation:bk.pickLoc,Revenue:bk.rev,Tips:bk.tips,Prepayment:bk.prepay,FinalPayment:bk.finalPay,UnitCost:bk.unit,DiscountNotes:bk.discNotes,RoverCommissionPct:bk.roverPct,RoverCommissionGBP:bk.roverAmt,Channel:bk.ch,Payment:bk.pay,Status:bk.status,Private:bk.priv?'Private':'',Month:bk.month,Rating:bk.rating,Feedback:bk.feedback,Rem1:rem[0]||'',Rem2:rem[1]||'',Rem3:rem[2]||'',Rem4:rem[3]||'',Rem5:rem[4]||'',WF_WhatsApp:wf.whatsapp||'',WF_Prep:wf.prep||'',WF_DocsReceived:wf.docsReceived||'',WF_ConsentSigned:wf.consentSigned||'',WF_DropoffReminder:wf.dropoff||'',WF_PickupReminder:wf.pickup||'',WF_FinalPayReminder:wf.finalpay||'',WF_ReviewRequest:wf.reviewReq||'',WF_Review:wf.review||'',BookingRef:bk.bookingRef||'',PrepaymentRef:bk.prepayRef||'',FinalPaymentRef:bk.finalPayRef||''};}
function bkRowVals(bk){return rowFromMap(bkHdrRow,bkFieldMap(bk),TABS.BK.h);}
function renderBoard(){
  const q=(document.getElementById('dogSearch')?.value||'').toLowerCase();const today=todayStr();
  const in7=new Date();in7.setDate(in7.getDate()+7);const in7s=in7.toISOString().split('T')[0];
  const validBks=bookings.filter(b=>!['Cancelled','Canceled'].includes(b.status));
  let dogs=q?allDogs.filter(d=>d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)):allDogs;
  const active=[],week=[],upcoming=[],other=[];
  dogs.forEach(d=>{
    const dogBks=validBks.filter(b=>bkMatchesDog(b,d));
    const activeBks=dogBks.filter(b=>b.sd<=today&&b.ed>=today);
    const activeBk=activeBks.length?activeBks.sort((a,b)=>a.sd.localeCompare(b.sd))[0]:null;
    if(activeBk){active.push({dog:d,bk:activeBk});return;}
    const futureBks=dogBks.filter(b=>b.sd>today).sort((a,b)=>a.sd.localeCompare(b.sd));
    const nextBk=futureBks[0];
    if(nextBk){if(nextBk.sd<=in7s)week.push({dog:d,bk:nextBk});else upcoming.push({dog:d,bk:nextBk});}
    else other.push({dog:d,bk:null});
  });
  week.sort((a,b)=>a.bk.sd.localeCompare(b.bk.sd));
  upcoming.sort((a,b)=>a.bk.sd.localeCompare(b.bk.sd));
  renderCards(active,document.getElementById('todayCards'),'on');renderCards(week,document.getElementById('weekCards'),'wk');renderCards(upcoming,document.getElementById('upcomingCards'),'up');renderCards(other,document.getElementById('otherCards'),'');
}
function renderCards(entries,c,cls){
  if(!entries.length){c.innerHTML='<div class="empty"><p>-</p></div>';return;}c.innerHTML='';
  const scMap={'Quoted':'sq','Booked':'sb','Prepaid':'spp','Fully Paid':'sf','Credit':'scr','Canceled':'sc'};
  entries.forEach(({dog,bk})=>{
    const photo=dog.photoUrl||localStorage.getItem('dog_photo_'+dog.cid);const td=JSON.parse(localStorage.getItem('log_'+dog.cid+'_'+todayStr())||'{}');const hasAlert=dog.med&&dog.med.toLowerCase()!=='none'&&dog.med.trim();
    const vaccExpired=dog.vacc?(()=>{try{const vd=new Date(dog.vacc+'T12:00:00');const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);return vd<cutoff;}catch(e){return false;}})():false;
    // Birthday month celebration
    const bdMonth=dog.birthday?parseInt(dog.birthday.split('-')[1]):0;const isBdayMo=bdMonth&&bdMonth===(new Date().getMonth()+1);
    // Booking info strip
    const bkStrip=bk?'<div style="display:flex;align-items:center;gap:4px;margin-top:4px;flex-wrap:wrap;">'+(bk.svc?'<span style="font-size:8px;font-weight:700;background:var(--bll);color:var(--bl);padding:1px 5px;border-radius:99px;">'+bk.svc+'</span>':'')+'<span class="spill '+(scMap[bk.status]||'sb')+'" style="font-size:7px;padding:1px 5px;">'+bk.status+'</span><span style="font-size:8px;color:var(--gr3);">'+fmtDate(bk.sd)+(bk.ed&&bk.ed!==bk.sd?' → '+fmtDate(bk.ed):'')+'</span></div>':'';
    const card=document.createElement('div');card.className='dcard'+(cls?' '+cls:'');card.onclick=()=>openProfile(dog);
    card.innerHTML='<div class="dc-photo">'+(photo?'<img src="'+photo+'" alt="">':'')+(cls==='on'?'<div class="live-badge">LIVE</div>':'')+'</div><div class="dcb"><div class="dcb-n">'+dog.name+(isBdayMo?' 🎂':'')+'</div><div class="dcb-b">'+(dog.breed||'-')+(dog.birthday?' - '+calcAge(dog.birthday):'')+'</div><div class="dcb-id">'+dog.cid+'</div>'+bkStrip+'<div class="dcb-ch" style="margin-top:4px;">'+(td.breakfast==='yes'||td.breakfast===true?'<span class="chip cg">Fed</span>':'')+(td.walkAm==='yes'||td.walkAm===true?'<span class="chip cg">Walked</span>':'')+(hasAlert?'<span class="chip cr">Alert</span>':'')+(vaccExpired?'<span class="chip cr">Vacc expired</span>':'')+'</div></div>';
    c.appendChild(card);
  });
}
function dogOptLabel(d){return d.name+' - '+d.cid;}
function refreshDogDropdowns(){const sel=document.getElementById('bm_dog');if(sel){const cur=sel.value;sel.innerHTML='<option value="">Select dog</option>';allDogs.forEach(d=>sel.add(new Option(dogOptLabel(d),d.name)));if(cur)sel.value=cur;}buildQDogMS();}
function filterBmDog(){const q=(document.getElementById('bm_dog_search')?.value||'').toLowerCase();const sel=document.getElementById('bm_dog');if(!sel)return;const prev=sel.value;sel.innerHTML='<option value="">Select dog</option>';allDogs.filter(d=>!q||d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)).forEach(d=>sel.add(new Option(dogOptLabel(d),d.name)));if(prev)sel.value=prev;}

function waLink(ph){if(!ph)return'';const n=ph.replace(/[^0-9]/g,'');return'<a href="https://wa.me/'+n+'" target="_blank" style="color:var(--gn);font-weight:600;text-decoration:none;">'+ph+' 💬</a>';}
// ==================== PROFILE ====================
function openProfile(dog){
  curDog=dog;histCache={};
  const photo=dog.photoUrl||localStorage.getItem('dog_photo_'+dog.cid);
  document.getElementById('profName').textContent=dog.name;document.getElementById('profMeta').textContent=[dog.breed,dog.weight?dog.weight+'kg':'',calcAge(dog.birthday)].filter(Boolean).join(' - ');document.getElementById('profId').textContent=dog.cid;document.getElementById('profEmoji').textContent='';
  const wrap=document.getElementById('profPhotoWrap');let img=wrap.querySelector('img.pl');
  if(!img){img=document.createElement('img');img.className='pl';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';wrap.appendChild(img);}
  img.style.display=photo?'block':'none';if(photo)img.src=photo;
  buildTodayLog();buildSummary(dog);buildProfInfo(dog);buildConsent(dog);buildServices(dog);
  document.getElementById('histList').innerHTML='<div class="hload">Loading...</div>';
  document.querySelectorAll('.hfb').forEach(b=>b.classList.remove('active'));
  const allBtn=document.querySelector('.hfb[onclick*="all"]');if(allBtn)allBtn.classList.add('active');
  setTimeout(()=>{if(allBtn)filtHist('all',allBtn);},100);
  document.querySelectorAll('.ptc').forEach(c=>c.classList.remove('active'));document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  document.getElementById('ptab-logs').classList.add('active');document.querySelector('.ptab[data-tab="logs"]').classList.add('active');
  showScreen('sc-profile');
}

function hasActiveBookingToday(dog){
  const today=todayStr();
  return bookings.some(b=>(b.customerId&&b.customerId===dog.cid||b.dog.toLowerCase()===dog.name.toLowerCase())&&b.sd<=today&&b.ed>=today&&b.status!=='Canceled');
}
function buildTodayLog(){
  _logSelectedActs=[];
  const today=todayStr();const sv=JSON.parse(localStorage.getItem('log_'+(curDog&&curDog.cid)+'_'+today)||'{}');
  document.getElementById('logDateDisplay').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  if(!hasActiveBookingToday(curDog)){
    document.getElementById('logsBody').innerHTML='<div class="empty" style="padding:20px;text-align:center;"><p style="color:var(--gr3);font-size:12px;">No active booking today.<br>Log via History for past dates.</p></div>';
    document.getElementById('logNotes').value='';document.getElementById('logPrivate').checked=false;
    document.getElementById('logNotes').style.display='none';document.querySelector('label[for="logPrivate"]')&&(document.querySelector('label[for="logPrivate"]').style.display='none');
    const saveBtn=document.querySelector('.slb[onclick="saveLog()"]');if(saveBtn)saveBtn.style.display='none';
    return;
  }
  document.getElementById('logNotes').style.display='';
  const privLabel=document.querySelector('label[for="logPrivate"]');if(privLabel)privLabel.style.display='';
  const saveBtn=document.querySelector('.slb[onclick="saveLog()"]');if(saveBtn)saveBtn.style.display='';
  // Default all unset tiles to 'To-do' when there is an active booking
  const _TILE_KEYS=['breakfast','medAm','dinner','medPm','snack','walkAm','garden','walkPm','game','beforeSleep','bowl','room','garment'];
  const _anySet=_TILE_KEYS.some(k=>sv[k]);
  if(!_anySet){_TILE_KEYS.forEach(k=>{sv[k]='todo';});localStorage.setItem('log_'+curDog.cid+'_'+todayStr(),JSON.stringify(sv));}
  document.getElementById('logNotes').value=sv.notes||'';document.getElementById('logPrivate').checked=!!sv.priv;
  function tile(k,ico,lbl){const s=sv[k]||'';const sc=s?'done-'+s:'';const si=s==='yes'?' ✓':s==='refused'?' ✗':s==='todo'?' ○':s==='na'?' —':'';return'<div class="tile'+(sc?' '+sc:'')+'" id="tl_'+k+'" data-lbl="'+lbl+'" onclick="togTile(\''+k+'\')"><span class="t-ico">'+ico+'</span><span class="t-lbl">'+lbl+si+'</span></div>';}
  function inc(k,lbl,body){return '<div class="inc-tog" onclick="togInc(\''+k+'\')"><span>'+lbl+'</span><span style="font-size:10px;color:var(--gr3);">'+(sv['inc_'+k]?'&#9652;':'&#9660;')+'</span></div><div class="inc-fld'+(sv['inc_'+k]?' open':'')+'" id="inc_'+k+'">'+body+'</div>';}
  const dogOpts=allDogs.filter(d=>d.cid!==curDog.cid).map(d=>'<option>'+d.name+' - '+d.cid+'</option>').join('');
  const actOpts='<option value="">No specific activity</option>'+activities.filter(a=>a.cat==='Walk'||a.cat==='Game').map(a=>'<option>'+a.title+'</option>').join('');
  document.getElementById('logsBody').innerHTML=
    '<div class="cat-sec"><div class="cat-t">Food &amp; Medicine</div><div class="tile-row">'+tile('breakfast','&#9728;','Breakfast')+tile('medAm','&#128138;','AM Med')+tile('dinner','&#127769;','Dinner')+tile('medPm','&#128138;','PM Med')+tile('snack','&#127999;','Snack')+'</div></div>'+
    '<div class="cat-sec"><div class="cat-t">Activity</div><div class="tile-row">'+tile('walkAm','&#128062;','AM Walk')+tile('walkPm','&#128062;','PM Walk')+tile('garden','&#127807;','Garden Break')+'</div>'+
    '<div style="margin-top:5px;"><label style="font-size:9px;font-weight:600;color:var(--gr2);">Activities from library</label><div id="log_act_pills" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;min-height:0;"></div><div style="position:relative;margin-top:3px;"><input class="fi" id="log_act_search" placeholder="Search to add activities..." oninput="filterLogActs()" style="font-size:10px;"><div id="log_act_results" style="position:absolute;z-index:50;background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);max-height:120px;overflow-y:auto;width:100%;display:none;"></div></div></div></div>'+
    '<div class="cat-sec"><div class="cat-t">Hygiene</div><div class="tile-row">'+tile('bowl','&#129379;','Bowl')+tile('room','&#129524;','Room')+tile('garment','&#129507;','Garment')+'</div></div>'+
    '<div class="cat-sec"><div class="cat-t">Incidents</div>'+
    inc('health','Health','<div class="fr"><div class="f"><label>Category</label><select class="fs" id="ih_cat"><option>Injury</option><option>Illness</option><option>Allergic reaction</option><option>Digestive</option><option>Behavioural</option><option>Medication</option><option>Other</option></select></div><div class="f"><label>Importance</label><div style="display:flex;gap:4px;margin-top:2px;"><button class="ib" onclick="setImp(\'health\',\'Low\',event)">Low</button><button class="ib" onclick="setImp(\'health\',\'Med\',event)">Med</button><button class="ib" onclick="setImp(\'health\',\'High\',event)">High</button></div><input type="hidden" id="ih_imp"></div></div><div class="f"><label>Issue</label><input class="fi" id="ih_issue"></div><div class="f"><label>Description</label><textarea class="fta" id="ih_desc" style="min-height:48px;"></textarea></div><div class="f"><label>Root cause</label><input class="fi" id="ih_cause"></div><div class="f"><label>Next steps</label><input class="fi" id="ih_next"></div>')+
    inc('fight','Dog Fight','<div class="fr"><div class="f"><label>Time</label><input class="fi" type="time" id="if_time"></div><div class="f"><label>Importance</label><div style="display:flex;gap:4px;margin-top:2px;"><button class="ib" onclick="setImp(\'fight\',\'Low\',event)">Low</button><button class="ib" onclick="setImp(\'fight\',\'Med\',event)">Med</button><button class="ib" onclick="setImp(\'fight\',\'High\',event)">High</button></div><input type="hidden" id="if_imp"></div></div><div class="f"><label>Other dogs</label><select class="fs" id="if_others" multiple style="min-height:55px;">'+dogOpts+'</select></div><div class="f"><label>What happened</label><textarea class="fta" id="if_issue" style="min-height:48px;"></textarea></div><div class="f"><label>Injuries</label><input class="fi" id="if_inj"></div><div class="f"><label>Treatment</label><input class="fi" id="if_treat"></div><div class="f"><label>Prevention</label><input class="fi" id="if_prev"></div>')+
    inc('transport','Transport','<div class="fr"><div class="f"><label>Transporter</label><input class="fi" id="it_name"></div><div class="f"><label>Vehicle</label><input class="fi" id="it_vehicle"></div></div><div class="fr"><div class="f"><label>Plate</label><input class="fi" id="it_plate"></div><div class="f"><label>Journey</label><select class="fs" id="it_type"><option>Drop-off</option><option>Pick-up</option><option>Both</option></select></div></div><div class="fr"><div class="f"><label>Time</label><input class="fi" type="time" id="it_time"></div><div class="f"><label>Notes</label><input class="fi" id="it_notes"></div></div><div class="fr"><div class="f"><label>From</label><input class="fi" id="it_from" placeholder="Pickup location"></div><div class="f"><label>To</label><input class="fi" id="it_to" placeholder="Drop-off location"></div></div>')+
    inc('trial','Dog Trial','<div class="f"><label>Dogs mixed with</label><select class="fs" id="itr_others" multiple style="min-height:55px;">'+dogOpts+'</select></div><div class="f"><label>Observations</label><textarea class="fta" id="itr_obs" style="min-height:55px;"></textarea></div><div class="f"><label>Suitable?</label><select class="fs" id="itr_suit"><option>Suitable</option><option>Partial</option><option>Not Suitable</option></select></div>')+
    '</div>';
}
function parseState(v){return v==='[Y]'?'yes':v==='[Refused]'?'refused':v==='[To-do]'?'todo':v==='[N/A]'?'na':'';}
function togTile(k){if(!curDog)return;const lk='log_'+curDog.cid+'_'+todayStr();const sv=JSON.parse(localStorage.getItem(lk)||'{}');const cycle=['','todo','yes','refused','na'];sv[k]=cycle[(cycle.indexOf(sv[k]||'')+1)%cycle.length];localStorage.setItem(lk,JSON.stringify(sv));const t=document.getElementById('tl_'+k);if(t){['done-yes','done-refused','done-todo','done-na'].forEach(c=>t.classList.remove(c));if(sv[k])t.classList.add('done-'+sv[k]);const lblEl=t.querySelector('.t-lbl');if(lblEl){const si=sv[k]==='yes'?' ✓':sv[k]==='refused'?' ✗':sv[k]==='todo'?' ○':sv[k]==='na'?' —':'';lblEl.textContent=(t.dataset.lbl||'')+si;}}}
function togInc(k){const el=document.getElementById('inc_'+k);if(!el)return;el.classList.toggle('open');const lk='log_'+curDog.cid+'_'+todayStr();const sv=JSON.parse(localStorage.getItem(lk)||'{}');sv['inc_'+k]=el.classList.contains('open');localStorage.setItem(lk,JSON.stringify(sv));}
function setImp(p,val,e){e.stopPropagation();const pfx=p==='health'?'ih':'if';document.querySelectorAll('#inc_'+p+' .ib').forEach(b=>{b.className='ib';if(b.textContent===val)b.classList.add(val==='Low'?'il':val==='Med'?'im':'ih');});const el=document.getElementById(pfx+'_imp');if(el)el.value=val;}
async function saveLog(){
  if(!curDog)return;const today=todayStr();const lk='log_'+curDog.cid+'_'+today;
  const sv=JSON.parse(localStorage.getItem(lk)||'{}');sv.notes=document.getElementById('logNotes').value;sv.priv=document.getElementById('logPrivate').checked;localStorage.setItem(lk,JSON.stringify(sv));
  const st=document.getElementById('logStatus');st.style.display='block';st.style.color='var(--gr2)';st.textContent='Saving...';
  const g=k=>{const s=sv[k]||'';return s==='yes'?'[Y]':s==='refused'?'[Refused]':s==='todo'?'[To-do]':s==='na'?'[N/A]':'[ ]';};const priv=sv.priv?'Private':'';
  const row=rowFromMap(dailyHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Breakfast:g('breakfast'),MedAM:g('medAm'),Dinner:g('dinner'),MedPM:g('medPm'),Snack:g('snack'),WalkAM:g('walkAm'),Garden:g('garden'),WalkPM:g('walkPm'),BeforeSleep:g('beforeSleep'),Game:g('game'),Bowl:g('bowl'),Room:g('room'),Garment:g('garment'),Notes:sv.notes||'',Private:priv},TABS.DAILY.h);
  const rawDaily=await readSheet(TABS.DAILY,'A1:R').catch(()=>[]);const dh_sl=mkHdr(rawDaily[0]||[]);const allDaily=rawDaily.slice(1);
  const existIdx=allDaily.findIndex(r=>(r[dh_sl['Date']??2]===today&&r[dh_sl['CustomerID']??0]===curDog.cid)||(r[0]===today&&r[15]===curDog.cid));
  const saves=[existIdx>=0?updateRow(TABS.DAILY,existIdx+2,row):appendRow(TABS.DAILY,row)];
  _logSelectedActs.forEach(act=>saves.push(appendRow(TABS.ACTLOG,rowFromMap(actlogHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Activity:act,Staff:'',Duration:'',Notes:sv.notes||''},TABS.ACTLOG.h))));
  if(document.getElementById('inc_health')?.classList.contains('open'))saves.push(appendRow(TABS.HEALTH,rowFromMap(healthHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Owner:curDog.owner||'',Issue:gv('ih_issue'),Category:gv('ih_cat'),Location:'',Importance:gv('ih_imp'),Description:gv('ih_desc'),RootCause:gv('ih_cause'),NextStep:gv('ih_next'),Private:priv},TABS.HEALTH.h)));
  if(document.getElementById('inc_fight')?.classList.contains('open')){const sel=document.getElementById('if_others');const oth=sel?Array.from(sel.selectedOptions).map(o=>o.value).join(', '):'';saves.push(appendRow(TABS.FIGHT,rowFromMap(fightHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Time:gv('if_time'),Owner:curDog.owner||'',OtherDogs:oth,Issue:gv('if_issue'),Importance:gv('if_imp'),Injuries:gv('if_inj'),Treatment:gv('if_treat'),Prevention:gv('if_prev'),Private:priv},TABS.FIGHT.h)));}
  if(document.getElementById('inc_transport')?.classList.contains('open'))saves.push(appendRow(TABS.TRANSPORT,rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Transporter:gv('it_name'),Vehicle:gv('it_vehicle'),Plate:gv('it_plate'),JourneyType:gv('it_type'),Time:gv('it_time'),Notes:gv('it_notes'),Private:priv,From:gv('it_from'),To:gv('it_to')},TABS.TRANSPORT.h)));
  if(document.getElementById('inc_trial')?.classList.contains('open')){const sel2=document.getElementById('itr_others');const oth2=sel2?Array.from(sel2.selectedOptions).map(o=>o.value).join(', '):'';saves.push(appendRow(TABS.TRIAL,rowFromMap(trialHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,MixedWith:oth2,Observations:gv('itr_obs'),Suitable:gv('itr_suit'),Private:priv},TABS.TRIAL.h)));}
  try{await Promise.all(saves);histCache={};_logSelectedActs=[];renderLogActPills();st.style.color='var(--gn)';st.textContent='Log saved!';setTimeout(()=>st.style.display='none',3000);}catch(e){st.style.color='var(--rd)';st.textContent=e.message;}
}
function buildSummary(dog){
  const alerts=[],notes=[];
  const medVal=(dog.med||'').toLowerCase().trim();if(medVal&&medVal!=='none'&&medVal!=='n/a'&&medVal!=='na')alerts.push('Medical: '+dog.med);
  if(dog.medSchedule)alerts.push('Med schedule: '+dog.medSchedule);
  const algVal=(dog.allerg||'').toLowerCase().trim();if(algVal&&algVal!=='none'&&algVal!=='n/a'&&algVal!=='na')alerts.push('Allergies: '+dog.allerg);
  const fearsVal=(dog.fears||'').toLowerCase().trim();if(fearsVal&&fearsVal!=='none'&&fearsVal!=='n/a'&&fearsVal!=='na'&&fearsVal!=='-')notes.push('Fears: '+dog.fears);if(dog.rescue==='Yes')notes.push('Rescue dog');
  if(parseInt(dog.nervous)>=4)notes.push('Very nervous ('+dog.nervous+'/5)');if(parseInt(dog.anxiety)>=4)notes.push('High sep. anxiety');
  const ageStr=calcAge(dog.birthday);const lines=[dog.name+' - '+(dog.breed||'dog')+(ageStr?' ('+ageStr+')':'')+', owned by '+(dog.owner||'unknown')+'.'];
  if(notes.length)lines.push(notes.join('. ')+'.');if(dog.remarks)lines.push(dog.remarks);
  document.getElementById('sumText').textContent=lines.join(' ');
  document.getElementById('alertRows').innerHTML=alerts.map(a=>'<div class="alert-r">! '+a+'</div>').join('');
  document.getElementById('smartSum').style.display='block';
}
function buildProfInfo(dog){
  const nbar=(n,col)=>{const l=parseInt(n)||0;return'<div class="nb-bar" style="flex:1;">'+Array.from({length:5},(_,i)=>'<div class="nb-seg" style="background:'+(i<l?col:'var(--gr4)')+'"></div>').join('')+'</div><span style="font-size:9px;font-weight:700;color:var(--gr2);margin-left:3px;">'+l+'/5</span>';};
  const nc=v=>parseInt(v)>=4?'var(--rd)':parseInt(v)>=3?'var(--hn)':'var(--or)';
  let vaccExpired=false;if(dog.vacc){try{const vd=new Date(dog.vacc+'T12:00:00');const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);vaccExpired=vd<cutoff;}catch(e){}}
  const vaccRow=dog.vacc?'<div class="irow"><span class="ikey">Last vaccination</span><span class="ival" style="'+(vaccExpired?'color:var(--rd);font-weight:700;':'')+'">'+fmtDateFull(dog.vacc)+(vaccExpired?' ⚠️ Expired':' ✅')+'</span></div>':'';
  const vaccUrlRow=dog.vaccUrl?'<div class="irow"><span class="ikey">Vaccination record</span><span class="ival"><a href="'+gdriveDirect(dog.vaccUrl)+'" target="_blank" style="color:var(--bl);text-decoration:none;">View document 📄</a></span></div>':'';
  const vaccBanner=vaccExpired?'<div style="background:var(--rdl,#fff0f0);border:1px solid var(--rd);border-radius:8px;padding:10px 14px;margin-bottom:10px;color:var(--rd);font-weight:600;font-size:13px;">⚠️ Vaccination expired — please ask owners to update records before the next visit.</div>':'';
  document.getElementById('profInfoBody').innerHTML=
    vaccBanner+
    '<div class="isec"><div class="isec-t">Dog</div>'+ir('Name',dog.name)+ir('Breed',dog.breed)+ir('Weight',dog.weight?dog.weight+'kg':'')+ir('Birthday',dog.birthday?(dog.bdayType==='approx'?'Approx. '+fmtDate(dog.birthday):fmtDateFull(dog.birthday)):'')+ir('Age',calcAge(dog.birthday))+ir('Gender & Neuter Status',dog.genderStatus||dog.gender+(dog.neut?(' · '+(dog.neut==='Yes'?'Neutered/Spayed':'Intact')):''))+ir('Microchip',dog.chip)+ir('Rescue',dog.rescue)+(dog.nervous?'<div class="irow"><span class="ikey">Nervous level</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.nervous,nc(dog.nervous))+'</span></div>':'')+(dog.anxiety?'<div class="irow"><span class="ikey">Sep. anxiety</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.anxiety,parseInt(dog.anxiety)>=4?'var(--rd)':'var(--pu)')+'</span></div>':'')+ir('Motivation',dog.motivation)+ir('Dog compatibility',dog.dogfriends)+(dog.jog?'<div class="irow"><span class="ikey">Jogging suitability</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.jog,'var(--gn)')+'</span></div>':'')+ir('Relationships',dog.rel)+'</div>'+
    '<div class="isec"><div class="isec-t">Food &amp; Health</div>'+ir('Food type',dog.food)+ir('Food measurement',dog.foodMeasure)+ir('Diet notes',dog.dietNotes)+ir('Allergies',dog.allerg)+ir('Medical',dog.med)+ir('Medication schedule',dog.medSchedule)+vaccRow+vaccUrlRow+ir('Flea/tick',dog.flea)+'</div>'+
    '<div class="isec"><div class="isec-t">Behaviour &amp; Routine</div>'+ir('Behaviour',dog.behav)+ir('Walking schedule',dog.walk)+ir('Car seat',dog.car)+ir('Normally sleeps',dog.sleep)+ir('Escape attempts',dog.escape)+ir('Toilet trained',dog.toilet)+ir('Can be left alone',dog.alone?dog.alone+' hrs':'')+ir('Training commands',dog.commands)+ir('Previous sitters',dog.sitters)+ir('Update frequency',dog.updates)+ir('Fears',dog.fears)+ir('Untouchable',dog.notouch)+'</div>'+
    (dog.notes?'<div class="isec"><div class="isec-t">Notes</div>'+ir('Notes',dog.notes)+'</div>':'')+
    (dog.remarks?'<div class="isec" style="border-left:3px solid var(--or);"><div class="isec-t" style="color:var(--or);">Staff Remarks</div>'+ir('Remarks',dog.remarks)+'</div>':'')+
    '<div class="isec"><div class="isec-t">Owners</div>'+ir('Owner 1',dog.owner)+(dog.phone?'<div class="irow"><span class="ikey">Phone 1</span><span class="ival">'+waLink(dog.phone)+'</span></div>':'')+ir('Owner 2',dog.owner2)+(dog.phone2?'<div class="irow"><span class="ikey">Phone 2</span><span class="ival">'+waLink(dog.phone2)+'</span></div>':'')+ir('Owner 3',dog.owner3)+(dog.phone3?'<div class="irow"><span class="ikey">Phone 3</span><span class="ival">'+waLink(dog.phone3)+'</span></div>':'')+(dog.addr||dog.postcode?'<div class="irow"><span class="ikey">Address</span><span class="ival"><a href="https://maps.google.com/?q='+encodeURIComponent((dog.addr||'')+(dog.postcode?' '+dog.postcode:''))+'" target="_blank" style="color:var(--bl);text-decoration:none;">'+(dog.addr||(dog.postcode||''))+'</a></span></div>':'')+ir('Postcode',dog.postcode)+ir('Emergency',dog.emergency)+ir('Vet',dog.vet)+ir('Insurance',dog.ins)+ir('Meet &amp; greet',fmtDateFull(dog.meetgreet))+ir('Referred by',dog.referral)+ir('Referral notes',dog.refNotes)+'</div>'+
    '<div class="isec"><div class="isec-t">Identifiers</div>'+ir('Customer ID',dog.cid)+ir('Microchip',dog.chip)+'</div>';
}
async function filtHist(type,btn){
  document.querySelectorAll('.hfb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(!curDog)return;
  const list=document.getElementById('histList');list.innerHTML='<div class="hload">Loading...</div>';
  try{
    let all=[];const TAB_RANGE={[TABS.ACTLOG]:'A1:G'};const ft=async(tab)=>{if(histCache[tab])return histCache[tab];const rng=TAB_RANGE[tab]||'A1:R';const rows=await readSheet(tab,rng).catch(()=>[]);const h=mkHdr(rows[0]||[]);if(h['Activity']===undefined&&h['Game']!==undefined)h['Activity']=h['Game'];const items=rows.slice(1).map((r,i)=>({tab,row:r,ri:i+2,h}));histCache[tab]={items,h};return histCache[tab];};
    if(type==='all'){for(const t of[TABS.DAILY,TABS.HEALTH,TABS.FIGHT,TABS.TRANSPORT,TABS.TRIAL,TABS.ACTLOG])all=all.concat((await ft(t)).items);}
    else if(type==='incidents'){for(const t of[TABS.HEALTH,TABS.FIGHT,TABS.TRANSPORT,TABS.TRIAL])all=all.concat((await ft(t)).items);}
    else if(type==='daily')all=(await ft(TABS.DAILY)).items;
    else if(type==='health')all=(await ft(TABS.HEALTH)).items;
    else if(type==='activities')all=(await ft(TABS.ACTLOG)).items;
    else if(type==='transport')all=(await ft(TABS.TRANSPORT)).items;
    else if(type==='trial')all=(await ft(TABS.TRIAL)).items;
    const nm=curDog.name.toLowerCase();const cid=curDog.cid;let flt=all.filter(({row})=>row.includes(cid)||(row.join(' ').toLowerCase().includes(nm)));
    flt.sort((a,b)=>(b.row[2]||'').localeCompare(a.row[2]||''));
    // Deduplicate Daily logs — keep only latest entry per day
    const seenDaily=new Set();flt=flt.filter(({tab,row})=>{if(tab!==TABS.DAILY)return true;const key=row[2]||'';if(seenDaily.has(key))return false;seenDaily.add(key);return true;});
    // Insert missing-log placeholders for booking days with no recorded log
    if(type==='all'||type==='daily'){
      const loggedDates=new Set(flt.filter(({tab})=>tab===TABS.DAILY).map(({row})=>row[2]));
      const today=todayStr();const yD=new Date(today+'T12:00:00Z');yD.setUTCDate(yD.getUTCDate()-1);const yesterday=yD.toISOString().slice(0,10);
      const bks=bookings.filter(b=>bkMatchesDog(b,curDog)&&!['Cancelled','Canceled'].includes(b.status)&&b.sd<today);
      const missingSet=new Set();
      bks.forEach(bk=>{const endD=bk.ed<today?bk.ed:yesterday;let d=new Date(bk.sd+'T12:00:00Z');const end=new Date(endD+'T12:00:00Z');while(d<=end){const ds=d.toISOString().slice(0,10);if(!loggedDates.has(ds))missingSet.add(ds);d.setUTCDate(d.getUTCDate()+1);}});
      missingSet.forEach(ds=>flt.push({tab:'MISSING',row:[null,null,ds],ri:null}));
      flt.sort((a,b)=>(b.row[2]||'').localeCompare(a.row[2]||''));
    }
    list.innerHTML='';if(!flt.length){list.innerHTML='<div class="hload">No records found</div>';return;}
    flt.slice(0,100).forEach(({tab,row,ri,h={}})=>{
      const g=col=>row[h[col]!==undefined?h[col]:-1]||'';
      if(tab==='MISSING'){const item=document.createElement('div');item.className='hi';item.innerHTML='<div class="hi-h"><span class="hi-d">'+fmtDate(row[2])+'</span><span class="htype htmiss">Missing</span></div><div class="hsum" style="color:var(--or);font-style:italic;">No log recorded for this booking day</div><div class="hi-acts"><button class="ebtn" style="background:var(--or);color:#fff;border-color:var(--or);">+ Add Log</button></div>';item.querySelector('.ebtn').onclick=()=>openAddPastLog(row[2]);list.appendChild(item);return;}
      const lbl={};lbl[TABS.DAILY]='Daily';lbl[TABS.HEALTH]='Health';lbl[TABS.FIGHT]='Fight';lbl[TABS.TRANSPORT]='Transport';lbl[TABS.TRIAL]='Trial';lbl[TABS.ACTLOG]='Activity';
      const cls={};cls[TABS.DAILY]='htd';cls[TABS.HEALTH]='hth';cls[TABS.FIGHT]='hti';cls[TABS.TRANSPORT]='hti';cls[TABS.TRIAL]='hti';cls[TABS.ACTLOG]='hta';
      const iP=row.includes('Private');
      let summary='';
      if(tab===TABS.DAILY){
        const stLbl=(v,ico,n)=>{if(!v||v==='[ ]')return null;if(v==='[Y]')return ico+' '+n+' ✓';if(v==='[Refused]')return ico+' '+n+' ✗';if(v==='[To-do]')return ico+' '+n+' ○';if(v==='[N/A]')return ico+' '+n+' —';return null;};
        const done=[stLbl(g('Breakfast'),'🍽️','Breakfast'),stLbl(g('MedAM'),'💊','Med AM'),stLbl(g('Dinner'),'🥘','Dinner'),stLbl(g('MedPM'),'💊','Med PM'),stLbl(g('Snack'),'🍪','Snack'),stLbl(g('WalkAM'),'🐾','AM Walk'),stLbl(g('Garden'),'🌿','Garden'),stLbl(g('WalkPM'),'🐾','PM Walk'),stLbl(g('BeforeSleep'),'🌙','Before Sleep'),stLbl(g('Activity'),'🎮','Activity')].filter(Boolean);
        const clean=v=>(!v||v.includes('[')||v==='Private')?'':v.trim();
        const bowl=clean(g('Bowl'));const room=clean(g('Room'));const notes=clean(g('Notes'));
        const meta=[bowl?bowl+' bowl':'',room].filter(Boolean).join(' · ');
        summary=(done.length?done.join(' · '):'Nothing logged')+(meta?' · '+meta:'')+(notes?' — '+notes:'');
      }
      else if(tab===TABS.HEALTH)summary=(g('Issue')||'-')+' '+(g('Category')||'');
      else if(tab===TABS.FIGHT)summary='Fight: '+(g('Issue')||'-');
      else if(tab===TABS.TRANSPORT){const trn=g('Transporter');const jtype=g('JourneyType');const time=g('Time');const from=g('From');const to=g('To');const route=(from||to)?(from||'?')+' → '+(to||'?'):'';summary=[trn,jtype,time,route].filter(Boolean).join(' · ');}
      else if(tab===TABS.TRIAL)summary='Mixed: '+(g('MixedWith')||'-')+' - '+(g('Suitable')||'-');
      else if(tab===TABS.ACTLOG)summary=(g('ActivityTitle')||'-')+(g('DurationMins')?' - '+g('DurationMins')+' mins':'')+(g('Staff')?' - '+g('Staff'):'');
      const item=document.createElement('div');item.className='hi';
      item.innerHTML='<div class="hi-h"><span class="hi-d">'+(row[2]||'-')+'</span><span class="htype '+(cls[tab]||'htd')+'">'+(lbl[tab]||tab)+'</span>'+(iP?'<span class="ptag">Private</span>':'')+'</div><div class="hsum">'+summary+'</div><div class="hi-acts"><button class="ebtn">Edit</button></div>';
      item.querySelector('.ebtn').onclick=()=>openLiveEditDirect(tab,ri,row,h);
      list.appendChild(item);
    });
  }catch(e){list.innerHTML='<div class="hload" style="color:var(--rd)">'+e.message+'</div>';}
}
function openLiveEditDirect(tab,ri,row,h={}){const dc=h['Date']!==undefined?h['Date']:2;if(tab===TABS.DAILY){openAddPastLog(row[dc]);return;}document.getElementById('editModalBody').innerHTML=buildEditFlds(tab,row[dc],row,ri,h);document.getElementById('editModal').classList.add('open');}
function buildEditFlds(tab,date,lr,ri,h={}){
  const g=col=>lr&&h[col]!==undefined?lr[h[col]]||'':'';
  const info='<div style="background:var(--hnxl);border:1px solid var(--hnl);border-radius:var(--r);padding:7px 9px;font-size:9px;color:var(--cn);margin-bottom:10px;">Changes overwrite the original row in Google Sheets</div>';
  let flds='',fn='';
  if(tab===TABS.DAILY){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes" value="'+g('Notes')+'"></div></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','daily')";}
  else if(tab===TABS.HEALTH){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Category</label><input class="fi" id="ef_cat" value="'+g('Category')+'"></div></div><div class="f"><label>Issue</label><input class="fi" id="ef_issue" value="'+g('Issue')+'"></div><div class="f"><label>Description</label><textarea class="fta" id="ef_desc">'+g('Description')+'</textarea></div><div class="f"><label>Next steps</label><input class="fi" id="ef_next" value="'+g('NextStep')+'"></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','health')";}
  else if(tab===TABS.FIGHT){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Time</label><input class="fi" type="time" id="ef_time" value="'+g('Time')+'"></div></div><div class="f"><label>What happened</label><textarea class="fta" id="ef_issue">'+g('Issue')+'</textarea></div><div class="f"><label>Prevention</label><input class="fi" id="ef_prev" value="'+g('Prevention')+'"></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','fight')";}
  else if(tab===TABS.TRANSPORT){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Transporter</label><input class="fi" id="ef_trn" value="'+g('Transporter')+'"></div></div><div class="fr"><div class="f"><label>Vehicle</label><input class="fi" id="ef_trv" value="'+g('Vehicle')+'"></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes" value="'+g('Notes')+'"></div></div><div class="fr"><div class="f"><label>From</label><input class="fi" id="ef_from" value="'+g('From')+'" placeholder="Pickup location"></div><div class="f"><label>To</label><input class="fi" id="ef_to" value="'+g('To')+'" placeholder="Drop-off location"></div></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','transport')";}
  else if(tab===TABS.TRIAL){const suitVal=g('Suitable');const suitOpts=['Suitable','Partial','Not Suitable'].map(o=>'<option'+(o===suitVal?' selected':'')+'>'+o+'</option>').join('');flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Suitable?</label><select class="fs" id="ef_suit">'+suitOpts+'</select></div></div><div class="f"><label>Observations</label><textarea class="fta" id="ef_obs">'+g('Observations')+'</textarea></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','trial')";}
  else if(tab===TABS.ACTLOG){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Duration (mins)</label><input class="fi" id="ef_dur" value="'+g('DurationMins')+'"></div></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes" value="'+g('Notes')+'"></div>';fn="doEdit('"+ri+"','"+tab+"','actlog')";}
  return info+flds+'<div class="srow"><button class="sbtn2" onclick="'+fn+'">Save Changes</button><span class="smsg" id="editStatus"></span></div>';
}
async function doEdit(riStr,tabStr,type){
  const st=document.getElementById('editStatus');const priv=document.getElementById('ef_priv')?.checked?'Private':'';const date=gv('ef_date');let vals=[];
  if(type==='daily')vals=rowFromMap(dailyHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Notes:gv('ef_notes'),Private:priv},TABS.DAILY.h);
  else if(type==='health')vals=rowFromMap(healthHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Owner:curDog.owner||'',Issue:gv('ef_issue'),Category:gv('ef_cat'),Location:'',Importance:'',Description:gv('ef_desc'),RootCause:'',NextStep:gv('ef_next'),Private:priv},TABS.HEALTH.h);
  else if(type==='fight')vals=rowFromMap(fightHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Time:gv('ef_time'),Owner:curDog.owner||'',OtherDogs:'',Issue:gv('ef_issue'),Importance:'',Injuries:'',Treatment:'',Prevention:gv('ef_prev'),Private:priv},TABS.FIGHT.h);
  else if(type==='transport')vals=rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Transporter:gv('ef_trn'),Vehicle:gv('ef_trv'),Plate:'',JourneyType:'',Time:'',Notes:gv('ef_notes'),Private:priv,From:gv('ef_from'),To:gv('ef_to')},TABS.TRANSPORT.h);
  else if(type==='trial')vals=rowFromMap(trialHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,MixedWith:'',Observations:gv('ef_obs'),Suitable:gv('ef_suit'),Private:priv},TABS.TRIAL.h);
  else if(type==='actlog')vals=rowFromMap(actlogHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Activity:'',Staff:'',Duration:gv('ef_dur'),Notes:gv('ef_notes')},TABS.ACTLOG.h);
  st.textContent='Saving...';const tm={daily:TABS.DAILY,health:TABS.HEALTH,fight:TABS.FIGHT,transport:TABS.TRANSPORT,trial:TABS.TRIAL,actlog:TABS.ACTLOG};
  try{await updateRow(tm[type]||tabStr,parseInt(riStr),vals);histCache={};st.textContent='Updated!';st.className='smsg ok';setTimeout(()=>document.getElementById('editModal').classList.remove('open'),1600);}
  catch(e){st.textContent=e.message;st.className='smsg err';}
}
async function openAddPastLog(date){
  if(!curDog)return;
  document.getElementById('editModalBody').innerHTML='<div class="hload">Loading…</div>';
  document.getElementById('editModal').classList.add('open');
  const lk='log_'+curDog.cid+'_'+date;
  let sv=JSON.parse(localStorage.getItem(lk)||'{}');
  // Pre-populate from Google Sheet so edits work across devices
  try{
    const rawRows=await readSheet(TABS.DAILY,'A1:R');const dh=mkHdr(rawRows[0]||[]);if(dh['Activity']===undefined&&dh['Game']!==undefined)dh['Activity']=dh['Game'];const rows=rawRows.slice(1);
    const gd=(r,col,fb)=>r[dh[col]!==undefined?dh[col]:fb]||'';
    const km={breakfast:'Breakfast',medAm:'MedAM',dinner:'Dinner',medPm:'MedPM',snack:'Snack',walkAm:'WalkAM',garden:'Garden',walkPm:'WalkPM',beforeSleep:'BeforeSleep',game:'Activity',bowl:'Bowl',room:'Room',garment:'Garment'};
    const row=rows.find(r=>(gd(r,'Date',2)===date&&gd(r,'CustomerID',0)===curDog.cid)||(r[0]===date&&r[15]===curDog.cid));
    if(row){Object.entries(km).forEach(([k,col])=>{sv[k]=parseState(dh[col]!==undefined?row[dh[col]]||'':'');});sv.notes=gd(row,'Notes',16);sv.priv=gd(row,'Private',17)==='Private';localStorage.setItem(lk,JSON.stringify(sv));}
    else{// No existing log — if there was a booking for this date, default tiles to 'todo'
      const hadBooking=bookings.some(b=>bkMatchesDog(b,curDog)&&b.sd<=date&&(b.ed||b.sd)>=date&&!['Cancelled','Canceled'].includes(b.status));
      if(hadBooking&&!keys.some(k=>sv[k])){keys.forEach(k=>{sv[k]='todo';});localStorage.setItem(lk,JSON.stringify(sv));}}
  }catch(e){}
  function tile(k,ico,lbl){const s=sv[k]||'';const sc=s?'done-'+s:'';const si=s==='yes'?' ✓':s==='refused'?' ✗':s==='todo'?' ○':s==='na'?' —':'';return'<div class="tile'+(sc?' '+sc:'')+'" id="ptl_'+k+'" data-lbl="'+lbl+'" onclick="togPastTile(\''+k+'\',\''+date+'\')"><span class="t-ico">'+ico+'</span><span class="t-lbl">'+lbl+si+'</span></div>';}
  const legend='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:8px;">'+['✓ Yes','✗ Refused','○ To-do','— N/A'].map(l=>'<span style="color:var(--gr3);">'+l+'</span>').join('')+' <span style="color:var(--gr3);">(tap to cycle)</span></div>';
  const flds=
    '<div class="cat-sec"><div class="cat-t">Food &amp; Medicine</div><div class="tile-row">'+tile('breakfast','&#9728;','Breakfast')+tile('medAm','&#128138;','AM Med')+tile('dinner','&#127769;','Dinner')+tile('medPm','&#128138;','PM Med')+tile('snack','&#127999;','Snack')+'</div></div>'+
    '<div class="cat-sec"><div class="cat-t">Activity</div><div class="tile-row">'+tile('walkAm','&#128062;','AM Walk')+tile('walkPm','&#128062;','PM Walk')+tile('garden','&#127807;','Garden Break')+'</div></div>'+
    '<div class="cat-sec"><div class="cat-t">Hygiene</div><div class="tile-row">'+tile('bowl','&#129379;','Bowl')+tile('room','&#129524;','Room')+tile('garment','&#129507;','Garment')+'</div></div>'+
    '<div class="f"><label>Notes</label><textarea class="fta" id="ef_notes" style="min-height:48px;">'+(sv.notes||'')+'</textarea></div>'+
    '<label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(sv.priv?'checked':'')+'>Private</label>';
  document.getElementById('editModalBody').innerHTML=
    '<div style="background:var(--orl);border:1px solid var(--or);border-radius:var(--r);padding:7px 9px;font-size:9px;color:var(--or);margin-bottom:10px;">Daily log for <strong>'+fmtDateFull(date)+'</strong></div>'+
    legend+flds+'<div class="srow"><button class="sbtn2" onclick="saveAddPastLog(\''+date+'\')">Save Log</button><span class="smsg" id="editStatus"></span></div>';
}
function togPastTile(k,date){if(!curDog)return;const lk='log_'+curDog.cid+'_'+date;const sv=JSON.parse(localStorage.getItem(lk)||'{}');const cycle=['','todo','yes','refused','na'];sv[k]=cycle[(cycle.indexOf(sv[k]||'')+1)%cycle.length];localStorage.setItem(lk,JSON.stringify(sv));const t=document.getElementById('ptl_'+k);if(t){['done-yes','done-refused','done-todo','done-na'].forEach(c=>t.classList.remove(c));if(sv[k])t.classList.add('done-'+sv[k]);const lblEl=t.querySelector('.t-lbl');if(lblEl){const si=sv[k]==='yes'?' ✓':sv[k]==='refused'?' ✗':sv[k]==='todo'?' ○':sv[k]==='na'?' —':'';lblEl.textContent=(t.dataset.lbl||'')+si;}}}
async function saveAddPastLog(date){
  if(!curDog)return;const lk='log_'+curDog.cid+'_'+date;const sv=JSON.parse(localStorage.getItem(lk)||'{}');
  sv.notes=document.getElementById('ef_notes')?.value||'';sv.priv=document.getElementById('ef_priv')?.checked||false;localStorage.setItem(lk,JSON.stringify(sv));
  const st=document.getElementById('editStatus');st.textContent='Saving...';st.className='smsg';
  const g=k=>{const s=sv[k]||'';return s==='yes'?'[Y]':s==='refused'?'[Refused]':s==='todo'?'[To-do]':s==='na'?'[N/A]':'[ ]';};const priv=sv.priv?'Private':'';
  const row=rowFromMap(dailyHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Breakfast:g('breakfast'),MedAM:g('medAm'),Dinner:g('dinner'),MedPM:g('medPm'),Snack:g('snack'),WalkAM:g('walkAm'),Garden:g('garden'),WalkPM:g('walkPm'),BeforeSleep:g('beforeSleep'),Game:g('game'),Bowl:g('bowl'),Room:g('room'),Garment:g('garment'),Notes:sv.notes||'',Private:priv},TABS.DAILY.h);
  try{
    const rawSave=await readSheet(TABS.DAILY,'A1:R').catch(()=>[]);const dh2=mkHdr(rawSave[0]||[]);const rows=rawSave.slice(1);
    const existIdx=rows.findIndex(r=>(r[dh2['Date']??2]===date&&r[dh2['CustomerID']??0]===curDog.cid)||(r[0]===date&&r[15]===curDog.cid));
    if(existIdx>=0)await updateRow(TABS.DAILY,existIdx+2,row);else await appendRow(TABS.DAILY,row);
    histCache={};st.textContent='Log saved!';st.className='smsg ok';setTimeout(()=>document.getElementById('editModal').classList.remove('open'),1600);
  }catch(e){st.textContent=e.message;st.className='smsg err';}
}
function openHistAddLog(){
  if(!curDog)return;
  const date=document.getElementById('hist_add_date').value||todayStr();
  const type=document.getElementById('hist_add_type').value;
  if(type==='daily'){
    const hasBk=bookings.some(b=>bkMatchesDog(b,curDog)&&b.sd<=date&&(b.ed||b.sd)>=date&&!['Cancelled','Canceled'].includes(b.status));
    if(!hasBk&&!confirm('⚠️ No booking on this date for '+curDog.name+'. Add daily log anyway?'))return;
    openAddPastLog(date);
  }else{
    openAddHistEntry(type,date);
  }
}
function openAddHistEntry(type,date){
  if(!curDog)return;
  const hasBk=bookings.some(b=>bkMatchesDog(b,curDog)&&b.sd<=date&&(b.ed||b.sd)>=date&&!['Cancelled','Canceled'].includes(b.status));
  const warn=hasBk?'':'<div style="background:var(--orl);border:1px solid var(--or);border-radius:var(--r);padding:7px 9px;font-size:9px;color:var(--or);margin-bottom:10px;">⚠️ No booking on this date for '+curDog.name+'</div>';
  const df='<div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div>';
  const prv='<label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv">Private</label>';
  const ss='<div class="srow"><button class="sbtn2" onclick="doAdd(\''+type+'\')">Add Record</button><span class="smsg" id="editStatus"></span></div>';
  let flds='';
  if(type==='health')flds=df+'<div class="fr"><div class="f"><label>Category</label><input class="fi" id="ef_cat"></div></div><div class="f"><label>Issue</label><input class="fi" id="ef_issue"></div><div class="f"><label>Description</label><textarea class="fta" id="ef_desc"></textarea></div><div class="f"><label>Next steps</label><input class="fi" id="ef_next"></div>'+prv;
  else if(type==='fight')flds='<div class="fr">'+df+'<div class="f"><label>Time</label><input class="fi" type="time" id="ef_time"></div></div><div class="f"><label>What happened</label><textarea class="fta" id="ef_issue"></textarea></div><div class="f"><label>Prevention</label><input class="fi" id="ef_prev"></div>'+prv;
  else if(type==='transport')flds='<div class="fr">'+df+'<div class="f"><label>Transporter</label><input class="fi" id="ef_trn"></div></div><div class="fr"><div class="f"><label>Vehicle</label><input class="fi" id="ef_trv"></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes"></div></div><div class="fr"><div class="f"><label>From</label><input class="fi" id="ef_from"></div><div class="f"><label>To</label><input class="fi" id="ef_to"></div></div>'+prv;
  else if(type==='trial'){const opts=['Suitable','Partial','Not Suitable'].map(o=>'<option>'+o+'</option>').join('');const dogOpts=allDogs.filter(d=>d.cid!==curDog.cid).map(d=>'<option value="'+d.name+'">').join('');flds='<div class="fr">'+df+'<div class="f"><label>Suitable?</label><select class="fs" id="ef_suit">'+opts+'</select></div></div><div class="f"><label>Mixed with (dog names)</label><input class="fi" id="ef_mixed" list="mixedDogList" placeholder="e.g. Bertie, Daisy (comma-separated)"><datalist id="mixedDogList">'+dogOpts+'</datalist></div><div class="f"><label>Observations</label><textarea class="fta" id="ef_obs"></textarea></div>'+prv;}
  else return;
  document.getElementById('editModalBody').innerHTML=warn+flds+ss;
  document.getElementById('editModal').classList.add('open');
}
async function doAdd(type){
  const st=document.getElementById('editStatus');st.textContent='Saving...';st.className='smsg';
  const priv=document.getElementById('ef_priv')?.checked?'Private':'';const date=gv('ef_date');
  const tm={health:TABS.HEALTH,fight:TABS.FIGHT,transport:TABS.TRANSPORT,trial:TABS.TRIAL};
  let vals=[];
  if(type==='health')vals=rowFromMap(healthHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Owner:curDog.owner||'',Issue:gv('ef_issue'),Category:gv('ef_cat'),Location:'',Importance:'',Description:gv('ef_desc'),RootCause:'',NextStep:gv('ef_next'),Private:priv},TABS.HEALTH.h);
  else if(type==='fight')vals=rowFromMap(fightHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Time:gv('ef_time'),Owner:curDog.owner||'',OtherDogs:'',Issue:gv('ef_issue'),Importance:'',Injuries:'',Treatment:'',Prevention:gv('ef_prev'),Private:priv},TABS.FIGHT.h);
  else if(type==='transport')vals=rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Transporter:gv('ef_trn'),Vehicle:gv('ef_trv'),Plate:'',JourneyType:'',Time:'',Notes:gv('ef_notes'),Private:priv,From:gv('ef_from'),To:gv('ef_to')},TABS.TRANSPORT.h);
  else if(type==='trial')vals=rowFromMap(trialHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,MixedWith:gv('ef_mixed'),Observations:gv('ef_obs'),Suitable:gv('ef_suit'),Private:priv},TABS.TRIAL.h);
  else{st.textContent='Unknown type';st.className='smsg err';return;}
  try{await appendRow(tm[type],vals);histCache={};st.textContent='Added!';st.className='smsg ok';setTimeout(()=>{document.getElementById('editModal').classList.remove('open');if(curDog)filtHist(document.querySelector('.hfb.active')?.dataset?.type||'all');},1600);}
  catch(e){st.textContent=e.message;st.className='smsg err';}
}
function swPTab(name,btn){
  document.querySelectorAll('.ptc').forEach(c=>c.classList.remove('active'));document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));document.getElementById('ptab-'+name).classList.add('active');if(btn)btn.classList.add('active');
  if(name==='history'){const d=document.getElementById('hist_add_date');if(d&&!d.value)d.value=todayStr();}
}

// CONSENT
const CF=[{k:'photo',l:'Photo & video for marketing'},{k:'offleash',l:'Off-lead consent'},{k:'mixing',l:'Mixing with other households'},{k:'walkout',l:'Walking outside home/garden'},{k:'groupwalk',l:'Group walk (max 6 dogs)'},{k:'feedtog',l:'Fed alongside other households'},{k:'crate',l:'Crate consent'},{k:'sameroom',l:'Same room as family dog'},{k:'medcost',l:'Owner covers all vet costs'},{k:'vetconsent',l:'Vet consent incl. euthanasia'},{k:'tcsigned',l:'Signed T&Cs (THE CUDDLY LANE)'}];
function _renderConsentUI(dog){
  document.getElementById('consentBody').innerHTML=CF.map(f=>{
    const v=(dog[f.k]||'').toLowerCase();const iy=v.includes('yes')||v.includes('signed');const inn=v.includes('no');
    const yoc="setConsent('"+f.k+"','Yes',this)";const noc="setConsent('"+f.k+"','No',this)";
    return'<div class="cfld"><label>'+f.l+'</label><div class="ctog"><button class="ctb'+(iy?' yes':'')+'" onclick="'+yoc+'">Yes</button><button class="ctb'+(inn?' no':'')+'" onclick="'+noc+'">No</button></div></div>';
  }).join('');
}
function buildConsent(dog){
  _renderConsentUI(dog);
  // Async: fetch latest consent record from sheet and refresh UI
  readSheet(TABS.CONSENT,'A2:N').then(rows=>{
    const dogRows=rows.filter(r=>r[0]===dog.cid||r[1]===dog.name).sort((a,b)=>(b[2]||'').localeCompare(a[2]||''));
    if(!dogRows.length)return;
    const latest=dogRows[0];
    CF.forEach((f,i)=>{curDog[f.k]=latest[i+3]||'';});
    _renderConsentUI(curDog);
  }).catch(()=>{});
}
function setConsent(k,v,btn){if(!curDog)return;const already=(curDog[k]||'')=== v;curDog[k]=already?'':v;btn.closest('.cfld').querySelectorAll('.ctb').forEach(b=>b.className='ctb');if(!already)btn.classList.add(v==='Yes'?'yes':'no');}
async function saveConsent(){const st=document.getElementById('consentStatus');if(!curDog)return;const vals=[curDog.cid,curDog.name,todayStr(),...CF.map(f=>curDog[f.k]||'')];try{await appendRow(TABS.CONSENT,vals);st.textContent='Consent saved!';st.className='smsg ok';setTimeout(()=>st.className='smsg',3000);}catch(e){st.textContent=e.message;st.className='smsg err';}}
function buildServices(dog){
  const el=document.getElementById('servicesList');const recs=bookings.filter(r=>bkMatchesDog(r,dog)).sort((a,b)=>b.sd.localeCompare(a.sd));
  if(!recs.length){el.innerHTML='<div class="hload">No bookings yet</div>';return;}
  const sc={'Quoted':'sq','Booked':'sb','Prepaid':'spp','Fully Paid':'sf','Credit':'scr','Canceled':'sc'};
  el.innerHTML=recs.map(r=>{
    const owed=(r.rev||0)+(r.tips||0);const paid=(r.prepay||0)+(r.finalPay||0);const bal=paid-owed;
    const oc="openBkModal('"+r.id+"',true)";
    return'<div class="sitem" onclick="'+oc+'"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px;"><span style="font-size:8px;font-weight:700;background:var(--bll);color:var(--bl);padding:2px 5px;border-radius:99px;">'+r.svc+'</span><span style="font-size:8px;color:var(--gr3);">'+fmtDate(r.sd)+' - '+fmtDate(r.ed)+'</span>'+(r.priv?'<span class="ptag">Private</span>':'')+'</div><div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:10px;font-weight:700;">'+fmtGBP(owed)+'</div><span class="spill '+(sc[r.status]||'sb')+'">'+r.status+'</span></div>'+(bal<0?'<div style="font-size:9px;color:var(--rd);margin-top:2px;">'+fmtGBP(Math.abs(bal))+' outstanding</div>':bal>0?'<div style="font-size:9px;color:var(--gn);margin-top:2px;">'+fmtGBP(bal)+' credit</div>':'')+'</div>';
  }).join('');
}

// REGISTER
function toggleSvcChip(btn){btn.classList.toggle('il');syncSvcChips();}
function syncSvcChips(){const vals=Array.from(document.querySelectorAll('#reg_svc_chips .ib.il')).map(b=>b.dataset.svc);const el=document.getElementById('reg_svc');if(el)el.value=vals.join(', ');}
function setSvcChips(val){document.querySelectorAll('#reg_svc_chips .ib').forEach(b=>{b.classList.toggle('il',val&&val.includes(b.dataset.svc));});syncSvcChips();}
function toggleBdayType(){const t=document.getElementById('reg_bday_type').value;const ex=document.getElementById('reg_bday');const mo=document.getElementById('reg_bday_m');const yr=document.getElementById('reg_bday_y');if(t==='exact'){ex.style.display='';mo.style.display='none';yr.style.display='none';}else{ex.style.display='none';mo.style.display='';yr.style.display='';}}
function initBdayType(){document.getElementById('reg_bday_type').value='exact';toggleBdayType();}
function showEmojiPicker(ctx){
  _emojiCtx=ctx||'profile';
  const modal=document.getElementById('emojiModal');if(!modal)return;
  const cur=_emojiCtx==='register'?_regEmoji:(curDog?curDog.emoji||defEmoji(curDog):'');
  const ci=document.getElementById('emojiCustomInput');if(ci)ci.value='';
  document.getElementById('emojiGrid').innerHTML=DOG_EMOJIS.map((e,i)=>'<button class="epick'+(e===cur?' sel':'')+'" data-em="'+i+'" style="font-size:20px;padding:5px;background:none;border:1px solid var(--gr4);border-radius:7px;cursor:pointer;">'+e+'</button>').join('');
  document.getElementById('emojiGrid').querySelectorAll('.epick').forEach((btn,i)=>{btn.onclick=()=>selectEmoji(DOG_EMOJIS[i]);});
  modal.classList.add('open');
}
function selectEmoji(em){
  if(_emojiCtx==='register'){
    _regEmoji=em;const sp=document.getElementById('regPhotoEmoji');if(sp){sp.textContent=em;sp.style.display='block';}
  }else{
    if(curDog){curDog.emoji=em;document.getElementById('profEmoji').textContent=em;}
    if(curDog&&curDog.rowIdx){const vals=Object.values(mapDogToRow(curDog));updateRow(TABS.DOGS,curDog.rowIdx,vals).catch(()=>{});}
  }
  const modal=document.getElementById('emojiModal');if(modal)modal.classList.remove('open');
}
function previewCustomEmoji(){
  const v=document.getElementById('emojiCustomInput')?.value||'';
  const preview=document.getElementById('emojiCustomPreview');if(preview)preview.textContent=v;
}
function useCustomEmoji(){
  const v=(document.getElementById('emojiCustomInput')?.value||'').trim();
  if(!v){alert('Type an emoji first');return;}
  selectEmoji(v);
}
function dogToFieldMap(d){return{CustomerID:d.cid,Name:d.name,Breed:d.breed,Gender:d.gender,Birthday:d.birthday,BirthdayType:d.bdayType,Weight:d.weight,Neutered:d.neut,GenderStatus:d.genderStatus||'',Motivation:d.motivation||'',ChipID:d.chip,Rescue:d.rescue,Nervous:d.nervous,SepAnxiety:d.anxiety,DogFriends:d.dogfriends,FoodType:d.food,FoodMeasure:d.foodMeasure,DietNotes:d.dietNotes,Allergies:d.allerg,Medical:d.med,MedSchedule:d.medSchedule,Fears:d.fears,Untouchable:d.notouch,Vaccination:d.vacc,Flea:d.flea,Behaviour:d.behav,WalkSchedule:d.walk,CarSeat:d.car,SleepLocation:d.sleep,EscapeAttempts:d.escape,ToiletTrained:d.toilet,AloneHours:d.alone,TrainingCommands:d.commands,PrevSitters:d.sitters,UpdateFrequency:d.updates,Relationships:d.rel,AdditionalNotes:d.notes,Owner1:d.owner,Phone1:sheetPhone(d.phone),Owner2:d.owner2||'',Phone2:sheetPhone(d.phone2),Owner3:d.owner3||'',Phone3:sheetPhone(d.phone3),Address:d.addr,Postcode:d.postcode,Emergency:sheetPhone(d.emergency),Vet:d.vet,Insurance:d.ins,MeetGreetDate:d.meetgreet,Referral:d.referral,ReferralNotes:d.refNotes,Service:d.svc,Status:d.status,Remarks:d.remarks,Jogging:d.jog||'',VaccinationURL:d.vaccUrl||'',PhotoURL:d.photoUrl||''};}
function mapDogToRow(d){return rowFromMap(dogsHdrRow,dogToFieldMap(d),TABS.DOGS.h);}
function openEditProf(){
  if(!curDog)return;const d=curDog;
  document.getElementById('reg_eid').value=d.cid;document.getElementById('reg_ridx').value=d.rowIdx||'';
  document.querySelector('#sc-register .pg-t').textContent='Edit: '+d.name;document.getElementById('regBtn').textContent='Save Changes';
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  s('reg_name',d.name);s('reg_breed',d.breed);s('reg_gender_status',d.genderStatus||'');
  const bt=d.bdayType||'exact';document.getElementById('reg_bday_type').value=bt;toggleBdayType();
  if(bt==='approx'){const pts=d.birthday?d.birthday.split('-'):[];s('reg_bday_m',pts[1]||'');s('reg_bday_y',pts[0]||'');}else s('reg_bday',d.birthday);
  s('reg_weight',d.weight);s('reg_chip',d.chip);s('reg_motivation',d.motivation||'');s('reg_rescue',d.rescue);
  document.getElementById('reg_nervous').value=d.nervous||3;updNB('reg');document.getElementById('reg_anxiety').value=d.anxiety||1;updAnxBar();
  s('reg_dogfriends',d.dogfriends);s('reg_food',d.food);s('reg_food_measure',d.foodMeasure);s('reg_diet',d.dietNotes);s('reg_allergies',d.allerg);s('reg_medical',d.med);s('reg_med_schedule',d.medSchedule);s('reg_fears',d.fears);s('reg_touch',d.notouch);s('reg_vacc',d.vacc);s('reg_vacc_url',d.vaccUrl||'');s('reg_flea',d.flea);
  s('reg_behaviour',d.behav);s('reg_walk',d.walk);s('reg_car',d.car);s('reg_sleep',d.sleep);s('reg_escape',d.escape);s('reg_toilet',d.toilet);s('reg_alone',d.alone);s('reg_commands',d.commands);s('reg_sitters',d.sitters);s('reg_updates',d.updates);s('reg_rel',d.rel);s('reg_notes',d.notes);
  s('reg_owner',d.owner);s('reg_phone',d.phone);s('reg_owner2',d.owner2||'');s('reg_phone2',d.phone2||'');s('reg_owner3',d.owner3||'');s('reg_phone3',d.phone3||'');s('reg_address',d.addr);s('reg_postcode',d.postcode);s('reg_emergency',d.emergency);s('reg_vet',d.vet);s('reg_insurance',d.ins);s('reg_meetgreet',d.meetgreet);s('reg_referral',d.referral);s('reg_ref_notes',d.refNotes);setSvcChips(d.svc);s('reg_status',d.status);s('reg_remarks',d.remarks);
  document.getElementById('reg_nervous').value=d.nervous||3;updNB('reg');document.getElementById('reg_anxiety').value=d.anxiety||1;updAnxBar();document.getElementById('reg_jog').value=d.jog||3;updJogBar();
  _regEmoji='';
  _regPhotoUrl=d.photoUrl||'';const p=d.photoUrl||localStorage.getItem('dog_photo_'+d.cid);if(p){document.getElementById('regPhotoImg').src=p;document.getElementById('regPhotoImg').style.display='block';const re=document.getElementById('regPhotoEmoji');if(re)re.style.display='none';}
  showScreen('sc-register');
}
function updNB(pfx){const v=parseInt(document.getElementById(pfx+'_nervous').value)||3;if(document.getElementById(pfx+'_nval'))document.getElementById(pfx+'_nval').textContent=v;const col=v>=4?'var(--rd)':v>=3?'var(--hn)':'var(--or)';for(let i=0;i<5;i++){const s=document.getElementById('rns'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updAnxBar(){const v=parseInt(document.getElementById('reg_anxiety').value)||1;if(document.getElementById('reg_axval'))document.getElementById('reg_axval').textContent=v;const col=v>=4?'var(--rd)':v>=3?'var(--pu)':'var(--bl)';for(let i=0;i<5;i++){const s=document.getElementById('axs'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updJogBar(){const v=parseInt(document.getElementById('reg_jog').value)||3;if(document.getElementById('reg_jogval'))document.getElementById('reg_jogval').textContent=v;const col=v>=4?'var(--gn)':v>=3?'var(--hn)':'var(--gr3)';for(let i=0;i<5;i++){const s=document.getElementById('jgs'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function startReg(){
  document.getElementById('reg_eid').value='';document.getElementById('reg_ridx').value='';
  document.querySelector('#sc-register .pg-t').textContent='Register New Dog';document.getElementById('regBtn').textContent='Register Dog';
  ['reg_name','reg_breed','reg_weight','reg_chip','reg_dogfriends','reg_food_measure','reg_diet','reg_allergies','reg_medical','reg_med_schedule','reg_behaviour','reg_walk','reg_rel','reg_owner','reg_phone','reg_owner2','reg_phone2','reg_owner3','reg_phone3','reg_address','reg_postcode','reg_emergency','reg_vet','reg_insurance','reg_fears','reg_touch','reg_flea','reg_remarks','reg_sleep','reg_escape','reg_toilet','reg_alone','reg_commands','reg_sitters','reg_updates','reg_notes','reg_ref_notes','reg_meetgreet','reg_jog'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['reg_gender_status','reg_rescue','reg_car','reg_food','reg_svc','reg_referral'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});setSvcChips('');
  document.getElementById('reg_status').value='Active';document.getElementById('reg_nervous').value=3;updNB('reg');document.getElementById('reg_anxiety').value=1;updAnxBar();document.getElementById('reg_jog').value=3;updJogBar();
  _regEmoji='';_regPhotoUrl='';initBdayType();document.getElementById('regPhotoImg').style.display='none';const re=document.getElementById('regPhotoEmoji');if(re){re.textContent='+';re.style.display='block';}document.getElementById('regPhotoCircle')._pd=null;showScreen('sc-register');
}
function duplicateDog(){
  if(!curDog)return;const d=curDog;startReg();
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  s('reg_breed',d.breed);s('reg_dogfriends',d.dogfriends);s('reg_food',d.food);s('reg_food_measure',d.foodMeasure);s('reg_diet',d.dietNotes);s('reg_allergies',d.allerg);s('reg_fears',d.fears);s('reg_touch',d.notouch);s('reg_vacc',d.vacc);
  s('reg_owner',d.owner);s('reg_phone',d.phone);s('reg_owner2',d.owner2||'');s('reg_phone2',d.phone2||'');s('reg_owner3',d.owner3||'');s('reg_phone3',d.phone3||'');s('reg_address',d.addr);s('reg_postcode',d.postcode);s('reg_emergency',d.emergency);s('reg_vet',d.vet);s('reg_insurance',d.ins);s('reg_referral',d.referral);s('reg_ref_notes',d.refNotes);setSvcChips(d.svc);
  document.getElementById('reg_nervous').value=d.nervous||3;updNB('reg');document.getElementById('reg_anxiety').value=d.anxiety||1;updAnxBar();
  document.querySelector('#sc-register .pg-t').textContent='New Dog (same owner as '+d.name+')';
}
async function registerDog(){
  const name=document.getElementById('reg_name').value.trim();const owner=document.getElementById('reg_owner').value.trim();if(!name||!owner){alert('Dog name and owner name required');return;}
  const eid=document.getElementById('reg_eid').value;const ri=parseInt(document.getElementById('reg_ridx').value)||null;
  const btn=document.getElementById('regBtn');const st=document.getElementById('regStatus');btn.disabled=true;btn.textContent='Saving...';
  const bt=gv('reg_bday_type');let bday='';if(bt==='approx'){const m=gv('reg_bday_m'),y=gv('reg_bday_y');bday=y&&m?y+'-'+m+'-01':'';}else bday=gv('reg_bday');
  const cid=eid||genId(name);
  // photoUrl: prefer new URL from Drive link; for edit fall back to existing; for new reg start empty
  const photoUrlVal=_regPhotoUrl||(eid?curDog?.photoUrl||'':'');
  const fieldMap={CustomerID:cid,Name:name,Breed:gv('reg_breed'),Birthday:bday,BirthdayType:bt,Weight:gv('reg_weight'),GenderStatus:gv('reg_gender_status'),ChipID:gv('reg_chip'),Rescue:gv('reg_rescue'),Nervous:document.getElementById('reg_nervous').value,SepAnxiety:document.getElementById('reg_anxiety').value,DogFriends:gv('reg_dogfriends'),FoodType:gv('reg_food'),FoodMeasure:gv('reg_food_measure'),DietNotes:gv('reg_diet'),Allergies:gv('reg_allergies'),Medical:gv('reg_medical'),MedSchedule:gv('reg_med_schedule'),Fears:gv('reg_fears'),Untouchable:gv('reg_touch'),Vaccination:gv('reg_vacc'),Flea:gv('reg_flea'),Behaviour:gv('reg_behaviour'),WalkSchedule:gv('reg_walk'),CarSeat:gv('reg_car'),SleepLocation:gv('reg_sleep'),EscapeAttempts:gv('reg_escape'),ToiletTrained:gv('reg_toilet'),AloneHours:gv('reg_alone'),TrainingCommands:gv('reg_commands'),PrevSitters:gv('reg_sitters'),UpdateFrequency:gv('reg_updates'),Relationships:gv('reg_rel'),AdditionalNotes:gv('reg_notes'),Owner1:owner,Phone1:sheetPhone(gv('reg_phone')),Owner2:gv('reg_owner2'),Phone2:sheetPhone(gv('reg_phone2')),Owner3:gv('reg_owner3'),Phone3:sheetPhone(gv('reg_phone3')),Address:gv('reg_address'),Postcode:gv('reg_postcode'),Emergency:sheetPhone(gv('reg_emergency')),Vet:gv('reg_vet'),Insurance:gv('reg_insurance'),MeetGreetDate:gv('reg_meetgreet'),Referral:gv('reg_referral'),ReferralNotes:gv('reg_ref_notes'),Service:gv('reg_svc'),Status:gv('reg_status'),Remarks:gv('reg_remarks'),Jogging:gv('reg_jog'),VaccinationURL:gv('reg_vacc_url'),PhotoURL:photoUrlVal,Motivation:gv('reg_motivation')};
  const vals=rowFromMap(dogsHdrRow,fieldMap,TABS.DOGS.h);
  try{
    if(eid){
      // Search column A of Dogs sheet for the actual row with matching CID
      // Using cached ri as fallback only — avoids cell-shift bug when rows are deleted/reordered
      const cidCol=await readSheet(TABS.DOGS,'A2:A').catch(()=>[]);
      const foundIdx=cidCol.findIndex(r=>r[0]===eid);
      const targetRi=foundIdx>=0?foundIdx+2:ri;
      if(targetRi)await updateRow(TABS.DOGS,targetRi,vals);else await appendRow(TABS.DOGS,vals);
    }else await appendRow(TABS.DOGS,vals);
    const pd=document.getElementById('regPhotoCircle')._pd;if(pd)try{localStorage.setItem('dog_photo_'+cid,pd);syncPhotoToSheet(cid,pd);}catch(e){}
    if(!eid){allDogs.push(mapDog(vals,allDogs.length));refreshDogDropdowns();}else if(curDog){const idx=allDogs.findIndex(d=>d.cid===eid);if(idx>=0){allDogs[idx]=mapDog(vals,idx);curDog=allDogs[idx];}}
    st.textContent=eid?'Profile updated!':'Registered! ID: '+cid;st.className='smsg ok';
    setTimeout(()=>{goBack();renderBoard();if(eid&&curDog){buildProfInfo(curDog);buildSummary(curDog);}},1800);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent=eid?'Save Changes':'Register Dog';}
}
function compressPhoto(file,cb){const r=new FileReader();r.onload=ev=>{const img=new Image();img.onload=()=>{const MAX=300;let w=img.width,h=img.height;if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}else if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',0.7));};img.src=ev.target.result;};r.readAsDataURL(file);}
function trigPh(){document.getElementById('profPhotoInput').click();}
function handlePh(e){const f=e.target.files[0];if(!f||!curDog)return;compressPhoto(f,data=>{try{localStorage.setItem('dog_photo_'+curDog.cid,data);}catch(err){}const w=document.getElementById('profPhotoWrap');let img=w.querySelector('img.pl');if(!img){img=document.createElement('img');img.className='pl';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';w.appendChild(img);}img.src=data;img.style.display='block';syncPhotoToSheet(curDog.cid,data);});}
function handleRegPh(e){const f=e.target.files[0];if(!f)return;compressPhoto(f,data=>{document.getElementById('regPhotoImg').src=data;document.getElementById('regPhotoImg').style.display='block';document.getElementById('regPhotoEmoji').style.display='none';document.getElementById('regPhotoCircle')._pd=data;});}
function gdriveDirect(url){try{const m=url.match(/(?:\/d\/|id=)([-\w]{25,})/);if(m)return'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w800';}catch(e){}return url;}
function syncPhotoToSheet(cid,url){if(!cid||!url)return;const key='photo_'+cid;const ts=new Date().toISOString();readSheet(TABS.RATES,'A2:C').then(rr=>{const idx=rr.findIndex(r=>r[0]===key);if(idx>=0)updateRow(TABS.RATES,idx+2,[key,url,ts]).catch(()=>{});else appendRow(TABS.RATES,[key,url,ts]).catch(()=>{});}).catch(()=>{});}
function setPhotoFromUrl(url,context){if(!url)return;const direct=gdriveDirect(url.trim());if(context==='profile'){if(!curDog)return;try{localStorage.setItem('dog_photo_'+curDog.cid,direct);}catch(e){}const w=document.getElementById('profPhotoWrap');let img=w.querySelector('img.pl');if(!img){img=document.createElement('img');img.className='pl';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';w.appendChild(img);}img.src=direct;img.style.display='block';
  // Save URL to dog record in Dogs sheet so it's visible on all devices
  curDog.photoUrl=direct;
  if(curDog.rowIdx){updateRow(TABS.DOGS,curDog.rowIdx,Object.values(mapDogToRow(curDog))).catch(()=>{});}
  syncPhotoToSheet(curDog.cid,direct);
}else{_regPhotoUrl=direct;document.getElementById('regPhotoImg').src=direct;document.getElementById('regPhotoImg').style.display='block';document.getElementById('regPhotoEmoji').style.display='none';document.getElementById('regPhotoCircle')._pd=direct;}}
function promptGdriveUrl(context){const url=prompt('Paste your Google Drive photo link:\n(File > Share > Copy link)');if(url)setPhotoFromUrl(url,context);}

// ==================== QUOTE ====================
// ==================== MULTI-SERVICE QUOTE ====================
const SVC_EMOJIS={boarding:'\u{1F4A4}',daycare:'\u2600\uFE0F',walk:'\u{1F415}',dropin:'\u{1F511}',dogsit:'\u{1FA91}',taxi:'\u{1F695}',training:'\u{1F3C5}'};
const SVC_NAMES={boarding:'Boarding',daycare:'Daycare',walk:'Dog Walk',dropin:'Drop-in Visit',dogsit:'Dog Sit',taxi:'Pet Taxi',training:'Training'};
const SVC_SUBTYPES={
  walk:[{key:'w30g',label:'30 min',rk:'walk30',rka:'walk30a'},{key:'w60g',label:'60 min',rk:'walk60',rka:'walk60a'}],
  dropin:[{key:'di30',label:'30 min',rk:'dropin30',rka:'dropin30a'},{key:'di60',label:'60 min',rk:'dropin60',rka:'dropin60a'}],
  taxi:[{key:'t15s',label:'15 min — Single',rk:'t15s',rka:null},{key:'t15r',label:'15 min — Return',rk:'t15r',rka:null},{key:'t30s',label:'30 min — Single',rk:'t30s',rka:null},{key:'t30r',label:'30 min — Return',rk:'t30r',rka:null},{key:'t60s',label:'60 min — Single',rk:'t60s',rka:null},{key:'t60r',label:'60 min — Return',rk:'t60r',rka:null}],
};

const DATE_SVCS=['boarding','daycare','dogsit'];
function onMLSvc(){
  const svc=document.getElementById('ml_svc')?.value;
  const isDate=DATE_SVCS.includes(svc);
  const hasSub=!!SVC_SUBTYPES[svc];
  const dw=document.getElementById('ml_date_wrap');const qw=document.getElementById('ml_qty_wrap');const sw=document.getElementById('ml_sub_wrap');
  // Date wrap: boarding/daycare/dogsit for full date range; taxi for service date (holiday detection)
  if(dw)dw.style.display=(isDate||svc==='taxi')?'block':'none';
  // Qty wrap: walk, dropin, training (session-based)
  if(qw)qw.style.display=(!isDate&&svc&&svc!=='taxi'&&svc!=='training')?'block':'none';
  // Training: show qty too
  if(qw&&svc==='training')qw.style.display='block';
  // Sub-type selector: walk, dropin, taxi
  if(sw){
    if(hasSub){
      sw.style.display='block';
      const sel=document.getElementById('ml_sub');
      if(sel){sel.innerHTML=SVC_SUBTYPES[svc].map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('');onMLSub();}
    }else{sw.style.display='none';}
  }
  // Auto-placeholder for dogsit
  const rateEl=document.getElementById('ml_rate');
  if(rateEl){if(svc==='dogsit'){const r=getRates();rateEl.placeholder='Auto ('+fmtGBP(r.board_std)+'/night)';}else if(!hasSub)rateEl.placeholder='Auto or override';}
}
function onMLSub(){
  const svc=document.getElementById('ml_svc')?.value;const sub=document.getElementById('ml_sub')?.value;if(!svc||!sub)return;
  const subDef=SVC_SUBTYPES[svc]?.find(s=>s.key===sub);if(!subDef)return;
  const r=getRates();const rate=r[subDef.rk]||0;
  const rateEl=document.getElementById('ml_rate');
  if(rateEl){rateEl.value=rate||'';rateEl.placeholder='Auto or override';}
}
function addSvcLine(){
  const svc=document.getElementById('ml_svc')?.value;if(!svc)return;
  const isTaxi=svc==='taxi';const isDate=DATE_SVCS.includes(svc);
  const sub=document.getElementById('ml_sub')?.value||'';
  const subDef=SVC_SUBTYPES[svc]?.find(s=>s.key===sub);
  const dogs=isTaxi?[]:([..._selDogs].length?[..._selDogs]:[]);
  const qty=!isDate&&!isTaxi?parseInt(document.getElementById('ml_qty')?.value)||1:1;
  const sd=(isDate||isTaxi)?document.getElementById('ml_sd')?.value||'':document.getElementById('ml_qty_date')?.value||'';
  const rateEl=document.getElementById('ml_rate');const manualRate=parseFloat(rateEl?.value)||0;
  const r=getRates();const autoRate=subDef?r[subDef.rk]||0:0;
  const line={svc,sub,rka:subDef?.rka||null,dogs,sd,ed:isDate?document.getElementById('ml_ed')?.value||'':sd,st2:document.getElementById('ml_st')?.value||'09:00',et:document.getElementById('ml_et')?.value||'18:00',rate:manualRate||autoRate,qty};
  _svcLines.push(line);renderSvcLines();calcMultiQ();
  if(rateEl)rateEl.value='';const qtyEl=document.getElementById('ml_qty');if(qtyEl)qtyEl.value='1';
}
function addExtraCost(){document.getElementById('ml_extra_wrap').style.display=document.getElementById('ml_extra_wrap').style.display==='none'?'block':'none';}
function confirmExtraCost(){
  const label=document.getElementById('ml_extra_label')?.value.trim();
  const amt=parseFloat(document.getElementById('ml_extra_amt')?.value)||0;
  if(!label||!amt){alert('Enter a label and amount');return;}
  _svcLines.push({svc:'extra',label,rate:amt,dogs:[]});
  document.getElementById('ml_extra_label').value='';document.getElementById('ml_extra_amt').value='';
  document.getElementById('ml_extra_wrap').style.display='none';
  renderSvcLines();calcMultiQ();
}
function removeSvcLine(i){_svcLines.splice(i,1);renderSvcLines();calcMultiQ();}
function renderSvcLines(){
  const c=document.getElementById('svcLines');if(!c)return;
  if(!_svcLines.length){c.innerHTML='<div style="font-size:10px;color:var(--gr3);padding:6px 0;">No services added yet.</div>';return;}
  c.innerHTML=_svcLines.map((l,i)=>{
    const em=l.svc==='extra'?'\u2795':SVC_EMOJIS[l.svc]||'';
    const name=l.svc==='extra'?(l.label||'Extra cost'):(SVC_NAMES[l.svc]||l.svc);
    const subLabel=l.sub&&SVC_SUBTYPES[l.svc]?SVC_SUBTYPES[l.svc].find(s=>s.key===l.sub)?.label||'':'';
    const detail=[subLabel,l.dogs&&l.dogs.length?l.dogs.join(' & '):'',l.sd?fmtDate(l.sd)+(l.ed&&l.ed!==l.sd?' \u2192 '+fmtDate(l.ed):''):'',l.qty&&l.qty>1?'\u00d7'+l.qty:'',l.rate?fmtGBP(l.rate*(l.qty||1)):''].filter(Boolean).join(' \u00b7 ');
    return'<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--gr4);">'+
      '<span style="font-size:14px;">'+em+'</span>'+
      '<div style="flex:1;font-size:10px;line-height:1.5;"><strong>'+name+'</strong>'+(detail?' <span style="color:var(--gr3);">'+detail+'</span>':'')+'</div>'+
      '<button onclick="removeSvcLine('+i+')" style="background:none;border:none;color:var(--rd);cursor:pointer;font-size:16px;line-height:1;">\u00d7</button></div>';
  }).join('');
}
function calcMultiQ(){
  if(!_svcLines.length){document.getElementById('q_result').style.display='none';return;}
  const r=getRates();let total=0;const lines=[];const descParts=[];
  _svcLines.forEach(l=>{
    let amt=0;
    if(l.svc==='extra'){
      amt=l.rate||0;
      lines.push(['\u2795 '+(l.label||'Extra cost'),amt]);
      descParts.push('\u2795 '+(l.label||'Extra cost')+': '+fmtGBP(amt));
      total+=amt;return;
    }
    const isTaxi=l.svc==='taxi';
    if(l.svc==='boarding'){
      const dogs=l.dogs&&l.dogs.length?l.dogs:[_mainDog||'Dog'];
      const mainDog=dogs[0];const addDogs=dogs.slice(1);
      if(l.sd&&l.ed){
        const dropDt=new Date(l.sd+'T'+(l.st2||'09:00')),pickDt=new Date(l.ed+'T'+(l.et||'18:00'));
        const hrs=(pickDt-dropDt)/3600000;const nights=Math.max(1,Math.floor(hrs/24));
        const exHrs=hrs-nights*24;
        const holDates=getHolDates(l.sd,l.ed);let hN=0,sN=0;
        let d=new Date(l.sd+'T12:00:00');const endD=new Date(l.ed+'T12:00:00');
        while(d<endD){const ds=d.toISOString().split('T')[0];if(holDates.includes(ds))hN++;else sN++;d.setDate(d.getDate()+1);}
        const stdR=l.rate>0?l.rate:r.board_std,holR=l.rate>0?l.rate:r.board_hol;
        const mainAmt=(sN*stdR)+(hN*holR);
        amt=mainAmt;
        const em='\u{1F4A4}';const allDogStr=dogs.join(' & ');
        lines.push([em+' Boarding \u2014 '+mainDog+' (main)',mainAmt]);
        const holRangeStr=holDates.length>0?fmtDate(holDates[0])+' \u2014 '+fmtDate(holDates[holDates.length-1]):'';
        let dp=em+' Boarding ('+allDogStr+'):\n'+fmtDate(l.sd)+'  Drop-off: '+(l.st2||'09:00')+'\n'+fmtDate(l.ed)+'  Pick-up: '+(l.et||'18:00');
        if(hN>0)dp+='\n\uD83C\uDFDD\uFE0F Holiday rate applies on '+hN+' night'+(hN!==1?'s':'')+(holRangeStr?' ('+holRangeStr+')':'');
        dp+='\n\n'+mainDog+':\n';
        if(sN>0&&hN>0){dp+=fmtGBP(stdR)+'/night \u00D7 '+sN+' night'+(sN!==1?'s':'')+' = '+fmtGBP(sN*stdR)+'\n'+fmtGBP(holR)+'/night \u00D7 '+hN+' night'+(hN!==1?'s':'')+' = '+fmtGBP(hN*holR)+'\nTotal: '+fmtGBP(mainAmt);}
        else{dp+=fmtGBP(sN>0?stdR:holR)+'/night \u00D7 '+nights+' night'+(nights!==1?'s':'')+' = '+fmtGBP(mainAmt);}
        if(exHrs>0){const baseN=sN>0?stdR:holR;const extAmt=exHrs<8?Math.round(baseN*0.5*100)/100:baseN;amt+=extAmt;lines.push([em+' Boarding \u2014 extra hours '+( exHrs<8?'(<8h, +50%)':'(8+h, +100%)'),extAmt]);dp+='\nExtra hours ('+exHrs.toFixed(1)+'h'+(hN>0&&sN===0?' holiday':'')+', '+(exHrs<8?'+50%':'+100%')+'): '+fmtGBP(extAmt);}
        addDogs.forEach(dog=>{const addAmt=(sN*r.board_add)+(hN*r.board_addh);amt+=addAmt;lines.push([em+' Boarding \u2014 '+dog+' (+dog rate)',addAmt]);dp+='\n\n'+dog+' (additional dog):\n';if(sN>0&&hN>0){dp+=fmtGBP(r.board_add)+'/night \u00D7 '+sN+' night'+(sN!==1?'s':'')+' = '+fmtGBP(sN*r.board_add)+'\n'+fmtGBP(r.board_addh)+'/night \u00D7 '+hN+' night'+(hN!==1?'s':'')+' = '+fmtGBP(hN*r.board_addh)+'\nTotal: '+fmtGBP(addAmt);}else{dp+=fmtGBP(sN>0?r.board_add:r.board_addh)+'/night \u00D7 '+nights+' night'+(nights!==1?'s':'')+' = '+fmtGBP(addAmt);}});
        descParts.push(dp);
      }
    }else if(l.svc==='daycare'){
      const hol=l.sd?isHol(l.sd):false;
      const dogs=l.dogs&&l.dogs.length?l.dogs:[_mainDog||'Dog'];
      const mainDog=dogs[0];const addDogs=dogs.slice(1);
      const dayBase=l.rate>0?l.rate:(hol?r.day_hol:r.day_std);const mainAmt=dayBase;amt=mainAmt;
      const em='\u2600\uFE0F';const allDogStr=dogs.join(' & ');
      lines.push([em+' Daycare \u2014 '+mainDog+(hol?' (holiday)':''),mainAmt]);
      let dp=em+' Daycare ('+allDogStr+'): '+fmtDate(l.sd||'')+'  Drop-off: '+(l.st2||'07:00')+'  Pick-up: '+(l.et||'18:00')+(hol?'\n\uD83C\uDFDD\uFE0F Holiday rate':'');
      dp+='\n'+mainDog+': '+fmtGBP(mainAmt);
      addDogs.forEach(dog=>{const addAmt=hol?r.day_addh:r.day_add;amt+=addAmt;lines.push([em+' Daycare \u2014 '+dog+' (+dog rate)',addAmt]);dp+='\n'+dog+' (additional): '+fmtGBP(addAmt);});
      const [eph,epm]=(l.et||'18:00').split(':').map(Number);const ptD=eph+epm/60;
      if(ptD>18&&ptD<=23){const eveSur=Math.round(dayBase*(r.evening_pct/100)*100)/100;amt+=eveSur;lines.push([em+' Daycare \u2014 evening care (6\u201311PM, +'+r.evening_pct+'%)',eveSur]);dp+='\nEvening care (pick-up '+(l.et||'18:00')+'): +'+r.evening_pct+'% = '+fmtGBP(eveSur);}
      if(hol)dp+='\n\uD83C\uDFDD\uFE0F Holiday rate applies on this day';
      descParts.push(dp);
    }else if(isTaxi){
      const subDef=SVC_SUBTYPES.taxi?.find(s=>s.key===l.sub);
      const baseRate=l.rate||(subDef?r[subDef.rk]||0:r.t30r);
      const holMult=l.sd&&isHol(l.sd)?1.15:1;
      amt=Math.round(baseRate*holMult*100)/100;
      const isHolDay=holMult>1;const subLabel=subDef?.label||'';
      lines.push(['\u{1F695} Pet Taxi'+(subLabel?' ('+subLabel+')':'')+(isHolDay?' holiday +15%':''),amt]);
      descParts.push('\u{1F695} Pet Taxi'+(subLabel?' ('+subLabel+')':'')+(l.sd?' \u2014 '+fmtDate(l.sd):'')+(isHolDay?' \uD83C\uDFDD\uFE0F Holiday rate (+15%)':'')+': '+fmtGBP(amt));
    }else if(l.svc==='walk'||l.svc==='dropin'){
      const dogs=l.dogs&&l.dogs.length?l.dogs:[_mainDog||'Dog'];
      const mainDog=dogs[0];const addDogs=dogs.slice(1);
      const holMult=l.sd&&isHol(l.sd)?1.15:1;const isHolDay=holMult>1;
      const baseRate=l.rate||0;const mainRate=Math.round(baseRate*holMult*100)/100;
      const addRateBase=l.rka?r[l.rka]||0:0;const addRate=Math.round(addRateBase*holMult*100)/100;
      amt=mainRate;const em=SVC_EMOJIS[l.svc]||'';const svcName=SVC_NAMES[l.svc]||l.svc;
      const subLabel=l.sub&&SVC_SUBTYPES[l.svc]?SVC_SUBTYPES[l.svc].find(s=>s.key===l.sub)?.label||'':'';
      const allDogStr=dogs.join(' & ');
      let dp=em+' '+svcName+(subLabel?' ('+subLabel+')':'')+(l.sd?' \u2014 '+fmtDate(l.sd):'');
      if(isHolDay)dp+='\n\uD83C\uDFDD\uFE0F Holiday rate (+15%)';
      dp+='\n'+mainDog+': '+fmtGBP(mainRate);
      lines.push([em+' '+svcName+' \u2014 '+mainDog+(isHolDay?' (holiday)':'')+(subLabel?' ('+subLabel+')':''),mainRate]);
      addDogs.forEach(dog=>{amt+=addRate;lines.push([em+' '+svcName+' \u2014 '+dog+' (add-on'+(isHolDay?', holiday':'')+') ',addRate]);dp+='\n'+dog+' (additional): '+fmtGBP(addRate);});
      if(addRate===0&&addDogs.length>0)dp+=' (no add-on rate for this type)';
      descParts.push(dp);
    }else if(l.svc==='dogsit'){
      const dogs=l.dogs&&l.dogs.length?l.dogs:[_mainDog||'Dog'];
      const em='\uD83E\uDEB1';const allDogStr=dogs.join(' & ');
      if(l.sd&&l.ed){
        const holDates2=getHolDates(l.sd,l.ed);let hN2=0,sN2=0;
        let d2=new Date(l.sd+'T12:00:00');const endD2=new Date(l.ed+'T12:00:00');
        while(d2<endD2){const ds2=d2.toISOString().split('T')[0];if(holDates2.includes(ds2))hN2++;else sN2++;d2.setDate(d2.getDate()+1);}
        const stdR2=l.rate>0?l.rate:r.board_std,holR2=l.rate>0?l.rate:r.board_hol;
        const nights2=sN2+hN2;const mainAmt2=(sN2*stdR2)+(hN2*holR2);amt=mainAmt2;
        let dp2=em+' Dog Sit ('+allDogStr+'):\n'+fmtDate(l.sd)+'  Drop-off: '+(l.st2||'09:00')+'\n'+fmtDate(l.ed)+'  Pick-up: '+(l.et||'18:00');
        if(hN2>0)dp2+='\n\uD83C\uDFDD\uFE0F Holiday rate applies on '+hN2+' night'+(hN2!==1?'s':'');
        dp2+='\n\n'+dogs[0]+':\n';
        if(sN2>0&&hN2>0){dp2+=fmtGBP(stdR2)+'/night \u00D7 '+sN2+' night'+(sN2!==1?'s':'')+' = '+fmtGBP(sN2*stdR2)+'\n'+fmtGBP(holR2)+'/night \u00D7 '+hN2+' night'+(hN2!==1?'s':'')+' = '+fmtGBP(hN2*holR2)+'\nTotal: '+fmtGBP(mainAmt2);}
        else{dp2+=fmtGBP(sN2>0?stdR2:holR2)+'/night \u00D7 '+nights2+' night'+(nights2!==1?'s':'')+' = '+fmtGBP(mainAmt2);}
        lines.push([em+' Dog Sit \u2014 '+dogs[0],mainAmt2]);descParts.push(dp2);
      }else{
        const qty2=l.qty||1;const nRate=l.rate||r.board_std;amt=nRate*qty2;
        lines.push([em+' Dog Sit \u00D7'+qty2,amt]);
        descParts.push(em+' Dog Sit ('+allDogStr+'): '+fmtGBP(nRate)+'/night \u00D7 '+qty2+' = '+fmtGBP(amt));
      }
    }else{
      const qty=l.qty||1;amt=(l.rate||0)*qty;
      const em=SVC_EMOJIS[l.svc]||'';const dogStr=l.dogs&&l.dogs.length?l.dogs.join(' & '):'';
      const label=em+' '+(SVC_NAMES[l.svc]||l.svc)+(dogStr?' ('+dogStr+')':'');
      lines.push([label+(qty>1?' \u00D7'+qty:''),amt]);
      descParts.push(label+(qty>1?'\n\u00D7'+qty+' sessions @ '+fmtGBP(l.rate||0)+' = '+fmtGBP(amt):': '+fmtGBP(amt)));
    }
    total+=amt;
  });
  const discType=document.getElementById('q_disc_t')?.value||'none';const discVal=parseFloat(document.getElementById('q_disc_v')?.value)||0;
  let discLine='';
  if(discType==='pct'&&discVal>0){const da=total*(discVal/100);total-=da;discLine='Discount '+discVal+'%: -'+fmtGBP(da);lines.push(['Discount '+discVal+'%',-da]);}
  else if(discType==='gbp'&&discVal>0){total-=discVal;discLine='Discount: -'+fmtGBP(discVal);lines.push(['Discount',-discVal]);}
  const prepayPct=parseInt(document.getElementById('q_prepay_pct')?.value)||50;
  const prepayAmt=total*(prepayPct/100);const finalAmt=total-prepayAmt;
  _cr={total,prepayAmt,finalAmt,lines,discLine,selDogs:[..._selDogs],mainDog:_mainDog||_selDogs[0]||'',descParts,dogRevMap:_computeDogRevMap()};
  document.getElementById('q_total').textContent=fmtGBP(total);
  document.getElementById('q_breakdown').innerHTML=lines.map((l,i)=>'<div class="q-ln"'+(i===lines.length-1?' style="border-top:1px solid rgba(255,255,255,.1);margin-top:4px;padding-top:4px;"':'')+'>'+
    '<span>'+l[0]+'</span><span>'+(l[1]<0?'-':'')+fmtGBP(Math.abs(l[1]))+'</span></div>').join('');
  document.getElementById('q_prepay_show').textContent=fmtGBP(prepayAmt);
  document.getElementById('q_final_show').textContent=fmtGBP(finalAmt);
  const apEl=document.getElementById('q_actual_prepay');if(apEl&&!apEl.value)apEl.placeholder='Defaults to '+fmtGBP(prepayAmt);
  document.getElementById('q_result').style.display='block';
}

function getRates(){return JSON.parse(localStorage.getItem('tcl_rates')||JSON.stringify(DR));}
function getHolRanges(){return JSON.parse(localStorage.getItem('tcl_hol_ranges')||JSON.stringify(DEFAULT_RANGES));}
function getTpls(){const s=JSON.parse(localStorage.getItem('tcl_tpls')||'{}');return{quote:s.quote||TP_QUOTE,book:s.book||TP_BOOK,prepay:s.prepay||TP_PREPAY,final:s.final||TP_FINAL,avail:s.avail||TP_AVAIL,payLink:s.payLink||'https://paymentrequest.natwestpayit.com/reusable-links/80b66e1d-90d1-4893-8441-c23a30cb5d1d',payRefPfx:s.payRefPfx||'KCHEUNG'};}
function isHol(d){return getHolRanges().some(r=>d>=r.start&&d<=r.end);}
function getHolDates(sd,ed){const ranges=getHolRanges();const dates=[];let d=new Date(sd+'T12:00:00');const e=new Date(ed+'T12:00:00');while(d<e){const ds=d.toISOString().split('T')[0];if(ranges.some(r=>ds>=r.start&&ds<=r.end))dates.push(ds);d.setDate(d.getDate()+1);}return dates;}
function loadQSettings(){
  const r=getRates();['board_std','board_hol','board_add','board_addh','day_std','day_hol','day_add','day_addh','evening_pct','t15s','t15r','t30s','t30r','t60s','t60r','walk30','walk60','walk30a','walk60a','walk30_11','walk60_11','dropin30','dropin60','dropin30a','dropin60a'].forEach(k=>{const el=document.getElementById('r_'+k);if(el)el.value=r[k]!=null?r[k]:DR[k];});
  renderHolList();renderHolYrBtns();const t=getTpls();const qe=document.getElementById('tpl_quote');const be=document.getElementById('tpl_book');const pe=document.getElementById('tpl_prepay');const fe=document.getElementById('tpl_final');if(qe)qe.value=t.quote;if(be)be.value=t.book;if(pe)pe.value=t.prepay;if(fe)fe.value=t.final;
  const pl=document.getElementById('tpl_paylink');const pp=document.getElementById('tpl_payref_pfx');if(pl)pl.value=t.payLink||'';if(pp)pp.value=t.payRefPfx||'';
}
function toggleSP(id){document.getElementById('sp-'+id).classList.toggle('open');}
async function saveRates(){const r={};['board_std','board_hol','board_add','board_addh','day_std','day_hol','day_add','day_addh','evening_pct','t15s','t15r','t30s','t30r','t60s','t60r','walk30','walk60','walk30a','walk60a','walk30_11','walk60_11','dropin30','dropin60','dropin30a','dropin60a'].forEach(k=>r[k]=parseFloat(document.getElementById('r_'+k)?.value)||DR[k]);localStorage.setItem('tcl_rates',JSON.stringify(r));const s=document.getElementById('rateStatus');s.textContent='Saving...';s.className='smsg';
  try{
    const rows=await readSheet(TABS.RATES,'A2:C').catch(()=>[]);const existIdx=rows.findIndex(r=>r[0]==='tcl_rates');
    if(existIdx>=0){await updateRow(TABS.RATES,existIdx+2,['tcl_rates',JSON.stringify(r),new Date().toISOString()]);}
    else{await appendRow(TABS.RATES,['tcl_rates',JSON.stringify(r),new Date().toISOString()]);}
    s.textContent='Rates saved & synced!';s.className='smsg ok';
  }catch(e){s.textContent='Saved locally (sheet: '+e.message+')';s.className='smsg err';}
  setTimeout(()=>s.className='smsg',3000);calcMultiQ();}
async function loadRatesFromSheet(){const s=document.getElementById('rateStatus');s.textContent='Loading...';s.className='smsg';
  try{const rows=await readSheet(TABS.RATES,'A2:C');const rRow=rows.find(r=>r[0]==='tcl_rates');if(rRow&&rRow[1]){const r=JSON.parse(rRow[1]);localStorage.setItem('tcl_rates',JSON.stringify(r));loadQSettings();s.textContent='Rates loaded from sheet!';s.className='smsg ok';}else{s.textContent='No rates found in sheet';s.className='smsg err';}
  }catch(e){s.textContent='Error: '+e.message;s.className='smsg err';}setTimeout(()=>s.className='smsg',3000);}
let _holYrFilter=null;
function renderHolYrBtns(){const yrs=[...new Set(getHolRanges().map(r=>r.start.slice(0,4)))].sort();const el=document.getElementById('holYrBtns');if(!el)return;el.innerHTML=yrs.map(y=>{const oc="setHolYr('"+y+"')";return'<button class="hyrb'+(_holYrFilter===y?' active':'')+'" onclick="'+oc+'">'+y+'</button>';}).join('');renderHolList();}
function setHolYr(y){_holYrFilter=_holYrFilter===y?null:y;renderHolYrBtns();}
function renderHolList(){const ranges=getHolRanges();const f=_holYrFilter?ranges.filter(r=>r.start.startsWith(_holYrFilter)):ranges;const el=document.getElementById('holList');if(!el)return;el.innerHTML=f.map(r=>{const oc="removeHolRange('"+r.start+"','"+r.end+"')";return'<div class="hol-rng">'+r.label+' ('+r.start+' to '+r.end+')<button onclick="'+oc+'">x</button></div>';}).join('')||'<span style="font-size:9px;color:var(--gr3);">No holiday ranges</span>';}
function addHolRange(){const s=document.getElementById('holStart').value,e=document.getElementById('holEnd').value;if(!s||!e||e<s){alert('Select valid start and end dates');return;}const ranges=getHolRanges();ranges.push({start:s,end:e,label:'Holiday '+new Date(s+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'})});localStorage.setItem('tcl_hol_ranges',JSON.stringify(ranges));renderHolList();renderHolYrBtns();document.getElementById('holStart').value='';document.getElementById('holEnd').value='';calcMultiQ();}
function removeHolRange(start,end){localStorage.setItem('tcl_hol_ranges',JSON.stringify(getHolRanges().filter(r=>!(r.start===start&&r.end===end))));renderHolList();renderHolYrBtns();calcMultiQ();}
async function saveTpl(k){const c=document.getElementById('tpl_'+k)?.value;const t=getTpls();t['_prev_'+k]=t[k];t[k]=c;localStorage.setItem('tcl_tpls',JSON.stringify(t));await saveTplSettingsAndSync();}
function redoTpl(k){const t=getTpls();if(t['_prev_'+k]){const tmp=t[k];t[k]=t['_prev_'+k];t['_prev_'+k]=tmp;localStorage.setItem('tcl_tpls',JSON.stringify(t));document.getElementById('tpl_'+k).value=t[k];alert('Reverted.');}else alert('No previous version.');}
function confirmRestoreTpl(k){_restoreTplKey=k;document.getElementById('restoreInput').value='';document.getElementById('restoreConfirm').classList.add('open');}
function doRestore(){if(document.getElementById('restoreInput').value.trim()!=='RESTORE'){alert('Type RESTORE to confirm');return;}const t=getTpls();const defaults={quote:TP_QUOTE,book:TP_BOOK,prepay:TP_PREPAY,final:TP_FINAL};t[_restoreTplKey]=defaults[_restoreTplKey]||TP_FINAL;delete t['_prev_'+_restoreTplKey];localStorage.setItem('tcl_tpls',JSON.stringify(t));document.getElementById('tpl_'+_restoreTplKey).value=t[_restoreTplKey];document.getElementById('restoreConfirm').classList.remove('open');alert('Restored.');}
async function saveTplSettingsAndSync(){
  const t=getTpls();t.payLink=document.getElementById('tpl_paylink').value;t.payRefPfx=document.getElementById('tpl_payref_pfx').value;t.quote=document.getElementById('tpl_quote')?.value||t.quote;t.book=document.getElementById('tpl_book')?.value||t.book;t.prepay=document.getElementById('tpl_prepay').value;t.final=document.getElementById('tpl_final').value;
  localStorage.setItem('tcl_tpls',JSON.stringify(t));
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D').catch(()=>[]);const idx=rows.findIndex(r=>r[0]==='prepay-quote');
    const vals=['prepay-quote','Quote Templates',JSON.stringify({prepay:t.prepay,final:t.final,payLink:t.payLink,payRefPfx:t.payRefPfx}),new Date().toISOString()];
    if(idx>=0)await updateRow(TABS.TPLS,idx+2,vals);else await appendRow(TABS.TPLS,vals);
    alert('Saved and synced!');
  }catch(e){alert('Saved locally. Sheet sync failed: '+e.message);}
}
function buildQDogMS(){
  const c=document.getElementById('q_dog_ms');if(!c)return;
  if(!allDogs.length){c.innerHTML='<div style="padding:9px;font-size:10px;color:var(--gr3);">No dogs loaded - tap Refresh on the Board first</div>';return;}
  const q=(document.getElementById('q_dog_search')?.value||'').toLowerCase();
  const visible=allDogs.filter(d=>!q||d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q));
  c.innerHTML=visible.map(d=>{const i=allDogs.indexOf(d);return'<div class="dog-ms-item'+(_selDogs.includes(d.name)?' sel':'')+'" onclick="toggleQDog('+i+')"><input type="checkbox" '+(_selDogs.includes(d.name)?'checked':'')+' onclick="event.stopPropagation()"><span style="flex:1;">'+d.name+'</span><span style="font-size:8px;color:var(--gr3);">'+d.cid+'</span></div>';}).join('');
}
function _syncDogsToLines(){const ordered=_mainDog?[_mainDog,..._selDogs.filter(n=>n!==_mainDog)]:[..._selDogs];_svcLines.forEach(l=>{if(l.svc!=='extra'&&l.svc!=='taxi')l.dogs=[...ordered];});}
function toggleQDog(i){const name=allDogs[i].name;const idx=_selDogs.indexOf(name);if(idx>=0)_selDogs.splice(idx,1);else _selDogs.push(name);if(!_selDogs.includes(_mainDog))_mainDog=_selDogs[0]||'';_syncDogsToLines();buildQDogMS();buildMainDogBtns();calcMultiQ();}
function buildMainDogBtns(){const w=document.getElementById('q_main_dog_wrap');const c=document.getElementById('q_main_dog_btns');if(!w||!c)return;if(_selDogs.length<=1){w.style.display='none';_mainDog=_selDogs[0]||'';return;}w.style.display='block';c.innerHTML=_selDogs.map((n,i)=>'<button class="main-dog-pill'+(_mainDog===n?' active':'')+'" onclick="setMainDog('+i+')">* '+n+'</button>').join('');}
function setMainDog(i){_mainDog=_selDogs[i];_syncDogsToLines();buildMainDogBtns();calcMultiQ();}
function _computeDogRevMap(){
  const r=getRates();const map={};
  const add=(name,a)=>{if(name&&a>0)map[name]=Math.round(((map[name]||0)+a)*100)/100;};
  _svcLines.forEach(l=>{
    if(l.svc==='extra'||l.svc==='taxi')return;
    const dogs=l.dogs&&l.dogs.length?l.dogs:[_mainDog||''];
    const main=dogs[0];const addDogs=dogs.slice(1);
    if(l.svc==='boarding'&&l.sd&&l.ed){
      const drop=new Date(l.sd+'T'+(l.st2||'09:00')),pick=new Date(l.ed+'T'+(l.et||'18:00'));
      const hrs=(pick-drop)/3600000;const nights=Math.max(1,Math.floor(hrs/24));const exHrs=hrs-nights*24;
      const hd=getHolDates(l.sd,l.ed);let hN=0,sN=0;
      let d=new Date(l.sd+'T12:00:00');const eD=new Date(l.ed+'T12:00:00');
      while(d<eD){if(hd.includes(d.toISOString().split('T')[0]))hN++;else sN++;d.setDate(d.getDate()+1);}
      let mAmt=(sN*r.board_std)+(hN*r.board_hol);
      if(exHrs>0){const bn=sN>0?r.board_std:r.board_hol;mAmt+=exHrs<8?Math.round(bn*0.5*100)/100:bn;}
      add(main,mAmt);addDogs.forEach(dog=>add(dog,(sN*r.board_add)+(hN*r.board_addh)));
    }else if(l.svc==='daycare'&&l.sd){
      const hol=isHol(l.sd);add(main,hol?r.day_hol:r.day_std);
      addDogs.forEach(dog=>add(dog,hol?r.day_addh:r.day_add));
    }else if((l.svc==='walk'||l.svc==='dropin')&&l.rate){
      const hm=l.sd&&isHol(l.sd)?1.15:1;const mr=Math.round(l.rate*hm*100)/100;
      const ar=l.rka?Math.round((r[l.rka]||0)*hm*100)/100:0;
      add(main,mr);addDogs.forEach(dog=>add(dog,ar));
    }else if(l.svc==='dogsit'&&l.sd&&l.ed){
      const hd2=getHolDates(l.sd,l.ed);let hN2=0,sN2=0;
      let d2=new Date(l.sd+'T12:00:00');const eD2=new Date(l.ed+'T12:00:00');
      while(d2<eD2){if(hd2.includes(d2.toISOString().split('T')[0]))hN2++;else sN2++;d2.setDate(d2.getDate()+1);}
      add(main,(sN2*r.board_std)+(hN2*r.board_hol));
    }else if(l.rate){const qty=l.qty||1;add(main,(l.rate||0)*qty);}
  });
  return map;
}
function onQSvc(){}
function calcQ(){
  const svc=document.getElementById('q_svc')?.value;if(!svc)return;const r=getRates();const addDogs=Math.max(0,_selDogs.length-1);
  const discType=document.getElementById('q_disc_t')?.value||'none';const discVal=parseFloat(document.getElementById('q_disc_v')?.value)||0;const prepayPct=parseInt(document.getElementById('q_prepay_pct')?.value)||50;
  document.getElementById('q_result').style.display='block';let total=0,lines=[],nights=0,rpn=0,addLine='',discLine='',holDates=[];
  if(svc==='boarding'){
    const dd=document.getElementById('q_dd').value,dt=document.getElementById('q_dt_t').value||'09:00';const pd=document.getElementById('q_pd').value,pt=document.getElementById('q_pt').value||'09:00';
    if(!dd||!pd){document.getElementById('q_total').textContent='--';return;}
    const dropDt=new Date(dd+'T'+dt),pickDt=new Date(pd+'T'+pt);if(pickDt<=dropDt){document.getElementById('q_total').textContent='Invalid dates';return;}
    const hrs=(pickDt-dropDt)/3600000;nights=Math.max(1,Math.floor(hrs/24));const exHrs=hrs-nights*24;
    holDates=getHolDates(dd,pd);let hN=0,sN=0;let d=new Date(dd+'T12:00:00');const endD=new Date(pd+'T12:00:00');
    while(d<endD){const ds=d.toISOString().split('T')[0];if(holDates.includes(ds))hN++;else sN++;d.setDate(d.getDate()+1);}
    rpn=sN>0?r.board_std:r.board_hol;
    if(sN>0){const a=sN*r.board_std;total+=a;lines.push(['Standard nights x'+sN,a]);}if(hN>0){const a=hN*r.board_hol;total+=a;lines.push(['Holiday nights x'+hN,a]);}
    if(exHrs>0&&exHrs<8){const a=r.board_std*0.5;total+=a;lines.push(['Extension <8h (+50%)',a]);}else if(exHrs>=8){const a=r.board_std;total+=a;lines.push(['Extension >=8h',a]);}
    if(addDogs>0){const es=sN*r.board_add*addDogs,eh=hN*r.board_addh*addDogs;total+=es+eh;addLine='Additional dog x'+addDogs+': '+fmtGBP(es+eh);lines.push(['Add. dog x'+addDogs,es+eh]);}
  }else if(svc==='daycare'){
    const dd=document.getElementById('q_dd').value,pt=document.getElementById('q_pt').value||'18:00';if(!dd){document.getElementById('q_total').textContent='--';return;}
    const[ph,pm]=pt.split(':').map(Number);const ptD=ph+pm/60;const hol=isHol(dd);const base=hol?r.day_hol:r.day_std;
    total=base;lines.push([(hol?'Holiday':'Standard')+' daycare',base]);rpn=base;nights=1;
    if(ptD>18){const sur=base*(r.evening_pct/100);total+=sur;lines.push(['Evening +'+r.evening_pct+'%',sur]);}
    if(addDogs>0){const ext=(hol?r.day_addh:r.day_add)*addDogs;total+=ext;addLine='Additional dog x'+addDogs+': '+fmtGBP(ext);lines.push(['Add. dog x'+addDogs,ext]);}
    if(hol)holDates=[dd];
  }else if(svc==='taxi'){
    const dk=document.getElementById('q_taxi_d').value||'15s';const taxiDate=document.getElementById('q_taxi_dt').value;
    const tR={t15s:r.t15s,t15r:r.t15r,t30s:r.t30s,t30r:r.t30r,t60s:r.t60s,t60r:r.t60r};
    const lbl={t15s:'15min Single',t15r:'15min Return',t30s:'30min Single',t30r:'30min Return',t60s:'60min Single',t60r:'60min Return'};
    const base=tR['t'+dk]||r.t15s;
    if(taxiDate&&isHol(taxiDate)){total=Math.round(base*1.15*100)/100;lines.push([lbl[dk]+' (holiday +15%)',total]);holDates=[taxiDate];}else{total=base;lines.push([lbl[dk],base]);}
    nights=1;rpn=base;
  }else{
    const rate=parseFloat(document.getElementById('q_rate')?.value)||0;const qty=parseInt(document.getElementById('q_qty')?.value)||1;total=rate*qty;lines.push(['Rate '+fmtGBP(rate)+' x '+qty,total]);nights=qty;rpn=rate;
  }
  if(discType==='pct'&&discVal>0){const da=total*(discVal/100);total-=da;discLine='Discount '+discVal+'%: -'+fmtGBP(da);lines.push(['Discount '+discVal+'%',-da]);}
  else if(discType==='gbp'&&discVal>0){total-=discVal;discLine='Discount -'+fmtGBP(discVal);lines.push(['Discount',-discVal]);}
  lines.push(['Total',total]);const prepayAmt=total*(prepayPct/100);const finalAmt=total-prepayAmt;
  _cr={total,prepayAmt,finalAmt,lines,nights,rpn,addLine,discLine,holDates,selDogs:[..._selDogs],mainDog:_mainDog||_selDogs[0]||''};
  document.getElementById('q_total').textContent=fmtGBP(total);
  document.getElementById('q_breakdown').innerHTML=lines.map((l,i)=>'<div class="q-ln"'+(i===lines.length-1?' style="border-top:1px solid rgba(255,255,255,.1);margin-top:4px;padding-top:4px;"':'')+'>'+
    '<span>'+l[0]+'</span><span>'+(l[1]<0?'-':'')+fmtGBP(Math.abs(l[1]))+'</span></div>').join('');
  document.getElementById('q_hol_note').textContent=holDates.length?'Holiday rate: '+holDates.slice(0,4).join(', '):'';
  document.getElementById('q_prepay_show').textContent=fmtGBP(prepayAmt);document.getElementById('q_final_show').textContent=fmtGBP(finalAmt);
}
function updateFinalShow(){const ap=parseFloat(document.getElementById('q_actual_prepay')?.value);if(!isNaN(ap)&&ap>0){document.getElementById('q_final_show').textContent=fmtGBP(Math.max(0,_cr.total-ap));}}
function genRateBlock(){
  const r=getRates();const svcs=[...new Set(_svcLines.filter(l=>l.svc!=='extra').map(l=>l.svc))];
  return svcs.map(svc=>{
    if(svc==='boarding')return '\ud83d\udca4 Boarding (per night, 24 hours)\nPer night: '+fmtGBP(r.board_std)+'\nAdditional pet: '+fmtGBP(r.board_add)+'/night\nExtra hours <8h: +50% \u00b7 8+h: +100%\nHoliday rate: +15%';
    if(svc==='daycare')return '\u2600\ufe0f Day Care (per day, 10 hours)\nDrop-off after 7AM \u00b7 Pick-up before 6PM\nPer day: '+fmtGBP(r.day_std)+'\nAdditional pet: '+fmtGBP(r.day_add)+'/day\nEvening care (6\u201311PM): +'+r.evening_pct+'%\nHoliday rate: +15%';
    if(svc==='walk')return '\ud83d\udc15 Dog Walk\n30 min: '+fmtGBP(r.walk30)+' / Additional pet: '+fmtGBP(r.walk30a)+'\n60 min: '+fmtGBP(r.walk60)+' / Additional pet: '+fmtGBP(r.walk60a)+'\nHoliday rate: +15%';
    if(svc==='dropin')return '\ud83d\udd11 Drop-in Visit\n30 min: '+fmtGBP(r.dropin30)+' / 60 min: '+fmtGBP(r.dropin60)+'\nAdditional pet \u2014 30 min: '+fmtGBP(r.dropin30a)+' / 60 min: '+fmtGBP(r.dropin60a)+'\nHoliday rate: +15%';
    if(svc==='dogsit')return '\ud83d\udecb\ufe0f Dog Sit\nPer night: '+fmtGBP(r.board_std)+'\nHoliday rate: '+fmtGBP(r.board_hol)+'/night';
    if(svc==='taxi')return '\ud83d\ude95 Pet Taxi\n15 min \u2014 single: '+fmtGBP(r.t15s)+' / return: '+fmtGBP(r.t15r)+'\n30 min \u2014 single: '+fmtGBP(r.t30s)+' / return: '+fmtGBP(r.t30r)+'\n60 min \u2014 single: '+fmtGBP(r.t60s)+' / return: '+fmtGBP(r.t60r)+'\nHoliday rate: +15%';
    if(svc==='training')return '\ud83c\udfc5 Training\nPricing not available yet \u2014 please contact us for details';
    return '';
  }).filter(Boolean).join('\n\n');
}
function genQuote(type){
  calcMultiQ();// always recalculate to pick up latest discount/prepay changes
  const t=getTpls();const ownerName=document.getElementById('q_owner').value||'there';
  const payRef=document.getElementById('q_payref').value||(t.payRefPfx||'KCHEUNG');
  const allDogNames=[...new Set((_svcLines||[]).flatMap(l=>l.svc!=='extra'?l.dogs||[]:[]))].filter(Boolean).join(' & ')||_cr.selDogs.join(' & ')||'your dog';
  const serviceBlock=(_cr.descParts||[]).join('\n\n');
  const actualPrepay=parseFloat(document.getElementById('q_actual_prepay')?.value)||_cr.prepayAmt;
  const balanceDue=Math.max(0,_cr.total-actualPrepay);
  let msg='Hi '+ownerName+',\n\n';
  // clear other output boxes
  ['q_out_quote','q_out_book','q_out_prepay','q_out_final'].forEach(id=>{if('q_out_'+type!==id){const el=document.getElementById(id);if(el){el.style.display='none';el.textContent='';}}});
  if(type==='quote'){
    markBookingsQuotedFromQuote();
    const rateBlock=genRateBlock();
    msg+='Here is the rate for our services with THE CUDDLY LANE \u2601\ufe0f\u2728\n\n';
    msg+=rateBlock;
    msg+='\n\nHere is your quotation:\n\n';
    msg+=serviceBlock;
    if(_cr.discLine)msg+='\n\n'+_cr.discLine;
    msg+='\n\n*Total: '+fmtGBP(_cr.total)+'*';
    msg+='\n\nTo secure your booking, a 50% prepayment will be required (non-refundable, but transferable to other dates). Let us know if you\'d like to go ahead!';
    msg+='\n\nThank you!\nKatie & Osbert \ud83d\udc3e';
  }else if(type==='book'){
    msg+='Thank you for choosing THE CUDDLY LANE \u2014 we can\'t wait to welcome *'+allDogNames+'*! \ud83d\udc3e\n\n';
    msg+='Here is a summary of your booking:\n\n';
    msg+=serviceBlock;
    if(_cr.discLine)msg+='\n\n'+_cr.discLine;
    msg+='\n\n*Total: '+fmtGBP(_cr.total)+'*';
    msg+='\n\nTo confirm your spot, please send your 50% prepayment:\n*'+fmtGBP(_cr.prepayAmt)+'*';
    msg+='\n\nPayment reference: *'+payRef+'*\n'+(t.payLink||'[payment link]');
    msg+='\n\nThis payment is non-refundable but fully transferable to alternative dates. Once received, your booking is confirmed!';
    msg+='\n\nThank you!\nKatie & Osbert \ud83d\udc3e';
  }else if(type==='prepay'){
    msg+='Great news \u2014 your prepayment has been received and your booking is confirmed! \ud83c\udf89\n\n';
    msg+='Here is your booking summary:\n\n';
    msg+=serviceBlock;
    if(_cr.discLine)msg+='\n\n'+_cr.discLine;
    msg+='\n\n*Total: '+fmtGBP(_cr.total)+'*';
    msg+='\nPrepayment received: *'+fmtGBP(actualPrepay)+'*';
    msg+='\n*Balance due at drop-off: '+fmtGBP(balanceDue)+'*';
    msg+='\n\nPayment reference: *'+payRef+'*\n'+(t.payLink||'[payment link]');
    msg+='\n\nWe look forward to seeing *'+allDogNames+'*! \ud83d\udc3e\nKatie & Osbert';
  }else{
    msg+='Your booking is coming up soon! \ud83d\udc3e\n\n';
    msg+='Here is your final payment summary:\n\n';
    msg+=serviceBlock;
    if(_cr.discLine)msg+='\n\n'+_cr.discLine;
    msg+='\n\n*Total: '+fmtGBP(_cr.total)+'*';
    msg+='\nPrepayment received: '+fmtGBP(actualPrepay);
    msg+='\n*Balance due: '+fmtGBP(balanceDue)+'*';
    msg+='\n\nPlease settle the balance before drop-off.\nPayment reference: *'+payRef+'*\n'+(t.payLink||'[payment link]');
    msg+='\n\nLooking forward to seeing *'+allDogNames+'*!\nKatie & Osbert \ud83d\udc3e';
  }
  msg=msg.replace(/\n{3,}/g,'\n\n').trim();
  const outId='q_out_'+type;
  document.getElementById(outId).style.display='block';document.getElementById(outId).textContent=msg;copyText(msg);
  const btnLabels={quote:'Copy Get Quote',book:'Copy Book with Us',prepay:'Copy Prepayment Received',final:'Copy Final Payment'};
  const allBtns=document.querySelectorAll('.cpbtn[data-qtype]');
  allBtns.forEach(b=>{if(b.dataset.qtype===type){b.textContent='Copied!';setTimeout(()=>b.textContent=btnLabels[type]||'Copy',2000);}});
}

async function markBookingsQuotedFromQuote(){
  try{
    const svcN={boarding:'Boarding',daycare:'DayCare',walk:'Walking',dropin:'Drop-in',dogsit:'Dog Sit',taxi:'Pet Taxi',training:'Training'};
    const mainLine=_svcLines.find(l=>l.svc!=='extra');if(!mainLine)return;
    const sd=mainLine.sd||'';const ed=mainLine.ed||sd;const svcLabel=svcN[mainLine.svc]||mainLine.svc;
    const dogs=(_selDogs&&_selDogs.length)?_selDogs:(mainLine.dogs||[]);
    let changed=false;
    for(const dogName of dogs){
      if(!dogName)continue;
      const dogData=allDogs.find(d=>d.name===dogName);const customerId=dogData?dogData.cid:'';
      const existing=bookings.find(b=>(customerId?b.customerId===customerId:b.dog.toLowerCase()===dogName.toLowerCase())&&b.sd===sd&&(b.ed||b.sd)===(ed||sd)&&!['Cancelled','Canceled'].includes(b.status));
      if(existing){
        if(!existing.status){
          const fullVals=rowFromMap(bkHdrRow,bkFieldMap({...existing,dog:dogName,status:'Quoted'}),TABS.BK.h);
          const hdr=(bkHdrRow&&bkHdrRow.length)?bkHdrRow:TABS.BK.h;const cut=hdr.indexOf('Rem5')+1;
          const vals=fullVals.slice(0,cut>0?cut:fullVals.length);
          await updateRow(TABS.BK,existing.ri,vals);
          existing.status='Quoted';changed=true;
        }
      }else if(sd){
        const id=nextBkId();const month=new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'});
        const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId,dog:dogName,id,svc:svcLabel,sd,st:mainLine.st2||'09:00',ed:ed||sd,et:mainLine.et||'18:00',dropLoc:'',pickLoc:'',rev:0,tips:0,prepay:0,finalPay:0,unit:0,discNotes:'',roverPct:0,roverAmt:0,ch:'TCL',pay:'',status:'Quoted',priv:false,month,rating:'',feedback:'',rem:['','','','','']}),TABS.BK.h);
        await appendRow(TABS.BK,vals);
        bookings.push(mapBk(vals,bookings.length));changed=true;
      }
    }
    if(changed){renderBoard();updatePendingBadge();}
  }catch(e){}
}
async function createBookingsFromQuote(){
  if(!_svcLines.length){alert('Complete the quote first');return;}
  calcMultiQ();
  const svcN={boarding:'Boarding',daycare:'DayCare',walk:'Walking',dropin:'Drop-in',dogsit:'Dog Sit',taxi:'Pet Taxi',training:'Training',extra:'Extra'};
  const prepayPct=parseInt(document.getElementById('q_prepay_pct')?.value)||50;
  // Proportional revenue: each dog's share = (their service rev / total service rev) * full quote total
  const dogRevMap=_cr.dogRevMap||{};
  const svcRevTotal=Object.values(dogRevMap).reduce((s,v)=>s+v,0)||1;
  const revenueMap={};Object.entries(dogRevMap).forEach(([dog,rev])=>{revenueMap[dog]=Math.round(rev/svcRevTotal*_cr.total*100)/100;});
  let created=0;
  for(const line of _svcLines){
    if(line.svc==='extra')continue;
    // Taxi: flat rate per trip — one booking for main dog only
    const dogs=line.svc==='taxi'?[_mainDog||_selDogs[0]||'']:(line.dogs&&line.dogs.length?line.dogs:(_selDogs.length?_selDogs:['']));
    const sd=line.sd||'';const ed=line.ed||sd;const st=line.st2||'09:00';const et=line.et||'18:00';
    const svcLabel=svcN[line.svc]||line.svc;
    for(const dogName of dogs){
      const id=nextBkId();
      const month=sd?new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'}):'';
      const rev=line.svc==='taxi'?(_cr.lines.find(l=>l[0].includes('Taxi'))?.[1]||0):revenueMap[dogName]||0;
      const prepayAmt=parseFloat((rev*(prepayPct/100)).toFixed(2));
      const dogData=allDogs.find(d=>d.name===dogName);const customerId=dogData?dogData.cid:'';
      const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId,dog:dogName,id,svc:svcLabel,sd,st,ed,et,dropLoc:'',pickLoc:'',rev,tips:0,prepay:prepayAmt,finalPay:0,unit:0,discNotes:'',roverPct:0,roverAmt:0,ch:'TCL',pay:'',status:'Booked',priv:false,month,rating:'',feedback:'',rem:['','','','','']}),TABS.BK.h);
      try{await appendRow(TABS.BK,vals);const mv=[...vals];mv[1]=dogName;bookings.push(mapBk(mv,bookings.length));created++;}catch(e){alert('Error for '+dogName+' ('+svcLabel+'): '+e.message);}
    }
  }
  if(created){renderBoard();alert(created+' booking'+(created>1?'s':'')+' created with revenue pre-filled. Check Bookings to adjust.');}
}
function quoteFromBk(){
  const dog=document.getElementById('bm_dog').value;const svc=document.getElementById('bm_svc').value;const sd=document.getElementById('bm_sd').value;const ed=document.getElementById('bm_ed').value;const bst=document.getElementById('bm_st').value;const et=document.getElementById('bm_et').value;
  const actualPrepay=parseFloat(document.getElementById('bm_prepay')?.value)||0;
  const svcMap={Boarding:'boarding',DayCare:'daycare',Walking:'walk','Drop-in':'dropin','Dog Sit':'dogsit','Pet Taxi':'taxi',Training:'training'};
  const svcKey=svcMap[svc]||'boarding';
  _svcLines=[{svc:svcKey,dogs:dog?[dog]:[],sd,ed,st2:bst||'09:00',et:et||'18:00',rate:0}];
  _selDogs=dog?[dog]:[];_mainDog=dog||'';
  const dogData=allDogs.find(d=>d.name.toLowerCase()===(dog||'').toLowerCase());
  if(dogData)document.getElementById('q_owner').value=dogData.owner;
  if(actualPrepay>0){const apEl=document.getElementById('q_actual_prepay');if(apEl)apEl.value=actualPrepay.toFixed(2);}
  document.getElementById('bkModal').classList.remove('open');switchSection('quote');
  renderSvcLines();buildQDogMS();buildMainDogBtns();calcMultiQ();
}

// ==================== BOOKINGS ====================
function nextBkId(){let max=0;bookings.forEach(b=>{const m=(b.id||'').match(/^BK-BD-(\d+)$/);if(m)max=Math.max(max,parseInt(m[1],10));});const n=max+1;return'BK-BD-'+(n<10?'00'+n:n<100?'0'+n:''+n);}
function openBkModal(editId=null,fromProf=false){
  const modal=document.getElementById('bkModal');const ed=editId&&bookings.find(r=>r.id===editId);
  document.getElementById('bm_eid').value=editId||'';document.getElementById('bm_ridx').value=ed?.ri||'';
  document.getElementById('bkMTitle').textContent=ed?'Modify Booking':'Add Booking';document.getElementById('bkBtn').textContent=ed?'Modify Booking':'Save Booking';
  document.getElementById('bkDelBtn').style.display=ed?'block':'none';
  const searchEl=document.getElementById('bm_dog_search');if(searchEl)searchEl.value='';
  const sel=document.getElementById('bm_dog');sel.innerHTML='<option value="">Select dog</option>';allDogs.forEach(d=>sel.add(new Option(dogOptLabel(d),d.name)));
  if(ed){
    const ss=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null?v:''};
    sel.value=ed.dog;updateDogIdHint();ss('bm_svc',ed.svc);ss('bm_sd',ed.sd);ss('bm_st',ed.st);ss('bm_ed',ed.ed);ss('bm_et',ed.et);ss('bm_drop_loc',ed.dropLoc||'');ss('bm_pick_loc',ed.pickLoc||'');ss('bm_rev',ed.rev||0);ss('bm_tips',ed.tips||0);ss('bm_prepay',ed.prepay||0);ss('bm_final',ed.finalPay||0);ss('bm_unit',ed.unit||0);ss('bm_disc_notes',ed.discNotes||'');ss('bm_channel',ed.ch||'TCL');ss('bm_pay',ed.pay||'');ss('bm_status',ed.status||'Quoted');ss('bm_rpct',ed.roverPct||15);ss('bm_ramt',ed.roverAmt||0);ss('bm_rating',ed.rating||'');ss('bm_feedback',ed.feedback||'');ss('bm_ref',ed.bookingRef||'');ss('bm_prepay_ref',ed.prepayRef||'');ss('bm_final_ref',ed.finalPayRef||'');document.getElementById('bm_priv').checked=ed.priv||false;
  }else{
    sel.value='';if(fromProf&&curDog)sel.value=curDog.name;updateDogIdHint();
    ['bm_rev','bm_tips','bm_prepay','bm_final','bm_unit','bm_disc_notes','bm_drop_loc','bm_pick_loc','bm_rating','bm_feedback','bm_ref','bm_prepay_ref','bm_final_ref'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('bm_rpct').value='15';document.getElementById('bm_sd').value=todayStr();document.getElementById('bm_ed').value=todayStr();document.getElementById('bm_channel').value='TCL';document.getElementById('bm_pay').value='';document.getElementById('bm_status').value='Quoted';document.getElementById('bm_priv').checked=false;
  }
  calcBal();toggleRover();updateStatusFlow();renderOverlapCheck();renderWfChecklist();modal.classList.add('open');
}
// ==================== WORKFLOW CHECKLIST (stored on Bookings sheet) ====================
function wfAutoLogs(bk){
  if(!bk||!bk.sd)return null;
  const today=todayStr();const endD=bk.ed&&bk.ed<today?bk.ed:(()=>{const y=new Date(today+'T12:00:00Z');y.setUTCDate(y.getUTCDate()-1);return y.toISOString().slice(0,10);})();
  if(bk.sd>endD)return true; // booking hasn't started or is today only
  let d=new Date(bk.sd+'T12:00:00Z');const end=new Date(endD+'T12:00:00Z');
  while(d<=end){const ds=d.toISOString().slice(0,10);if(!dailyLogSet.has(bk.customerId+'_'+ds))return false;d.setUTCDate(d.getUTCDate()+1);}
  return true;
}
function wfAutoCompat(bk){
  if(!bk||!bk.dog)return null;
  return trialLogs.some(t=>(bk.customerId&&t.cid?t.cid===bk.customerId:t.dog.toLowerCase()===bk.dog.toLowerCase())&&t.date>=bk.sd&&t.date<=(bk.ed||bk.sd));
}
function wfStepValue(bk,key){
  const sv=bk.wf||{};
  if(key==='logs'){const v=sv.logs;return v!==undefined&&v!==''?!!v:wfAutoLogs(bk);}
  if(key==='compat'){const v=sv.compat;return v!==undefined&&v!==''?!!v:wfAutoCompat(bk);}
  if(key==='review')return sv.review==='done'||sv.review==='na';
  return !!sv[key];
}
function wfCompletion(bk){
  if(!bk)return{done:0,total:WF_STEPS.length,pct:0,allDone:false};
  let done=0;
  WF_STEPS.forEach(s=>{if(wfStepValue(bk,s.k))done++;});
  return{done,total:WF_STEPS.length,pct:Math.round(done/WF_STEPS.length*100),allDone:done===WF_STEPS.length};
}
async function toggleWfStep(eid,key,checked){
  const bk=bookings.find(b=>b.id===eid);if(!bk)return;
  if(!bk.wf)bk.wf={};
  const prev=bk.wf[key];
  if(key==='review')bk.wf.review=checked?'done':'';
  else bk.wf[key]=checked?'1':'';
  try{await updateRow(TABS.BK,bk.ri,bkRowVals(bk));}catch(e){
    bk.wf[key]=prev;
    alert('Could not save to Google Sheet (check internet connection): '+e.message+'\nThe change was NOT saved — please try again.');
  }
  renderWfChecklist();updateStatusFlow();updatePendingBadge();
}
async function setWfReviewNA(eid,isNA){
  const bk=bookings.find(b=>b.id===eid);if(!bk)return;
  if(!bk.wf)bk.wf={};
  const prev=bk.wf.review;
  bk.wf.review=isNA?'na':'';
  try{await updateRow(TABS.BK,bk.ri,bkRowVals(bk));}catch(e){
    bk.wf.review=prev;
    alert('Could not save to Google Sheet (check internet connection): '+e.message+'\nThe change was NOT saved — please try again.');
  }
  renderWfChecklist();updateStatusFlow();updatePendingBadge();
}
function renderWfChecklist(){
  const c=document.getElementById('bm_workflow');if(!c)return;
  const eid=document.getElementById('bm_eid')?.value;
  if(!eid){c.innerHTML='<div style="font-size:9px;color:var(--gr3);">Save the booking first to track its workflow checklist.</div>';return;}
  const bk=bookings.find(b=>b.id===eid);if(!bk)return;
  const rows=WF_STEPS.map(s=>{
    const v=wfStepValue(bk,s.k);
    const auto=(s.k==='logs'||s.k==='compat')&&(bk.wf?.[s.k]===undefined||bk.wf?.[s.k]==='');
    const checked=v?'checked':'';
    const autoTag=auto?'<span style="font-size:8px;color:var(--gr3);margin-left:4px;">(auto)</span>':'';
    let extra='';
    if(s.k==='review')extra='<label style="display:flex;align-items:center;gap:5px;font-size:10px;cursor:pointer;margin:2px 0 6px 19px;"><input type="checkbox" '+(bk.wf?.review==='na'?'checked':'')+' onchange="setWfReviewNA(\''+eid+'\',this.checked)"> No review needed</label>';
    return'<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-bottom:4px;"><input type="checkbox" '+checked+' onchange="toggleWfStep(\''+eid+'\',\''+s.k+'\',this.checked)" style="width:13px;height:13px;accent-color:var(--gr);">'+s.l+autoTag+'</label>'+extra;
  }).join('');
  const comp=wfCompletion(bk);
  c.innerHTML='<div style="font-size:9px;font-weight:700;color:'+(comp.allDone?'var(--gn)':'var(--gr3)')+';margin-bottom:6px;">'+comp.done+'/'+comp.total+' steps complete'+(comp.allDone?' ✅':'')+'</div>'+rows;
}
// ==================== OVERLAP / COMPATIBILITY REMINDER (Trial-Log based) ====================
function renderOverlapCheck(){
  const c=document.getElementById('bm_overlap');if(!c)return;
  const dog=document.getElementById('bm_dog')?.value;
  const sd=document.getElementById('bm_sd')?.value;const st=document.getElementById('bm_st')?.value||'00:00';
  const ed=document.getElementById('bm_ed')?.value;const et=document.getElementById('bm_et')?.value||'23:59';
  if(!dog||!sd||!ed){c.innerHTML='<div style="font-size:9px;color:var(--gr3);">Select dog and dates to check overlaps.</div>';return;}
  const eid=document.getElementById('bm_eid')?.value;
  const qStart=new Date(sd+'T'+st);const qEnd=new Date(ed+'T'+et);
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const dogObj=allDogs.find(d=>d.name===dog);
  const overlaps=bookings.filter(b=>{
    if(b.id===eid)return false;
    if(!active.includes(b.status)||!b.sd)return false;
    if(dogObj&&b.customerId&&b.customerId===dogObj.cid)return false;
    if((!dogObj||!b.customerId)&&b.dog.toLowerCase()===dog.toLowerCase())return false;
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  if(!overlaps.length){c.innerHTML='<div style="font-size:9px;color:var(--gn);">✅ No other dogs booked during this period.</div>';return;}
  const seen=new Set();const names=overlaps.filter(b=>{const k=b.customerId||b.dog.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  const dogEsc=(dog||'').replace(/'/g,"\\'");
  const logBtn=dogObj?'<button type="button" class="sbtn2" style="margin-top:6px;font-size:10px;padding:6px 10px;" onclick="curDog=allDogs.find(d=>d.cid===\''+dogObj.cid+'\');openAddHistEntry(\'trial\',\''+sd+'\')">📝 Log full Trial-Log entry</button>':'';
  c.innerHTML='<div style="font-size:9px;color:var(--gr3);margin-bottom:5px;">⚠️ Other dogs staying during this period — log how they got on:</div>'+
    names.map(b=>{
      const mEsc=b.dog.replace(/'/g,"\\'");
      return '<div style="padding:5px 0;border-bottom:1px solid var(--gr4);">'
        +'<div style="font-size:11px;font-weight:600;color:var(--bk);">'+b.dog+' ('+fmtDate(b.sd)+' – '+fmtDate(b.ed)+')</div>'
        +'<div style="display:flex;gap:8px;margin-top:3px;align-items:center;flex-wrap:wrap;">'
        +'<label style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;"><input type="checkbox" onchange="if(this.checked)logCompatResult(\''+dogEsc+'\',\''+mEsc+'\',true,\'\');" style="width:13px;height:13px;accent-color:var(--gn);">👍 Happy together</label>'
        +'<button type="button" class="sbtn2" style="font-size:9px;padding:3px 8px;" onclick="toggleCompatNotes(this)">⚠️ Didn\'t get on</button>'
        +'</div>'
        +'<div class="compatNotes" style="display:none;margin-top:4px;"><textarea class="fta" style="min-height:40px;font-size:10px;" placeholder="What happened?"></textarea><button type="button" class="sbtn2" style="font-size:9px;margin-top:3px;" onclick="logCompatNotes(this,\''+dogEsc+'\',\''+mEsc+'\')">Save</button></div>'
        +'</div>';
    }).join('')+logBtn;
}
function toggleCompatNotes(btn){
  const box=btn.parentElement.nextElementSibling;
  box.style.display=box.style.display==='none'?'block':'none';
}
async function logCompatResult(dog,mixedDog,happy,notes){
  const dogObj=allDogs.find(d=>d.name===dog);if(!dogObj)return;
  const today=todayStr();const suitable=happy?'Suitable':'Not Suitable';const obs=notes||(happy?'Happy together':'');
  try{
    await appendRow(TABS.TRIAL,rowFromMap(trialHdrRow,{CustomerID:dogObj.cid,DogName:dog,Date:today,MixedWith:mixedDog,Observations:obs,Suitable:suitable,Private:''},TABS.TRIAL.h));
    trialLogs.push({cid:dogObj.cid,dog,date:today,mixedWith:mixedDog,obs,suitable});
  }catch(e){alert('Could not save to Google Sheet (check internet connection): '+e.message+'\nPlease try again.');return;}
  renderOverlapCheck();renderWfChecklist();updatePendingBadge();
}
function logCompatNotes(btn,dog,mixedDog){
  const ta=btn.previousElementSibling;
  const obs=ta.value.trim();
  if(!obs){alert('Please add notes about what happened.');return;}
  logCompatResult(dog,mixedDog,false,obs);
}
function updateDogIdHint(){const n=document.getElementById('bm_dog').value;const d=allDogs.find(x=>x.name===n);document.getElementById('bm_dog_id').textContent=d?d.cid:'';}
function updateStatusFlow(){const v=document.getElementById('bm_status')?.value||'';const steps=['quoted','booked','prepaid','fullypaid'];const statMap={Quoted:0,Booked:1,Prepaid:2,'Fully Paid':3};const cur=statMap[v]??-1;const isCancelled=v==='Cancelled';const isCompleted=v==='Completed';steps.forEach((s,i)=>{const el=document.getElementById('bsf_'+s);if(!el)return;el.className='bk-flow-step';el.style.opacity='';if(isCancelled){el.style.opacity='0.3';return;}if(isCompleted){el.classList.add('fsdone');return;}if(cur<0)return;if(i<cur)el.classList.add('fsdone');else if(i===cur)el.classList.add('fsactive');});const cancelEl=document.getElementById('bsf_cancelled');const completeEl=document.getElementById('bsf_completed');if(cancelEl)cancelEl.style.display=isCancelled?'inline-block':'none';if(completeEl)completeEl.style.display=isCompleted?'inline-block':'none';
  const warnEl=document.getElementById('bm_status_warn');
  if(warnEl){
    if(isCompleted){
      const eid=document.getElementById('bm_eid')?.value;const bk=eid?bookings.find(b=>b.id===eid):null;
      const comp=bk?wfCompletion(bk):{allDone:false,done:0,total:WF_STEPS.length};
      warnEl.style.display=comp.allDone?'none':'block';
      warnEl.textContent='⚠️ Workflow checklist incomplete ('+comp.done+'/'+comp.total+'). Scroll down to finish before marking Completed.';
    }else warnEl.style.display='none';
  }
}
function calcBal(){const rev=parseFloat(document.getElementById('bm_rev').value)||0;const tips=parseFloat(document.getElementById('bm_tips').value)||0;const pre=parseFloat(document.getElementById('bm_prepay').value)||0;const fin=parseFloat(document.getElementById('bm_final').value)||0;const owed=rev+tips;const paid=pre+fin;const bal=paid-owed;document.getElementById('bm_owed').textContent=fmtGBP(owed);document.getElementById('bm_paid').textContent=fmtGBP(paid);const balEl=document.getElementById('bm_bal');balEl.textContent=(bal>=0?'+':'')+fmtGBP(bal);balEl.style.color=bal>0?'var(--gn)':bal<0?'var(--rd)':'var(--gr2)';}
function calcRover(){const rev=parseFloat(document.getElementById('bm_rev').value)||0;const pct=parseFloat(document.getElementById('bm_rpct').value)||0;document.getElementById('bm_ramt').value=(rev*pct/100).toFixed(2);}
function toggleRover(){const isR=document.getElementById('bm_channel').value==='Rover';document.getElementById('bm_rover_row').style.display=isR?'grid':'none';if(isR)calcRover();}
async function saveBk(){
  const dog=document.getElementById('bm_dog').value;if(!dog){alert('Select a dog');return;}
  const btn=document.getElementById('bkBtn');const st=document.getElementById('bkStatus');btn.disabled=true;btn.textContent='Saving...';
  const eid=document.getElementById('bm_eid').value;let ri=parseInt(document.getElementById('bm_ridx').value)||null;
  if(eid&&!ri){const existing=bookings.find(b=>b.id===eid);if(existing?.ri)ri=existing.ri;}
  const rev=parseFloat(document.getElementById('bm_rev').value)||0;const tips=parseFloat(document.getElementById('bm_tips').value)||0;const pre=parseFloat(document.getElementById('bm_prepay').value)||0;const fin=parseFloat(document.getElementById('bm_final').value)||0;const unit=parseFloat(document.getElementById('bm_unit').value)||0;
  const ch=document.getElementById('bm_channel').value;const rPct=ch==='Rover'?(parseFloat(document.getElementById('bm_rpct').value)||0):0;const rAmt=ch==='Rover'?(parseFloat(document.getElementById('bm_ramt').value)||0):0;
  const priv=document.getElementById('bm_priv').checked;const id=eid||nextBkId();const rems=eid?(bookings.find(b=>b.id===eid)?.rem||['','','','','']):['','','','',''];
  const sd=document.getElementById('bm_sd').value;const month=sd?new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'}):'';
  const dogData=allDogs.find(d=>d.name===dog);const customerId=dogData?dogData.cid:'';
  const existingWf=eid?(bookings.find(b=>b.id===eid)?.wf||{}):{};
  const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId,dog:dog,id,svc:document.getElementById('bm_svc').value,sd,st:document.getElementById('bm_st').value,ed:document.getElementById('bm_ed').value,et:document.getElementById('bm_et').value,dropLoc:gv('bm_drop_loc'),pickLoc:gv('bm_pick_loc'),rev,tips,prepay:pre,finalPay:fin,unit,discNotes:document.getElementById('bm_disc_notes').value,roverPct:rPct,roverAmt:rAmt,ch,pay:document.getElementById('bm_pay').value,status:document.getElementById('bm_status').value,priv,month,rating:gv('bm_rating'),feedback:gv('bm_feedback'),rem:rems,wf:existingWf,bookingRef:gv('bm_ref'),prepayRef:gv('bm_prepay_ref'),finalPayRef:gv('bm_final_ref')}),TABS.BK.h);
  try{
    if(eid&&ri)await updateRow(TABS.BK,ri,vals);else await appendRow(TABS.BK,vals);
    const mv=[...vals];mv[1]=dog;const bkObj=mapBk(mv,eid?ri-2:bookings.length);if(eid){const idx=bookings.findIndex(r=>r.id===eid);if(idx>=0)bookings[idx]=bkObj;}else bookings.push(bkObj);
    st.textContent='Saved!';st.className='smsg ok';setTimeout(()=>{document.getElementById('bkModal').classList.remove('open');renderBk();if(curDog)buildServices(curDog);updatePL();renderBoard();updatePendingBadge();},1400);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent=eid?'Modify Booking':'Save Booking';}
}
function confirmDeleteBk(){const eid=document.getElementById('bm_eid').value;const ri=parseInt(document.getElementById('bm_ridx').value)||null;_delBkId=eid;_delBkRi=ri;document.getElementById('deleteBkInput').value='';document.getElementById('deleteBkConfirm').classList.add('open');}
async function doDeleteBk(){
  if(document.getElementById('deleteBkInput').value.trim()!=='DELETE'){alert('Type DELETE to confirm');return;}
  document.getElementById('deleteBkConfirm').classList.remove('open');
  if(_delBkRi){try{await clearRow(TABS.BK,_delBkRi);}catch(e){alert('Error: '+e.message);return;}}
  bookings=bookings.filter(b=>b.id!==_delBkId);document.getElementById('bkModal').classList.remove('open');renderBk();if(curDog)buildServices(curDog);updatePL();
}
function renderBk(){
  const sf=document.getElementById('bkSF').value;const vf=document.getElementById('bkVF').value;const search=(document.getElementById('bkSearch').value||'').toLowerCase();const from=document.getElementById('bkFrom').value;const to=document.getElementById('bkTo').value;const today=todayStr();
  let recs=[...bookings];
  if(sf==='live')recs=recs.filter(r=>r.ed>=today&&!['Cancelled','Canceled'].includes(r.status));else if(sf)recs=recs.filter(r=>r.status===sf);
  if(vf)recs=recs.filter(r=>r.svc===vf);if(search)recs=recs.filter(r=>r.dog.toLowerCase().includes(search));if(from)recs=recs.filter(r=>r.sd>=from);if(to)recs=recs.filter(r=>r.sd<=to);
  recs.sort((a,b)=>a.sd.localeCompare(b.sd));document.getElementById('bkCount').textContent=recs.length+' booking'+(recs.length!==1?'s':'');
  if(!recs.length){document.getElementById('bkBody').innerHTML='<tr><td colspan="7" style="text-align:center;padding:13px;color:var(--gr3);">No bookings</td></tr>';return;}
  const sc={'Quoted':'sq','Booked':'sb','Prepaid':'spp','Fully Paid':'sf','Credit':'scr','Canceled':'sc','Cancelled':'sc','Completed':'sf'};
  document.getElementById('bkBody').innerHTML=recs.map(r=>{
    const owed=(r.rev||0)+(r.tips||0);const paid=(r.prepay||0)+(r.finalPay||0);const bal=paid-owed;
    const oc="openBkModal('"+r.id+"')";
    return'<tr onclick="'+oc+'"><td>'+(r.priv?'🔒 ':'')+r.dog+'</td><td style="font-size:8px;">'+r.svc+'</td><td style="font-size:8px;white-space:nowrap;">'+fmtDate(r.sd)+'<br>'+fmtDate(r.ed)+'</td><td style="font-weight:700;">'+fmtGBP(owed)+'</td><td style="color:var(--gn);">'+fmtGBP(paid)+'</td><td style="font-weight:700;'+(bal>0?'color:var(--gn)':bal<0?'color:var(--rd)':'color:var(--gr2)')+';">'+(bal>0?'+':'')+fmtGBP(bal)+'</td><td><span class="spill '+(sc[r.status]||'sb')+'">'+r.status+'</span></td></tr>';
  }).join('');
}

// ==================== COSTS ====================
const COST_CATS=['Boarding License','Pet Insurance','PACT CTI Course','Business Phone','Tractive Subscription','Dog Field Booking','Poo Bags','Marketing','Rover Commission','Other'];
function initCostFilters(){
  // Populate category filter
  const fc=document.getElementById('cost_fCat');if(!fc)return;fc.innerHTML='<option value="">All Categories</option>'+COST_CATS.map(c=>'<option>'+c+'</option>').join('');
  // Default to current year + current month
  const now=new Date();const yr=String(now.getFullYear());const mo=String(now.getMonth()+1).padStart(2,'0');
  const fy=document.getElementById('cost_fYear');const fm=document.getElementById('cost_fMonth');
  if(fy)fy.value=yr;if(fm)fm.value=mo;
}
function getFilteredCosts(){
  const fy=document.getElementById('cost_fYear')?.value||'';const fm=document.getElementById('cost_fMonth')?.value||'';const fc=document.getElementById('cost_fCat')?.value||'';
  return costs.filter(c=>{const nd=normDate(c.date);if(fy&&!nd.startsWith(fy))return false;if(fm&&nd.slice(5,7)!==fm)return false;if(fc&&c.cat!==fc)return false;return true;});
}
function drawCostPie(filtered){
  const bycat={};filtered.forEach(c=>{bycat[c.cat]=(bycat[c.cat]||0)+(c.amount||0);});
  const total=Object.values(bycat).reduce((s,v)=>s+v,0);
  const svgEl=document.getElementById('costPieSvg');const legEl=document.getElementById('costPieLegend');if(!svgEl||!legEl)return;
  if(!total){svgEl.innerHTML='<text x="100" y="105" text-anchor="middle" font-size="11" fill="#A8A29E">No data</text>';legEl.innerHTML='';return;}
  const cols=['#F97316','#3B82F6','#22C55E','#EF4444','#A855F7','#EAB308','#14B8A6','#F43F5E','#6366F1','#64748B'];
  const entries=Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
  let angle=-Math.PI/2;let paths='';let legend='';
  entries.forEach(([cat,amt],i)=>{const pct=amt/total;const sweep=pct*2*Math.PI;const x1=100+80*Math.cos(angle),y1=100+80*Math.sin(angle),x2=100+80*Math.cos(angle+sweep),y2=100+80*Math.sin(angle+sweep);const large=sweep>Math.PI?1:0;const col=cols[i%cols.length];paths+='<path d="M100,100 L'+x1.toFixed(1)+','+y1.toFixed(1)+' A80,80 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' Z" fill="'+col+'" opacity="0.85"/>';legend+='<div style="display:flex;align-items:center;gap:5px;font-size:8px;color:var(--gr);"><div style="width:8px;height:8px;border-radius:2px;background:'+col+';flex-shrink:0;"></div><span>'+cat+'</span><span style="color:var(--gr3);margin-left:auto;">'+fmtGBP(amt)+' ('+Math.round(pct*100)+'%)</span></div>';angle+=sweep;});
  paths+='<circle cx="100" cy="100" r="42" fill="white"/><text x="100" y="97" text-anchor="middle" font-size="10" font-weight="700" fill="#44403C">'+fmtGBP(total)+'</text><text x="100" y="110" text-anchor="middle" font-size="8" fill="#A8A29E">Total</text>';
  svgEl.innerHTML=paths;legEl.innerHTML=legend;
}
function renderCostTable(){
  if(!document.getElementById('cost_fYear')?.value&&!document.getElementById('cost_fMonth')?.value)initCostFilters();
  const filtered=getFilteredCosts();drawCostPie(filtered);
  const inStyle='border:none;background:transparent;font-size:9px;font-family:var(--fb);color:var(--gr);outline:none;';
  document.getElementById('costBody').innerHTML=filtered.map(c=>{const i=costs.indexOf(c);return'<tr><td><input type="date" value="'+(normDate(c.date)||'')+'" oninput="costs['+i+'].date=this.value" style="'+inStyle+'width:100px;"></td><td><select onchange="costs['+i+'].cat=this.value" style="'+inStyle+'">'+COST_CATS.map(o=>'<option'+(o===c.cat?' selected':'')+'>'+o+'</option>').join('')+'</select></td><td><input type="number" value="'+(c.amount||0)+'" oninput="costs['+i+'].amount=parseFloat(this.value)||0" style="'+inStyle+'width:56px;"></td><td><input type="text" value="'+(c.notes||'')+'" oninput="costs['+i+'].notes=this.value" style="'+inStyle+'width:100px;"></td><td style="white-space:nowrap;"><button onclick="dupCostRow('+i+')" title="Duplicate" style="background:none;border:none;cursor:pointer;color:var(--or);font-size:13px;padding:0 3px;">⧉</button><button onclick="costs.splice('+i+',1);renderCostTable()" style="background:none;border:none;cursor:pointer;color:var(--rd);font-size:13px;padding:0;">✕</button></td></tr>';}).join('');
}
function dupCostRow(i){const o=costs[i];costs.push({date:o.date,cat:o.cat,amount:o.amount,notes:o.notes,ri:null});renderCostTable();document.getElementById('costBody').lastElementChild?.scrollIntoView({behavior:'smooth'});}
function addCostRow(){costs.push({date:todayStr(),cat:'Other',amount:0,notes:'',ri:null});renderCostTable();document.getElementById('costBody').lastElementChild?.scrollIntoView({behavior:'smooth'});}
async function saveCosts(){const st=document.getElementById('costStatus');st.textContent='Saving...';st.className='smsg';try{const upd=costs.filter(c=>c.ri).map(c=>({ri:c.ri,vals:rowFromMap(costsHdrRow,{Date:c.date,Category:c.cat,Amount:c.amount,Notes:c.notes},TABS.COSTS.h)}));const newc=costs.filter(c=>!c.ri);if(upd.length)await batchUpd(TABS.COSTS,upd);for(const c of newc)await appendRow(TABS.COSTS,rowFromMap(costsHdrRow,{Date:c.date,Category:c.cat,Amount:c.amount,Notes:c.notes},TABS.COSTS.h));st.textContent='All costs saved!';st.className='smsg ok';setTimeout(()=>st.className='smsg',3000);updatePL();}catch(e){st.textContent=e.message;st.className='smsg err';}}

// ==================== P&L ====================
function getTargets(yr){const s=JSON.parse(localStorage.getItem('tcl_tgts_'+yr)||'{}');const res={};MOS.forEach(m=>{res[m]={rev:s[m+'_r']||0,cost:s[m+'_c']||0};});return res;}
async function syncTargetsFromSheet(){
  const rows=await readSheet(TABS.TARGETS,'A2:C').catch(()=>[]);
  if(!rows.length)return;
  const byYear={};
  rows.forEach(r=>{if(!r[0])return;const parts=r[0].trim().split(' ');const mo=parts[0];const yr=parts[1]||'2026';if(!MOS.includes(mo))return;if(!byYear[yr])byYear[yr]={};byYear[yr][mo+'_r']=parseFloat(r[1])||0;byYear[yr][mo+'_c']=parseFloat(r[2])||0;});
  Object.entries(byYear).forEach(([yr,data])=>{localStorage.setItem('tcl_tgts_'+yr,JSON.stringify(data));});
}
function buildPLTable(yr){
  const tgts=getTargets(yr);const monthly={};MOS.forEach(m=>{monthly[m]={rev:0,cost:0,rover:0};});
  const active=['Prepaid','Fully Paid','Credit'];
  bookings.forEach(r=>{const ned=normDate(r.ed);if(!ned||!ned.startsWith(yr))return;const mo=new Date(ned+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo]){monthly[mo].rev+=actualRev(r);if(active.includes(r.status))monthly[mo].rover+=(r.roverAmt||0);}});
  costs.forEach(c=>{const nd=normDate(c.date);if(!nd||!nd.startsWith(yr))return;const mo=new Date(nd+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo])monthly[mo].cost+=(c.amount||0);});
  document.getElementById('plTbl').innerHTML=MOS.map(m=>{const tgt=tgts[m];const act=monthly[m];const totalCost=act.cost+act.rover;const net=act.rev-totalCost;
    return'<tr><td style="font-weight:700;">'+m+'</td><td><input class="pl-inp" type="number" id="tr_'+m+'" value="'+tgt.rev+'"></td><td><input class="pl-inp" type="number" id="tc_'+m+'" value="'+tgt.cost+'"></td><td style="color:var(--gn);font-weight:700;">'+fmtGBP(act.rev)+'</td><td style="color:var(--rd);">'+fmtGBP(totalCost)+(act.rover>0?'<br><span style="font-size:7px;color:var(--gr3);">incl '+fmtGBP(act.rover)+' Rover</span>':'')+'</td><td style="font-weight:700;'+(net>=0?'color:var(--gn)':'color:var(--rd)')+';">'+fmtGBP(net)+'</td></tr>';
  }).join('');
}
async function saveTargets(){
  const yr=document.getElementById('plYear').value;const data={};
  MOS.forEach(m=>{data[m+'_r']=parseFloat(document.getElementById('tr_'+m)?.value)||0;data[m+'_c']=parseFloat(document.getElementById('tc_'+m)?.value)||0;});
  localStorage.setItem('tcl_tgts_'+yr,JSON.stringify(data));
  const st=document.getElementById('tgtStatus');st.textContent='Saving...';st.className='smsg';
  try{
    const rows=await readSheet(TABS.TARGETS,'A2:C').catch(()=>[]);
    const updates=[];const newRows=[];
    MOS.forEach(m=>{const label=m+' '+yr;const rev=data[m+'_r'];const cost=data[m+'_c'];const idx=rows.findIndex(r=>r[0]===label);if(idx>=0)updates.push({ri:idx+2,vals:[label,rev,cost]});else newRows.push([label,rev,cost]);});
    if(updates.length)await batchUpd(TABS.TARGETS,updates);
    for(const r of newRows)await appendRow(TABS.TARGETS,r);
    st.textContent='Targets saved & synced!';st.className='smsg ok';
  }catch(e){st.textContent='Saved locally (sheet sync failed)';st.className='smsg err';}
  updatePL();setTimeout(()=>st.className='smsg',3000);
}
function updatePL(){
  const yr=document.getElementById('plYear')?.value||'2026';const tgts=getTargets(yr);const revTgt=Object.values(tgts).reduce((s,t)=>s+t.rev,0);const costTgt=Object.values(tgts).reduce((s,t)=>s+t.cost,0);
  const active=['Prepaid','Fully Paid','Credit'];const yRec=bookings.filter(r=>r.ed&&normDate(r.ed).startsWith(yr));const normCosts=costs.map(c=>({...c,_nd:normDate(c.date)}));
  const totalRev=yRec.reduce((s,r)=>s+actualRev(r),0);const totalRover=yRec.filter(r=>active.includes(r.status)).reduce((s,r)=>s+(r.roverAmt||0),0);
  const totalCost=normCosts.filter(c=>c._nd&&c._nd.startsWith(yr)).reduce((s,c)=>s+(c.amount||0),0)+totalRover;const net=totalRev-totalCost;const pct=revTgt>0?(totalRev/revTgt*100):0;
  document.getElementById('kpi_rev').textContent=fmtGBP(totalRev);document.getElementById('kpi_rev_s').textContent='vs '+fmtGBP(revTgt)+' target';
  document.getElementById('kpi_pct').textContent=pct.toFixed(1)+'%';document.getElementById('kpi_cost').textContent=fmtGBP(totalCost);
  document.getElementById('kpi_cost_s').textContent='vs '+fmtGBP(costTgt)+' target'+(totalRover>0?' (incl '+fmtGBP(totalRover)+' Rover)':'');
  document.getElementById('kpi_net').textContent=fmtGBP(net);buildPLTable(yr);drawChart(yr,tgts);
}
function drawChart(yr,tgts){
  const monthly={};MOS.forEach(m=>{monthly[m]={rev:0,cost:0};});const active=['Prepaid','Fully Paid','Credit'];
  bookings.forEach(r=>{const ned=normDate(r.ed);if(!ned||!ned.startsWith(yr))return;const mo=new Date(ned+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo]){monthly[mo].rev+=actualRev(r);if(active.includes(r.status))monthly[mo].cost+=(r.roverAmt||0);}});
  costs.forEach(c=>{const nd=normDate(c.date);if(!nd||!nd.startsWith(yr))return;const mo=new Date(nd+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo])monthly[mo].cost+=(c.amount||0);});
  const rd=MOS.map(m=>monthly[m].rev);const cd=MOS.map(m=>monthly[m].cost);const rt=MOS.map(m=>tgts[m].rev);const ct=MOS.map(m=>tgts[m].cost);
  const maxV=Math.max(...rd,...cd,...rt,...ct,100);const W=560,H=190,PL=40,PR=14,PT=14,PB=26;const cW=W-PL-PR,cH=H-PT-PB;
  const xi=i=>PL+i*(cW/(MOS.length-1));const yi=v=>PT+cH-(v/maxV*cH);
  let g='';[0,.25,.5,.75,1].forEach(ratio=>{const yy=PT+cH-ratio*cH;g+='<line x1="'+PL+'" y1="'+yy+'" x2="'+(W-PR)+'" y2="'+yy+'" stroke="#E7E5E4" stroke-width="1"/>';if(ratio>0)g+='<text x="'+(PL-4)+'" y="'+(yy+3)+'" font-size="8" fill="#A8A29E" text-anchor="end">'+(maxV*ratio).toFixed(0)+'</text>';});
  const lbl=MOS.map((m,i)=>'<text x="'+xi(i)+'" y="'+(H-5)+'" font-size="8" fill="#A8A29E" text-anchor="middle">'+m+'</text>').join('');
  const poly=(pts,col,dash)=>'<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
  const dots=rd.map((v,i)=>'<circle cx="'+xi(i)+'" cy="'+yi(v)+'" r="3" fill="#F97316"/>').join('');
  document.getElementById('plChart').innerHTML='<g font-family="system-ui,sans-serif">'+g+poly(rt.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#FED7AA','4,3')+poly(ct.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#7DD3FC','3,3')+poly(cd.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#1E40AF')+poly(rd.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#F97316')+dots+lbl+'</g>';
}

// ==================== TRAINING ====================
let trainRecords=[];
async function submitTraining(){
  const who=gv('st_who');if(!who){alert('Select staff member');return;}
  const btn=document.querySelector('[onclick="submitTraining()"]');const st=document.getElementById('stStatus');if(btn)btn.disabled=true;
  const eid=gv('st_eid');const ri=parseInt(gv('st_ridx'))||null;
  const vals=[gv('st_date'),who,gv('st_cat'),gv('st_obj'),gv('st_prov'),gv('st_learnt'),gv('st_cpd'),gv('st_link'),''];
  try{
    if(eid&&ri)await updateRow(TABS.TRAIN,ri,vals);else await appendRow(TABS.TRAIN,vals);
    st.textContent=eid?'Updated!':'Saved!';st.className='smsg ok';
    ['st_obj','st_prov','st_learnt','st_cpd','st_link'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const eidEl=document.getElementById('st_eid');if(eidEl)eidEl.value='';
    const ridxEl=document.getElementById('st_ridx');if(ridxEl)ridxEl.value='';
    if(btn){btn.textContent='Save Record';}
    await loadTraining();setTimeout(()=>st.className='smsg',3000);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{if(btn)btn.disabled=false;}
}
function editTrainingRow(ri,r){
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  s('st_eid',ri);s('st_ridx',ri);s('st_date',r[0]);s('st_who',r[1]);s('st_cat',r[2]);s('st_obj',r[3]);s('st_prov',r[4]);s('st_learnt',r[5]);s('st_cpd',r[6]);s('st_link',r[7]);
  const btn=document.querySelector('[onclick="submitTraining()"]');if(btn)btn.textContent='Update Record';
  const stEl=document.getElementById('stStatus');if(stEl){stEl.textContent='Editing record...';stEl.className='smsg';}
  const form=document.getElementById('stForm');if(form)form.scrollIntoView({behavior:'smooth'});
}
async function loadTraining(){
  const list=document.getElementById('stList');list.innerHTML='<div class="hload">Loading...</div>';
  try{
    const rows=await readSheet(TABS.TRAIN,'A2:I');
    trainRecords=rows.map((r,i)=>({ri:i+2,date:r[0]||'',staff:r[1]||'',cat:r[2]||'',obj:r[3]||'',prov:r[4]||'',learnt:r[5]||'',cpd:r[6]||'',link:r[7]||''}));
    list.innerHTML=trainRecords.slice().reverse().map(r=>{
      const rd=JSON.stringify([r.date,r.staff,r.cat,r.obj,r.prov,r.learnt,r.cpd,r.link]).replace(/'/g,"\\'");
      return '<div class="hi"><div class="hi-h"><span class="hi-d">'+r.date+'</span><span style="font-size:9px;font-weight:700;color:var(--gr);">'+r.staff+'</span>'+(r.cat?'<span class="htype hti">'+r.cat+'</span>':'')+'<button class="ebtn" style="margin-left:auto;" onclick="editTrainingRow('+r.ri+','+rd+')">Edit</button></div>'+(r.obj?'<div class="hsum">'+r.obj+'</div>':'')+(r.cpd?'<div style="font-size:8px;color:var(--gn);margin-top:2px;">CPD: '+r.cpd+' pts</div>':'')+(r.link?'<div style="font-size:8px;margin-top:2px;"><a href="'+r.link+'" target="_blank" style="color:var(--bl);">Link</a></div>':'')+'</div>';
    }).join('')||'<div class="hload">No records</div>';
  }catch(e){list.innerHTML='<div class="hload" style="color:var(--rd)">'+e.message+'</div>';}
}
function exportTraining(){const recs=trainRecords.length?trainRecords:[{date:'',staff:'No records - tap Load first',cat:'',obj:'',prov:'',learnt:'',cpd:'',cert:''}];const rows=[['THE CUDDLY LANE - Staff Training Log'],['AWLA Licence: AWLA/124654'],[''],['Date','Staff Member','Category','Development Objective','Course Provider','What I Learnt','CPD Points','Certificate Link'],...recs.map(r=>[r.date,r.staff,r.cat,r.obj,r.prov,r.learnt,r.cpd,r.cert])];const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='TCL-Training-'+todayStr()+'.csv';a.click();}

// ==================== MESSAGE TEMPLATES ====================
function saveMsgTpls(){localStorage.setItem('tcl_msg_tpls',JSON.stringify(msgTpls));}
function setTplCat(cat){_tplCat=cat;document.querySelectorAll('.tpl-cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));renderTplHub();}
function renderTplHub(){
  const el=document.getElementById('tplHubList');if(!msgTpls.length){el.innerHTML='<div class="hload">No templates - tap + New or wait for sync</div>';return;}
  const filtered=_tplCat?msgTpls.filter(t=>(t.cat||'').toLowerCase()===_tplCat.toLowerCase()):msgTpls;
  if(!filtered.length){el.innerHTML='<div class="hload">No templates in this category</div>';return;}
  el.innerHTML='';
  filtered.forEach((tpl,i)=>{
    const realIdx=msgTpls.indexOf(tpl);
    const item=document.createElement('div');item.className='tpl-item';item.draggable=true;
    item.innerHTML='<span class="tpl-drag">::::</span><div class="tpl-info"><div class="tpl-nm">'+tpl.name+'</div>'+(tpl.cat?'<div style="font-size:8px;color:var(--or);margin-bottom:2px;">'+tpl.cat+'</div>':'')+'<div class="tpl-pv">'+(tpl.content||'').slice(0,80)+'</div></div>'
      +'<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">'
      +'<button class="tpl-copy-btn" onclick="event.stopPropagation();openCopyTpl('+realIdx+')" style="background:var(--pu);color:#fff;border:none;border-radius:6px;font-size:10px;padding:4px 8px;cursor:pointer;font-family:var(--fb);">Copy</button>'
      +'<button onclick="event.stopPropagation();delTplHub('+realIdx+')" style="background:none;border:none;cursor:pointer;color:var(--rd);font-size:11px;padding:2px 0;">Delete</button>'
      +'</div>';
    item.onclick=(e)=>{if(!e.target.closest('button')&&!e.target.classList.contains('tpl-drag'))openTplHub(realIdx);};
    item.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',realIdx);item.style.opacity='.5';});
    item.addEventListener('dragend',()=>item.style.opacity='1');
    item.addEventListener('dragover',e=>{e.preventDefault();item.style.borderColor='var(--or)';});
    item.addEventListener('dragleave',()=>item.style.borderColor='');
    item.addEventListener('drop',e=>{e.preventDefault();item.style.borderColor='';const fromReal=parseInt(e.dataTransfer.getData('text/plain'));if(fromReal===realIdx)return;const moved=msgTpls.splice(fromReal,1)[0];msgTpls.splice(realIdx,0,moved);saveMsgTpls();renderTplHub();});
    el.appendChild(item);
  });
}
async function delTplHub(idx){
  const tpl=msgTpls[idx];if(!tpl)return;
  if(!confirm('Delete this template?'))return;
  msgTpls.splice(idx,1);saveMsgTpls();renderTplHub();
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D').catch(()=>[]);
    const ri=rows.findIndex(r=>r[0]===tpl.name);
    if(ri>=0)await clearRow(TABS.TPLS,ri+2);
  }catch(e){}
}
function openCopyTpl(idx){
  const tpl=msgTpls[idx];if(!tpl)return;
  const content=tpl.content||'';
  const vars=[...new Set((content.match(/\{\{(\w+)\}\}/g)||[]).map(m=>m.slice(2,-2)))];
  document.getElementById('ctpl_title').textContent=tpl.name;
  document.getElementById('ctpl_idx').value=idx;
  const fEl=document.getElementById('ctpl_fields');
  const varLabels={ownerName:'Owner name',dogs:'Dog name(s)',dropoff:'Drop-off date',pickup:'Pick-up date',dropoffTime:'Drop-off time',pickupTime:'Pick-up time',service:'Service',total:'Total amount',prepayAmt:'Prepayment amount',finalAmt:'Balance due',payRef:'Payment reference',payLink:'Payment link',rateBlock:'Rate block',discount:'Discount line'};
  if(vars.length){
    fEl.innerHTML=vars.map(v=>'<div style="margin-bottom:7px;"><label style="font-size:10px;color:var(--gr2);font-weight:600;display:block;margin-bottom:3px;">'+(varLabels[v]||v)+'</label><input class="fi" id="ctplv_'+v+'" placeholder="Enter '+(varLabels[v]||v)+'..." style="font-size:11px;" oninput="updateCopyPreview('+idx+')"></div>').join('');
    if(curDog){const e=document.getElementById('ctplv_ownerName');if(e)e.value=curDog.owner||'';const f=document.getElementById('ctplv_dogs');if(f)f.value=curDog.name||'';}
  }else{
    fEl.innerHTML='<div style="font-size:10px;color:var(--gr3);margin-bottom:8px;padding:8px;background:var(--gr5);border-radius:8px;">No personalised fields — ready to copy.</div>';
  }
  updateCopyPreview(idx);
  document.getElementById('copyTplPanel').classList.add('open');
}
function updateCopyPreview(idx){
  const tpl=msgTpls[idx];if(!tpl)return;
  let msg=tpl.content||'';
  const vars=[...new Set((msg.match(/\{\{(\w+)\}\}/g)||[]).map(m=>m.slice(2,-2)))];
  vars.forEach(v=>{const el=document.getElementById('ctplv_'+v);const val=el&&el.value?el.value:'{{'+v+'}}';msg=msg.replace(new RegExp('\\{\\{'+v+'\\}\\}','g'),val);});
  document.getElementById('ctpl_preview').value=msg;
}
function doCopyTpl(){
  const msg=document.getElementById('ctpl_preview').value;
  copyText(msg);
  const btn=document.getElementById('ctpl_copybtn');btn.textContent='Copied! ✓';btn.style.background='var(--gn)';
  setTimeout(()=>{btn.textContent='Copy';btn.style.background='';},2000);
}
function openTplHub(idx){document.getElementById('tpl_eidx').value=idx!==null?idx:'';document.getElementById('tplMTitle').textContent=idx!==null?'Edit Template':'New Template';document.getElementById('tpl_name').value=idx!==null?msgTpls[idx].name:'';document.getElementById('tpl_cat').value=idx!==null?(msgTpls[idx].cat||''):'';document.getElementById('tpl_content').value=idx!==null?msgTpls[idx].content:'';document.getElementById('tplModal').classList.add('open');}
async function saveTplHub(){
  const name=document.getElementById('tpl_name').value.trim();if(!name){alert('Template name required');return;}
  const content=document.getElementById('tpl_content').value;const cat=document.getElementById('tpl_cat').value;
  if(!cat){alert('Category is required');return;}
  const idx2=document.getElementById('tpl_eidx').value;const st=document.getElementById('tplHubStatus');
  let oldName='';
  if(idx2!==''){const prev=msgTpls[parseInt(idx2)];oldName=prev.name;msgTpls[parseInt(idx2)]={...prev,_prev:{name:prev.name,content:prev.content,cat:prev.cat||''},name,content,cat};}
  else{msgTpls.push({name,content,cat});}
  saveMsgTpls();st.textContent='Saving...';st.className='smsg';
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D').catch(()=>[]);
    const lookupName=oldName||name;
    const existIdx=rows.findIndex(r=>r[0]===lookupName);
    if(existIdx>=0){await updateRow(TABS.TPLS,existIdx+2,[name,cat,content,new Date().toISOString()]);}
    else{await appendRow(TABS.TPLS,[name,cat,content,new Date().toISOString()]);}
    st.textContent='Saved & synced!';st.className='smsg ok';
  }catch(e){st.textContent='Saved locally (sheet: '+e.message+')';st.className='smsg err';}
  setTimeout(()=>{st.className='smsg';renderTplHub();document.getElementById('tplModal').classList.remove('open');},1800);
}
function redoTplHub(){const idx=document.getElementById('tpl_eidx').value;if(idx!==''){const t=msgTpls[parseInt(idx)];if(t._prev){document.getElementById('tpl_name').value=t._prev.name;document.getElementById('tpl_content').value=t._prev.content;document.getElementById('tpl_cat').value=t._prev.cat||'';alert('Reverted.');}else alert('No previous version.');}else alert('Save first.');}
async function syncTplsFromSheet(){
  const el=document.getElementById('tplHubList');el.innerHTML='<div class="hload">Syncing...</div>';
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D');
    const sheetTpls=rows.map(r=>({name:r[0]||'',cat:r[1]||'',content:r[2]||'',_updated:r[3]||''})).filter(t=>t.name);
    // Push any local-only templates up to the sheet first (one-time migration).
    // This prevents templates that were never synced from being wiped on read-back.
    const localOnly=msgTpls.filter(t=>t.name&&!sheetTpls.some(s=>s.name===t.name));
    for(const t of localOnly){await appendRow(TABS.TPLS,[t.name,t.cat||'',t.content||'',new Date().toISOString()]).catch(()=>{});}
    // Sheet is now the single source of truth — full replace from sheet.
    const allSheetTpls=localOnly.length?[...sheetTpls,...localOnly]:sheetTpls;
    if(allSheetTpls.length){msgTpls=allSheetTpls;saveMsgTpls();}
    renderTplHub();
  }catch(e){el.innerHTML='<div class="hload" style="color:var(--rd)">'+e.message+'</div>';}
}

// ==================== ACTIVITIES ====================
function saveActivities(){localStorage.setItem('tcl_acts',JSON.stringify(activities));}
function loadActivities(){activities=JSON.parse(localStorage.getItem('tcl_acts')||'[]');}
function setActMainCat(cat){_actMainCat=cat;document.querySelectorAll('.act-main-cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));renderActs();}
function getFilteredActs(){
  const cat=_actMainCat||'';const io=document.getElementById('act_fIO')?.value||'';const energy=document.getElementById('act_fEnergy')?.value||'';const weather=document.getElementById('act_fWeather')?.value||'';
  const maxDur=parseFloat(document.getElementById('act_fDur')?.value)||Infinity;const maxDist=parseFloat(document.getElementById('act_fDist')?.value)||Infinity;const maxCost=parseFloat(document.getElementById('act_fCost')?.value)||Infinity;
  return activities.filter(a=>{if(cat&&a.cat!==cat)return false;if(io&&a.io!==io)return false;if(energy&&a.energy!==energy)return false;if(weather&&a.weather!==weather)return false;if(maxDur<Infinity&&(parseFloat(a.dur)||0)>maxDur)return false;if(maxDist<Infinity&&(parseFloat(a.dist)||0)>maxDist)return false;if(maxCost<Infinity&&(parseFloat(a.cost)||0)>maxCost)return false;return true;});
}
function sortActs(acts){
  const sortBy=document.getElementById('act_sort')?.value||'title';
  if(sortBy==='cost')return acts.slice().sort((a,b)=>(parseFloat(a.cost)||0)-(parseFloat(b.cost)||0));
  if(sortBy==='drive')return acts.slice().sort((a,b)=>(parseFloat(a.dist)||0)-(parseFloat(b.dist)||0));
  if(sortBy==='duration')return acts.slice().sort((a,b)=>(parseFloat(a.dur)||0)-(parseFloat(b.dur)||0));
  if(sortBy==='least_recent'){return acts.slice().sort((a,b)=>{const aLog=actLogs.filter(l=>l.activity===a.title).sort((x,y)=>y.date.localeCompare(x.date))[0];const bLog=actLogs.filter(l=>l.activity===b.title).sort((x,y)=>y.date.localeCompare(x.date))[0];if(!aLog&&!bLog)return 0;if(!aLog)return -1;if(!bLog)return 1;return aLog.date.localeCompare(bLog.date);});}
  if(sortBy==='least_freq'){return acts.slice().sort((a,b)=>{const aC=actLogs.filter(l=>l.activity===a.title).length;const bC=actLogs.filter(l=>l.activity===b.title).length;return aC-bC;});}
  return acts.slice().sort((a,b)=>(a.title||'').localeCompare(b.title||''));
}
function renderActs(){
  document.getElementById('surpriseWrap').style.display='none';const filtered=sortActs(getFilteredActs());const el=document.getElementById('actList');
  if(!activities.length){el.innerHTML='<div class="hload">No activities yet - tap + Add to build your library</div>';return;}
  if(!filtered.length){el.innerHTML='<div class="hload">No activities match these filters</div>';return;}
  const energyCls={'Low':'cat-low','Medium':'cat-med','High':'cat-high'};const weatherCls={'Sunny / Dry':'cat-sun','Rainy / Wet':'cat-rain','Any weather':'cat-any'};
  el.innerHTML=filtered.map(a=>{
    const idx=activities.indexOf(a);const lastLog=actLogs.filter(l=>l.activity===a.title).sort((x,y)=>y.date.localeCompare(x.date))[0];
    const lastStr=lastLog?fmtDate(lastLog.date)+' - '+lastLog.dogs:'Never done yet';
    return'<div class="act-item" onclick="openActModal('+idx+')">'+
      '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">'+
      '<span class="act-cat cat-'+(a.cat||'walk').toLowerCase().replace(/[^a-z0-9]/g,'-')+'">'+(a.cat||'Walk')+'</span>'+
      (a.io?'<span class="act-cat cat-'+(a.io==='Indoor'?'in':'out')+'">'+a.io+'</span>':'')+
      (a.energy?'<span class="act-cat '+(energyCls[a.energy]||'cat-any')+'">'+a.energy+' energy</span>':'')+
      (a.weather?'<span class="act-cat '+(weatherCls[a.weather]||'cat-any')+'">'+a.weather+'</span>':'')+
      '</div>'+
      '<div class="act-title">'+a.title+'</div>'+
      '<div class="act-meta">'+
      (a.location?'<span class="act-m">'+a.location+'</span>':'')+
      (a.dur?'<span class="act-m">⏱️ '+a.dur+' mins</span>':'')+
      (a.dist!==undefined&&a.dist!==null&&a.dist!==''?'<span class="act-m">'+(parseInt(a.dist)>0?'🚗 '+a.dist+' mins drive':'🏠 At home')+'</span>':'')+
      (a.cost?'<span class="act-m">'+fmtGBP(a.cost)+'</span>':'')+
      (a.mapsUrl?'<a class="maps-btn" href="'+a.mapsUrl+'" target="_blank" onclick="event.stopPropagation()">Map</a>':'')+
      '<span class="act-last">'+lastStr+'</span>'+
      '</div>'+
      (a.notes?'<div style="font-size:9px;color:var(--gr3);margin-top:4px;">'+a.notes+'</div>':'')+
      '</div>';
  }).join('');
}
function showAllActs(){renderActs();}
function filterLogActs(){
  const q=(document.getElementById('log_act_search')?.value||'').toLowerCase();
  const res=document.getElementById('log_act_results');if(!res)return;
  if(!q){res.style.display='none';return;}
  const matches=activities.filter(a=>a.title.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){res.style.display='none';return;}
  // Exclude already selected activities from results
  const available=matches.filter(a=>!_logSelectedActs.includes(a.title));
  if(!available.length){res.style.display='none';return;}
  res.innerHTML=available.map(a=>'<div style="padding:6px 9px;font-size:10px;cursor:pointer;border-bottom:1px solid var(--gr4);" onclick="selectLogAct(\''+a.title+'\')" onmousedown="event.preventDefault()">'+a.title+'</div>').join('');
  res.style.display='block';
}
function selectLogAct(title){
  if(!_logSelectedActs.includes(title))_logSelectedActs.push(title);
  const inp=document.getElementById('log_act_search');if(inp)inp.value='';
  const res=document.getElementById('log_act_results');if(res)res.style.display='none';
  renderLogActPills();
}
function renderLogActPills(){
  const el=document.getElementById('log_act_pills');if(!el)return;
  el.innerHTML=_logSelectedActs.map((a,i)=>'<span style="background:var(--pul);color:var(--pu);font-size:8px;padding:3px 7px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;">'+a+'<button onclick="removeLogAct('+i+')" onmousedown="event.preventDefault()" style="background:none;border:none;cursor:pointer;color:var(--pu);font-size:10px;padding:0;line-height:1;">&times;</button></span>').join('');
}
function removeLogAct(i){_logSelectedActs.splice(i,1);renderLogActPills();}
function surpriseAct(){
  const pool=getFilteredActs();if(!pool.length){alert('No activities match these filters');return;}
  const a=pool[Math.floor(Math.random()*pool.length)];const w=document.getElementById('surpriseWrap');w.style.display='block';
  const distStr=a.dist!==undefined&&a.dist!==null&&a.dist!==''?(parseInt(a.dist)>0?'🚗 '+a.dist+' mins drive':'🏠 At home'):'';
  const meta=[a.cat,a.io,a.energy?a.energy+' energy':'',a.weather,a.dur?'⏱️ '+a.dur+' mins':'',distStr,a.cost?fmtGBP(a.cost):'',a.location].filter(Boolean).join(' - ');
  w.innerHTML='<div class="surprise-card"><div style="font-size:8px;color:var(--hnl);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Today&#39;s Activity Pick</div><div class="surprise-title">'+a.title+'</div><div class="surprise-meta">'+meta+'</div>'+(a.notes?'<div style="font-size:10px;color:rgba(255,255,255,.6);margin-bottom:13px;">'+a.notes+'</div>':'')+(a.mapsUrl?'<a class="maps-btn" href="'+a.mapsUrl+'" target="_blank" style="margin-bottom:12px;display:inline-flex;">Map</a><br>':'')+'<button class="surprise-btn" onclick="surpriseAct()">Try another</button></div>';
  document.getElementById('actList').innerHTML='';
}
function openActModal(idx){
  document.getElementById('act_eidx').value=idx!==null?idx:'';document.getElementById('actMTitle').textContent=idx!==null?'Edit Activity':'New Activity';
  const a=idx!==null?activities[idx]:{};const ss=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  ss('act_title',a.title);ss('act_cat',a.cat);ss('act_io',a.io);ss('act_energy',a.energy);ss('act_weather',a.weather);ss('act_dur',a.dur);ss('act_dist',a.dist);ss('act_location',a.location);ss('act_maps',a.mapsUrl);ss('act_cost',a.cost);ss('act_notes',a.notes);
  document.getElementById('actModal').classList.add('open');
}
async function saveAct(){
  const title=document.getElementById('act_title').value.trim();if(!title){alert('Title required');return;}
  const idx2=document.getElementById('act_eidx').value;const st=document.getElementById('actStatus');
  const act={title,cat:gv('act_cat'),io:gv('act_io'),energy:gv('act_energy'),weather:gv('act_weather'),dur:gv('act_dur'),dist:gv('act_dist'),location:gv('act_location'),mapsUrl:gv('act_maps'),cost:gv('act_cost'),notes:gv('act_notes')};
  if(idx2!=='')activities[parseInt(idx2)]=act;else activities.push(act);saveActivities();
  st.textContent='Saving...';st.className='smsg';
  try{
    const rows=await readSheet(TABS.ACTS,'A2:K').catch(()=>[]);
    const existIdx=rows.findIndex(r=>r[0]===act.title);
    const actsMap={Title:act.title,Category:act.cat,IndoorOutdoor:act.io,EnergyLevel:act.energy,Weather:act.weather,Location:act.location,MapsURL:act.mapsUrl,DurationMins:act.dur,DistanceMins:act.dist,Cost:act.cost,Notes:act.notes};
    if(existIdx>=0){await updateRow(TABS.ACTS,existIdx+2,rowFromMap(actsHdrRow,actsMap,TABS.ACTS.h));}
    else{await appendRow(TABS.ACTS,rowFromMap(actsHdrRow,actsMap,TABS.ACTS.h));}
    st.textContent='Saved & synced!';st.className='smsg ok';
  }catch(e){st.textContent='Saved locally (sheet: '+e.message+')';st.className='smsg err';}
  setTimeout(()=>{st.className='smsg';document.getElementById('actModal').classList.remove('open');renderActs();},1600);
}
async function syncActsFromSheet(silent=false){
  try{
    const rows=await readSheet(TABS.ACTS,'A2:K');
    if(rows.length){
      activities=rows.filter(r=>r[0]).map(r=>({title:r[0]||'',cat:r[1]||'',io:r[2]||'',energy:r[3]||'',weather:r[4]||'',location:r[5]||'',mapsUrl:r[6]||'',dur:r[7]||'',dist:r[8]||'',cost:r[9]||'',notes:r[10]||''}));
      saveActivities();renderActs();if(!silent)alert('Activities synced from sheet!');
    }else if(!silent)alert('No activities found in sheet.');
  }catch(e){if(!silent)alert('Sync failed: '+e.message);}
}

// ==================== EXPORT ====================
function exportData(incPriv){const recs=incPriv?bookings:bookings.filter(r=>!r.priv);const hdrs=['ID','Dog','Service','Start Date','Start Time','End Date','End Time','Drop-off Location','Pick-up Location','Revenue','Tips','Prepayment','Final Payment','Balance','Rover Comm','Channel','Payment','Status','Private','Month','Rating','Feedback'];const rows=[['THE CUDDLY LANE - Booking Records'],['AWLA Licence: AWLA/124654'],['Exported: '+new Date().toLocaleString('en-GB')],[''],hdrs,...recs.map(r=>{const owed=(r.rev||0)+(r.tips||0);const paid=(r.prepay||0)+(r.finalPay||0);return[r.id,r.dog,r.svc,r.sd,r.st,r.ed,r.et,r.dropLoc,r.pickLoc,r.rev,r.tips,r.prepay,r.finalPay,(paid-owed).toFixed(2),r.roverAmt,r.ch,r.pay,r.status,r.priv?'Yes':'No',r.month,r.rating,r.feedback];})];const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='TCL-records-'+todayStr()+'.csv';a.click();}

// ==================== MANIFEST / PWA ====================
function registerSW(){if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}}

// ==================== INIT ====================
loadConfig();checkCreds();loadQSettings();initPin();
msgTpls=JSON.parse(localStorage.getItem('tcl_msg_tpls')||'[]');
loadActivities();
document.getElementById('boardDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
document.getElementById('backBtn').style.display='none';
document.getElementById('reg_eid').value='';document.getElementById('reg_ridx').value='';
document.getElementById('st_date').value=todayStr();
const bmDog=document.getElementById('bm_dog');if(bmDog)bmDog.addEventListener('change',updateDogIdHint);
registerSW();
initPin();
