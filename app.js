// THE CUDDLY LANE CRM v8 - app.js

// ==================== UTILITIES ====================
// Local calendar date (YYYY-MM-DD). Uses the device's LOCAL date, not UTC — otherwise in the evening under BST/DST the
// "today" used by the board, calendar anchor, pending-actions and occupancy could jump a day ahead of the wall clock.
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(d){if(!d)return'-';try{const dt=new Date(d+'T12:00:00');const dy=String(dt.getDate()).padStart(2,'0');const mo=String(dt.getMonth()+1).padStart(2,'0');const yr=dt.getFullYear();return dy+'/'+mo+'/'+yr;}catch(e){return d;}}
function fmtDateFull(d){if(!d)return'-';try{return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}}
function gv(id){const el=document.getElementById(id);return el?el.value||'':(console.warn('gv:',id),'');}
function calcAge(b){if(!b)return'';try{const dob=new Date(b+'T12:00:00'),now=new Date();let y=now.getFullYear()-dob.getFullYear();if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))y--;return y<1?Math.floor((now-dob)/2592000000)+'mo':y+'yr';}catch(e){return'';}}
function defEmoji(d){const b=(d.breed||'').toLowerCase();if(b.includes('retriever')||b.includes('golden'))return'\u{1F9AE}';if(b.includes('husky'))return'\u{1F43A}';if(b.includes('collie'))return'\u{1F429}';if(b.includes('bulldog')||b.includes('pug')||b.includes('french'))return'\u{1F43E}';if(b.includes('shiba'))return'\u{1F98A}';if(b.includes('lab'))return'\u{1F415}';return'\u{1F436}';}
// Dog/Customer ID: TCL- + 2 letters from name + 4-digit random, matching the house convention (e.g. TCL-CB1017).
// Checks against existing dog IDs (allDogs) so the generated id is unique.
function genId(n){
  const pre='TCL-'+((n||'').replace(/[^A-Za-z]/g,'').substring(0,2).toUpperCase().padEnd(2,'X'));
  const used=new Set((typeof allDogs!=='undefined'&&allDogs?allDogs:[]).map(d=>d&&d.cid).filter(Boolean));
  let id;let guard=0;do{id=pre+String(Math.floor(1000+Math.random()*9000));}while(used.has(id)&&++guard<50);
  return id;
}
const VL_A='=IFERROR(VLOOKUP(INDIRECT("A"&ROW()),Dogs!$A:$B,2,FALSE),"")';
function mkHdr(row){const m={};(row||[]).forEach((v,i)=>{if(v)m[v]=i;});return m;}
function rowFromMap(hdrRow,map,fallbackHdr){const h=(hdrRow&&hdrRow.length)?hdrRow:fallbackHdr;return h.map(name=>{const v=map[name];return v===undefined?'':v;});}
// Resolve a booking by row-index first (disambiguates duplicate IDs), falling back to id
function bkByRef(id,ri){return ri?(bookings.find(b=>b.ri===ri)||bookings.find(b=>b.id===id)):bookings.find(b=>b.id===id);}
function sheetPhone(v){const s=String(v||'').trim();return s.startsWith('+')?`'${s}`:s;}
// Normalise cost dates — handles both YYYY-MM-DD (from date input) and DD/MM/YYYY (manual sheet entry)
function normDate(d){if(!d)return'';if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;if(/^\d{2}\/\d{2}\/\d{4}$/.test(d)){const p=d.split('/');return p[2]+'-'+p[1]+'-'+p[0];}return d;}
// Cash actually received: Prepaid → deposit only; Fully Paid/Credit → full settlement; Quoted/Booked/Canceled → 0
function actualRev(r){if(r.status==='Prepaid')return(r.prepay||0);if(r.status==='Fully Paid'||r.status==='Credit'||r.status==='Completed')return(r.prepay||0)+(r.finalPay||0)+(r.tips||0);return 0;}
// Split a booking across the calendar months it spans, pro-rated by nights (multi-night boarding/dog-sit).
// Single-day services → one segment on the service date. Returns [{y:'2026',mo:'Dec',frac:0.57},...] summing to 1.
// Used so cross-year/cross-month orders attribute revenue to the right months in Analysis + P&L (DB stays one row).
function bkMonthFractions(b){
  const svcL=(b.svc||'').toLowerCase();
  const multi=svcL.includes('boarding')||svcL.includes('dogsit')||svcL.includes('dog sit');
  const nsd=normDate(b.sd),ned=normDate(b.ed);
  if(!multi||!nsd||!ned||ned<=nsd){const d=ned||nsd;if(!d)return[];return[{y:d.slice(0,4),mo:MOS[parseInt(d.slice(5,7),10)-1],frac:1}];}
  const per={};let tot=0,d=new Date(nsd+'T12:00:00Z');const end=new Date(ned+'T12:00:00Z');
  while(d<end){const ym=d.toISOString().slice(0,7);per[ym]=(per[ym]||0)+1;tot++;d=new Date(d.getTime()+864e5);}
  return Object.entries(per).map(([ym,n])=>({y:ym.slice(0,4),mo:MOS[parseInt(ym.slice(5,7),10)-1],frac:n/tot}));
}
function ir(k,v){if(!v||!v.toString().trim())return'';const lv=v.toString().toLowerCase().trim();if(lv==='n/a'||lv==='na'||lv==='none'||lv==='-')return'';return '<div class="irow"><span class="ikey">'+k+'</span><span class="ival">'+v+'</span></div>';}
function fmtGBP(n){return '\u00a3'+(parseFloat(n)||0).toFixed(2);}
// Round half-up to a whole pound (10.5\u219211, 10.4\u219210). Used across the quote engine so amounts have no pennies.
function roundGBP(n){return Math.round(parseFloat(n)||0);}
// Holiday rate = base \u00d7 1.15, rounded to whole \u00a3 per night/day (e.g. \u00a338\u2192\u00a344, \u00a328\u2192\u00a332).
function holRate(base){return roundGBP((parseFloat(base)||0)*1.15);}
function copyText(msg){if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(msg).catch(()=>{});}else{const ta=document.createElement('textarea');ta.value=msg;ta.style.cssText='position:fixed;top:-9999px;opacity:0;';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);}}
function maskKey(k){if(!k||k.length<12)return k?'****':'';return k.slice(0,6)+'...****...'+k.slice(-4);}
// Non-blocking toast feedback — used for background save failures and quick confirmations instead of a blocking alert().
function toast(msg,type){const w=document.getElementById('toastWrap');if(!w){alert(msg);return;}const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;w.appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),260);},type==='err'?4200:2600);}
// Header "last synced" indicator so staff can see how fresh the on-screen data is.
let _lastSync=0;
function updateSyncInfo(){const el=document.getElementById('syncInfo');if(!el)return;if(!_lastSync){el.textContent='';return;}const s=Math.floor((Date.now()-_lastSync)/1000);el.textContent=s<60?'Synced just now':s<3600?'Synced '+Math.floor(s/60)+'m ago':'Synced '+Math.floor(s/3600)+'h ago';}
setInterval(updateSyncInfo,60000);
// ---- Dog description helpers (used by message templates, e.g. "🐾 3 y/o spayed female Schnauzer") ----
function ageYears(bday){if(!bday)return null;try{const dob=new Date(bday+'T12:00:00'),now=new Date();let y=now.getFullYear()-dob.getFullYear();if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))y--;return y<0?null:y;}catch(e){return null;}}
function genderPhrase(gs){const s=(gs||'').toLowerCase();const sex=s.includes('female')?'female':s.includes('male')?'male':'';let mod='';if(s.includes('spay'))mod='spayed';else if(s.includes('neuter')||s.includes('castrat'))mod='neutered';return((mod?mod+' ':'')+sex).trim();}
function fmtDogDesc(d){if(!d)return'';const a=ageYears(d.birthday);const gp=genderPhrase(d.gender||d.genderStatus);const parts=['🐾'];if(a!==null)parts.push(a+' y/o');if(gp)parts.push(gp);if(d.breed)parts.push(d.breed);return parts.join(' ');}

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
let curDog=null,allDogs=[],bookings=[],costs=[],msgTpls=[],activities=[],actLogs=[],trialLogs=[],histCache={},_svcLines=[],_logSelectedActs=[],_actMainCat='',_tplCat='',dailyLogSet=new Set(),dailyLogRows=[],dogsHdrRow=[],bkHdrRow=[],dailyHdrRow=[],trialHdrRow=[],actlogHdrRow=[],costsHdrRow=[],healthHdrRow=[],fightHdrRow=[],transportHdrRow=[],actsHdrRow=[];
// 3 lifecycle groups (g): before arrival / during service / after service.
const WF_STEPS=[
  {k:'whatsapp',l:'WhatsApp group created / name updated',g:'before'},
  {k:'docsReq',l:'Send docs & consent request',g:'before'},
  {k:'docsReceived',l:'Docs received',g:'before'},
  {k:'consentSigned',l:'Consent signed',g:'before'},
  {k:'dbUpdated',l:'Update database (dog profile)',g:'before'},
  {k:'packingList',l:'Send packing list',g:'before'},
  {k:'finalpay',l:'Final payment reminder sent',g:'before'},
  {k:'dropoff',l:'Drop-off reminder sent',g:'before'},
  {k:'pickup',l:'Pick-up reminder sent',g:'during'},
  {k:'dailyLogs',l:'Daily logs completed',g:'during'},
  {k:'compat',l:'Compatibility / overlap logged',g:'during'},
  {k:'reviewReq',l:'Review request sent',g:'after'},
  {k:'review',l:'Review logged (or marked N/A)',g:'after'},
  {k:'staffNotes',l:'Update staff notes',g:'after'}
];
const WF_GRP={before:'📋 Before arrival',during:'🏠 During service',after:'⭐ After service'};
let _restoreTplKey=null,_delBkId=null,_delBkRi=null,_selDogs=[],_addDogs=[],_mainDog='';
// Quote dogs are stored as CustomerIDs (cids) to avoid same-name mix-ups. _addDogs = cids charged the additional-dog rate.
function _nm(cid){const d=allDogs.find(x=>x.cid===cid);return d?d.name:(cid||'Dog');}
function _dogByCid(cid){return cid?allDogs.find(d=>d.cid===cid)||null:null;}
// Parse a party token that may embed a CID: "TCL-XX0001 Name" / "Name - TCL-XX0001" / "Name" / "TCL-XX0001".
function _parseParty(tok){const s=(tok||'').trim();const m=s.match(/TCL-[A-Za-z0-9]+/i);const cid=m?m[0].toUpperCase():'';const name=s.replace(/TCL-[A-Za-z0-9]+/i,'').replace(/[-–—]/g,' ').replace(/\s+/g,' ').trim();return{cid,name};}
// Resolve a party token to a dog object — by CID first, else by name (case-insensitive). Always prefer CID (dupe names).
function _resolveParty(tok){const p=_parseParty(tok);if(p.cid){const d=_dogByCid(p.cid);if(d)return d;}if(p.name){const n=p.name.toLowerCase();const d=allDogs.find(x=>(x.name||'').toLowerCase()===n);if(d)return d;}return null;}
// For a Trial/Fight record, the OTHER dog relative to curDog (record owner or a mixed-with token) with its attributes (item 16).
function _otherPartyLine(ownerCid,ownerName,mixedWith){
  const meCid=curDog?curDog.cid:'';const meNm=(curDog?curDog.name:'').toLowerCase();
  const owner={cid:ownerCid||'',name:ownerName||'',dog:_dogByCid(ownerCid)||allDogs.find(x=>(x.name||'').toLowerCase()===(ownerName||'').toLowerCase())};
  const toks=(mixedWith||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean).map(t=>{const d=_resolveParty(t);const p=_parseParty(t);return{cid:d?d.cid:(p.cid||''),name:d?d.name:(p.name||t),dog:d};});
  const others=[owner].concat(toks).filter(p=>!((p.cid&&p.cid===meCid)||(p.name&&p.name.toLowerCase()===meNm)));
  const o=others[0];if(!o)return ownerName||'?';
  const d=o.dog;const gs=d?(d.genderStatus||d.gender||''):'';const age=d?ageYears(d.birthday):null;
  const attrs=d?[d.breed,(age!=null?age+'y':''),[_gsNeuter(gs),_gsGender(gs)].filter(Boolean).join(' '),(d.weight?d.weight+'kg':'')].filter(Boolean).join(' · '):'';
  return (d?d.name:(o.name||o.cid))+(attrs?' ('+attrs+')':'');
}
function _isAddDog(cid){return _addDogs.includes(cid);}
function _orderedSel(){return [..._selDogs.filter(c=>!_addDogs.includes(c)),..._selDogs.filter(c=>_addDogs.includes(c))];}
let _bkSaving=false;
let _todoFilter='';// To-Do New/Live/Completed pill filter (17)
function setTodoFilter(b){_todoFilter=(_todoFilter===b)?'':b;renderPendingPanel();}
// Date-range linkage (10): picking the start date constrains + defaults the end date and auto-opens its picker, so a range is one flow.
function _linkStart(sid,eid){const s=document.getElementById(sid),e=document.getElementById(eid);if(!s||!e||s._rangeLinked)return;s._rangeLinked=true;
  s.addEventListener('change',()=>{if(!s.value)return;e.min=s.value;if(!e.value||e.value<s.value)e.value=s.value;try{e.focus();if(e.showPicker)e.showPicker();}catch(_){}});}
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
// Allow typing the PIN on a physical keyboard (laptop browser): digits enter, Backspace deletes.
document.addEventListener('keydown',e=>{const ps=document.getElementById('pinScreen');if(!ps||!ps.classList.contains('active'))return;if(e.key>='0'&&e.key<='9'){e.preventDefault();pk(e.key);}else if(e.key==='Backspace'){e.preventDefault();pdel();}});

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
    {n:TABS.DOGS,h:['CustomerID','DogName','Breed','GenderStatus','Birthday','BirthdayType','Weight','ChipID','Rescue','Nervous','SepAnxiety','Jogging','DogFriends','FoodType','FoodMeasure','DietNotes','Allergies','Medical','MedSchedule','Fears','Untouchable','Vaccination','Flea','Behaviour','Motivation','WalkSchedule','CarSeat','SleepLocation','EscapeAttempts','ToiletTrained','AloneHours','TrainingCommands','PrevSitters','UpdateFrequency','Relationships','AdditionalNotes','Owner1','Phone1','Owner2','Phone2','Owner3','Phone3','Address','Postcode','Emergency','Vet','Insurance','MeetGreetDate','Referral','ReferralNotes','Service','Status','Remarks','VaccinationURL','PhotoURL','Barking','RemarkAtHome','RemarkOutdoor','RemarkIndoor','RemarkSleeping','RemarkFood','RemarkWithDogs','Sociability','InsuranceURL','EmergencyName','EmergencyPhone','EmergencyRelationship']},
    {n:TABS.BK,h:['CustomerID','DogName','ID','ServiceType','StartDate','StartTime','EndDate','EndTime','DropoffLocation','PickupLocation','Revenue','Tips','Prepayment','FinalPayment','UnitCost','DiscountNotes','RoverCommissionPct','RoverCommissionGBP','Channel','Payment','Status','Private','Month','Rating','Feedback','Rem1','Rem2','Rem3','Rem4','Rem5','WF_WhatsApp','WF_PackingList','WF_DocsReceived','WF_ConsentSigned','WF_DropoffReminder','WF_PickupReminder','WF_FinalPayReminder','WF_ReviewRequest','WF_Review','WF_DailyLogs','WF_Compat','WF_DocsReq','WF_ConsentSent','BookingRef','PrepaymentRef','FinalPaymentRef','WF_DatabaseUpdated','WF_StaffNotes']},
    {n:TABS.DAILY,h:['CustomerID','DogName','Date','Breakfast','MedAM','Dinner','MedPM','Snack','WalkAM','Garden','WalkPM','BeforeSleep','Game','Bowl','Room','Garment','Notes','Private']},
    {n:TABS.HEALTH,h:['CustomerID','DogName','Date','Owner','Issue','Category','Location','Importance','Description','RootCause','','NextStep','Private']},
    {n:TABS.FIGHT,h:['CustomerID','DogName','Date','Time','Owner','OtherDogs','Issue','Importance','Injuries','Treatment','Prevention','Private']},
    {n:TABS.TRANSPORT,h:['CustomerID','DogName','Date','Transporter','Vehicle','Plate','JourneyType','Time','Notes','Private','From','To']},
    {n:TABS.TRIAL,h:['CustomerID','DogName','Date','MixedWith','Observations','Suitable','Private']},
    {n:TABS.COSTS,h:['Date','Category','Amount','Notes']},
    {n:TABS.TARGETS,h:['Month','RevTarget','CostTarget']},
    {n:TABS.TRAIN,h:['Date','Staff','Category','Objective','Provider','Learnt','CPDPoints','CertLink','MaterialsLink']},
    {n:TABS.CONSENT,h:['CustomerID','DogName','Date','PhotoConsent','OffLeash','Mixing','WalkOutside','GroupWalk','FeedTogether','Crate','SameRoom','MedCost','VetConsent','TCSigned','TCVersion','TCSignedDate']},
    {n:TABS.TPLS,h:['Name','Category','Content','LastUpdated','Key']},
    {n:TABS.ACTS,h:['Title','Category','IndoorOutdoor','EnergyLevel','Weather','Location','MapsURL','DurationMins','DistanceMins','Cost','Notes']},
    {n:TABS.ACTLOG,h:['CustomerID','DogName','Date','Activity','Staff','Duration','Notes']},
    {n:TABS.RATES,h:['Key','Value','UpdatedAt']},
  ];
  try{await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+':batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({requests:sheets.map(sh=>({addSheet:{properties:{title:sh.n}}}))})});}catch(e){}
  for(const sh of sheets){try{await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(sh.n+'!A1')+'?valueInputOption=RAW',{method:'PUT',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({values:[sh.h]})});}catch(e){}}
  s.textContent='Sheet structure created!';setTimeout(()=>s.textContent='',5000);
}

// ==================== NAV ====================
let _stk=['sc-board'],_curSection='dogs',_curSubK='dogs';
// Panel openers (reuse existing toggle logic; force-open only)
function openPending(){const p=document.getElementById('pendingPanel');if(p&&(p.style.display==='none'||!p.style.display))togglePendingPanel();}
function openAvail(){const p=document.getElementById('availPanel');if(p&&(p.style.display==='none'||!p.style.display))toggleAvailPanel();}
function openSP(id){const e=document.getElementById('sp-'+id);if(e){e.classList.add('open');setTimeout(()=>{try{e.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){}} ,60);}}
// Section → ordered sub-tabs. sc = primary screen; after = optional panel to open on that screen.
const SECTIONS={
  dogs:[{k:'dogs',lbl:'🐾 Profiles',sc:'sc-board'},{k:'cal',lbl:'📅 Calendar',sc:'sc-calendar'},{k:'bk',lbl:'📋 Bookings',sc:'sc-bookings'},{k:'act',lbl:'🎯 Activities',sc:'sc-activities'}],
  customers:[{k:'todo',lbl:'✅ To-Do',sc:'sc-todo'},{k:'tpl',lbl:'✉️ Templates',sc:'sc-templates'},{k:'quote',lbl:'🔢 Quote',sc:'sc-quote'},{k:'rates',lbl:'💷 Rates',sc:'sc-rates'}],
  business:[{k:'an',lbl:'🔍 Analysis',sc:'sc-analysis'},{k:'cost',lbl:'💸 Costs',sc:'sc-costs'},{k:'pl',lbl:'📈 P&L',sc:'sc-pl'},{k:'train',lbl:'📚 Training',sc:'sc-training'}]
};
const SECTION_ROOTS=new Set(Object.values(SECTIONS).flat().map(t=>t.sc));
function renderSubTabs(){const bar=document.getElementById('subTabs');if(!bar)return;bar.innerHTML=(SECTIONS[_curSection]||[]).map(t=>'<button class="subtab'+(t.k===_curSubK?' active':'')+'" onclick="goSub(\''+t.k+'\')">'+t.lbl+'</button>').join('');}
function _runTab(t){_curSubK=t.k;_stk=[t.sc];showScreen(t.sc,false);if(t.after)t.after();renderSubTabs();}
function switchSection(sec){if(!SECTIONS[sec])return;_curSection=sec;document.querySelectorAll('.snav').forEach(b=>b.classList.remove('active'));document.getElementById('snav-'+sec)?.classList.add('active');_runTab(SECTIONS[sec][0]);}
function goSub(k){const t=(SECTIONS[_curSection]||[]).find(x=>x.k===k);if(t)_runTab(t);}
function goToTab(sec,k){if(!SECTIONS[sec])return;_curSection=sec;document.querySelectorAll('.snav').forEach(b=>b.classList.remove('active'));document.getElementById('snav-'+sec)?.classList.add('active');const t=SECTIONS[sec].find(x=>x.k===k)||SECTIONS[sec][0];_runTab(t);}
function showScreen(id,push=true){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');document.getElementById('mainScroll').scrollTop=0;
  if(push)_stk.push(id);
  const isRoot=SECTION_ROOTS.has(id)||id==='sc-business';
  document.getElementById('backBtn').style.display=isRoot?'none':'flex';document.getElementById('hdrTitle').style.display=isRoot?'block':'none';
  const subs={'sc-bookings':'Booking Records','sc-costs':'Cost Records','sc-pl':'P&L Dashboard','sc-calendar':'Availability Calendar','sc-training':'Staff Training','sc-templates':'Message Templates','sc-activities':'Activities','sc-analysis':'Analysis','sc-profile':curDog?curDog.name:'Dog Profile','sc-register':document.getElementById('reg_eid')?.value?'Edit Profile':'Register New Dog'};
  document.getElementById('hdrSub').textContent=subs[id]||'Staff Portal';
  if(id==='sc-bookings')renderBk();if(id==='sc-pl')updatePL();if(id==='sc-costs'){initCostFilters();renderCostTable();};if(id==='sc-calendar')renderCalendar();if(id==='sc-templates')syncTplsFromSheet();if(id==='sc-activities')renderActs();if(id==='sc-analysis')renderAnalysis();if(id==='sc-quote'){buildQDogMS();buildMainDogBtns();_linkStart('ml_sd','ml_ed');}if(id==='sc-todo')renderPendingPanel();if(id==='sc-checkdates')initAvail();if(id==='sc-rates'){loadQSettings();renderHolYrBtns();}
}
function goBack(){_stk.pop();showScreen(_stk[_stk.length-1]||'sc-board',false);}

// ==================== BOARD ====================
// ==================== PENDING ACTIONS ====================
function bkWfPendingItems(bk){
  const today=todayStr();
  const addDays=(ds,n)=>{const d=new Date(ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const items=[];
  const ed=bk.ed||bk.sd;
  // Ended bookings (service over): only wrap-up REVIEW tasks remain — the pre-arrival/setup steps no longer clutter the
  // To-Do. (Missing daily logs are surfaced separately in computePendingActions.)
  if(ed&&ed<today){
    if(today>=addDays(ed,1)){
      if(!wfStepValue(bk,'reviewReq'))items.push({key:'reviewReq',label:'Send review request'});
      else if(!wfStepValue(bk,'review'))items.push({key:'review',label:'Log review (or mark N/A)'});
    }
    if(!wfStepValue(bk,'staffNotes'))items.push({key:'staffNotes',label:'Update staff notes'});
    return items;
  }
  // Setup steps appear as soon as the booking is committed (any status except Quoted/Cancelled).
  const committed=!['Quoted','Cancelled','Canceled'].includes(bk.status);
  if(committed){
    if(!wfStepValue(bk,'whatsapp'))items.push({key:'whatsapp',label:'WhatsApp group created / name updated'});
    if(!wfStepValue(bk,'docsReq'))items.push({key:'docsReq',label:'Send docs & consent request'});
    if(wfStepValue(bk,'docsReq')){
      if(!wfStepValue(bk,'docsReceived'))items.push({key:'docsReceived',label:'Docs received'});
      if(!wfStepValue(bk,'consentSigned'))items.push({key:'consentSigned',label:'Consent signed'});
    }
    if(!wfStepValue(bk,'dbUpdated'))items.push({key:'dbUpdated',label:'Update database (dog profile)'});
  }
  if(bk.sd&&today>=addDays(bk.sd,-7)){// packing list: 1 week before service
    if(!wfStepValue(bk,'packingList'))items.push({key:'packingList',label:'Send packing list'});
  }
  if(bk.sd&&today>=addDays(bk.sd,-2)){// final payment + drop-off: 48h before
    if(!wfStepValue(bk,'finalpay'))items.push({key:'finalpay',label:'Send final payment reminder'});
    if(!wfStepValue(bk,'dropoff'))items.push({key:'dropoff',label:'Send drop-off reminder'});
  }
  if(ed&&today>=addDays(ed,-1)){
    if(!wfStepValue(bk,'pickup'))items.push({key:'pickup',label:'Send pick-up reminder'});
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
  // Guard: ignore blank/malformed rows (no dog name or no start date) so they never surface as nameless To-Do cards.
  const _real=b=>(b.dog||'').trim()&&b.sd;
  const pendingCompletion=bookings.filter(b=>!b.priv&&_real(b)&&b.ed&&b.ed<today&&!['Cancelled','Canceled','Completed'].includes(b.status)&&!wfCompletion(b).allDone);
  const wfTasks=[];
  bookings.filter(b=>!b.priv&&_real(b)&&!['Cancelled','Canceled','Completed'].includes(b.status)).forEach(b=>{
    bkWfPendingItems(b).forEach(item=>wfTasks.push({bk:b,...item}));
  });
  // Vaccination reminders (high priority): dog with an upcoming or in-service Booked/Prepaid/Fully Paid booking whose vaccination is expired or missing.
  const PAID_UP=['Booked','Prepaid','Fully Paid'];
  const vaccReminders=[];
  allDogs.forEach(d=>{
    const vaccMissing=!(d.vacc&&String(d.vacc).trim());
    let vaccExpired=false;
    if(!vaccMissing){try{const vd=new Date(d.vacc+'T12:00:00');const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);vaccExpired=vd<cutoff;}catch(e){}}
    if(!vaccMissing&&!vaccExpired)return;
    const qbks=bookings.filter(b=>!b.priv&&bkMatchesDog(b,d)&&PAID_UP.includes(b.status)&&b.sd&&(b.sd>=today||(b.sd<=today&&(b.ed||b.sd)>=today)));
    if(!qbks.length)return;
    qbks.sort((a,c)=>(a.sd||'').localeCompare(c.sd||''));
    vaccReminders.push({dog:d,missing:vaccMissing,vacc:d.vacc,bk:qbks[0]});
  });
  // Emergency-contact reminders (high priority): same trigger as vaccination, but for a dog with no usable emergency contact on record.
  const emergReminders=[];
  allDogs.forEach(d=>{
    const legacy=(d.emergency||'').trim().toLowerCase();
    const legacyOk=legacy&&!['tbc','na','n/a','-','yes','no'].includes(legacy);
    if((d.emergPhone||'').trim()||(d.emergName||'').trim()||legacyOk)return;// some contact on record
    const qbks=bookings.filter(b=>!b.priv&&bkMatchesDog(b,d)&&PAID_UP.includes(b.status)&&b.sd&&(b.sd>=today||(b.sd<=today&&(b.ed||b.sd)>=today)));
    if(!qbks.length)return;
    qbks.sort((a,c)=>(a.sd||'').localeCompare(c.sd||''));
    emergReminders.push({dog:d,bk:qbks[0]});
  });
  const tm=localStorage.getItem('tcl_train_month')||'';const[tmMonth,tmHas]=tm.split(':');
  const noTrainingThisMonth=tmMonth===today.slice(0,7)&&tmHas==='0';
  return{missingLogs,pendingCompletion,wfTasks,noTrainingThisMonth,vaccReminders,emergReminders};
}
function updatePendingBadge(){
  const b=document.getElementById('pendingBadge');if(!b)return;
  const{missingLogs,wfTasks,noTrainingThisMonth,vaccReminders,emergReminders}=computePendingActions();
  const n=missingLogs.length+wfTasks.length+(vaccReminders?vaccReminders.length:0)+(emergReminders?emergReminders.length:0)+(noTrainingThisMonth?1:0);
  if(n){b.textContent=n;b.style.display='block';}else b.style.display='none';
}
function togglePendingPanel(){
  const p=document.getElementById('pendingPanel');if(!p)return;const showing=p.style.display!=='none'&&p.style.display!=='';
  p.style.display=showing?'none':'block';
  if(!showing)renderPendingPanel();
}
// Add a missing daily log straight from the To-Do list — set the dog as current, then open the past-log editor for that date.
function todoAddLog(cid,date){const d=allDogs.find(x=>x.cid===cid);if(!d)return;curDog=d;openAddPastLog(date);}
// Tick a checklist step straight from the To-Do list (booking modal not open) — resolve the booking directly.
async function quickToggleWf(bkId,bkRi,key){
  const bk=bkByRef(bkId,parseInt(bkRi)||null);if(!bk)return;
  if(!bk.wf)bk.wf={};const prev=bk.wf[key];
  bk.wf[key]=(key==='review')?'done':'1';
  try{await updateRow(TABS.BK,bk.ri,bkRowVals(bk));}catch(e){bk.wf[key]=prev;alert('Could not save to Google Sheet: '+e.message);return;}
  renderPendingPanel();updatePendingBadge();
}
function renderPendingPanel(){
  const el=document.getElementById('pending_results');if(!el)return;
  const{missingLogs,pendingCompletion,wfTasks,noTrainingThisMonth,vaccReminders,emergReminders}=computePendingActions();
  const today=todayStr();
  // Collect per-booking tasks, then group by dog.
  const bkMap={};const ensure=bk=>{const k=(bk.ri||bk.id);if(!bkMap[k])bkMap[k]={bk,tasks:[]};return bkMap[k];};
  wfTasks.forEach(({bk,key,label})=>ensure(bk).tasks.push({key,label}));
  // Bucket outstanding tasks by the booking's timing: New = upcoming (sd>today), Live = in service, Completed = ended (ed<today).
  const buckets={New:0,Live:0,Completed:0};
  const _bkt=bk=>{const ed=(bk.ed||bk.sd);return ed<today?'Completed':(bk.sd>today?'New':'Live');};
  const _mlBkt=dog=>bookings.some(b=>bkMatchesDog(b,dog)&&normDate(b.sd)<=today&&today<=normDate(b.ed||b.sd))?'Live':'Completed';
  const _remBkt=bk=>(bk&&bk.sd<=today&&today<=(bk.ed||bk.sd))?'Live':'New';
  Object.values(bkMap).forEach(({bk,tasks})=>{buckets[_bkt(bk)]+=tasks.length;});
  missingLogs.forEach(({dog})=>{buckets[_mlBkt(dog)]+=1;});
  (vaccReminders||[]).forEach(({bk})=>{buckets[_remBkt(bk)]+=1;});
  (emergReminders||[]).forEach(({bk})=>{buckets[_remBkt(bk)]+=1;});
  const totalOut=buckets.New+buckets.Live+buckets.Completed;
  const _pass=b=>!_todoFilter||b===_todoFilter;// New/Live/Completed pill filter (17)
  const dogs={};const dogEntry=(cid,name)=>{if(!dogs[cid])dogs[cid]={name,cid,up:[],past:[],missing:null,vacc:null,emerg:null};return dogs[cid];};
  Object.values(bkMap).forEach(({bk,tasks})=>{if(!tasks.length)return;if(!_pass(_bkt(bk)))return;const e=dogEntry(bk.customerId||bk.dog,bk.dog);((bk.ed||bk.sd)<today?e.past:e.up).push({bk,tasks});});
  missingLogs.forEach(({dog,dates})=>{if(!_pass(_mlBkt(dog)))return;dogEntry(dog.cid,dog.name).missing=dates;});
  (vaccReminders||[]).forEach(v=>{if(!_pass(_remBkt(v.bk)))return;dogEntry(v.dog.cid,v.dog.name).vacc=v;});
  (emergReminders||[]).forEach(v=>{if(!_pass(_remBkt(v.bk)))return;dogEntry(v.dog.cid,v.dog.name).emerg=v;});
  const dogList=Object.values(dogs);
  // Outstanding counter → rendered into the sticky #todoCounter (shown in both empty and non-empty states).
  const cpill=(lbl,n,col,key)=>'<span onclick="setTodoFilter(\''+key+'\')" title="Tap to filter" style="cursor:pointer;font-size:9px;font-weight:700;padding:3px 9px;border-radius:99px;background:'+(_todoFilter===key?col:col+'1a')+';color:'+(_todoFilter===key?'#fff':col)+';border:1px solid '+col+';">'+lbl+' '+n+'</span>';
  const cc=document.getElementById('todoCounter');if(cc)cc.innerHTML='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span style="font-size:12px;font-weight:800;">'+totalOut+' outstanding</span>'+cpill('🆕 New',buckets.New,'#F97316','New')+cpill('🔴 Live',buckets.Live,'#16A34A','Live')+cpill('✅ Completed',buckets.Completed,'#78716C','Completed')+(_todoFilter?'<span onclick="setTodoFilter(\'\')" style="cursor:pointer;font-size:9px;color:var(--bl);text-decoration:underline;">show all</span>':'')+'</div>';
  if(!dogList.length&&!noTrainingThisMonth){el.innerHTML='<div style="font-size:11px;font-weight:600;color:var(--gn);padding:10px 12px;background:var(--gnl);border-radius:8px;">✅ Nothing pending — all caught up!</div>';return;}
  // Upcoming: soonest first · Past: most recent first · Dogs ordered by soonest upcoming (dogs with only past come after).
  dogList.forEach(d=>{d.up.sort((a,c)=>(a.bk.sd||'').localeCompare(c.bk.sd||''));d.past.sort((a,c)=>((c.bk.ed||c.bk.sd)||'').localeCompare((a.bk.ed||a.bk.sd)||''));});
  // Priority: Live (in-service) → New (upcoming) → Completed (ended only). Vaccination/emergency banners no longer jump a dog to the top.
  const _dogBucket=d=>{if(d.up.some(x=>x.bk.sd<=today))return 0;if(d.up.length)return 1;return 2;};
  dogList.sort((a,c)=>{const ba=_dogBucket(a),bc=_dogBucket(c);if(ba!==bc)return ba-bc;return((a.up[0]?a.up[0].bk.sd:'9999')).localeCompare(c.up[0]?c.up[0].bk.sd:'9999');});
  const dates=x=>fmtDate(x.bk.sd)+(x.bk.ed&&x.bk.ed!==x.bk.sd?' → '+fmtDate(x.bk.ed):'');
  const taskRow=(bk,t)=>t.key?'<div onclick="event.stopPropagation();quickToggleWf(\''+bk.id+'\','+bk.ri+',\''+t.key+'\')" style="display:flex;align-items:center;gap:8px;padding:6px 10px 6px 14px;cursor:pointer;font-size:10px;color:var(--gr);border-top:1px solid var(--gr5);"><span style="width:17px;height:17px;border-radius:5px;border:1.5px solid var(--gr3);flex-shrink:0;background:var(--wh);"></span><span style="flex:1;">'+t.label+'</span></div>':'<div style="padding:6px 10px 6px 14px;font-size:10px;color:var(--gr2);border-top:1px solid var(--gr5);">• '+t.label+'</div>';
  // Per-booking status emoji: 🆕 upcoming (New) · 🔴 in service (Live) · ✅ ended (Completed).
  const bkStatusEmoji=bk=>{const ed=(bk.ed||bk.sd);return ed<today?'✅':(bk.sd>today?'🆕':'🔴');};
  const bkRow=x=>'<div style="border-top:1px solid var(--gr4);"><div onclick="openBkModal(\''+x.bk.id+'\',false,'+x.bk.ri+',2)" style="cursor:pointer;padding:6px 10px 4px;"><span style="font-size:10px;font-weight:700;color:var(--bk);">'+bkStatusEmoji(x.bk)+' '+x.bk.svc+' · '+dates(x)+' <span style="font-size:11px;">✏️</span></span></div>'+x.tasks.map(t=>taskRow(x.bk,t)).join('')+'</div>';
  const subhd=t=>'<div style="font-size:8px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;padding:5px 10px 2px;background:var(--gr5);">'+t+'</div>';
  let html='';
  dogList.forEach(d=>{
    const d0=allDogs.find(x=>x.cid===d.cid);
    const photo=d0?resolvePhotoUrl(d0):'';
    const meta=[d0&&d0.breed,d0?calcAge(d0.birthday):''].filter(Boolean).join(' · ');
    const av=photo?'<img src="'+photo+'" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--gr4);" onerror="this.style.display=\'none\'">':'<span style="width:30px;height:30px;border-radius:50%;background:var(--orl);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🐶</span>';
    html+='<div style="margin-bottom:11px;border:1px solid var(--gr4);border-radius:8px;overflow:hidden;">'+
      '<div onclick="openDogByCid(\''+d.cid+'\')" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:7px 10px;background:var(--gr5);">'+av+
      '<div style="min-width:0;overflow:hidden;"><span style="font-size:12px;font-weight:800;color:var(--bl);">'+d.name+'</span>'+(meta?' <span style="font-size:9px;color:var(--gr3);font-weight:400;white-space:nowrap;">'+meta+'</span>':'')+'</div></div>';
    // High-priority vaccination reminder (expired/missing + an upcoming/in-service paid booking).
    if(d.vacc){const vb=d.vacc;const tgt=vb.bk?(vb.bk.svc+' '+fmtDate(vb.bk.sd)):'the next visit';html+='<div onclick="openDogByCid(\''+d.cid+'\')" style="cursor:pointer;padding:8px 10px;border-top:2px solid var(--rd);background:var(--rdl);"><div style="font-size:10px;font-weight:800;color:var(--rd);">💉 Vaccination '+(vb.missing?'record missing':'EXPIRED'+(vb.vacc?' ('+fmtDate(vb.vacc)+')':''))+'</div><div style="font-size:9px;color:var(--rd);margin-top:1px;">Ask the owner to update records before '+tgt+'.</div></div>';}
    if(d.emerg){const eb=d.emerg;const tgt=eb.bk?(eb.bk.svc+' '+fmtDate(eb.bk.sd)):'the next visit';html+='<div onclick="openDogByCid(\''+d.cid+'\')" style="cursor:pointer;padding:8px 10px;border-top:2px solid var(--rd);background:var(--rdl);"><div style="font-size:10px;font-weight:800;color:var(--rd);">📞 Emergency contact not recorded</div><div style="font-size:9px;color:var(--rd);margin-top:1px;">Ask the owner for an emergency contact before '+tgt+'.</div></div>';}
    // All this dog's bookings in one list (soonest upcoming first, then most recent past) — each row carries its own status emoji.
    [...d.up,...d.past].forEach(x=>html+=bkRow(x));
    if(d.missing)html+='<div style="padding:6px 10px 7px;border-top:1px solid var(--gr4);"><div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px;">⚠️ Missing daily logs ('+d.missing.length+') — tap a date to add</div><div style="display:flex;flex-wrap:wrap;gap:4px;">'+d.missing.map(dt=>'<button onclick="event.stopPropagation();todoAddLog(\''+d.cid+'\',\''+dt+'\')" style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:99px;border:1px solid var(--or);background:var(--orxl);color:var(--cn);cursor:pointer;font-family:var(--fb);">+ '+fmtDate(dt)+'</button>').join('')+'</div></div>';
    html+='</div>';
  });
  if(noTrainingThisMonth)html+='<div onclick="showScreen(\'sc-training\')" style="cursor:pointer;padding:8px 10px;border:1px solid var(--gr4);border-radius:8px;"><div style="font-size:11px;font-weight:700;color:var(--bk);text-decoration:underline;">📚 No training logged this month</div><div style="font-size:9px;color:var(--gr2);">Log CPD/training for '+new Date().toLocaleString('en-GB',{month:'long',year:'numeric'})+'</div></div>';
  el.innerHTML=html;
}
// Populate the Check Dates screen (av_dog dropdown + default dates). Called on sc-checkdates show.
function initAvail(){
  const dse=document.getElementById('av_dog_search');if(dse)dse.value='';
  const av=document.getElementById('av_dog');if(av)av.value='';
  const res=document.getElementById('av_dog_results');if(res)res.style.display='none';
  const td=todayStr();const sd=document.getElementById('av_sd'),ed=document.getElementById('av_ed');if(sd&&!sd.value)sd.value=td;if(ed&&!ed.value)ed.value=td;
  _linkStart('av_sd','av_ed');// date-range linkage (10)
}
// Live typeahead for the Check-dates dog picker (11). av_dog (hidden) holds the chosen CID.
function filterAvDog(){
  const q=(document.getElementById('av_dog_search')?.value||'').trim().toLowerCase();
  const res=document.getElementById('av_dog_results');if(!res)return;
  const matches=[...allDogs].filter(d=>!q||(d.name||'').toLowerCase().includes(q)||(d.cid||'').toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||'')).slice(0,30);
  const exact=matches.some(d=>(d.name||'').toLowerCase()===q);
  res.innerHTML=matches.map(d=>'<div onmousedown="pickAvDog(\''+d.cid+'\')" style="padding:6px 9px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--gr5);">'+(d.name||'')+' <span style="color:var(--gr3);font-size:9px;">'+d.cid+(d.breed?' · '+d.breed:'')+'</span></div>').join('')
    +((q&&!exact)?'<div onmousedown="quickAddDogFromSearch()" style="padding:6px 9px;font-size:11px;color:var(--gn);font-weight:700;cursor:pointer;border-bottom:1px solid var(--gr5);">➕ Create new dog “'+document.getElementById('av_dog_search').value.trim()+'” (minimal profile)</div>':'')
    +'<div onmousedown="pickAvDog(\'\')" style="padding:6px 9px;font-size:10px;color:var(--gr2);cursor:pointer;">— No dog (skip compatibility) —</div>';
  res.style.display='block';
}
// (13) Create a minimal dog profile (name only) right from the Check-dates search, then select it — no booking required. Complete the full profile later.
async function quickAddDogFromSearch(){
  const name=(document.getElementById('av_dog_search').value||'').trim();if(!name)return;
  const cid=genId(name);
  const drow=rowFromMap(dogsHdrRow,{CustomerID:cid,DogName:name,Name:name,Status:'Enquiry'},TABS.DOGS.h);
  try{await appendRow(TABS.DOGS,drow);const dog=mapDog(drow,allDogs.length,mkHdr(dogsHdrRow));allDogs.push(dog);pickAvDog(cid);if(typeof toast==='function')toast('Minimal profile added for '+name+' ('+cid+') — complete it later','ok');}
  catch(e){alert('Error: '+e.message);}
}
function pickAvDog(cid){const d=_dogByCid(cid);document.getElementById('av_dog').value=cid||'';document.getElementById('av_dog_search').value=d?d.name:'';const res=document.getElementById('av_dog_results');if(res)res.style.display='none';}
function toggleAvailPanel(){
  const p=document.getElementById('availPanel');if(!p)return;const showing=p.style.display!=='none'&&p.style.display!=='';
  p.style.display=showing?'none':'block';
  if(!showing){
    const dse=document.getElementById('av_dog_search');if(dse)dse.value='';
    const sel=document.getElementById('av_dog');
    sel.innerHTML='<option value="">— No dog (skip compatibility check) —</option>';
    [...allDogs].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).forEach(d=>sel.add(new Option(d.name+' – '+d.cid,d.cid)));
    const td=todayStr();
    if(!document.getElementById('av_sd').value)document.getElementById('av_sd').value=td;
    if(!document.getElementById('av_ed').value)document.getElementById('av_ed').value=td;
  }
}
// --- gender / neuter parsed from the combined GenderStatus string ("Spayed female", "Neutered male", "Male") ---
function _gsGender(s){s=(s||'').toLowerCase();return /female|bitch/.test(s)?'female':/\bmale|\bdog\b/.test(s)?'male':'';}
function _gsNeuter(s){s=(s||'').toLowerCase();return /spay/.test(s)?'spayed':/neuter|castrat/.test(s)?'neutered':/intact|entire|\bfull\b|un-?neuter|un-?spay/.test(s)?'intact':'';}
// Compatibility result → colour/emoji/severity. Vocabulary: Friends/Good/Ignore/Not Good/Fight/Did not meet (+ legacy Suitable/Partial/Not Suitable).
function _compatMeta(result){const s=(result||'').toLowerCase().trim();
  if(s==='fight'||s==='not suitable')return{col:'var(--rd)',emoji:'🔴',bad:true,rank:0};
  if(s==='not good')return{col:'#EAB308',emoji:'🟡',bad:true,rank:1};
  if(s==='partial')return{col:'#EAB308',emoji:'🟡',bad:false,rank:2};
  if(s==='ignore')return{col:'var(--gr2)',emoji:'⚪',bad:false,rank:3};
  if(s==='friends'||s==='good'||s==='suitable')return{col:'var(--gn)',emoji:'🟢',bad:false,rank:4};
  return{col:'var(--gr3)',emoji:'⚪',bad:false,rank:5};}
// Queried dog's compatibility history: latest prior-meeting result per partner (met[]) + partners it rated Not Good/Fight (conflicts[], for the reference panel). "Did not meet" counts as not-met.
// A booking's dog CID (prefer CustomerID, else resolve by name for legacy rows).
function _bkCid(b){if(b.customerId)return b.customerId;const d=allDogs.find(x=>bkMatchesDog(b,x));return d?d.cid:'';}
// Compat history for the searched dog (by CID). Parties are resolved to canonical CIDs via _resolveParty so "CID Name" / "Name - CID" tokens all match (fixes #12/#15).
function _availRiskInfo(searchCid){
  const info={met:{},conflicts:[]};
  if(!searchCid)return info;const seen=new Set();
  trialLogs.forEach(t=>{
    const owner=_dogByCid(t.cid)||allDogs.find(d=>(d.name||'').toLowerCase()===(t.dog||'').toLowerCase());
    const parties=[{key:owner?owner.cid:((t.cid||t.dog||'').toLowerCase()),dog:owner}];
    (t.mixedWith||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean).forEach(tok=>{const d=_resolveParty(tok);const p=_parseParty(tok);parties.push({key:d?d.cid:((p.cid||p.name||tok).toLowerCase()),dog:d});});
    if(!parties.some(p=>p.key===searchCid))return;
    const result=(t.suitable||'').trim();const didNotMeet=result.toLowerCase()==='did not meet';
    parties.filter(p=>p.key!==searchCid).forEach(o=>{
      if(!didNotMeet){let m=info.met[o.key];if(!m){m={result:'',latest:'',firstDate:'',lastDate:'',count:0};info.met[o.key]=m;}const dt=t.date||'';m.count++;if(dt){if(!m.firstDate||dt<m.firstDate)m.firstDate=dt;if(dt>m.lastDate)m.lastDate=dt;if(dt>=m.latest){m.latest=dt;m.result=result;}}else if(!m.result)m.result=result;}
      if(_compatMeta(result).bad&&!seen.has(o.key)){seen.add(o.key);const p=o.dog;const gs=p?(p.genderStatus||p.gender||''):'';
        info.conflicts.push({cid:o.key,name:p?p.name:o.key,breed:(p&&p.breed)||'',age:p?ageYears(p.birthday):null,gender:_gsGender(gs),neuter:_gsNeuter(gs),weight:(p&&p.weight)||'',result});}
    });
  });
  return info;
}
// Compatibility flag for one overlapped dog vs the queried dog: met-before (coloured by result) or not-met (grey).
function _availFlag(cid,info){const m=cid&&info.met[cid];if(m){const meta=_compatMeta(m.result);return{met:true,col:meta.col,emoji:meta.emoji,result:m.result,first:m.firstDate,last:m.lastDate,count:m.count,rank:meta.rank};}return{met:false,col:'var(--gr3)',emoji:'⚪',result:'',first:'',last:'',count:0,rank:9};}
// Actual overlapping window (max start … min end, with times) between a booking and the searched range.
function _overlapWindow(b,sd,st,ed,et){const qS=new Date(sd+'T'+(st||'00:00')),qE=new Date(ed+'T'+(et||'23:59'));const bS=new Date(b.sd+'T'+(b.st||'00:00')),bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));return{s:bS>qS?bS:qS,e:bE<qE?bE:qE};}
// Inclusive count of days a booking is present within [sd,ed].
function _rangeDays(b,sd,ed){const s=normDate(b.sd),e=normDate(b.ed||b.sd);if(!s)return 0;const a=s<sd?sd:s,z=e>ed?ed:e;if(a>z)return 0;let c=0,d=new Date(a+'T12:00:00');const end=new Date(z+'T12:00:00');while(d<=end){c++;d.setDate(d.getDate()+1);}return c;}
// Compact month grid(s) covering the searched range; in-range days ringed (purple) + occupant names risk-coloured.
function _availPeriodGrid(sd,ed,info){
  let out='',guard=0;let cur=new Date(sd.slice(0,7)+'-01T12:00:00');const lastM=ed.slice(0,7);
  while(guard<12){const y=cur.getFullYear(),m=cur.getMonth();out+=_availMonthBlock(y,m,sd,ed,info);if(_dstr(cur).slice(0,7)===lastM)break;cur=new Date(y,m+1,1);guard++;}
  return out;
}
function _availMonthBlock(y,m,sd,ed,info){
  const title=new Date(y,m,1).toLocaleString('en-GB',{month:'long',year:'numeric'});
  const start=_mondayOf(_dstr(new Date(y,m,1)));const today=todayStr();let cells='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=_dstr(d);const inMo=d.getMonth()===m;const inR=ds>=sd&&ds<=ed;
    const occs=inR?occupantsOn(ds):[];const occ=occs.length;
    const bg=!inMo?'transparent':(inR?_capBg(occ):'var(--gr5)');
    const names=occs.map(b=>{const fl=_availFlag(_bkCid(b),info);
      return'<span style="display:block;font-size:8px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:'+fl.col+';font-weight:'+(fl.met?'800':'500')+';">'+(fl.met?fl.emoji:'')+(b.dog||'')+'</span>';}).join('');
    cells+='<div style="min-height:34px;border:1px solid var(--gr4);border-radius:4px;padding:2px;background:'+bg+';'+(inR?'box-shadow:inset 0 0 0 2px var(--pu);':'')+(inMo?'':'opacity:.3;')+(ds===today?'outline:1px dashed var(--bl);':'')+'">'
      +'<div style="font-size:8px;font-weight:700;display:flex;justify-content:space-between;color:'+(inMo?'var(--bk)':'var(--gr3)')+';"><span>'+d.getDate()+'</span>'+(inR&&occ?'<span style="color:'+_capCol(occ)+';">'+occ+'/'+CAL_CAP+'</span>':'')+'</div>'+names+'</div>';}
  const hd=['M','T','W','T','F','S','S'].map(x=>'<div style="font-size:7px;font-weight:700;color:var(--gr2);text-align:center;">'+x+'</div>').join('');
  return'<div style="font-size:10px;font-weight:800;margin:8px 0 3px;">'+title+'</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">'+hd+cells+'</div>';
}
function runAvailCheck(){
  const sd=document.getElementById('av_sd').value;const st=document.getElementById('av_st').value||'00:00';
  const ed=document.getElementById('av_ed').value;const et=document.getElementById('av_et').value||'23:59';
  const dogCid=document.getElementById('av_dog').value;const searchDog=_dogByCid(dogCid);const dogName=searchDog?searchDog.name:'';
  const el=document.getElementById('av_results');
  if(!sd||!ed){el.innerHTML='<div style="font-size:10px;color:var(--rd);margin-top:6px;">Please enter start and end dates.</div>';return;}
  const qStart=new Date(sd+'T'+st);const qEnd=new Date(ed+'T'+et);
  if(qEnd<=qStart){el.innerHTML='<div style="font-size:10px;color:var(--rd);margin-top:6px;">End must be after start.</div>';return;}
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const overlaps=bookings.filter(b=>{
    if(!active.includes(b.status)||!b.sd)return false;
    if(dogCid&&_bkCid(b)===dogCid)return false;// exclude the searched dog's own bookings
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  const info=_availRiskInfo(dogCid);
  const grid=_availPeriodGrid(sd,ed,info);// month view of the searched range (4a)
  const mw=document.getElementById('av_msgWrap');if(mw)mw.style.display='block';// reveal overlap-message builder (4c/4d)
  _fillOverlapMsgUI(sd,ed);// populate existing-owner picker + prefill new-dog name (7d/7f)
  if(!overlaps.length){el.innerHTML=grid+'<div style="font-size:11px;font-weight:600;color:var(--gn);padding:10px 12px;background:var(--gnl);border-radius:8px;margin-top:8px;">✅ No active bookings during this period</div>';return;}
  // Enrich + sort: met-before worst first (Fight→…→Friends), then not-met, then start date (7b).
  const enriched=overlaps.map(b=>{const prof=allDogs.find(d=>bkMatchesDog(b,d));return{b,prof,fl:_availFlag(_bkCid(b),info),days:_rangeDays(b,sd,ed)};});
  enriched.sort((a,c)=>(a.fl.rank-c.fl.rank)||((a.b.sd||'').localeCompare(c.b.sd||'')));
  const wd=D=>fmtDate(_dstr(D))+' '+String(D.getHours()).padStart(2,'0')+':'+String(D.getMinutes()).padStart(2,'0');
  const rows=enriched.map(({b,prof,fl,days})=>{
    const win=_overlapWindow(b,sd,st,ed,et);const winStr=wd(win.s)+' → '+wd(win.e);
    const clickAttr=prof?' onclick="openDogByCid(\''+prof.cid+'\')"':'';// note: no style here — the row's single style attr sets cursor (a 2nd style attr would be ignored)
    const _pa=prof?ageYears(prof.birthday):null;const attrs=[prof&&prof.breed,(_pa!=null?_pa+'y':''),[_gsNeuter(prof&&(prof.genderStatus||prof.gender)||''),_gsGender(prof&&(prof.genderStatus||prof.gender)||'')].filter(Boolean).join(' '),(prof&&prof.weight?prof.weight+'kg':'')].filter(Boolean).join('&nbsp;·&nbsp;');
    const _per=fl.first?((fl.last&&fl.last!==fl.first)?fmtDate(fl.first)+' – '+fmtDate(fl.last):fmtDate(fl.first)):'';
    const _chip='display:inline-block;margin-top:3px;padding:2px 9px;border-radius:99px;font-size:9px;font-weight:800;color:#fff;';
    const metNote=fl.met
      ?'<div style="'+_chip+'background:'+fl.col+';">🐾 Met before'+(_per?' · '+_per:'')+(fl.count>1?' · '+fl.count+'×':'')+' — '+fl.result+'</div>'
      :'<div style="'+_chip+'background:var(--gr3);">🐾 Not met before</div>';
    const flagDot='<span title="'+(fl.met?('met before: '+fl.result):'not met before')+'" style="width:11px;height:11px;border-radius:50%;background:'+fl.col+';display:inline-block;flex-shrink:0;'+(fl.met&&_compatMeta(fl.result).bad?'box-shadow:0 0 0 2px var(--rdl);':'')+'"></span>';
    const photo=prof?resolvePhotoUrl(prof):'';
    const av=photo?'<img src="'+photo+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--gr4);" onerror="this.style.display=\'none\'">':'<span style="width:34px;height:34px;border-radius:50%;background:var(--orl);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">🐶</span>';
    return'<div'+clickAttr+' style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gr4);'+(prof?'cursor:pointer;':'')+'">'
      +av
      +'<div style="flex:1;min-width:0;">'
      +'<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--bk);'+(prof?'text-decoration:underline;':'')+'">'+flagDot+'<span>'+(b.dog||'')+'</span><span style="font-size:9px;font-weight:700;color:var(--pu);white-space:nowrap;">· '+days+' day'+(days!==1?'s':'')+' overlap</span></div>'
      +(attrs?'<div style="font-size:9px;color:var(--gr2);">'+attrs+'</div>':'')
      +'<div style="font-size:9px;color:var(--gr2);">'+(b.svc||'')+'&nbsp;·&nbsp;overlaps '+winStr+'</div>'
      +metNote
      +'</div></div>';
  }).join('');
  const nBad=enriched.filter(e=>e.fl.met&&_compatMeta(e.fl.result).bad).length;
  const riskPill=(dogName&&nBad)?' · <span style="color:var(--rd);font-weight:800;">'+nBad+' flagged</span>':'';
  // Reference panel: the searched dog's past Not Good / Fight partners + their attributes (7b).
  const refPanel=(dogName&&info.conflicts.length)?'<div style="background:var(--rdl);border:1px solid var(--rd);border-radius:8px;padding:8px 10px;margin-top:8px;"><div style="font-size:9px;font-weight:800;color:var(--rd);margin-bottom:2px;">⚠️ '+dogName+' previously did NOT get on with (reference — watch for similar dogs):</div>'+info.conflicts.map(c=>'<div style="font-size:9px;color:var(--rd);">• '+c.name+' — '+[c.breed,(c.age!=null?c.age+'y':''),[c.neuter,c.gender].filter(Boolean).join(' '),(c.weight?c.weight+'kg':'')].filter(Boolean).join(' · ')+' <b>('+c.result+')</b></div>').join('')+'</div>':'';
  const legend=dogName?'<div style="font-size:8px;color:var(--gr2);margin:4px 0;">Met before → 🟢 Friends/Good · ⚪ Ignore · 🟡 Not Good · 🔴 Fight · otherwise "not met before" · purple ring = searched days</div>':'<div style="font-size:8px;color:var(--gr2);margin:4px 0;">Pick a dog above to see met-before compatibility · purple ring = searched days</div>';
  el.innerHTML=grid+legend+refPanel+'<div style="font-size:9px;font-weight:700;color:var(--gr2);text-transform:uppercase;letter-spacing:.05em;margin-top:8px;margin-bottom:4px;">'+overlaps.length+' booking'+(overlaps.length>1?'s':'')+' during this period'+riskPill+'</div>'+rows;
}
// --- Overlap approval message builder (4c/4d) ---
function _photoViewLink(d){if(!d||!d.photoUrl)return'';return /^https?:/.test(d.photoUrl)?d.photoUrl:gdriveDirect(d.photoUrl);}
// Dog one-liner incl. a clickable photo link (customer can click to view). Reuses fmtDogDesc (age · gender/neuter · breed).
function fmtDogDescPhoto(d){if(!d)return'';let s=fmtDogDesc(d).replace('🐾 ','');const lk=_photoViewLink(d);if(lk)s+=' — 📷 photo: '+lk;return s;}
// Find an authored "Overlapped" template (new/existing) if one exists.
// Pick one of the user's authored "Overlapped" templates from the Templates page. kind='new' → name has "new"; kind='existing' → name has "exist", else any Overlapped template without "new".
function _overlapTpl(kind){const ts=(msgTpls||[]).filter(x=>(x.cat||'').toLowerCase()==='overlapped');if(kind==='new')return ts.find(x=>/new/i.test(x.name||''))||null;return ts.find(x=>/exist/i.test(x.name||''))||ts.find(x=>!/new/i.test(x.name||''))||null;}
// Per-dog placeholder values used by the overlap templates.
function _dogFactVars(d){const gs=d?(d.genderStatus||d.gender||''):'';const g=_gsGender(gs),nt=_gsNeuter(gs),a=d?ageYears(d.birthday):null;return{breed:(d&&d.breed)||'',dogs_breed:(d&&d.breed)||'',gender:g,neutered_spayed:nt,age:(a!=null?String(a):''),He_or_she:(g==='female'?'She':g==='male'?'He':''),he_or_she:(g==='female'?'she':g==='male'?'he':'')};}
// Replace only the {{keys}} we have a non-empty value for; unknown/blank ones are left intact for staff to fill.
function _fillTplVars(tpl,vars){let m=tpl;Object.keys(vars).forEach(k=>{const v=vars[k];if(v!==''&&v!=null)m=m.replace(new RegExp('\\{\\{\\s*'+k+'\\s*\\}\\}','gi'),v);});return m;}
function _overlapDogs(sd,ed){
  const st=document.getElementById('av_st').value||'00:00',et=document.getElementById('av_et').value||'23:59';
  const qStart=new Date(sd+'T'+st),qEnd=new Date(ed+'T'+et);
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const dogCid=document.getElementById('av_dog').value;// exclude the searched dog itself
  const overlaps=bookings.filter(b=>{if(!active.includes(b.status)||!b.sd)return false;if(dogCid&&_bkCid(b)===dogCid)return false;const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));return bS<qEnd&&bE>qStart;});
  const seen=new Set(),out=[];
  overlaps.forEach(b=>{const p=allDogs.find(d=>bkMatchesDog(b,d));const key=(p&&p.cid)||b.dog;if(!key||seen.has(key))return;seen.add(key);out.push(p||{name:b.dog||''});});
  return out;
}
// Overlapped-dog one-liner by ATTRIBUTES (no name): breed · gender · spayed/neutered/full · weight (7h).
function _dogAttrLine(d){if(!d)return'';const gs=d.genderStatus||d.gender||'';const g=_gsGender(gs);let n=_gsNeuter(gs);if(n==='intact')n='full';const gn=[n,g].filter(Boolean).join(' ');const a=ageYears(d.birthday);return[d.breed,(a!=null?a+'y':''),gn,(d.weight?d.weight+'kg':'')].filter(Boolean).join(', ');}
// Populate the overlap-message UI (existing-owner picker + prefill new-dog name) after a check runs.
function _fillOverlapMsgUI(sd,ed){
  const _sd=_dogByCid(document.getElementById('av_dog').value);const dm=document.getElementById('av_msg_dog');if(dm&&!dm.value)dm.value=_sd?_sd.name:'';
  const sel=document.getElementById('av_msg_exist');if(sel){const od=_overlapDogs(sd,ed);sel.innerHTML=od.length?od.map((d,i)=>'<option value="'+i+'">'+(d.name||'(dog)')+(d.owner?' — '+d.owner:'')+'</option>').join(''):'<option value="">(no overlapping owners)</option>';}
}
function buildOverlapMsg(kind){
  const sd=document.getElementById('av_sd').value,ed=document.getElementById('av_ed').value;
  const out=document.getElementById('av_msgOut');if(!sd||!ed){out.value='Run the availability check first (enter dates).';return;}
  const dates=fmtDate(sd)+(ed&&ed!==sd?' – '+fmtDate(ed):'');
  const monthName=new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'long',year:'numeric'});
  const overDogs=_overlapDogs(sd,ed);
  const nd=_dogByCid(document.getElementById('av_dog').value)||null;const dogName=nd?nd.name:'';
  let msg='';
  if(kind==='new'){
    // Availability reply = the NEW-customer message (7e). Owner/dog from inputs (7d). Overlapped dogs by attributes, not names (7h).
    const owner=(gv('av_msg_owner')||'').trim()||(nd&&nd.owner)||'there';
    const dogsNm=(gv('av_msg_dog')||'').trim()||dogName||'your dog(s)';
    let m=getTpls().avail||TP_AVAIL;
    const availability=overDogs.length?'We have some other dogs staying during part of this period — see below for details.':"Good news, we're available for these dates! ✅";
    const overlapBlock=overDogs.length?('Dogs already booked during this period:\n'+overDogs.map(d=>'• '+_dogAttrLine(d)).join('\n')+'\n\n'):'';
    m=m.replace(/\{\{ownerName\}\}/g,owner).replace(/\{\{dates\}\}/g,dates).replace(/\{\{dogs\}\}/g,dogsNm).replace(/\{\{availability\}\}/g,availability).replace(/\{\{overlapBlock\}\}/g,overlapBlock).replace(/\{\{[^}]*\}\}/g,'');
    msg=m.replace(/\n{3,}/g,'\n\n').trim();
  }else{
    // EXISTING customer — one owner at a time (7f). The NEW dog fills breed/gender/age/He_or_she; the picked owner+dog fill dog_owner/dogs_name.
    if(!overDogs.length){out.value='No overlapping bookings found for '+dates+'.';return;}
    const sel=document.getElementById('av_msg_exist');let idx=sel?parseInt(sel.value):0;if(isNaN(idx))idx=0;
    const d=overDogs[idx]||overDogs[0];
    const tpl=_overlapTpl('existing');
    const vars=Object.assign({month:monthName,dates},_dogFactVars(nd),{dogs_name:d.name||'',dog_owner:d.owner||''});
    if(tpl&&tpl.content){msg=_fillTplVars(tpl.content,vars);}
    else{const FALLBACK_EXIST='Hi {{dog_owner}},\n\nHope you and {{dogs_name}} are both keeping well! 🧡\n\nWe’ve had a request from another owner to board their {{dogs_breed}} with us, which overlaps with {{dogs_name}}’s booking in {{month}}. {{He_or_she}} is friendly with other dogs.\n\nWould you be comfortable with {{He_or_she}} staying alongside {{dogs_name}} during that time?\n\nBest regards,\nKatie & Osbert 🐾';msg=_fillTplVars(FALLBACK_EXIST,vars);}
    const lk=nd?_photoViewLink(nd):'';if(lk&&!/https?:\/\//.test(msg))msg+='\n\n📷 '+(nd.name||'photo')+': '+lk;
  }
  out.value=msg;
}
function copyOverlapMsg(){const v=document.getElementById('av_msgOut').value;if(!v){return;}copyText(v);const b=document.getElementById('av_msgCopyBtn');if(b){const o=b.textContent;b.textContent='Copied ✓';b.style.background='var(--gn)';setTimeout(()=>{b.textContent=o;b.style.background='var(--pu)';},1800);}}
// --- Quick-add a booking with a minimal dog profile from the search page (4e) ---
function toggleQuickBk(){const w=document.getElementById('av_qbkWrap');if(!w)return;w.style.display=w.style.display==='none'?'block':'none';if(w.style.display==='block'){const d0=_dogByCid(document.getElementById('av_dog').value);if(d0&&!document.getElementById('qbk_dog').value)document.getElementById('qbk_dog').value=d0.name;}}
async function quickAddBooking(){
  const msg=document.getElementById('qbk_msg');
  const name=(document.getElementById('qbk_dog').value||'').trim();
  const owner=(document.getElementById('qbk_owner').value||'').trim();
  const gender=document.getElementById('qbk_gender').value;
  const neut=document.getElementById('qbk_neut').value;
  const svc=document.getElementById('qbk_svc').value;
  const status=document.getElementById('qbk_status').value;
  const sd=document.getElementById('av_sd').value,ed=document.getElementById('av_ed').value;
  const stime=document.getElementById('av_st').value||'09:00',etime=document.getElementById('av_et').value||'17:00';
  const setMsg=(t,c)=>{msg.textContent=t;msg.style.color=c;};
  if(!name){setMsg('Enter a dog name.','var(--rd)');return;}
  if(!sd||!ed){setMsg('Set the From/To dates above first.','var(--rd)');return;}
  const genderStatus=(neut&&neut!=='Intact')?(neut+' '+(gender||'').toLowerCase()).trim():(gender||'');
  const btn=document.getElementById('qbk_save');btn.disabled=true;setMsg('Saving…','var(--gr2)');
  try{
    let dog=allDogs.find(d=>(d.name||'').toLowerCase()===name.toLowerCase()&&(owner?(d.owner||'').toLowerCase()===owner.toLowerCase():true));
    if(!dog){
      const cid=genId(name);
      const drow=rowFromMap(dogsHdrRow,{CustomerID:cid,DogName:name,Name:name,GenderStatus:genderStatus,Owner1:owner,Status:'Enquiry'},TABS.DOGS.h);
      await appendRow(TABS.DOGS,drow);
      dog=mapDog(drow,allDogs.length,mkHdr(dogsHdrRow));allDogs.push(dog);
    }
    const id=nextBkId(sd);const month=new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'});
    const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId:dog.cid,dog:dog.name,id,svc,sd,st:stime,ed,et:etime,ch:'TCL',status,month,rem:['','','','',''],wf:{}}),TABS.BK.h);
    await appendRow(TABS.BK,vals);
    const mv=[...vals];mv[1]=dog.name;bookings.push(mapBk(mv,bookings.length,mkHdr(bkHdrRow)));
    setMsg('✅ '+svc+' booking added for '+dog.name+' ('+dog.cid+') — complete the full profile later.','var(--gn)');
    document.getElementById('qbk_dog').value='';document.getElementById('qbk_owner').value='';
    runAvailCheck();if(typeof updatePendingBadge==='function')updatePendingBadge();
  }catch(e){setMsg('Error: '+e.message,'var(--rd)');}
  finally{btn.disabled=false;}
}
// Jump to the Quote page prefilled from the Check-dates search (dog, service, dates, times) — works for existing dogs (or ones just created via the typeahead).
function quoteFromSearch(){
  const cid=document.getElementById('av_dog').value;
  if(!cid){alert('Pick a dog first — type its name above (or create a minimal profile).');return;}
  const svcMap={Boarding:'boarding',DayCare:'daycare',Walking:'walk','Drop-in':'dropin','Dog Sit':'dogsit','Pet Taxi':'taxi',Training:'training'};
  const av=document.getElementById('av_svc')?.value||'Boarding';
  _selDogs=[cid];_addDogs=[];_mainDog=cid;
  showScreen('sc-quote');
  const set=(id,v)=>{const e=document.getElementById(id);if(e&&v!=null)e.value=v;};
  set('ml_svc',svcMap[av]||'boarding');if(typeof onMLSvc==='function')onMLSvc();
  set('ml_sd',document.getElementById('av_sd').value);set('ml_ed',document.getElementById('av_ed').value);
  set('ml_st',document.getElementById('av_st').value||'09:00');set('ml_et',document.getElementById('av_et').value||'18:00');
  const d=_dogByCid(cid);const ownerEl=document.getElementById('q_owner');if(ownerEl&&d)ownerEl.value=d.owner||'';
  buildQDogMS();buildMainDogBtns&&buildMainDogBtns();
  if(typeof addSvcLine==='function')addSvcLine();// auto-add the prefilled service line so the quote is ready
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
    const dogRows=await readSheet(TABS.DOGS,'A1:CZ');const dh=mkHdr(dogRows[0]||[]);dogsHdrRow=dogRows[0]||[];allDogs=dogRows.slice(1).map((r,i)=>mapDog(r,i,dh)).filter(d=>d.name.trim());// wide range so appended cols (Sociability/Insurance/split-Emergency at BM–BQ, +future) are read — mapping is by header name
    const bkRows=await readSheet(TABS.BK,'A1:BZ').catch(()=>[]);const bh=mkHdr(bkRows[0]||[]);bkHdrRow=bkRows[0]||[];bookings=bkRows.slice(1).map((r,i)=>mapBk(r,i,bh));
    const cr=await readSheet(TABS.COSTS,'A1:D').catch(()=>[]);costsHdrRow=cr[0]||[];const ch=mkHdr(cr[0]||[]);costs=cr.slice(1).map((r,i)=>({date:r[ch['Date']??-1]||'',cat:r[ch['Category']??-1]||'',amount:parseFloat(r[ch['Amount']??-1])||0,notes:r[ch['Notes']??-1]||'',ri:i+2})).filter(c=>c.date||c.notes||c.amount);// drop blank/cleared rows so a deleted cost doesn't reappear as an empty row after sync (map before filter keeps ri = real sheet row)
    const al=await readSheet(TABS.ACTLOG,'A1:G').catch(()=>[]);actlogHdrRow=al[0]||[];const alh=mkHdr(al[0]||[]);actLogs=al.slice(1).map(r=>({date:r[alh['Date']??-1]||'',activity:r[alh['Activity']??-1]||'',dogs:r[alh['DogName']??-1]||'',staff:r[alh['Staff']??-1]||'',dur:r[alh['Duration']??-1]||'',notes:r[alh['Notes']??-1]||''}));
    const tl=await readSheet(TABS.TRIAL,'A1:G').catch(()=>[]);const tlh=mkHdr(tl[0]||[]);trialHdrRow=tl[0]||[];trialLogs=tl.slice(1).map((r,i)=>{const rv=n=>tlh[n]!==undefined?r[tlh[n]]||'':'';return{cid:rv('CustomerID'),dog:rv('DogName'),date:rv('Date'),mixedWith:rv('MixedWith'),obs:rv('Observations'),suitable:rv('Suitable'),ri:i+2};});
    const dl=await readSheet(TABS.DAILY,'A1:R').catch(()=>[]);const dlh=mkHdr(dl[0]||[]);dailyHdrRow=dl[0]||[];dailyLogRows=dl.slice(1);dailyLogSet=new Set(dailyLogRows.map(r=>(dlh['CustomerID']!==undefined?r[dlh['CustomerID']]||'':'')+'_'+(dlh['Date']!==undefined?r[dlh['Date']]||'':'')));
    const [hlR,ftR,trR,acR]=await Promise.all([readSheet(TABS.HEALTH,'A1:Z1').catch(()=>[]),readSheet(TABS.FIGHT,'A1:Z1').catch(()=>[]),readSheet(TABS.TRANSPORT,'A1:Z1').catch(()=>[]),readSheet(TABS.ACTS,'A1:Z1').catch(()=>[])]);healthHdrRow=hlR[0]||[];fightHdrRow=ftR[0]||[];transportHdrRow=trR[0]||[];actsHdrRow=acR[0]||[];
    // Sync targets from sheet into localStorage
    syncTargetsFromSheet().catch(()=>{});
    // Sync activities library from sheet so sheet edits show in app
    syncActsFromSheet(true).catch(()=>{});
    // Sync rates + holiday ranges from sheet so pricing is consistent across devices
    await syncSettingsFromSheet();
    // Photos come from the dog's PhotoURL (Drive link) in the Dogs sheet — no local caching.
    renderBoard();updatePL();renderCostTable();refreshDogDropdowns();updatePendingBadge();
    await syncCurrentScreen();
    _lastSync=Date.now();updateSyncInfo();
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
  else if(id==='sc-rates')loadQSettings();            // refresh rate fields from freshly-synced cache
  else if(id==='sc-holidays')renderHolYrBtns();        // refresh holiday list from freshly-synced cache
  else if(id==='sc-calendar')renderCalendar();
  else if(id==='sc-analysis')renderAnalysis();
  else if(id==='sc-todo')renderPendingPanel();
  else if(id==='sc-checkdates')initAvail();
}
function bkMatchesDog(b,d){return b.customerId?b.customerId===d.cid:b.dog.toLowerCase()===(d.name||'').toLowerCase();}
function dogMatchesCidOrName(cid,name,dCid,dName){return cid?cid===dCid:(name||'').toLowerCase()===(dName||'').toLowerCase();}
function mapDog(r,i,h){
  const g=n=>(h&&h[n]!==undefined)?( r[h[n]]||''):'';
  return{cid:g('CustomerID')||genId(g('DogName')||g('Name')||'Dog'),
    name:g('DogName')||g('Name'),
    breed:g('Breed'),gender:g('GenderStatus'),birthday:g('Birthday'),bdayType:g('BirthdayType')||'exact',
    weight:g('Weight'),neut:g('GenderStatus'),genderStatus:g('GenderStatus'),chip:g('ChipID'),
    rescue:g('Rescue'),nervous:g('Nervous'),anxiety:g('SepAnxiety'),dogfriends:g('DogFriends'),
    food:g('FoodType'),foodMeasure:g('FoodMeasure'),dietNotes:g('DietNotes'),allerg:g('Allergies'),
    med:g('Medical'),medSchedule:g('MedSchedule'),fears:g('Fears'),notouch:g('Untouchable'),
    vacc:g('Vaccination'),flea:g('Flea'),behav:g('Behaviour'),walk:g('WalkSchedule'),car:g('CarSeat'),
    sleep:g('SleepLocation'),escape:g('EscapeAttempts'),toilet:g('ToiletTrained'),alone:g('AloneHours'),
    commands:g('TrainingCommands'),sitters:g('PrevSitters'),updates:g('UpdateFrequency'),
    rel:g('Relationships'),notes:g('AdditionalNotes'),owner:g('Owner1'),phone:g('Phone1'),
    owner2:g('Owner2'),phone2:g('Phone2'),owner3:g('Owner3'),phone3:g('Phone3'),
    addr:g('Address'),postcode:g('Postcode'),emergency:g('Emergency'),vet:g('Vet'),ins:g('Insurance'),insUrl:g('InsuranceURL'),emergName:g('EmergencyName'),emergPhone:g('EmergencyPhone'),emergRel:g('EmergencyRelationship'),
    meetgreet:g('MeetGreetDate'),referral:g('Referral'),refNotes:g('ReferralNotes'),svc:g('Service'),
    status:g('Status'),remarks:g('Remarks'),emoji:'',jog:g('Jogging'),vaccUrl:g('VaccinationURL'),
    photoUrl:g('PhotoURL'),motivation:g('Motivation'),
    barking:g('Barking'),socia:g('Sociability'),rmHome:g('RemarkAtHome'),rmOut:g('RemarkOutdoor'),rmIn:g('RemarkIndoor'),rmSleep:g('RemarkSleeping'),rmFood:g('RemarkFood'),rmDogs:g('RemarkWithDogs'),
    rowIdx:i+2};
}
function mapBk(r,i,h){
  const gi=n=>h&&h[n]!==undefined?h[n]:null;
  const rv=n=>{const idx=gi(n);return idx!==null?r[idx]||'':'';}
  return{id:rv('ID'),dog:rv('DogName'),customerId:rv('CustomerID'),svc:rv('ServiceType'),
    sd:rv('StartDate'),st:rv('StartTime'),ed:rv('EndDate'),et:rv('EndTime'),
    dropLoc:rv('DropoffLocation'),pickLoc:rv('PickupLocation'),
    rev:parseFloat(rv('Revenue'))||0,tips:parseFloat(rv('Tips'))||0,
    prepay:parseFloat(rv('Prepayment'))||0,finalPay:parseFloat(rv('FinalPayment'))||0,
    unit:parseFloat(rv('UnitCost'))||0,discNotes:rv('DiscountNotes'),
    roverPct:parseFloat(rv('RoverCommissionPct'))||0,roverAmt:parseFloat(rv('RoverCommissionGBP'))||0,
    ch:rv('Channel')||'TCL',pay:rv('Payment'),status:rv('Status'),
    priv:rv('Private')==='Private',month:rv('Month'),rating:rv('Rating'),feedback:rv('Feedback'),
    rem:[rv('Rem1'),rv('Rem2'),rv('Rem3'),rv('Rem4'),rv('Rem5')],
    wf:{whatsapp:rv('WF_WhatsApp'),docsReq:rv('WF_DocsReq'),consentSent:rv('WF_ConsentSent'),packingList:rv('WF_PackingList'),docsReceived:rv('WF_DocsReceived'),
      consentSigned:rv('WF_ConsentSigned'),dropoff:rv('WF_DropoffReminder'),
      pickup:rv('WF_PickupReminder'),finalpay:rv('WF_FinalPayReminder'),
      reviewReq:rv('WF_ReviewRequest'),review:rv('WF_Review'),
      dailyLogs:rv('WF_DailyLogs'),compat:rv('WF_Compat'),dbUpdated:rv('WF_DatabaseUpdated'),staffNotes:rv('WF_StaffNotes')},
    bookingRef:rv('BookingRef'),prepayRef:rv('PrepaymentRef'),finalPayRef:rv('FinalPaymentRef'),
    ri:i+2};
}
function bkFieldMap(bk){const rem=bk.rem||['','','','','']; const wf=bk.wf||{};return{CustomerID:bk.customerId,DogName:bk.dog,ID:bk.id,ServiceType:bk.svc,StartDate:bk.sd,StartTime:bk.st,EndDate:bk.ed,EndTime:bk.et,DropoffLocation:bk.dropLoc,PickupLocation:bk.pickLoc,Revenue:bk.rev,Tips:bk.tips,Prepayment:bk.prepay,FinalPayment:bk.finalPay,UnitCost:bk.unit,DiscountNotes:bk.discNotes,RoverCommissionPct:bk.roverPct,RoverCommissionGBP:bk.roverAmt,Channel:bk.ch,Payment:bk.pay,Status:bk.status,Private:bk.priv?'Private':'',Month:bk.month,Rating:bk.rating,Feedback:bk.feedback,Rem1:rem[0]||'',Rem2:rem[1]||'',Rem3:rem[2]||'',Rem4:rem[3]||'',Rem5:rem[4]||'',WF_WhatsApp:wf.whatsapp||'',WF_PackingList:wf.packingList||'',WF_DocsReq:wf.docsReq||'',WF_ConsentSent:wf.consentSent||'',WF_DocsReceived:wf.docsReceived||'',WF_ConsentSigned:wf.consentSigned||'',WF_DropoffReminder:wf.dropoff||'',WF_PickupReminder:wf.pickup||'',WF_FinalPayReminder:wf.finalpay||'',WF_ReviewRequest:wf.reviewReq||'',WF_Review:wf.review||'',WF_DailyLogs:wf.dailyLogs||'',WF_Compat:wf.compat||'',WF_DatabaseUpdated:wf.dbUpdated||'',WF_StaffNotes:wf.staffNotes||'',BookingRef:bk.bookingRef||'',PrepaymentRef:bk.prepayRef||'',FinalPaymentRef:bk.finalPayRef||''};}
function bkRowVals(bk){return rowFromMap(bkHdrRow,bkFieldMap(bk),TABS.BK.h);}
function renderBoard(){
  const q=(document.getElementById('dogSearch')?.value||'').toLowerCase();const today=todayStr();
  const in7=new Date();in7.setDate(in7.getDate()+7);const in7s=in7.toISOString().split('T')[0];
  const validBks=bookings.filter(b=>!['Cancelled','Canceled'].includes(b.status));
  let dogs=q?allDogs.filter(d=>d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)||(d.breed||'').toLowerCase().includes(q)):allDogs;
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
    const photo=resolvePhotoUrl(dog);const td=JSON.parse(localStorage.getItem('log_'+dog.cid+'_'+todayStr())||'{}');const hasAlert=[dog.med,dog.medSchedule,dog.allerg].some(v=>{const s=(v||'').toLowerCase().trim();return s&&s!=='no'&&s!=='none'&&s!=='n/a'&&s!=='na'&&s!=='-';});
    const vaccExpired=dog.vacc?(()=>{try{const vd=new Date(dog.vacc+'T12:00:00');const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);return vd<cutoff;}catch(e){return false;}})():false;
    // Birthday month celebration
    const bdMonth=dog.birthday?parseInt(dog.birthday.split('-')[1]):0;const isBdayMo=bdMonth&&bdMonth===(new Date().getMonth()+1);
    // Booking info strip
    const bkStrip=bk?'<div style="display:flex;align-items:center;gap:4px;margin-top:4px;flex-wrap:wrap;">'+(bk.svc?'<span style="font-size:8px;font-weight:700;background:var(--bll);color:var(--bl);padding:1px 5px;border-radius:99px;">'+bk.svc+'</span>':'')+'<span class="spill '+(scMap[bk.status]||'sb')+'" style="font-size:7px;padding:1px 5px;">'+bk.status+'</span><span style="font-size:8px;color:var(--gr3);">'+fmtDate(bk.sd)+(bk.ed&&bk.ed!==bk.sd?' → '+fmtDate(bk.ed):'')+'</span></div>':'';
    const card=document.createElement('div');card.className='dcard'+(cls?' '+cls:'');card.onclick=()=>openProfile(dog);
    card.innerHTML='<div class="dc-photo">'+(photo?'<img src="'+photo+'" alt="" onerror="this.style.display=\'none\'">':'')+(cls==='on'?'<div class="live-badge">LIVE</div>':'')+'</div><div class="dcb"><div class="dcb-n">'+dog.name+(isBdayMo?' 🎂':'')+'</div><div class="dcb-b">'+(dog.breed||'-')+(dog.birthday?' - '+calcAge(dog.birthday):'')+'</div><div class="dcb-id">'+dog.cid+'</div>'+bkStrip+'<div class="dcb-ch" style="margin-top:4px;">'+(td.breakfast==='yes'||td.breakfast===true?'<span class="chip cg">Fed</span>':'')+(td.walkAm==='yes'||td.walkAm===true?'<span class="chip cg">Walked</span>':'')+(hasAlert?'<span class="chip cr">Alert</span>':'')+(vaccExpired?'<span class="chip cr">Vacc expired</span>':'')+'</div></div>';
    c.appendChild(card);
  });
}
function dogOptLabel(d){return d.name+(d.breed?' · '+d.breed:'')+' · '+d.cid;}
function refreshDogDropdowns(){const sel=document.getElementById('bm_dog');if(sel){const cur=sel.value;sel.innerHTML='<option value="">Select dog</option>';allDogs.forEach(d=>sel.add(new Option(dogOptLabel(d),d.cid)));if(cur)sel.value=cur;}buildQDogMS();}
function filterBmDog(){const q=(document.getElementById('bm_dog_search')?.value||'').toLowerCase();const sel=document.getElementById('bm_dog');if(!sel)return;const prev=sel.value;sel.innerHTML='<option value="">Select dog</option>';allDogs.filter(d=>!q||d.name.toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)).forEach(d=>sel.add(new Option(dogOptLabel(d),d.cid)));if(prev)sel.value=prev;}

function waLink(ph){if(!ph)return'';const n=ph.replace(/[^0-9]/g,'');return'<a href="https://wa.me/'+n+'" target="_blank" style="color:var(--gn);font-weight:600;text-decoration:none;">'+ph+' 💬</a>';}
// ==================== PROFILE ====================
function openProfile(dog){
  curDog=dog;histCache={};
  const photo=resolvePhotoUrl(dog);
  document.getElementById('profName').textContent=dog.name;document.getElementById('profMeta').textContent=[dog.breed,dog.weight?dog.weight+'kg':'',calcAge(dog.birthday)].filter(Boolean).join(' - ');document.getElementById('profId').textContent=dog.cid;document.getElementById('profEmoji').textContent='';
  const wrap=document.getElementById('profPhotoWrap');let img=wrap.querySelector('img.pl');
  if(!img){img=document.createElement('img');img.className='pl';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';wrap.appendChild(img);}
  img.onerror=()=>{img.style.display='none';};img.style.display=photo?'block':'none';if(photo)img.src=photo;updateCopyPhotoBtn();
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
  const today=todayStr();
  // Prefer the latest SAVED log from the sheet (shared across devices); fall back to the local working copy.
  const cid=curDog&&curDog.cid;const sheetSv=svFromSheet(cid,today);
  const sv=sheetSv||JSON.parse(localStorage.getItem('log_'+cid+'_'+today)||'{}');
  if(sheetSv&&cid)localStorage.setItem('log_'+cid+'_'+today,JSON.stringify(sv));
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
  if(!_anySet){const noMed=v=>{const s=(v||'').toLowerCase().trim();return !s||s==='no'||s==='none'||s==='n/a'||s==='na'||s==='-';};const _noMeds=noMed(curDog.med)&&noMed(curDog.medSchedule);_TILE_KEYS.forEach(k=>{sv[k]=(_noMeds&&(k==='medAm'||k==='medPm'))?'na':'todo';});localStorage.setItem('log_'+curDog.cid+'_'+todayStr(),JSON.stringify(sv));}// (14) current-date only: med tiles default to N/A when the dog needs no medication
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
// Load a saved daily-log (from the Daily-Log sheet, held in memory) into tile-state form, so every device
// sees the latest saved log. Returns null if no row for that dog+date.
const _DL_FIELD={breakfast:'Breakfast',medAm:'MedAM',dinner:'Dinner',medPm:'MedPM',snack:'Snack',walkAm:'WalkAM',garden:'Garden',walkPm:'WalkPM',beforeSleep:'BeforeSleep',game:'Game',bowl:'Bowl',room:'Room',garment:'Garment'};
function svFromSheet(cid,date){
  if(!cid||!date)return null;const h=mkHdr(dailyHdrRow);const ci=h['CustomerID']??0,di=h['Date']??2;
  const r=(dailyLogRows||[]).find(x=>((x[ci]||'')===cid&&(x[di]||'')===date));
  if(!r)return null;const gv2=n=>h[n]!==undefined?(r[h[n]]||''):'';
  const sv={};Object.keys(_DL_FIELD).forEach(k=>{const st=parseState(gv2(_DL_FIELD[k]));if(st)sv[k]=st;});
  sv.notes=gv2('Notes');sv.priv=(gv2('Private')==='Private');return sv;
}
function togTile(k){if(!curDog)return;const lk='log_'+curDog.cid+'_'+todayStr();const sv=JSON.parse(localStorage.getItem(lk)||'{}');const cycle=['','todo','yes','refused','na'];sv[k]=cycle[(cycle.indexOf(sv[k]||'')+1)%cycle.length];localStorage.setItem(lk,JSON.stringify(sv));const t=document.getElementById('tl_'+k);if(t){['done-yes','done-refused','done-todo','done-na'].forEach(c=>t.classList.remove(c));if(sv[k])t.classList.add('done-'+sv[k]);const lblEl=t.querySelector('.t-lbl');if(lblEl){const si=sv[k]==='yes'?' ✓':sv[k]==='refused'?' ✗':sv[k]==='todo'?' ○':sv[k]==='na'?' —':'';lblEl.textContent=(t.dataset.lbl||'')+si;}}}
function togInc(k){const el=document.getElementById('inc_'+k);if(!el)return;el.classList.toggle('open');const lk='log_'+curDog.cid+'_'+todayStr();const sv=JSON.parse(localStorage.getItem(lk)||'{}');sv['inc_'+k]=el.classList.contains('open');localStorage.setItem(lk,JSON.stringify(sv));}
function setImp(p,val,e){e.stopPropagation();const pfx=p==='health'?'ih':'if';document.querySelectorAll('#inc_'+p+' .ib').forEach(b=>{b.className='ib';if(b.textContent===val)b.classList.add(val==='Low'?'il':val==='Med'?'im':'ih');});const el=document.getElementById(pfx+'_imp');if(el)el.value=val;}
async function saveLog(){
  if(!curDog)return;const today=todayStr();const lk='log_'+curDog.cid+'_'+today;
  const sv=JSON.parse(localStorage.getItem(lk)||'{}');sv.notes=document.getElementById('logNotes').value;sv.priv=document.getElementById('logPrivate').checked;localStorage.setItem(lk,JSON.stringify(sv));
  const st=document.getElementById('logStatus');st.style.display='block';st.style.color='var(--gr2)';st.textContent='Saving...';
  const g=k=>{const s=sv[k]||'';return s==='yes'?'[Y]':s==='refused'?'[Refused]':s==='todo'?'[To-do]':s==='na'?'[N/A]':'[ ]';};const priv=sv.priv?'Private':'';
  const row=rowFromMap(dailyHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Breakfast:g('breakfast'),MedAM:g('medAm'),Dinner:g('dinner'),MedPM:g('medPm'),Snack:g('snack'),WalkAM:g('walkAm'),Garden:g('garden'),WalkPM:g('walkPm'),BeforeSleep:g('beforeSleep'),Game:g('game'),Bowl:g('bowl'),Room:g('room'),Garment:g('garment'),Notes:sv.notes||'',Private:priv},TABS.DAILY.h);
  // Keep the in-memory Daily-Log cache in sync so re-opening shows the just-saved state (not a stale sheet read)
  {const _h=mkHdr(dailyHdrRow);const _ci=_h['CustomerID']??0,_di=_h['Date']??2;const _mi=dailyLogRows.findIndex(x=>(x[_ci]||'')===curDog.cid&&(x[_di]||'')===today);if(_mi>=0)dailyLogRows[_mi]=row;else dailyLogRows.push(row);dailyLogSet.add(curDog.cid+'_'+today);}
  const rawDaily=await readSheet(TABS.DAILY,'A1:R').catch(()=>[]);const dh_sl=mkHdr(rawDaily[0]||[]);const allDaily=rawDaily.slice(1);
  const existIdx=allDaily.findIndex(r=>(r[dh_sl['Date']??2]===today&&r[dh_sl['CustomerID']??0]===curDog.cid)||(r[0]===today&&r[15]===curDog.cid));
  const saves=[existIdx>=0?updateRow(TABS.DAILY,existIdx+2,row):appendRow(TABS.DAILY,row)];
  _logSelectedActs.forEach(act=>saves.push(appendRow(TABS.ACTLOG,rowFromMap(actlogHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Activity:act,Staff:'',Duration:'',Notes:sv.notes||''},TABS.ACTLOG.h))));
  if(document.getElementById('inc_health')?.classList.contains('open'))saves.push(appendRow(TABS.HEALTH,rowFromMap(healthHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Owner:curDog.owner||'',Issue:gv('ih_issue'),Category:gv('ih_cat'),Location:'',Importance:gv('ih_imp'),Description:gv('ih_desc'),RootCause:gv('ih_cause'),NextStep:gv('ih_next'),Private:priv},TABS.HEALTH.h)));
  if(document.getElementById('inc_fight')?.classList.contains('open')){const sel=document.getElementById('if_others');const oth=sel?Array.from(sel.selectedOptions).map(o=>o.value).join(', '):'';saves.push(appendRow(TABS.FIGHT,rowFromMap(fightHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Time:gv('if_time'),Owner:curDog.owner||'',OtherDogs:oth,Issue:gv('if_issue'),Importance:gv('if_imp'),Injuries:gv('if_inj'),Treatment:gv('if_treat'),Prevention:gv('if_prev'),Private:priv},TABS.FIGHT.h)));}
  if(document.getElementById('inc_transport')?.classList.contains('open'))saves.push(appendRow(TABS.TRANSPORT,rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,Transporter:gv('it_name'),Vehicle:gv('it_vehicle'),Plate:gv('it_plate'),JourneyType:gv('it_type'),Time:gv('it_time'),Notes:gv('it_notes'),Private:priv,From:gv('it_from'),To:gv('it_to')},TABS.TRANSPORT.h)));
  if(document.getElementById('inc_trial')?.classList.contains('open')){const sel2=document.getElementById('itr_others');const oth2=sel2?Array.from(sel2.selectedOptions).map(o=>o.value).join(', '):'';saves.push(appendRow(TABS.TRIAL,rowFromMap(trialHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:today,MixedWith:oth2,Observations:gv('itr_obs'),Suitable:gv('itr_suit'),Private:priv},TABS.TRIAL.h)));}
  try{await Promise.all(saves);histCache={};dailyLogSet.add(curDog.cid+'_'+today);_logSelectedActs=[];renderLogActPills();st.style.color='var(--gn)';st.textContent='Log saved!';setTimeout(()=>st.style.display='none',3000);}catch(e){st.style.color='var(--rd)';st.textContent=e.message;}
}
function buildSummary(dog){
  const alerts=[],notes=[];
  // Don't raise an alert when the value is empty / No / N/A / None — nothing to be aware of.
  const skipAlert=v=>{const s=(v||'').toLowerCase().trim();return !s||s==='no'||s==='none'||s==='n/a'||s==='na'||s==='-';};
  if(!skipAlert(dog.med))alerts.push('Medical: '+dog.med);
  if(!skipAlert(dog.medSchedule))alerts.push('Med schedule: '+dog.medSchedule);
  if(!skipAlert(dog.allerg))alerts.push('Allergies: '+dog.allerg);
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
    '<div class="psec" style="--sc:var(--or);"><div class="psec-h"><span class="psec-ic">🐾</span>Dog</div>'+ir('Name',dog.name)+ir('Breed',dog.breed)+ir('Weight',dog.weight?dog.weight+'kg':'')+ir('Birthday',dog.birthday?(dog.bdayType==='approx'?'Approx. '+fmtDate(dog.birthday):fmtDateFull(dog.birthday)):'')+ir('Age',calcAge(dog.birthday))+ir('Gender & Neuter Status',dog.genderStatus||dog.gender+(dog.neut?(' · '+(dog.neut==='Yes'?'Neutered/Spayed':'Intact')):''))+ir('Microchip',dog.chip)+ir('Rescue',dog.rescue)+ir('Motivation',dog.motivation)+ir('Dog compatibility',dog.dogfriends)+ir('Relationships',dog.rel)+'</div>'+
    '<div class="psec" style="--sc:var(--rd);"><div class="psec-h"><span class="psec-ic">🩺</span>Food &amp; Health</div>'+ir('Food type',dog.food)+ir('Food measurement',dog.foodMeasure)+ir('Diet notes',dog.dietNotes)+ir('Allergies',dog.allerg)+ir('Medical',dog.med)+ir('Medication schedule',dog.medSchedule)+vaccRow+vaccUrlRow+ir('Flea/tick',dog.flea)+'</div>'+
    '<div class="psec" style="--sc:var(--hn);"><div class="psec-h"><span class="psec-ic">🦴</span>Behaviour &amp; Routine</div>'+ir('Behaviour',dog.behav)+ir('Walking schedule',dog.walk)+ir('Car seat',dog.car)+ir('Normally sleeps',dog.sleep)+ir('Escape attempts',dog.escape)+ir('Toilet trained',dog.toilet)+ir('Can be left alone',dog.alone?dog.alone+' hrs':'')+ir('Training commands',dog.commands)+ir('Previous sitters',dog.sitters)+ir('Update frequency',dog.updates)+ir('Fears',dog.fears)+ir('Untouchable',dog.notouch)+'</div>'+
    (dog.notes?'<div class="psec" style="--sc:var(--gr2);"><div class="psec-h"><span class="psec-ic">📝</span>Notes</div>'+ir('Notes',dog.notes)+'</div>':'')+
    '<div class="psec" style="--sc:var(--cn);"><div class="psec-h"><span class="psec-ic">⭐</span>Staff Remarks</div>'+(dog.nervous?'<div class="irow"><span class="ikey">Nervous level</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.nervous,nc(dog.nervous))+'</span></div>':'')+(dog.anxiety?'<div class="irow"><span class="ikey">Sep. anxiety</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.anxiety,parseInt(dog.anxiety)>=4?'var(--rd)':'var(--pu)')+'</span></div>':'')+(dog.jog?'<div class="irow"><span class="ikey">Jogging suitability</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.jog,'var(--gn)')+'</span></div>':'')+(dog.barking?'<div class="irow"><span class="ikey">Barking level</span><span class="ival" style="display:flex;align-items:center;gap:3px;flex:1;">'+nbar(dog.barking,parseInt(dog.barking)>=4?'var(--rd)':'var(--hn)')+'</span></div>':'')+(dog.socia?'<div class="irow"><span class="ikey">Sociability with dogs</span><span class="ival" style="display:flex;align-items:center;gap:4px;flex:1;">'+nbar(dog.socia,'var(--pu)')+'</span></div>':'')+ir('At home',dog.rmHome)+ir('Outdoor',dog.rmOut)+ir('Indoor',dog.rmIn)+ir('Sleeping pattern',dog.rmSleep)+ir('Food',dog.rmFood)+ir('With other dogs',dog.rmDogs)+ir('General',dog.remarks)+'</div>'+
    '<div class="psec" style="--sc:var(--bl);"><div class="psec-h"><span class="psec-ic">📞</span>Owners &amp; Contacts</div>'+ir('Owner 1',dog.owner)+(dog.phone?'<div class="irow"><span class="ikey">Phone 1</span><span class="ival">'+waLink(dog.phone)+'</span></div>':'')+ir('Owner 2',dog.owner2)+(dog.phone2?'<div class="irow"><span class="ikey">Phone 2</span><span class="ival">'+waLink(dog.phone2)+'</span></div>':'')+ir('Owner 3',dog.owner3)+(dog.phone3?'<div class="irow"><span class="ikey">Phone 3</span><span class="ival">'+waLink(dog.phone3)+'</span></div>':'')+(dog.addr||dog.postcode?'<div class="irow"><span class="ikey">Address</span><span class="ival"><a href="https://maps.google.com/?q='+encodeURIComponent((dog.addr||'')+(dog.postcode?' '+dog.postcode:''))+'" target="_blank" style="color:var(--bl);text-decoration:none;">'+(dog.addr||(dog.postcode||''))+'</a></span></div>':'')+ir('Postcode',dog.postcode)+ir('Emergency name',dog.emergName)+(dog.emergPhone?'<div class="irow"><span class="ikey">Emergency phone</span><span class="ival">'+waLink(dog.emergPhone)+'</span></div>':'')+ir('Emergency relationship',dog.emergRel)+((!dog.emergName&&!dog.emergPhone&&dog.emergency)?ir('Emergency (old)',dog.emergency):'')+ir('Vet',dog.vet)+ir('Insurance',dog.ins)+(dog.insUrl?'<div class="irow"><span class="ikey">Insurance document</span><span class="ival"><a href="'+gdriveDirect(dog.insUrl)+'" target="_blank" style="color:var(--bl);text-decoration:none;">View document 📄</a></span></div>':'')+ir('Meet &amp; greet',fmtDateFull(dog.meetgreet))+ir('Referred by',dog.referral)+ir('Referral notes',dog.refNotes)+'</div>'+
    '<div class="psec" style="--sc:var(--gr3);"><div class="psec-h"><span class="psec-ic">🆔</span>Identifiers</div>'+ir('Customer ID',dog.cid)+ir('Microchip',dog.chip)+'</div>';
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
      else if(tab===TABS.FIGHT)summary='Fight: '+(g('Issue')||'-')+((g('OtherDogs')||'').trim()?' · with '+_otherPartyLine(g('CustomerID'),g('DogName'),g('OtherDogs')):'');
      else if(tab===TABS.TRANSPORT){const trn=g('Transporter');const jtype=g('JourneyType');const time=g('Time');const from=g('From');const to=g('To');const route=(from||to)?(from||'?')+' → '+(to||'?'):'';summary=[trn,jtype,time,route].filter(Boolean).join(' · ');}
      else if(tab===TABS.TRIAL)summary='Mixed with: '+_otherPartyLine(g('CustomerID'),g('DogName'),g('MixedWith'))+' — '+(g('Suitable')||'-');
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
  else if(tab===TABS.TRANSPORT){const jtypeVal=g('JourneyType');const jtypeOpts=['Drop-off','Pick-up','Both'].map(o=>'<option'+(o===jtypeVal?' selected':'')+'>'+o+'</option>').join('');flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Transporter</label><input class="fi" id="ef_trn" value="'+g('Transporter')+'"></div></div><div class="fr"><div class="f"><label>Vehicle</label><input class="fi" id="ef_trv" value="'+g('Vehicle')+'"></div><div class="f"><label>Plate</label><input class="fi" id="ef_plate" value="'+g('Plate')+'"></div></div><div class="fr"><div class="f"><label>Journey type</label><select class="fs" id="ef_jtype">'+jtypeOpts+'</select></div><div class="f"><label>Time</label><input class="fi" type="time" id="ef_ttime" value="'+g('Time')+'"></div></div><div class="fr"><div class="f"><label>From</label><input class="fi" id="ef_from" value="'+g('From')+'" placeholder="Pickup location"></div><div class="f"><label>To</label><input class="fi" id="ef_to" value="'+g('To')+'" placeholder="Drop-off location"></div></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes" value="'+g('Notes')+'"></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','transport')";}
  else if(tab===TABS.TRIAL){const suitVal=g('Suitable');const suitOpts=['Suitable','Partial','Not Suitable'].map(o=>'<option'+(o===suitVal?' selected':'')+'>'+o+'</option>').join('');flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Suitable?</label><select class="fs" id="ef_suit">'+suitOpts+'</select></div></div><div class="f"><label>Observations</label><textarea class="fta" id="ef_obs">'+g('Observations')+'</textarea></div><label style="display:flex;align-items:center;gap:5px;font-size:9px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="ef_priv" '+(g('Private')==='Private'?'checked':'')+'>Private</label>';fn="doEdit('"+ri+"','"+tab+"','trial')";}
  else if(tab===TABS.ACTLOG){flds='<div class="fr"><div class="f"><label>Date</label><input class="fi" id="ef_date" value="'+date+'"></div><div class="f"><label>Duration (mins)</label><input class="fi" id="ef_dur" value="'+g('DurationMins')+'"></div></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes" value="'+g('Notes')+'"></div>';fn="doEdit('"+ri+"','"+tab+"','actlog')";}
  return info+flds+'<div class="srow"><button class="sbtn2" onclick="'+fn+'">Save Changes</button><span class="smsg" id="editStatus"></span></div>';
}
async function doEdit(riStr,tabStr,type){
  const st=document.getElementById('editStatus');const priv=document.getElementById('ef_priv')?.checked?'Private':'';const date=gv('ef_date');let vals=[];
  if(type==='daily')vals=rowFromMap(dailyHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Notes:gv('ef_notes'),Private:priv},TABS.DAILY.h);
  else if(type==='health')vals=rowFromMap(healthHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Owner:curDog.owner||'',Issue:gv('ef_issue'),Category:gv('ef_cat'),Location:'',Importance:'',Description:gv('ef_desc'),RootCause:'',NextStep:gv('ef_next'),Private:priv},TABS.HEALTH.h);
  else if(type==='fight')vals=rowFromMap(fightHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Time:gv('ef_time'),Owner:curDog.owner||'',OtherDogs:'',Issue:gv('ef_issue'),Importance:'',Injuries:'',Treatment:'',Prevention:gv('ef_prev'),Private:priv},TABS.FIGHT.h);
  else if(type==='transport')vals=rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Transporter:gv('ef_trn'),Vehicle:gv('ef_trv'),Plate:gv('ef_plate'),JourneyType:gv('ef_jtype'),Time:gv('ef_ttime'),Notes:gv('ef_notes'),Private:priv,From:gv('ef_from'),To:gv('ef_to')},TABS.TRANSPORT.h);
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
  else if(type==='transport'){const jtypeOpts2=['Drop-off','Pick-up','Both'].map(o=>'<option>'+o+'</option>').join('');flds='<div class="fr">'+df+'<div class="f"><label>Transporter</label><input class="fi" id="ef_trn"></div></div><div class="fr"><div class="f"><label>Vehicle</label><input class="fi" id="ef_trv"></div><div class="f"><label>Plate</label><input class="fi" id="ef_plate"></div></div><div class="fr"><div class="f"><label>Journey type</label><select class="fs" id="ef_jtype">'+jtypeOpts2+'</select></div><div class="f"><label>Time</label><input class="fi" type="time" id="ef_ttime"></div></div><div class="fr"><div class="f"><label>From</label><input class="fi" id="ef_from"></div><div class="f"><label>To</label><input class="fi" id="ef_to"></div></div><div class="f"><label>Notes</label><input class="fi" id="ef_notes"></div>'+prv;}
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
  else if(type==='transport')vals=rowFromMap(transportHdrRow,{CustomerID:curDog.cid,DogName:curDog.name,Date:date,Transporter:gv('ef_trn'),Vehicle:gv('ef_trv'),Plate:gv('ef_plate'),JourneyType:gv('ef_jtype'),Time:gv('ef_ttime'),Notes:gv('ef_notes'),Private:priv,From:gv('ef_from'),To:gv('ef_to')},TABS.TRANSPORT.h);
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
  const tcSignedNow=((dog.tcsigned||'').toLowerCase().includes('yes')||(dog.tcsigned||'').toLowerCase().includes('signed'));
  const rows=CF.map(f=>{
    const v=(dog[f.k]||'').toLowerCase();const iy=v.includes('yes')||v.includes('signed');const inn=v.includes('no');
    const yoc="setConsent('"+f.k+"','Yes',this)";const noc="setConsent('"+f.k+"','No',this)";
    let extra='';
    if(f.k==='tcsigned'){const sd=dog._tcSignedDate||'',sv=dog._tcVersion||'';extra=(sd||sv)?'<div style="font-size:9px;color:var(--gr2);margin-top:2px;">Last signed: '+(sd?fmtDate(sd):'—')+(sv?' · T&C version '+sv:'')+'</div>':'';}
    return'<div class="cfld"><label>'+f.l+'</label><div class="ctog"><button class="ctb'+(iy?' yes':'')+'" onclick="'+yoc+'">Yes</button><button class="ctb'+(inn?' no':'')+'" onclick="'+noc+'">No</button></div>'+extra+'</div>';
  }).join('');
  const curVer=getTCVersion();
  const tcAdmin='<div style="margin-top:10px;padding:8px 10px;background:var(--gr5);border-radius:8px;"><div style="font-size:9px;font-weight:700;color:var(--gr2);margin-bottom:4px;">📄 Current T&amp;C version <span style="font-weight:400;">(bump when you change the T&amp;Cs — a fresh "Yes" stamps this version + today\'s date)</span></div><div style="display:flex;gap:6px;"><input class="fi" id="tc_version_input" value="'+curVer.replace(/"/g,'&quot;')+'" placeholder="e.g. 2026-08 or v3" style="font-size:11px;flex:1;"><button class="sbtn2" style="font-size:10px;padding:6px 10px;" onclick="setTCVersion()">Set as current</button></div>'+(tcSignedNow?'<div style="font-size:9px;color:var(--gn);margin-top:4px;">This dog\'s "Signed T&amp;Cs" will save as version <b>'+(curVer||'(blank)')+'</b> on '+fmtDate(todayStr())+' unless already signed on this version.</div>':'')+'</div>';
  document.getElementById('consentBody').innerHTML=rows+tcAdmin;
}
function buildConsent(dog){
  _renderConsentUI(dog);
  // Async: fetch latest consent record from sheet and refresh UI
  readSheet(TABS.CONSENT,'A2:P').then(rows=>{
    const dogRows=rows.filter(r=>r[0]===dog.cid).sort((a,b)=>(b[2]||'').localeCompare(a[2]||''));// match by CID (dupe-name safe)
    if(!dogRows.length)return;
    const latest=dogRows[0];
    CF.forEach((f,i)=>{curDog[f.k]=latest[i+3]||'';});
    curDog._tcVersion=latest[14]||'';curDog._tcSignedDate=latest[15]||'';// TCVersion=O, TCSignedDate=P (18)
    _renderConsentUI(curDog);
  }).catch(()=>{});
}
function setConsent(k,v,btn){if(!curDog)return;const already=(curDog[k]||'')=== v;curDog[k]=already?'':v;btn.closest('.cfld').querySelectorAll('.ctb').forEach(b=>b.className='ctb');if(!already)btn.classList.add(v==='Yes'?'yes':'no');}
async function saveConsent(){const st=document.getElementById('consentStatus');if(!curDog)return;
  // (18) stamp T&C version + signed date when Signed T&Cs = Yes. Latest-only: keep the prior date if the same version was already signed, else stamp today.
  const signedYes=((curDog.tcsigned||'').toLowerCase().includes('yes')||(curDog.tcsigned||'').toLowerCase().includes('signed'));
  let tcVer='',tcDate='';
  if(signedYes){const cur=getTCVersion();tcVer=cur;tcDate=((curDog._tcVersion||'')===cur&&curDog._tcSignedDate)?curDog._tcSignedDate:todayStr();curDog._tcVersion=tcVer;curDog._tcSignedDate=tcDate;}
  else{curDog._tcVersion='';curDog._tcSignedDate='';}
  const vals=[curDog.cid,curDog.name,todayStr(),...CF.map(f=>curDog[f.k]||''),tcVer,tcDate];
  try{await appendRow(TABS.CONSENT,vals);st.textContent='Consent saved!';st.className='smsg ok';_renderConsentUI(curDog);setTimeout(()=>st.className='smsg',3000);}catch(e){st.textContent=e.message;st.className='smsg err';}}
function buildServices(dog){
  const el=document.getElementById('servicesList');const recs=bookings.filter(r=>bkMatchesDog(r,dog)).sort((a,b)=>b.sd.localeCompare(a.sd));
  if(!recs.length){el.innerHTML='<div class="hload">No bookings yet</div>';return;}
  const sc={'Quoted':'sq','Booked':'sb','Prepaid':'spp','Fully Paid':'sf','Credit':'scr','Canceled':'sc'};
  el.innerHTML=recs.map(r=>{
    const owed=(r.rev||0)+(r.tips||0);const paid=(r.prepay||0)+(r.finalPay||0);const bal=paid-owed;
    const oc="openBkModal('"+r.id+"',true,"+r.ri+")";
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
function dogToFieldMap(d){return{CustomerID:d.cid,Name:d.name,DogName:d.name,Breed:d.breed,Gender:d.gender,Birthday:d.birthday,BirthdayType:d.bdayType,Weight:d.weight,Neutered:d.neut,GenderStatus:d.genderStatus||'',Motivation:d.motivation||'',ChipID:d.chip,Rescue:d.rescue,Nervous:d.nervous,SepAnxiety:d.anxiety,DogFriends:d.dogfriends,FoodType:d.food,FoodMeasure:d.foodMeasure,DietNotes:d.dietNotes,Allergies:d.allerg,Medical:d.med,MedSchedule:d.medSchedule,Fears:d.fears,Untouchable:d.notouch,Vaccination:d.vacc,Flea:d.flea,Behaviour:d.behav,WalkSchedule:d.walk,CarSeat:d.car,SleepLocation:d.sleep,EscapeAttempts:d.escape,ToiletTrained:d.toilet,AloneHours:d.alone,TrainingCommands:d.commands,PrevSitters:d.sitters,UpdateFrequency:d.updates,Relationships:d.rel,AdditionalNotes:d.notes,Owner1:d.owner,Phone1:sheetPhone(d.phone),Owner2:d.owner2||'',Phone2:sheetPhone(d.phone2),Owner3:d.owner3||'',Phone3:sheetPhone(d.phone3),Address:d.addr,Postcode:d.postcode,Emergency:sheetPhone(d.emergency),Vet:d.vet,Insurance:d.ins,MeetGreetDate:d.meetgreet,Referral:d.referral,ReferralNotes:d.refNotes,Service:d.svc,Status:d.status,Remarks:d.remarks,Jogging:d.jog||'',VaccinationURL:d.vaccUrl||'',PhotoURL:d.photoUrl||'',Barking:d.barking||'',Sociability:d.socia||'',RemarkAtHome:d.rmHome||'',RemarkOutdoor:d.rmOut||'',RemarkIndoor:d.rmIn||'',RemarkSleeping:d.rmSleep||'',RemarkFood:d.rmFood||'',RemarkWithDogs:d.rmDogs||'',InsuranceURL:d.insUrl||'',EmergencyName:d.emergName||'',EmergencyPhone:sheetPhone(d.emergPhone),EmergencyRelationship:d.emergRel||''};}
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
  s('reg_owner',d.owner);s('reg_phone',d.phone);s('reg_owner2',d.owner2||'');s('reg_phone2',d.phone2||'');s('reg_owner3',d.owner3||'');s('reg_phone3',d.phone3||'');s('reg_address',d.addr);s('reg_postcode',d.postcode);s('reg_emerg_name',d.emergName||'');s('reg_emerg_phone',d.emergPhone||'');s('reg_emerg_rel',d.emergRel||'');s('reg_vet',d.vet);s('reg_insurance',d.ins);s('reg_ins_url',d.insUrl||'');s('reg_meetgreet',d.meetgreet);s('reg_referral',d.referral);s('reg_ref_notes',d.refNotes);setSvcChips(d.svc);s('reg_status',d.status);s('reg_remarks',d.remarks);
  document.getElementById('reg_nervous').value=d.nervous||3;updNB('reg');document.getElementById('reg_anxiety').value=d.anxiety||1;updAnxBar();document.getElementById('reg_jog').value=d.jog||3;updJogBar();document.getElementById('reg_barking').value=d.barking||1;updBarkBar();document.getElementById('reg_socia').value=d.socia||3;updSociaBar();
  s('reg_rm_home',d.rmHome);s('reg_rm_out',d.rmOut);s('reg_rm_in',d.rmIn);s('reg_rm_sleep',d.rmSleep);s('reg_rm_food',d.rmFood);s('reg_rm_dogs',d.rmDogs);
  _regEmoji='';
  _regPhotoUrl=d.photoUrl||'';const p=d.photoUrl?gdriveDirect(d.photoUrl):'';
  const _rimg=document.getElementById('regPhotoImg'),_remo=document.getElementById('regPhotoEmoji');
  if(p){_rimg.src=p;_rimg.style.display='block';if(_remo)_remo.style.display='none';document.getElementById('regPhotoCircle')._pd=p;}
  else{_rimg.src='';_rimg.style.display='none';if(_remo){_remo.textContent='+';_remo.style.display='block';}document.getElementById('regPhotoCircle')._pd=null;}// reset circle when the dog has no photo, else the previously-edited dog's image lingers (wrong-image bug)
  showScreen('sc-register');
}
function updNB(pfx){const v=parseInt(document.getElementById(pfx+'_nervous').value)||3;if(document.getElementById(pfx+'_nval'))document.getElementById(pfx+'_nval').textContent=v;const col=v>=4?'var(--rd)':v>=3?'var(--hn)':'var(--or)';for(let i=0;i<5;i++){const s=document.getElementById('rns'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updAnxBar(){const v=parseInt(document.getElementById('reg_anxiety').value)||1;if(document.getElementById('reg_axval'))document.getElementById('reg_axval').textContent=v;const col=v>=4?'var(--rd)':v>=3?'var(--pu)':'var(--bl)';for(let i=0;i<5;i++){const s=document.getElementById('axs'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updJogBar(){const v=parseInt(document.getElementById('reg_jog').value)||3;if(document.getElementById('reg_jogval'))document.getElementById('reg_jogval').textContent=v;const col=v>=4?'var(--gn)':v>=3?'var(--hn)':'var(--gr3)';for(let i=0;i<5;i++){const s=document.getElementById('jgs'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updBarkBar(){const v=parseInt(document.getElementById('reg_barking').value)||1;if(document.getElementById('reg_barkval'))document.getElementById('reg_barkval').textContent=v;const col=v>=4?'var(--rd)':v>=3?'var(--hn)':'var(--gr3)';for(let i=0;i<5;i++){const s=document.getElementById('bks'+i);if(s)s.style.background=i<v?col:'var(--gr4)';}}
function updSociaBar(){const v=parseInt(document.getElementById('reg_socia').value)||3;if(document.getElementById('reg_sociaval'))document.getElementById('reg_sociaval').textContent=v;for(let i=0;i<5;i++){const s=document.getElementById('scs'+i);if(s)s.style.background=i<v?'var(--pu)':'var(--gr4)';}}
// Quick-edit only the Staff Remarks section (4 levels + 6 remark fields + general) without opening the full profile form.
function openStaffNotes(){
  if(!curDog)return;const d=curDog;
  document.getElementById('snTitle').textContent='Staff Notes — '+d.name;
  const sr=(id,v,vid)=>{const el=document.getElementById(id);if(el){el.value=v;const b=document.getElementById(vid);if(b)b.textContent=v;}};
  sr('sn_nervous',d.nervous||3,'sn_nervval');sr('sn_anxiety',d.anxiety||1,'sn_anxval');sr('sn_jog',d.jog||3,'sn_jogval');sr('sn_barking',d.barking||1,'sn_barkval');sr('sn_socia',d.socia||3,'sn_sociaval');
  const st=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  st('sn_rm_home',d.rmHome);st('sn_rm_out',d.rmOut);st('sn_rm_in',d.rmIn);st('sn_rm_sleep',d.rmSleep);st('sn_rm_food',d.rmFood);st('sn_rm_dogs',d.rmDogs);st('sn_remarks',d.remarks);
  const s=document.getElementById('snStatus');s.textContent='';s.className='smsg';
  document.getElementById('staffNotesModal').classList.add('open');
}
async function saveStaffNotes(){
  if(!curDog)return;const d=curDog;const st=document.getElementById('snStatus');const btn=document.getElementById('snSaveBtn');
  btn.disabled=true;btn.textContent='Saving...';st.textContent='';st.className='smsg';
  d.nervous=gv('sn_nervous');d.anxiety=gv('sn_anxiety');d.jog=gv('sn_jog');d.barking=gv('sn_barking');d.socia=gv('sn_socia');
  d.rmHome=gv('sn_rm_home');d.rmOut=gv('sn_rm_out');d.rmIn=gv('sn_rm_in');d.rmSleep=gv('sn_rm_sleep');d.rmFood=gv('sn_rm_food');d.rmDogs=gv('sn_rm_dogs');d.remarks=gv('sn_remarks');
  const vals=rowFromMap(dogsHdrRow,dogToFieldMap(d),TABS.DOGS.h);
  try{
    // Resolve the real sheet row by CID (row-shift safe), falling back to the cached rowIdx
    const cidCol=await readSheet(TABS.DOGS,'A2:A').catch(()=>[]);const found=cidCol.findIndex(r=>r[0]===d.cid);const ri=found>=0?found+2:d.rowIdx;
    if(!ri)throw new Error('Could not find this dog row to update — tap Sync and retry.');
    await updateRow(TABS.DOGS,ri,vals);
    const idx=allDogs.findIndex(x=>x.cid===d.cid);if(idx>=0)allDogs[idx]=d;
    st.textContent='Saved!';st.className='smsg ok';
    setTimeout(()=>{document.getElementById('staffNotesModal').classList.remove('open');if(curDog){buildProfInfo(curDog);buildSummary(curDog);}},900);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent='Save Staff Notes';}
}
function startReg(){
  document.getElementById('reg_eid').value='';document.getElementById('reg_ridx').value='';
  document.querySelector('#sc-register .pg-t').textContent='Register New Dog';document.getElementById('regBtn').textContent='Register Dog';
  ['reg_name','reg_breed','reg_weight','reg_chip','reg_dogfriends','reg_food_measure','reg_diet','reg_allergies','reg_medical','reg_med_schedule','reg_behaviour','reg_walk','reg_rel','reg_owner','reg_phone','reg_owner2','reg_phone2','reg_owner3','reg_phone3','reg_address','reg_postcode','reg_emerg_name','reg_emerg_phone','reg_emerg_rel','reg_vet','reg_insurance','reg_ins_url','reg_fears','reg_touch','reg_flea','reg_remarks','reg_sleep','reg_escape','reg_toilet','reg_alone','reg_commands','reg_sitters','reg_updates','reg_notes','reg_ref_notes','reg_meetgreet','reg_jog','reg_rm_home','reg_rm_out','reg_rm_in','reg_rm_sleep','reg_rm_food','reg_rm_dogs'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['reg_gender_status','reg_rescue','reg_car','reg_food','reg_svc','reg_referral'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});setSvcChips('');
  document.getElementById('reg_status').value='Active';document.getElementById('reg_nervous').value=3;updNB('reg');document.getElementById('reg_anxiety').value=1;updAnxBar();document.getElementById('reg_jog').value=3;updJogBar();document.getElementById('reg_barking').value=1;updBarkBar();document.getElementById('reg_socia').value=3;updSociaBar();
  _regEmoji='';_regPhotoUrl='';initBdayType();document.getElementById('regPhotoImg').style.display='none';const re=document.getElementById('regPhotoEmoji');if(re){re.textContent='+';re.style.display='block';}document.getElementById('regPhotoCircle')._pd=null;showScreen('sc-register');
}
function duplicateDog(){
  if(!curDog)return;const d=curDog;startReg();
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  s('reg_breed',d.breed);s('reg_dogfriends',d.dogfriends);s('reg_food',d.food);s('reg_food_measure',d.foodMeasure);s('reg_diet',d.dietNotes);s('reg_allergies',d.allerg);s('reg_fears',d.fears);s('reg_touch',d.notouch);s('reg_vacc',d.vacc);
  s('reg_owner',d.owner);s('reg_phone',d.phone);s('reg_owner2',d.owner2||'');s('reg_phone2',d.phone2||'');s('reg_owner3',d.owner3||'');s('reg_phone3',d.phone3||'');s('reg_address',d.addr);s('reg_postcode',d.postcode);s('reg_emerg_name',d.emergName||'');s('reg_emerg_phone',d.emergPhone||'');s('reg_emerg_rel',d.emergRel||'');s('reg_vet',d.vet);s('reg_insurance',d.ins);s('reg_ins_url',d.insUrl||'');s('reg_referral',d.referral);s('reg_ref_notes',d.refNotes);setSvcChips(d.svc);
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
  const fieldMap={CustomerID:cid,Name:name,DogName:name,Breed:gv('reg_breed'),Birthday:bday,BirthdayType:bt,Weight:gv('reg_weight'),GenderStatus:gv('reg_gender_status'),ChipID:gv('reg_chip'),Rescue:gv('reg_rescue'),Nervous:document.getElementById('reg_nervous').value,SepAnxiety:document.getElementById('reg_anxiety').value,DogFriends:gv('reg_dogfriends'),FoodType:gv('reg_food'),FoodMeasure:gv('reg_food_measure'),DietNotes:gv('reg_diet'),Allergies:gv('reg_allergies'),Medical:gv('reg_medical'),MedSchedule:gv('reg_med_schedule'),Fears:gv('reg_fears'),Untouchable:gv('reg_touch'),Vaccination:gv('reg_vacc'),Flea:gv('reg_flea'),Behaviour:gv('reg_behaviour'),WalkSchedule:gv('reg_walk'),CarSeat:gv('reg_car'),SleepLocation:gv('reg_sleep'),EscapeAttempts:gv('reg_escape'),ToiletTrained:gv('reg_toilet'),AloneHours:gv('reg_alone'),TrainingCommands:gv('reg_commands'),PrevSitters:gv('reg_sitters'),UpdateFrequency:gv('reg_updates'),Relationships:gv('reg_rel'),AdditionalNotes:gv('reg_notes'),Owner1:owner,Phone1:sheetPhone(gv('reg_phone')),Owner2:gv('reg_owner2'),Phone2:sheetPhone(gv('reg_phone2')),Owner3:gv('reg_owner3'),Phone3:sheetPhone(gv('reg_phone3')),Address:gv('reg_address'),Postcode:gv('reg_postcode'),Emergency:sheetPhone(gv('reg_emergency')),Vet:gv('reg_vet'),Insurance:gv('reg_insurance'),MeetGreetDate:gv('reg_meetgreet'),Referral:gv('reg_referral'),ReferralNotes:gv('reg_ref_notes'),Service:gv('reg_svc'),Status:gv('reg_status'),Remarks:gv('reg_remarks'),Jogging:gv('reg_jog'),VaccinationURL:gv('reg_vacc_url'),PhotoURL:photoUrlVal,Motivation:gv('reg_motivation'),Barking:document.getElementById('reg_barking').value,Sociability:document.getElementById('reg_socia').value,RemarkAtHome:gv('reg_rm_home'),RemarkOutdoor:gv('reg_rm_out'),RemarkIndoor:gv('reg_rm_in'),RemarkSleeping:gv('reg_rm_sleep'),RemarkFood:gv('reg_rm_food'),RemarkWithDogs:gv('reg_rm_dogs'),InsuranceURL:gv('reg_ins_url'),EmergencyName:gv('reg_emerg_name'),EmergencyPhone:sheetPhone(gv('reg_emerg_phone')),EmergencyRelationship:gv('reg_emerg_rel')};
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
    const dh=mkHdr(dogsHdrRow);if(!eid){allDogs.push(mapDog(vals,allDogs.length,dh));refreshDogDropdowns();}else if(curDog){const idx=allDogs.findIndex(d=>d.cid===eid);if(idx>=0){allDogs[idx]=mapDog(vals,idx,dh);curDog=allDogs[idx];}}
    st.textContent=eid?'Profile updated!':'Registered! ID: '+cid;st.className='smsg ok';
    setTimeout(()=>{goBack();renderBoard();if(eid&&curDog){buildProfInfo(curDog);buildSummary(curDog);}},1800);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent=eid?'Save Changes':'Register Dog';}
}
function gdriveDirect(url){try{const m=url.match(/(?:\/d\/|id=)([-\w]{25,})/);if(m)return'https://lh3.googleusercontent.com/d/'+m[1];}catch(e){}return url;}
function resolvePhotoUrl(dog){const raw=dog.photoUrl||'';return raw?gdriveDirect(raw):'';}

function setPhotoFromUrl(url,context){if(!url)return;const direct=gdriveDirect(url.trim());if(context==='profile'){if(!curDog)return;const w=document.getElementById('profPhotoWrap');let img=w.querySelector('img.pl');if(!img){img=document.createElement('img');img.className='pl';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';w.appendChild(img);}img.onerror=()=>{img.style.display='none';};img.src=direct;img.style.display='block';
  // Save URL to the dog's Dogs-sheet row so it's visible on all devices
  curDog.photoUrl=direct;updateCopyPhotoBtn();
  if(curDog.rowIdx){updateRow(TABS.DOGS,curDog.rowIdx,Object.values(mapDogToRow(curDog))).catch(()=>{});}
}else{_regPhotoUrl=direct;document.getElementById('regPhotoImg').src=direct;document.getElementById('regPhotoImg').style.display='block';document.getElementById('regPhotoEmoji').style.display='none';document.getElementById('regPhotoCircle')._pd=direct;}}
function promptGdriveUrl(context){const cur=(context==='profile'?(curDog&&curDog.photoUrl):_regPhotoUrl)||'';const url=prompt('Google Drive photo link — the existing link is shown below; copy it, or paste a new one to update:',cur);if(url!==null&&url.trim()&&url.trim()!==cur)setPhotoFromUrl(url.trim(),context);}
function copyPhotoUrl(){const url=curDog?.photoUrl;if(!url){alert('No Drive photo link stored for this dog.');return;}navigator.clipboard.writeText(url).then(()=>alert('Photo URL copied!')).catch(()=>{prompt('Copy this URL:',url);});}
function updateCopyPhotoBtn(){const url=curDog?.photoUrl;const btn=document.getElementById('copyPhotoUrlBtn');if(btn)btn.style.display=(url&&url.startsWith('http'))?'block':'none';}

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
  _svcLines.push(line);renderSvcLines();calcMultiQ();autoGenPayRef();
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
  // Holiday rates derived from base × 1.15, rounded to whole £ (board £38→£44, daycare £28→£32, +dog too)
  const bH=holRate(r.board_std),baH=holRate(r.board_add),dH=holRate(r.day_std),daH=holRate(r.day_add);
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
      let dogObjs=(l.dogs&&l.dogs.length?l.dogs:_orderedSel()).map(c=>({name:_nm(c),add:_addDogs.includes(c)}));if(!dogObjs.length)dogObjs=[{name:'Dog',add:false}];
      const prim=dogObjs.filter(x=>!x.add),adds=dogObjs.filter(x=>x.add);const allDogStr=dogObjs.map(x=>x.name).join(' & ');
      if(l.sd&&l.ed){
        const dropDt=new Date(l.sd+'T'+(l.st2||'09:00')),pickDt=new Date(l.ed+'T'+(l.et||'18:00'));
        const hrs=(pickDt-dropDt)/3600000;const nights=Math.max(1,Math.floor(hrs/24));const exHrs=hrs-nights*24;
        const holDates=getHolDates(l.sd,l.ed);let hN=0,sN=0;let d=new Date(l.sd+'T12:00:00');
        for(let ni=0;ni<nights;ni++){const ds=d.toISOString().split('T')[0];if(holDates.includes(ds))hN++;else sN++;d.setDate(d.getDate()+1);}
        const stdR=l.rate>0?l.rate:r.board_std,holR=l.rate>0?l.rate:bH;const em='\u{1F4A4}';
        const bd=(std,hol,tot)=>(sN>0&&hN>0)?(fmtGBP(std)+'/night \u00D7 '+sN+' + '+fmtGBP(hol)+'/night \u00D7 '+hN+' = '+fmtGBP(tot)):(fmtGBP(sN>0?std:hol)+'/night \u00D7 '+nights+' = '+fmtGBP(tot));
        const holRangeStr=holDates.length>0?fmtDate(holDates[0])+' - '+fmtDate(holDates[holDates.length-1]):'';
        let dp=em+' Boarding ('+allDogStr+'):\n'+fmtDate(l.sd)+'  Drop-off: '+(l.st2||'09:00')+'\n'+fmtDate(l.ed)+'  Pick-up: '+(l.et||'18:00');
        if(hN>0)dp+='\n\uD83C\uDFDD\uFE0F Holiday rate applies on '+hN+' night'+(hN!==1?'s':'')+(holRangeStr?' ('+holRangeStr+')':'');
        const exLbl=exHrs<8?'(<8h, +50%)':'(8+h, +100%)';const exTxt='\nExtra hours ('+exHrs.toFixed(1)+'h, '+(exHrs<8?'+50%':'+100%')+'): ';
        prim.forEach(x=>{let a=(sN*stdR)+(hN*holR);lines.push([em+' Boarding - '+x.name+' (primary)',a]);let sub='\n\n'+x.name+':\n'+bd(stdR,holR,a);if(exHrs>0){const b=sN>0?stdR:holR;const ex=exHrs<8?roundGBP(b*0.5):b;a+=ex;lines.push([em+' Boarding - '+x.name+' extra hours '+exLbl,ex]);sub+=exTxt+fmtGBP(ex);}amt+=a;dp+=sub;});
        adds.forEach(x=>{let a=(sN*r.board_add)+(hN*baH);lines.push([em+' Boarding - '+x.name+' (additional)',a]);let sub='\n\n'+x.name+' (additional dog):\n'+bd(r.board_add,baH,a);if(exHrs>0){const b=sN>0?r.board_add:baH;const ex=exHrs<8?roundGBP(b*0.5):b;a+=ex;lines.push([em+' Boarding - '+x.name+' extra hours '+exLbl,ex]);sub+=exTxt+fmtGBP(ex);}amt+=a;dp+=sub;});
        descParts.push(dp);
      }
    }else if(l.svc==='daycare'){
      const hol=l.sd?isHol(l.sd):false;
      let dogObjs=(l.dogs&&l.dogs.length?l.dogs:_orderedSel()).map(c=>({name:_nm(c),add:_addDogs.includes(c)}));if(!dogObjs.length)dogObjs=[{name:'Dog',add:false}];
      const prim=dogObjs.filter(x=>!x.add),adds=dogObjs.filter(x=>x.add);const allDogStr=dogObjs.map(x=>x.name).join(' & ');
      const dayStd=l.rate>0?l.rate:(hol?dH:r.day_std),dayAdd=hol?daH:r.day_add;const em='\u2600\uFE0F';
      let dp=em+' Daycare ('+allDogStr+'): '+fmtDate(l.sd||'')+'  Drop-off: '+(l.st2||'07:00')+'  Pick-up: '+(l.et||'18:00')+(hol?'\n\uD83C\uDFDD\uFE0F Holiday rate':'');
      prim.forEach(x=>{amt+=dayStd;lines.push([em+' Daycare - '+x.name+(hol?' (holiday)':''),dayStd]);dp+='\n'+x.name+': '+fmtGBP(dayStd);});
      adds.forEach(x=>{amt+=dayAdd;lines.push([em+' Daycare - '+x.name+' (additional)',dayAdd]);dp+='\n'+x.name+' (additional): '+fmtGBP(dayAdd);});
      const [eph,epm]=(l.et||'18:00').split(':').map(Number);const ptD=eph+epm/60;
      if(ptD>18&&ptD<=23){const eveSur=roundGBP(dayStd*(r.evening_pct/100));amt+=eveSur;lines.push([em+' Daycare - evening care (+'+r.evening_pct+'%)',eveSur]);dp+='\nEvening care (pick-up '+(l.et||'18:00')+'): +'+r.evening_pct+'% = '+fmtGBP(eveSur);}
      descParts.push(dp);
    }else if(isTaxi){
      const subDef=SVC_SUBTYPES.taxi?.find(s=>s.key===l.sub);
      const baseRate=l.rate||(subDef?r[subDef.rk]||0:r.t30r);
      const holMult=l.sd&&isHol(l.sd)?1.15:1;
      amt=roundGBP(baseRate*holMult);
      const isHolDay=holMult>1;const subLabel=subDef?.label||'';
      lines.push(['\u{1F695} Pet Taxi'+(subLabel?' ('+subLabel+')':'')+(isHolDay?' holiday +15%':''),amt]);
      descParts.push('\u{1F695} Pet Taxi'+(subLabel?' ('+subLabel+')':'')+(l.sd?' \u2014 '+fmtDate(l.sd):'')+(isHolDay?' \uD83C\uDFDD\uFE0F Holiday rate (+15%)':'')+': '+fmtGBP(amt));
    }else if(l.svc==='walk'||l.svc==='dropin'){
      let dogObjs=(l.dogs&&l.dogs.length?l.dogs:_orderedSel()).map(c=>({name:_nm(c),add:_addDogs.includes(c)}));if(!dogObjs.length)dogObjs=[{name:'Dog',add:false}];
      const prim=dogObjs.filter(x=>!x.add),adds=dogObjs.filter(x=>x.add);
      const holMult=l.sd&&isHol(l.sd)?1.15:1;const isHolDay=holMult>1;
      const mainRate=roundGBP((l.rate||0)*holMult);const addRate=roundGBP((l.rka?r[l.rka]||0:0)*holMult);
      const em=SVC_EMOJIS[l.svc]||'';const svcName=SVC_NAMES[l.svc]||l.svc;
      const subLabel=l.sub&&SVC_SUBTYPES[l.svc]?SVC_SUBTYPES[l.svc].find(s=>s.key===l.sub)?.label||'':'';
      let dp=em+' '+svcName+(subLabel?' ('+subLabel+')':'')+(l.sd?' - '+fmtDate(l.sd):'');
      if(isHolDay)dp+='\n\uD83C\uDFDD\uFE0F Holiday rate (+15%)';
      prim.forEach(x=>{amt+=mainRate;lines.push([em+' '+svcName+' - '+x.name+(isHolDay?' (holiday)':'')+(subLabel?' ('+subLabel+')':''),mainRate]);dp+='\n'+x.name+': '+fmtGBP(mainRate);});
      adds.forEach(x=>{amt+=addRate;lines.push([em+' '+svcName+' - '+x.name+' (additional)',addRate]);dp+='\n'+x.name+' (additional): '+fmtGBP(addRate);});
      if(addRate===0&&adds.length>0)dp+=' (no add-on rate for this type)';
      descParts.push(dp);
    }else if(l.svc==='dogsit'){
      let dogObjs=(l.dogs&&l.dogs.length?l.dogs:_orderedSel()).map(c=>({name:_nm(c),add:_addDogs.includes(c)}));if(!dogObjs.length)dogObjs=[{name:'Dog',add:false}];
      const prim=dogObjs.filter(x=>!x.add),adds=dogObjs.filter(x=>x.add);const allDogStr=dogObjs.map(x=>x.name).join(' & ');const em='\uD83E\uDEB1';
      if(l.sd&&l.ed){
        const holDates2=getHolDates(l.sd,l.ed);let hN2=0,sN2=0;
        const dropDt2=new Date(l.sd+'T'+(l.st2||'09:00')),pickDt2=new Date(l.ed+'T'+(l.et||'18:00'));
        const hrs2=(pickDt2-dropDt2)/3600000;const nights2a=Math.max(1,Math.floor(hrs2/24));
        let d2=new Date(l.sd+'T12:00:00');
        for(let ni=0;ni<nights2a;ni++){const ds2=d2.toISOString().split('T')[0];if(holDates2.includes(ds2))hN2++;else sN2++;d2.setDate(d2.getDate()+1);}
        const stdR2=l.rate>0?l.rate:r.board_std,holR2=l.rate>0?l.rate:bH;
        const bd2=(std,hol,tot)=>(sN2>0&&hN2>0)?(fmtGBP(std)+'/night x '+sN2+' + '+fmtGBP(hol)+'/night x '+hN2+' = '+fmtGBP(tot)):(fmtGBP(sN2>0?std:hol)+'/night x '+(sN2+hN2)+' = '+fmtGBP(tot));
        let dp2=em+' Dog Sit ('+allDogStr+'):\n'+fmtDate(l.sd)+'  Drop-off: '+(l.st2||'09:00')+'\n'+fmtDate(l.ed)+'  Pick-up: '+(l.et||'18:00');
        if(hN2>0)dp2+='\n\uD83C\uDFDD\uFE0F Holiday rate applies on '+hN2+' night'+(hN2!==1?'s':'');
        prim.forEach(x=>{const a=(sN2*stdR2)+(hN2*holR2);amt+=a;lines.push([em+' Dog Sit - '+x.name+' (primary)',a]);dp2+='\n\n'+x.name+':\n'+bd2(stdR2,holR2,a);});
        adds.forEach(x=>{const a=(sN2*r.board_add)+(hN2*baH);amt+=a;lines.push([em+' Dog Sit - '+x.name+' (additional)',a]);dp2+='\n\n'+x.name+' (additional dog):\n'+bd2(r.board_add,baH,a);});
        descParts.push(dp2);
      }else{
        const qty2=l.qty||1;const nRate=l.rate||r.board_std;amt=nRate*qty2*Math.max(1,prim.length);
        lines.push([em+' Dog Sit x'+qty2,amt]);
        descParts.push(em+' Dog Sit ('+allDogStr+'): '+fmtGBP(nRate)+'/night x '+qty2+' = '+fmtGBP(amt));
      }
    }else{
      const qty=l.qty||1;amt=(l.rate||0)*qty;
      const em=SVC_EMOJIS[l.svc]||'';const dogStr=(l.dogs&&l.dogs.length)?l.dogs.map(_nm).join(' & '):'';
      const label=em+' '+(SVC_NAMES[l.svc]||l.svc)+(dogStr?' ('+dogStr+')':'');
      lines.push([label+(qty>1?' \u00D7'+qty:''),amt]);
      descParts.push(label+(qty>1?'\n\u00D7'+qty+' sessions @ '+fmtGBP(l.rate||0)+' = '+fmtGBP(amt):': '+fmtGBP(amt)));
    }
    total+=amt;
  });
  const discType=document.getElementById('q_disc_t')?.value||'none';const discVal=parseFloat(document.getElementById('q_disc_v')?.value)||0;
  // Shown discount = subtotal − final rounded total, so the line + total always reconcile (final = subtotal − shownDiscount).
  let discLine='';const subtotal=roundGBP(total);let finalTotal=subtotal;
  if(discType==='pct'&&discVal>0){finalTotal=roundGBP(subtotal*(1-discVal/100));const shown=subtotal-finalTotal;discLine='Discount '+discVal+'%: -'+fmtGBP(shown);lines.push(['Discount '+discVal+'%',-shown]);}
  else if(discType==='gbp'&&discVal>0){finalTotal=roundGBP(subtotal-discVal);const shown=subtotal-finalTotal;discLine='Discount: -'+fmtGBP(shown);lines.push(['Discount',-shown]);}
  total=finalTotal;
  const prepayPct=parseInt(document.getElementById('q_prepay_pct')?.value)||50;
  const prepayAmt=roundGBP(total*(prepayPct/100));const finalAmt=total-prepayAmt; // outstanding = remainder, so they sum exactly
  _cr={total,prepayAmt,finalAmt,lines,discLine,selDogs:_orderedSel().map(_nm),mainDog:_nm(_orderedSel()[0]||''),descParts,dogRevMap:_computeDogRevMap()};
  document.getElementById('q_total').textContent=fmtGBP(total);
  document.getElementById('q_breakdown').innerHTML=lines.map((l,i)=>'<div class="q-ln"'+(i===lines.length-1?' style="border-top:1px solid rgba(255,255,255,.1);margin-top:4px;padding-top:4px;"':'')+'>'+
    '<span>'+l[0]+'</span><span>'+(l[1]<0?'-':'')+fmtGBP(Math.abs(l[1]))+'</span></div>').join('');
  document.getElementById('q_prepay_show').textContent=fmtGBP(prepayAmt);
  document.getElementById('q_final_show').textContent=fmtGBP(finalAmt);
  const apEl=document.getElementById('q_actual_prepay');if(apEl&&!apEl.value)apEl.placeholder='Defaults to '+fmtGBP(prepayAmt);
  document.getElementById('q_result').style.display='block';
}

function getRates(){return JSON.parse(localStorage.getItem('tcl_rates')||JSON.stringify(DR));}
// Auto-fill the read-only holiday-rate fields from their base rate × 1.15 (rounded). Called on load + base-rate edit.
function recalcHolFields(){const set=(id,base)=>{const el=document.getElementById(id),b=document.getElementById(base);if(el&&b)el.value=holRate(parseFloat(b.value)||0);};set('r_board_hol','r_board_std');set('r_board_addh','r_board_add');set('r_day_hol','r_day_std');}
function getHolRanges(){return JSON.parse(localStorage.getItem('tcl_hol_ranges')||JSON.stringify(DEFAULT_RANGES));}
// Current T&C version (18) — stored in the Rates sheet (row 'tcl_tc_version') so all devices share it.
function getTCVersion(){return localStorage.getItem('tcl_tc_version')||'';}
async function setTCVersion(){const v=(document.getElementById('tc_version_input')?.value||'').trim();localStorage.setItem('tcl_tc_version',v);const st=document.getElementById('consentStatus');if(st){st.textContent='Current T&C version set to '+(v||'(blank)');st.className='smsg ok';setTimeout(()=>st.className='smsg',2500);}
  try{const rows=await readSheet(TABS.RATES,'A2:C').catch(()=>[]);const idx=rows.findIndex(r=>r[0]==='tcl_tc_version');const row=['tcl_tc_version',v,new Date().toISOString()];if(idx>=0)await updateRow(TABS.RATES,idx+2,row);else await appendRow(TABS.RATES,row);}catch(e){}
  if(curDog)_renderConsentUI(curDog);}
// Rates + holiday ranges live in the Rates sheet (rows 'tcl_rates' / 'tcl_hol_ranges') so all devices share them.
// Read on every sync into the localStorage cache; every save writes the sheet.
async function syncSettingsFromSheet(){
  try{const rows=await readSheet(TABS.RATES,'A2:C');
    const rr=rows.find(r=>r[0]==='tcl_rates');if(rr&&rr[1])localStorage.setItem('tcl_rates',rr[1]);
    const hr=rows.find(r=>r[0]==='tcl_hol_ranges');if(hr&&hr[1])localStorage.setItem('tcl_hol_ranges',hr[1]);
    const tv=rows.find(r=>r[0]==='tcl_tc_version');if(tv)localStorage.setItem('tcl_tc_version',tv[1]||'');
  }catch(e){}
}
async function saveHolRangesToSheet(ranges){
  try{const rows=await readSheet(TABS.RATES,'A2:C').catch(()=>[]);const idx=rows.findIndex(r=>r[0]==='tcl_hol_ranges');const vals=['tcl_hol_ranges',JSON.stringify(ranges),new Date().toISOString()];
    if(idx>=0)await updateRow(TABS.RATES,idx+2,vals);else await appendRow(TABS.RATES,vals);
    toast('Holiday dates saved to sheet','ok');
  }catch(e){toast('Could not save holidays to the sheet — change is local only. '+e.message,'err');}
}
function getTpls(){const s=JSON.parse(localStorage.getItem('tcl_tpls')||'{}');return{quote:s.quote||TP_QUOTE,book:s.book||TP_BOOK,prepay:s.prepay||TP_PREPAY,final:s.final||TP_FINAL,avail:s.avail||TP_AVAIL,payLink:s.payLink||'https://paymentrequest.natwestpayit.com/reusable-links/80b66e1d-90d1-4893-8441-c23a30cb5d1d',payRefPfx:s.payRefPfx||'KCHEUNG'};}
function isHol(d){return getHolRanges().some(r=>d>=r.start&&d<=r.end);}
function getHolDates(sd,ed){const ranges=getHolRanges();const dates=[];let d=new Date(sd+'T12:00:00');const e=new Date(ed+'T12:00:00');while(d<e){const ds=d.toISOString().split('T')[0];if(ranges.some(r=>ds>=r.start&&ds<=r.end))dates.push(ds);d.setDate(d.getDate()+1);}return dates;}
function loadQSettings(){
  const r=getRates();['board_std','board_hol','board_add','board_addh','day_std','day_hol','day_add','day_addh','evening_pct','t15s','t15r','t30s','t30r','t60s','t60r','walk30','walk60','walk30a','walk60a','walk30_11','walk60_11','dropin30','dropin60','dropin30a','dropin60a'].forEach(k=>{const el=document.getElementById('r_'+k);if(el)el.value=r[k]!=null?r[k]:DR[k];});recalcHolFields();
  renderHolList();renderHolYrBtns();const t=getTpls();const qe=document.getElementById('tpl_quote');const be=document.getElementById('tpl_book');const pe=document.getElementById('tpl_prepay');const fe=document.getElementById('tpl_final');if(qe)qe.value=t.quote;if(be)be.value=t.book;if(pe)pe.value=t.prepay;if(fe)fe.value=t.final;
  const pl=document.getElementById('tpl_paylink');const pp=document.getElementById('tpl_payref_pfx');if(pl)pl.value=t.payLink||'';if(pp)pp.value=t.payRefPfx||'';
}
function toggleSP(id){document.getElementById('sp-'+id).classList.toggle('open');}
async function saveRates(){const r={};['board_std','board_hol','board_add','board_addh','day_std','day_hol','day_add','day_addh','evening_pct','t15s','t15r','t30s','t30r','t60s','t60r','walk30','walk60','walk30a','walk60a','walk30_11','walk60_11','dropin30','dropin60','dropin30a','dropin60a'].forEach(k=>r[k]=parseFloat(document.getElementById('r_'+k)?.value)||DR[k]);r.board_hol=holRate(r.board_std);r.board_addh=holRate(r.board_add);r.day_hol=holRate(r.day_std);r.day_addh=holRate(r.day_add);localStorage.setItem('tcl_rates',JSON.stringify(r));const s=document.getElementById('rateStatus');s.textContent='Saving...';s.className='smsg';
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
function addHolRange(){const s=document.getElementById('holStart').value,e=document.getElementById('holEnd').value;if(!s||!e||e<s){alert('Select valid start and end dates');return;}const ranges=getHolRanges();ranges.push({start:s,end:e,label:'Holiday '+new Date(s+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'})});localStorage.setItem('tcl_hol_ranges',JSON.stringify(ranges));saveHolRangesToSheet(ranges);renderHolList();renderHolYrBtns();document.getElementById('holStart').value='';document.getElementById('holEnd').value='';calcMultiQ();}
function removeHolRange(start,end){const ranges=getHolRanges().filter(r=>!(r.start===start&&r.end===end));localStorage.setItem('tcl_hol_ranges',JSON.stringify(ranges));saveHolRangesToSheet(ranges);renderHolList();renderHolYrBtns();calcMultiQ();}
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
  c.innerHTML=visible.map(d=>{const i=allDogs.indexOf(d);const sel=_selDogs.includes(d.cid);return'<div class="dog-ms-item'+(sel?' sel':'')+'" onclick="toggleQDog('+i+')"><input type="checkbox" '+(sel?'checked':'')+' onclick="event.stopPropagation()"><span style="flex:1;">'+d.name+(d.breed?' <span style="color:var(--gr3);font-weight:400;">'+d.breed+'</span>':'')+'</span><span style="font-size:8px;color:var(--gr3);">'+d.cid+'</span></div>';}).join('');
}
function _syncDogsToLines(){const ordered=_orderedSel();_svcLines.forEach(l=>{if(l.svc!=='extra'&&l.svc!=='taxi')l.dogs=[...ordered];});}
function toggleQDog(i){const cid=allDogs[i].cid;const idx=_selDogs.indexOf(cid);if(idx>=0){_selDogs.splice(idx,1);const ai=_addDogs.indexOf(cid);if(ai>=0)_addDogs.splice(ai,1);}else{_selDogs.push(cid);if(_selDogs.length>1)_addDogs.push(cid);/* default: 2nd+ dog = additional, freely toggleable */}
  _syncDogsToLines();buildQDogMS();buildAddDogChecks();calcMultiQ();
  const first=_selDogs[0];const dogData=first?allDogs.find(d=>d.cid===first):null;if(dogData){const ownerEl=document.getElementById('q_owner');if(ownerEl&&!ownerEl.value)ownerEl.value=dogData.owner||'';}
  autoGenPayRef();
}
// Per-dog "additional dog rate" toggles (replaces the single main-dog picker). Primary = not ticked.
function buildAddDogChecks(){const w=document.getElementById('q_add_dog_wrap');const c=document.getElementById('q_add_dog_btns');if(!w||!c)return;if(!_selDogs.length){w.style.display='none';return;}w.style.display='block';
  c.innerHTML=_orderedSel().map(cid=>{const add=_addDogs.includes(cid);return'<label class="adddog-row"><span>'+_nm(cid)+' <span style="font-size:8px;color:var(--gr3);">'+cid+'</span></span><span style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:'+(add?'var(--or)':'var(--gn)')+';">'+(add?'Additional':'Primary')+' <input type="checkbox" '+(add?'checked':'')+' onchange="toggleAddDog(\''+cid+'\')" title="Charge additional-dog rate"></span></label>';}).join('');
}
function toggleAddDog(cid){const i=_addDogs.indexOf(cid);if(i>=0)_addDogs.splice(i,1);else _addDogs.push(cid);_syncDogsToLines();buildAddDogChecks();calcMultiQ();autoGenPayRef();}
function buildMainDogBtns(){buildAddDogChecks();}// back-compat shim for existing callers
function autoGenPayRef(){
  const names=_orderedSel().map(_nm).filter(Boolean).map(n=>n.replace(/\s+/g,'')).join('');
  const lines=_svcLines.filter(l=>l.sd);
  const d=lines.length?new Date(lines[0].sd+'T12:00:00'):new Date();
  const mm=String(d.getMonth()+1).padStart(2,'0');const yy=String(d.getFullYear()).slice(-2);
  const ref=names+mm+yy;
  const el=document.getElementById('q_payref');if(el&&!el._userEdited)el.value=ref;
}
function _computeDogRevMap(){
  const r=getRates();const map={};
  const bH=holRate(r.board_std),baH=holRate(r.board_add),dH=holRate(r.day_std),daH=holRate(r.day_add);
  const add=(cid,a)=>{if(cid&&a>0)map[cid]=Math.round(((map[cid]||0)+a)*100)/100;};
  _svcLines.forEach(l=>{
    if(l.svc==='extra'||l.svc==='taxi')return;
    const prim=(l.dogs||[]).filter(c=>!_addDogs.includes(c)),adds=(l.dogs||[]).filter(c=>_addDogs.includes(c));
    if(l.svc==='boarding'&&l.sd&&l.ed){
      const drop=new Date(l.sd+'T'+(l.st2||'09:00')),pick=new Date(l.ed+'T'+(l.et||'18:00'));
      const hrs=(pick-drop)/3600000;const nights=Math.max(1,Math.floor(hrs/24));const exHrs=hrs-nights*24;
      const hd=getHolDates(l.sd,l.ed);let hN=0,sN=0;
      let d=new Date(l.sd+'T12:00:00');
      for(let ni=0;ni<nights;ni++){if(hd.includes(d.toISOString().split('T')[0]))hN++;else sN++;d.setDate(d.getDate()+1);}
      const base=(sN*r.board_std)+(hN*bH);let ex=0;if(exHrs>0){const bn=sN>0?r.board_std:bH;ex=exHrs<8?roundGBP(bn*0.5):bn;}
      prim.forEach((c,i)=>add(c,base+(i===0?ex:0)));adds.forEach(c=>add(c,(sN*r.board_add)+(hN*baH)));
    }else if(l.svc==='daycare'&&l.sd){
      const hol=isHol(l.sd);prim.forEach(c=>add(c,hol?dH:r.day_std));adds.forEach(c=>add(c,hol?daH:r.day_add));
    }else if((l.svc==='walk'||l.svc==='dropin')&&l.rate){
      const hm=l.sd&&isHol(l.sd)?1.15:1;const mr=roundGBP(l.rate*hm);const ar=l.rka?roundGBP((r[l.rka]||0)*hm):0;
      prim.forEach(c=>add(c,mr));adds.forEach(c=>add(c,ar));
    }else if(l.svc==='dogsit'&&l.sd&&l.ed){
      const hd2=getHolDates(l.sd,l.ed);let hN2=0,sN2=0;
      const dropDtDs=new Date(l.sd+'T'+(l.st2||'09:00')),pickDtDs=new Date(l.ed+'T'+(l.et||'18:00'));
      const hrsDs=(pickDtDs-dropDtDs)/3600000;const nightsDs=Math.max(1,Math.floor(hrsDs/24));
      let d2=new Date(l.sd+'T12:00:00');
      for(let ni=0;ni<nightsDs;ni++){if(hd2.includes(d2.toISOString().split('T')[0]))hN2++;else sN2++;d2.setDate(d2.getDate()+1);}
      prim.forEach(c=>add(c,(sN2*r.board_std)+(hN2*bH)));adds.forEach(c=>add(c,(sN2*r.board_add)+(hN2*baH)));
    }else if(l.rate){const qty=l.qty||1;prim.forEach(c=>add(c,(l.rate||0)*qty));}
  });
  Object.keys(map).forEach(k=>map[k]=roundGBP(map[k])); // whole-£ per-dog amounts, matching the quote
  return map;
}
// (removed v73b3) dead code: onQSvc() + calcQ() — the old single-service quote calc (unrounded discount). The live quote uses calcMultiQ; calcQ was never called.
function updateFinalShow(){const ap=parseFloat(document.getElementById('q_actual_prepay')?.value);if(!isNaN(ap)&&ap>0){document.getElementById('q_final_show').textContent=fmtGBP(Math.max(0,_cr.total-ap));}}
function genRateBlock(){
  const r=getRates();const svcs=[...new Set(_svcLines.filter(l=>l.svc!=='extra').map(l=>l.svc))];
  return svcs.map(svc=>{
    if(svc==='boarding')return '\ud83d\udca4 Boarding (per night, 24 hours)\nPer night: '+fmtGBP(r.board_std)+'\nAdditional pet: '+fmtGBP(r.board_add)+'/night\nExtra hours <8h: +50% \u00b7 8+h: +100%\nHoliday rate: +15%';
    if(svc==='daycare')return '\u2600\ufe0f Day Care (per day, 10 hours)\nDrop-off after 7AM \u00b7 Pick-up before 6PM\nPer day: '+fmtGBP(r.day_std)+'\nAdditional pet: '+fmtGBP(r.day_add)+'/day\nEvening care (6\u201311PM): +'+r.evening_pct+'%\nHoliday rate: +15%';
    if(svc==='walk')return '\ud83d\udc15 Dog Walk\n30 min: '+fmtGBP(r.walk30)+' / Additional pet: '+fmtGBP(r.walk30a)+'\n60 min: '+fmtGBP(r.walk60)+' / Additional pet: '+fmtGBP(r.walk60a)+'\nHoliday rate: +15%';
    if(svc==='dropin')return '\ud83d\udd11 Drop-in Visit\n30 min: '+fmtGBP(r.dropin30)+' / 60 min: '+fmtGBP(r.dropin60)+'\nAdditional pet \u2014 30 min: '+fmtGBP(r.dropin30a)+' / 60 min: '+fmtGBP(r.dropin60a)+'\nHoliday rate: +15%';
    if(svc==='dogsit')return '\ud83d\udecb\ufe0f Dog Sit\nPer night: '+fmtGBP(r.board_std)+'\nHoliday rate: '+fmtGBP(holRate(r.board_std))+'/night';
    if(svc==='taxi')return '\ud83d\ude95 Pet Taxi\n15 min \u2014 single: '+fmtGBP(r.t15s)+' / return: '+fmtGBP(r.t15r)+'\n30 min \u2014 single: '+fmtGBP(r.t30s)+' / return: '+fmtGBP(r.t30r)+'\n60 min \u2014 single: '+fmtGBP(r.t60s)+' / return: '+fmtGBP(r.t60r)+'\nHoliday rate: +15%';
    if(svc==='training')return '\ud83c\udfc5 Training\nPricing not available yet \u2014 please contact us for details';
    return '';
  }).filter(Boolean).join('\n\n');
}
// Payment templates are matched by a STABLE key (quote/book/prepay/final), so renaming them in the hub is safe.
// If no keyed hub template exists (or it's empty), fall back to the built-in default → quotes never break.
const DEFAULT_PAY_TPLS={quote:TP_QUOTE,book:TP_BOOK,prepay:TP_PREPAY,final:TP_FINAL};
function paymentTpl(key){const t=(msgTpls||[]).find(x=>(x.key||'')===key&&(x.content||'').trim());return t?t.content:DEFAULT_PAY_TPLS[key];}
function fillQuoteVars(tpl,vars){let m=tpl||'';Object.keys(vars).forEach(k=>{m=m.split('{{'+k+'}}').join(vars[k]==null?'':vars[k]);});return m.replace(/\{\{[a-zA-Z]+\}\}/g,'');/* blank any unknown placeholder */}
// Show the built-in fallback drafts (read-only) + whether each is currently overridden by a keyed Payment template.
function renderPayFallbacks(){
  const el=document.getElementById('payFallbacks');if(!el)return;
  const labels={quote:'Get Quote',book:'Book with Us',prepay:'Prepayment Received',final:'Final Payment'};
  const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  el.innerHTML=Object.keys(DEFAULT_PAY_TPLS).map(k=>{
    const t=(msgTpls||[]).find(x=>(x.key||'')===k&&(x.content||'').trim());
    const status=t?'<span style="color:var(--gn);">● live: uses your \''+esc(t.name)+'\'</span>':'<span style="color:var(--or);">● live: uses this fallback</span>';
    return '<div style="margin-bottom:9px;"><div style="font-size:10px;font-weight:700;margin-bottom:3px;">'+labels[k]+' <span style="font-weight:400;font-size:8px;">'+status+'</span></div><textarea readonly style="width:100%;min-height:66px;font-size:9px;background:var(--gr5);border:1px solid var(--gr4);border-radius:6px;padding:6px;color:var(--gr2);box-sizing:border-box;">'+esc(DEFAULT_PAY_TPLS[k])+'</textarea></div>';
  }).join('');
}
function genQuote(type){
  calcMultiQ();// always recalculate to pick up latest discount/prepay changes
  const t=getTpls();const ownerName=document.getElementById('q_owner').value||'there';
  const payRef=document.getElementById('q_payref').value||(t.payRefPfx||'KCHEUNG');
  const allDogNames=_orderedSel().map(_nm).filter(Boolean).join(' & ')||(_cr.selDogs||[]).join(' & ')||'your dog';// primary dogs first, then additional
  const serviceBlock=(_cr.descParts||[]).join('\n\n');
  const actualPrepay=parseFloat(document.getElementById('q_actual_prepay')?.value)||_cr.prepayAmt;
  const balanceDue=Math.max(0,_cr.total-actualPrepay);
  // clear the other output boxes
  ['q_out_quote','q_out_book','q_out_prepay','q_out_final'].forEach(id=>{if('q_out_'+type!==id){const el=document.getElementById(id);if(el){el.style.display='none';el.textContent='';}}});
  // NOTE: copying a quote no longer writes Quoted rows to the Bookings sheet (v60). Generating/copying a quote is now a
  // read-only action — bookings are created only via the explicit "Create booking(s) from quote" button or Add Booking.
  // This removes the surprise side-effect and the quote-driven duplicate-booking rows (old markBookingsQuotedFromQuote).
  const disc=_cr.discLine?('\n\n'+_cr.discLine):'';
  const vars={ownerName,dogs:allDogNames,service:serviceBlock,discount:disc,total:fmtGBP(_cr.total),rateBlock:genRateBlock(),prepayAmt:fmtGBP(type==='book'?_cr.prepayAmt:actualPrepay),finalAmt:fmtGBP(balanceDue),payRef,payLink:(t.payLink||'[payment link]')};
  let msg=fillQuoteVars(paymentTpl(type),vars);
  msg=msg.replace(/[—–]/g,'-').replace(/\n{3,}/g,'\n\n').trim();// quote templates use plain '-' not long dashes
  const outId='q_out_'+type;
  document.getElementById(outId).style.display='block';document.getElementById(outId).textContent=msg;copyText(msg);
  const btnLabels={quote:'Copy Get Quote',book:'Copy Book with Us',prepay:'Copy Prepayment Received',final:'Copy Final Payment'};
  const allBtns=document.querySelectorAll('.cpbtn[data-qtype]');
  allBtns.forEach(b=>{if(b.dataset.qtype===type){b.textContent='Copied!';setTimeout(()=>b.textContent=btnLabels[type]||'Copy',2000);}});
}

// (removed v60) markBookingsFromQuote — copying a quote used to append Quoted rows to the Bookings sheet on every copy,
// which polluted Bookings with duplicate quote rows. Bookings are now created only via createBookingsFromQuote / Add Booking.
async function createBookingsFromQuote(){
  if(!_svcLines.length){alert('Complete the quote first');return;}
  if(_bkSaving)return;_bkSaving=true;
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
    const dogs=line.svc==='taxi'?[_selDogs[0]||'']:(line.dogs&&line.dogs.length?line.dogs:(_selDogs.length?_selDogs:['']));
    const sd=line.sd||'';const ed=line.ed||sd;const st=line.st2||'09:00';const et=line.et||'18:00';
    const svcLabel=svcN[line.svc]||line.svc;
    for(const cid of dogs){
      const id=nextBkId(sd);
      const month=sd?new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'}):'';
      const customerId=cid;const dogName=_nm(cid);
      const rev=line.svc==='taxi'?(_cr.lines.find(l=>l[0].includes('Taxi'))?.[1]||0):revenueMap[cid]||0;
      const prepayAmt=parseFloat((rev*(prepayPct/100)).toFixed(2));
      const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId,dog:dogName,id,svc:svcLabel,sd,st,ed,et,dropLoc:'',pickLoc:'',rev,tips:0,prepay:prepayAmt,finalPay:0,unit:0,discNotes:'',roverPct:0,roverAmt:0,ch:'TCL',pay:'',status:'Booked',priv:false,month,rating:'',feedback:'',rem:['','','','','']}),TABS.BK.h);
      try{await appendRow(TABS.BK,vals);const mv=[...vals];mv[1]=dogName;bookings.push(mapBk(mv,bookings.length,mkHdr(bkHdrRow)));created++;}catch(e){alert('Error for '+dogName+' ('+svcLabel+'): '+e.message);}
    }
  }
  _bkSaving=false;
  if(created){renderBoard();toast(created+' booking'+(created>1?'s':'')+' created with revenue pre-filled — check Bookings to adjust.','ok');}
}
function quoteFromBk(){
  const dog=document.getElementById('bm_dog').value;const svc=document.getElementById('bm_svc').value;const sd=document.getElementById('bm_sd').value;const ed=document.getElementById('bm_ed').value;const bst=document.getElementById('bm_st').value;const et=document.getElementById('bm_et').value;
  const actualPrepay=parseFloat(document.getElementById('bm_prepay')?.value)||0;
  const svcMap={Boarding:'boarding',DayCare:'daycare',Walking:'walk','Drop-in':'dropin','Dog Sit':'dogsit','Pet Taxi':'taxi',Training:'training'};
  const svcKey=svcMap[svc]||'boarding';
  const cid0=_dogByCid(dog)?dog:'';// bm_dog now holds the CID
  _svcLines=[{svc:svcKey,dogs:cid0?[cid0]:[],sd,ed,st2:bst||'09:00',et:et||'18:00',rate:0}];
  _selDogs=cid0?[cid0]:[];_addDogs=[];
  const dogData=_dd;
  if(dogData)document.getElementById('q_owner').value=dogData.owner;
  if(actualPrepay>0){const apEl=document.getElementById('q_actual_prepay');if(apEl)apEl.value=actualPrepay.toFixed(2);}
  document.getElementById('bkModal').classList.remove('open');goToTab('customers','quote');
  renderSvcLines();buildQDogMS();buildMainDogBtns();calcMultiQ();
}

// ==================== BOOKINGS ====================
// Booking ID: BK-BD-YYMM-XXXX (YY+MM from the booking start date, + 4-char random). Year-scoped + random
// avoids the old sequential BK-BD-### cap (999) and its concurrent-creation collisions. Checked for uniqueness.
function nextBkId(sd){
  const d=(sd&&/^\d{4}-\d{2}/.test(sd))?sd:todayStr();
  const yymm=d.slice(2,4)+d.slice(5,7);
  const used=new Set(bookings.map(b=>b.id).filter(Boolean));
  const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id,guard=0;do{id='BK-BD-'+yymm+'-'+Array.from({length:4},()=>A[Math.floor(Math.random()*36)]).join('');}while(used.has(id)&&++guard<50);
  return id;
}
function openBkModal(editId=null,fromProf=false,editRi=null,tab=1){
  const modal=document.getElementById('bkModal');const ed=editId?bkByRef(editId,editRi):null;// resolve by ri first (unique) so edits hit the right row even with dup ids
  document.getElementById('bm_eid').value=editId||'';document.getElementById('bm_ridx').value=ed?.ri||'';
  document.getElementById('bkMTitle').textContent=ed?'Modify Booking':'Add Booking';document.getElementById('bkBtn').textContent=ed?'Modify Booking':'Save Booking';
  document.getElementById('bkDelBtn').style.display=ed?'block':'none';
  const searchEl=document.getElementById('bm_dog_search');if(searchEl)searchEl.value='';
  const sel=document.getElementById('bm_dog');sel.innerHTML='<option value="">Select dog</option>';allDogs.forEach(d=>sel.add(new Option(dogOptLabel(d),d.cid)));
  _linkStart('bm_sd','bm_ed');// date-range linkage (10)
  if(ed){
    const ss=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null?v:''};
    sel.value=ed.customerId||(allDogs.find(d=>(d.name||'').toLowerCase()===(ed.dog||'').toLowerCase())?.cid||'');updateDogIdHint();ss('bm_svc',ed.svc);ss('bm_sd',ed.sd);ss('bm_st',ed.st);ss('bm_ed',ed.ed);ss('bm_et',ed.et);ss('bm_drop_loc',ed.dropLoc||'');ss('bm_pick_loc',ed.pickLoc||'');ss('bm_rev',ed.rev||0);ss('bm_tips',ed.tips||0);ss('bm_prepay',ed.prepay||0);ss('bm_final',ed.finalPay||0);ss('bm_unit',ed.unit||0);ss('bm_disc_notes',ed.discNotes||'');ss('bm_channel',ed.ch||'TCL');ss('bm_pay',ed.pay||'');ss('bm_status',ed.status||'Quoted');ss('bm_rpct',ed.roverPct||15);ss('bm_ramt',ed.roverAmt||0);ss('bm_rating',ed.rating||'');ss('bm_feedback',ed.feedback||'');ss('bm_ref',ed.bookingRef||'');ss('bm_prepay_ref',ed.prepayRef||'');ss('bm_final_ref',ed.finalPayRef||'');document.getElementById('bm_priv').checked=ed.priv||false;
  }else{
    sel.value='';if(fromProf&&curDog)sel.value=curDog.cid;updateDogIdHint();
    ['bm_rev','bm_tips','bm_prepay','bm_final','bm_unit','bm_disc_notes','bm_drop_loc','bm_pick_loc','bm_rating','bm_feedback','bm_ref','bm_prepay_ref','bm_final_ref'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('bm_rpct').value='15';document.getElementById('bm_sd').value=todayStr();document.getElementById('bm_ed').value=todayStr();document.getElementById('bm_channel').value='TCL';document.getElementById('bm_pay').value='';document.getElementById('bm_status').value='Quoted';document.getElementById('bm_priv').checked=false;
  }
  calcBal();toggleRover();updateStatusFlow();renderOverlapCheck();renderWfChecklist();switchBkTab(tab);modal.classList.add('open');
}
function switchBkTab(n){
  document.getElementById('bkTab1').style.display=n===1?'':'none';
  document.getElementById('bkTab2').style.display=n===2?'':'none';
  document.getElementById('bkTabBtn1').classList.toggle('bk-tab-active',n===1);
  document.getElementById('bkTabBtn2').classList.toggle('bk-tab-active',n===2);
}
// ==================== WORKFLOW CHECKLIST (stored on Bookings sheet) ====================
function wfAutoLogs(bk){
  if(!bk||!bk.sd)return null;
  if(bk.wf&&bk.wf.dailyLogs)return true;
  const today=todayStr();const ed=bk.ed||bk.sd;
  if(today<=ed)return false;// only auto-complete once ALL service days have passed (today > ed) — not mid-service, not on the last day itself
  const endD=ed<today?ed:(()=>{const y=new Date(today+'T12:00:00Z');y.setUTCDate(y.getUTCDate()-1);return y.toISOString().slice(0,10);})();
  if(bk.sd>endD)return true;
  let d=new Date(bk.sd+'T12:00:00Z');const end=new Date(endD+'T12:00:00Z');
  while(d<=end){const ds=d.toISOString().slice(0,10);if(!dailyLogSet.has(bk.customerId+'_'+ds))return false;d.setUTCDate(d.getUTCDate()+1);}
  return true;
}
function wfAutoCompat(bk){
  if(!bk||!bk.dog)return null;
  if(bk.wf&&bk.wf.compat)return true;
  {const today=todayStr();const ed=bk.ed||bk.sd;if(today<=ed)return false;}// only auto-complete once ALL service days have passed (today > ed)
  const bkCid=bk.customerId||'';const bkDog=(bk.dog||'').toLowerCase();
  const active=['Quoted','Booked','Prepaid','Fully Paid','Credit','Completed'];
  const qStart=new Date(bk.sd+'T00:00');const qEnd=new Date((bk.ed||bk.sd)+'T23:59');
  const overlapBks=bookings.filter(b=>{
    if(b.id===bk.id||!active.includes(b.status)||!b.sd)return false;
    if(bkCid&&b.customerId===bkCid)return false;
    if(!bkCid&&(b.dog||'').toLowerCase()===bkDog)return false;
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  if(!overlapBks.length)return true;// no dogs overlap this booking → nothing to check → auto-tick
  return overlapBks.every(b=>{
    const mixedDog=(b.dog||'').toLowerCase();const mixedCid=b.customerId||'';
    return trialLogs.some(t=>{
      const tCid=t.cid||'';
      const mixedParts=(t.mixedWith||'').toLowerCase().split(/[,;]+/).map(s=>s.trim());
      const matchesPrimary=bkCid?tCid===bkCid:(t.dog||'').toLowerCase()===bkDog;
      // Match on the whole CID token (stored as "CID DogName") to avoid substring false-positives
      // e.g. "TCL-CB101" must not match a log for "TCL-CB1017", and a comma in a dog name won't break CID matching
      const mc=(mixedCid||'').toLowerCase();
      const matchesMixed=mc?mixedParts.some(m=>m===mc||m.startsWith(mc+' ')):mixedParts.some(m=>m===mixedDog||m.endsWith(' '+mixedDog));
      return matchesPrimary&&matchesMixed&&t.date>=bk.sd&&t.date<=(bk.ed||bk.sd);
    });
  });
}
async function persistAutoWf(bk,key){
  if(!bk||!bk.ri)return;
  const updated={...bk.wf,[key]:'auto'};
  const vals=rowFromMap(bkHdrRow,bkFieldMap({...bk,wf:updated}),TABS.BK.h);
  try{await updateRow(TABS.BK,bk.ri,vals);bk.wf[key]='auto';const idx=bookings.findIndex(b=>bk.ri?b.ri===bk.ri:b.id===bk.id);if(idx>=0)bookings[idx].wf[key]='auto';}catch(e){}
}
function wfStepValue(bk,key){
  const sv=bk.wf||{};
  if(key==='dailyLogs'){const v=sv.dailyLogs;return v!==undefined&&v!==''?!!v:wfAutoLogs(bk);}
  if(key==='compat'){const v=sv.compat;return v!==undefined&&v!==''?!!v:wfAutoCompat(bk);}
  if(key==='review')return sv.review==='done'||sv.review==='na';
  // Final-payment reminder is auto-satisfied once the booking is settled — no balance left to chase.
  if(key==='finalpay'){if(sv.finalpay)return true;return['Fully Paid','Credit','Completed'].includes(bk.status);}
  return !!sv[key];
}
function wfCompletion(bk){
  if(!bk)return{done:0,total:WF_STEPS.length,pct:0,allDone:false};
  let done=0;
  WF_STEPS.forEach(s=>{if(wfStepValue(bk,s.k))done++;});
  return{done,total:WF_STEPS.length,pct:Math.round(done/WF_STEPS.length*100),allDone:done===WF_STEPS.length};
}
async function toggleWfStep(eid,key,checked){
  const bk=bkByRef(eid,parseInt(document.getElementById('bm_ridx')?.value)||null);if(!bk)return;
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
  const bk=bkByRef(eid,parseInt(document.getElementById('bm_ridx')?.value)||null);if(!bk)return;
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
  const bk=bkByRef(eid,parseInt(document.getElementById('bm_ridx')?.value)||null);if(!bk)return;
  // Persist auto-computed WF fields if newly true
  const autoLogsVal=wfAutoLogs(bk);if(autoLogsVal===true&&!bk.wf?.dailyLogs)persistAutoWf(bk,'dailyLogs').catch(()=>{});
  const autoCompatVal=wfAutoCompat(bk);if(autoCompatVal===true&&!bk.wf?.compat)persistAutoWf(bk,'compat').catch(()=>{});
  const comp=wfCompletion(bk);const pct=comp.total?Math.round(comp.done/comp.total*100):0;
  let html='<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-bottom:4px;"><span>'+comp.done+' / '+comp.total+' done</span><span style="color:'+(comp.allDone?'var(--gn)':'var(--gr3)')+';">'+pct+'%'+(comp.allDone?' ✅':'')+'</span></div><div style="height:7px;background:var(--gr4);border-radius:4px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:'+(comp.allDone?'var(--gn)':'var(--or)')+';transition:width .2s;"></div></div></div>';
  ['before','during','after'].forEach(g=>{
    const steps=WF_STEPS.filter(s=>s.g===g);if(!steps.length)return;
    html+='<div style="font-size:9px;font-weight:800;color:var(--gr2);text-transform:uppercase;letter-spacing:.3px;margin:11px 0 5px;">'+(WF_GRP[g]||g)+'</div>';
    steps.forEach(s=>{
      const v=wfStepValue(bk,s.k);
      const isAuto=(s.k==='dailyLogs'||s.k==='compat'||s.k==='finalpay')&&(bk.wf?.[s.k]===undefined||bk.wf?.[s.k]==='');
      const autoTag=(isAuto&&v)?' <span style="font-size:8px;color:var(--gr3);">(auto)</span>':'';
      html+='<div onclick="toggleWfStep(\''+eid+'\',\''+s.k+'\','+(!v)+')" style="display:flex;align-items:center;gap:9px;padding:9px 11px;margin-bottom:5px;border-radius:var(--r);border:1.5px solid '+(v?'var(--gn)':'var(--gr4)')+';background:'+(v?'var(--gnl)':'var(--wh)')+';cursor:pointer;">'+
        '<span style="width:21px;height:21px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;background:'+(v?'var(--gn)':'var(--wh)')+';color:#fff;border:1.5px solid '+(v?'var(--gn)':'var(--gr3)')+';">'+(v?'✓':'')+'</span>'+
        '<span style="font-size:11px;flex:1;'+(v?'color:var(--gr2);text-decoration:line-through;':'color:var(--gr);font-weight:600;')+'">'+s.l+autoTag+'</span></div>';
      if(s.k==='review')html+='<label style="display:flex;align-items:center;gap:6px;font-size:10px;cursor:pointer;margin:-2px 0 7px 32px;color:var(--gr2);" onclick="event.stopPropagation()"><input type="checkbox" '+(bk.wf?.review==='na'?'checked':'')+' onchange="setWfReviewNA(\''+eid+'\',this.checked)"> No review needed</label>';
    });
  });
  c.innerHTML=html;
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
  const dogObj=_dogByCid(dog);// bm_dog now holds the CID
  const overlaps=bookings.filter(b=>{
    if(b.id===eid)return false;
    if(!active.includes(b.status)||!b.sd)return false;
    if(dogObj&&b.customerId&&b.customerId===dogObj.cid)return false;
    if((!dogObj||!b.customerId)&&dogObj&&(b.dog||'').toLowerCase()===(dogObj.name||'').toLowerCase())return false;
    const bS=new Date(b.sd+'T'+(b.st||'00:00'));const bE=new Date((b.ed||b.sd)+'T'+(b.et||'23:59'));
    return bS<qEnd&&bE>qStart;
  });
  if(!overlaps.length){c.innerHTML='<div style="font-size:9px;color:var(--gn);">✅ No other dogs booked during this period.</div>';return;}
  const seen=new Set();const names=overlaps.filter(b=>{const k=b.customerId||b.dog.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  const dogEsc=(dogObj?dogObj.cid:dog||'').replace(/'/g,"\\'");
  const logBtn=dogObj?'<button type="button" class="sbtn2" style="margin-top:6px;font-size:10px;padding:6px 10px;" onclick="curDog=allDogs.find(d=>d.cid===\''+dogObj.cid+'\');openAddHistEntry(\'trial\',\''+sd+'\')">📝 Log full Trial-Log entry</button>':'';
  const bk=dogObj?bkByRef(eid,parseInt(document.getElementById('bm_ridx')?.value)||null):null;
  const bkSd=bk?bk.sd:sd;const bkEd=bk?bk.ed||bk.sd:ed||sd;
  c.innerHTML='<div style="font-size:9px;color:var(--gr3);margin-bottom:5px;">⚠️ Other dogs staying during this period — log how they got on:</div>'+
    names.map(b=>{
      const mixedLabel=(b.customerId?b.customerId+' ':'') +b.dog;
      const mEsc=mixedLabel.replace(/'/g,"\\'");
      const overlapEnd=(b.ed||b.sd)<bkEd?(b.ed||b.sd):bkEd;
      const existingLog=[...trialLogs].reverse().find(t=>{
        if(!(t.date>=bkSd&&t.date<=bkEd))return false;
        const myCid=(dogObj?dogObj.cid:'').toLowerCase();const otherCid=(b.customerId||'').toLowerCase();const tCid=(t.cid||'').toLowerCase();
        const mwHas=cid=>!!cid&&(t.mixedWith||'').toLowerCase().split(/[,;]+/).some(p=>p.trim().split(/\s+/)[0]===cid);
        if(myCid&&otherCid)return (tCid===myCid&&mwHas(otherCid))||(tCid===otherCid&&mwHas(myCid));// pair, either direction
        const md=(b.dog||'').toLowerCase();const mixedParts=(t.mixedWith||'').toLowerCase().split(/[,;]+/).map(s=>s.trim());
        return (t.dog||'').toLowerCase()===((dogObj?dogObj.name:'')||'').toLowerCase()&&mixedParts.some(m=>m===md||m.endsWith(' '+md));
      });
      const curResult=existingLog?.suitable||'';
      const opts=[{v:'Friends',e:'🥰'},{v:'Good',e:'😊'},{v:'Ignore',e:'😐'},{v:'Not Good',e:'😒'},{v:'Fight',e:'😡'},{v:'Did not meet',e:'🚶'}];
      const btns=opts.map(o=>{
        const sel=curResult===o.v;
        const col=o.v==='Friends'||o.v==='Good'?'var(--gn)':o.v==='Ignore'?'var(--gr2)':o.v==='Did not meet'?'var(--or)':'var(--rd)';
        return '<button type="button" style="font-size:9px;padding:3px 7px;border-radius:99px;border:1.5px solid '+(sel?col:'var(--gr4)')+';background:'+(sel?col:'transparent')+';color:'+(sel?'#fff':'var(--gr2)')+';cursor:pointer;" onclick="logCompatResult(\''+dogEsc+'\',\''+mEsc+'\',\''+o.v+'\',\'\',\''+overlapEnd+'\',\''+bkSd+'\',\''+bkEd+'\')">'+o.e+' '+o.v+'</button>';
      }).join('');
      return '<div style="padding:5px 0;border-bottom:1px solid var(--gr4);">'
        +'<div style="font-size:11px;font-weight:600;color:var(--bk);">'+b.dog+(b.customerId?' <span style="font-size:9px;color:var(--gr3);">'+b.customerId+'</span>':'')+' ('+fmtDate(b.sd)+' – '+fmtDate(b.ed)+')</div>'
        +'<div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;">'+btns+'</div>'
        +'</div>';
    }).join('')+logBtn;
}
async function logCompatResult(dogRef,mixedLabel,result,notes,logDate,bookingStart,bookingEnd){
  const dogObj=_dogByCid(dogRef)||allDogs.find(d=>d.name===dogRef);if(!dogObj)return;// dogRef may be a CID or a name
  const otherNm=(_resolveParty(mixedLabel)||{}).name||mixedLabel;
  if(!confirm('Confirm: log '+dogObj.name+' + '+otherNm+' as "'+result+'"?'))return;// no accidental writes
  const today=logDate||todayStr();
  const suitMap={'Friends':'Friends','Good':'Good','Ignore':'Ignore','Not Good':'Not Good','Fight':'Fight','Did not meet':'Did not meet'};
  const suitable=suitMap[result]||result;
  const obs=notes||(result==='Friends'?'Happy together':result==='Fight'?'Fought':result==='Did not meet'?'Did not meet':'');
  const row=rowFromMap(trialHdrRow,{CustomerID:dogObj.cid,DogName:dogObj.name,Date:today,MixedWith:mixedLabel,Observations:obs,Suitable:suitable,Private:''},TABS.TRIAL.h);
  // ONE record per unordered dog-pair per overlapping period — match in EITHER direction so we update, not duplicate.
  const otherCid=(mixedLabel||'').trim().split(/\s+/)[0]||'';
  const inPeriod=t=>(!bookingStart||t.date>=bookingStart)&&(!bookingEnd||t.date<=bookingEnd);
  const mwHas=(mw,cid)=>!!cid&&(mw||'').toLowerCase().split(/[,;]+/).some(p=>p.trim().split(/\s+/)[0]===cid.toLowerCase());
  const existing=trialLogs.find(t=>inPeriod(t)&&((t.cid===dogObj.cid&&mwHas(t.mixedWith,otherCid))||(t.cid===otherCid&&mwHas(t.mixedWith,dogObj.cid))));
  const persist=cid=>{const bk=bookings.find(b=>b.customerId===cid&&b.sd<=today&&(b.ed||b.sd)>=today);if(bk&&!bk.wf?.compat)persistAutoWf(bk,'compat').catch(()=>{});};
  if(existing){
    const prevSuitable=existing.suitable,prevObs=existing.obs,prevDate=existing.date;
    existing.suitable=suitable;existing.obs=obs;existing.date=today;
    renderOverlapCheck();renderWfChecklist();
    try{
      // keep the record's existing direction (its CustomerID/MixedWith); only change result/obs/date
      const urow=rowFromMap(trialHdrRow,{CustomerID:existing.cid,DogName:_nm(existing.cid),Date:today,MixedWith:existing.mixedWith,Observations:obs,Suitable:suitable,Private:''},TABS.TRIAL.h);
      await updateRow(TABS.TRIAL,existing.ri,urow);
      persist(dogObj.cid);persist(otherCid);
    }catch(e){
      existing.suitable=prevSuitable;existing.obs=prevObs;existing.date=prevDate;
      renderOverlapCheck();renderWfChecklist();alert('Error saving: '+e.message);
    }
  }else{
    const entry={cid:dogObj.cid,dog:dogObj.name,date:today,mixedWith:mixedLabel,obs,suitable,ri:trialLogs.length+2};
    trialLogs.push(entry);
    renderOverlapCheck();renderWfChecklist();
    try{await appendRow(TABS.TRIAL,row);persist(dogObj.cid);persist(otherCid);}
    catch(e){const idx=trialLogs.indexOf(entry);if(idx>=0)trialLogs.splice(idx,1);renderOverlapCheck();renderWfChecklist();alert('Error saving: '+e.message);}
  }
  updatePendingBadge();
}
function updateDogIdHint(){const d=_dogByCid(document.getElementById('bm_dog').value);document.getElementById('bm_dog_id').textContent=d?d.cid:'';}
function updateStatusFlow(){const v=document.getElementById('bm_status')?.value||'';const steps=['quoted','booked','prepaid','fullypaid'];const statMap={Quoted:0,Booked:1,Prepaid:2,'Fully Paid':3};const cur=statMap[v]??-1;const isCancelled=v==='Cancelled';const isCompleted=v==='Completed';steps.forEach((s,i)=>{const el=document.getElementById('bsf_'+s);if(!el)return;el.className='bk-flow-step';el.style.opacity='';if(isCancelled){el.style.opacity='0.3';return;}if(isCompleted){el.classList.add('fsdone');return;}if(cur<0)return;if(i<cur)el.classList.add('fsdone');else if(i===cur)el.classList.add('fsactive');});const cancelEl=document.getElementById('bsf_cancelled');const completeEl=document.getElementById('bsf_completed');if(cancelEl)cancelEl.style.display=isCancelled?'inline-block':'none';if(completeEl)completeEl.style.display=isCompleted?'inline-block':'none';
  const warnEl=document.getElementById('bm_status_warn');
  if(warnEl){
    if(isCompleted){
      const eid=document.getElementById('bm_eid')?.value;const bk=eid?bkByRef(eid,parseInt(document.getElementById('bm_ridx')?.value)||null):null;
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
  if(_bkSaving)return;_bkSaving=true;
  const btn=document.getElementById('bkBtn');const st=document.getElementById('bkStatus');btn.disabled=true;btn.textContent='Saving...';
  const eid=document.getElementById('bm_eid').value;let ri=parseInt(document.getElementById('bm_ridx').value)||null;
  if(eid&&!ri){const existing=bookings.find(b=>b.id===eid);if(existing?.ri)ri=existing.ri;}
  const rev=parseFloat(document.getElementById('bm_rev').value)||0;const tips=parseFloat(document.getElementById('bm_tips').value)||0;const pre=parseFloat(document.getElementById('bm_prepay').value)||0;const fin=parseFloat(document.getElementById('bm_final').value)||0;const unit=parseFloat(document.getElementById('bm_unit').value)||0;
  const ch=document.getElementById('bm_channel').value;const rPct=ch==='Rover'?(parseFloat(document.getElementById('bm_rpct').value)||0):0;const rAmt=ch==='Rover'?(parseFloat(document.getElementById('bm_ramt').value)||0):0;
  const priv=document.getElementById('bm_priv').checked;const id=eid||nextBkId(document.getElementById('bm_sd').value);const rems=eid?(bkByRef(eid,ri)?.rem||['','','','','']):['','','','',''];
  const sd=document.getElementById('bm_sd').value;const month=sd?new Date(sd+'T12:00:00').toLocaleString('en-GB',{month:'short',year:'numeric'}):'';
  const existingBk=eid?bkByRef(eid,ri):null;
  // bm_dog now carries the CID (dupe-name safe). Resolve the display name from it.
  const customerId=dog;const dogData=_dogByCid(dog);const dogName=dogData?dogData.name:(existingBk?.dog||'');
  const existingWf=eid?(existingBk?.wf||{}):{};
  const vals=rowFromMap(bkHdrRow,bkFieldMap({customerId,dog:dogName,id,svc:document.getElementById('bm_svc').value,sd,st:document.getElementById('bm_st').value,ed:document.getElementById('bm_ed').value,et:document.getElementById('bm_et').value,dropLoc:gv('bm_drop_loc'),pickLoc:gv('bm_pick_loc'),rev,tips,prepay:pre,finalPay:fin,unit,discNotes:document.getElementById('bm_disc_notes').value,roverPct:rPct,roverAmt:rAmt,ch,pay:document.getElementById('bm_pay').value,status:document.getElementById('bm_status').value,priv,month,rating:gv('bm_rating'),feedback:gv('bm_feedback'),rem:rems,wf:existingWf,bookingRef:gv('bm_ref'),prepayRef:gv('bm_prepay_ref'),finalPayRef:gv('bm_final_ref')}),TABS.BK.h);
  try{
    if(eid){if(!ri)throw new Error('Could not find this booking row to update — tap Sync and retry. Nothing was saved (prevents a duplicate).');await updateRow(TABS.BK,ri,vals);}else await appendRow(TABS.BK,vals);
    const mv=[...vals];mv[1]=dogName;const bkObj=mapBk(mv,eid?ri-2:bookings.length,mkHdr(bkHdrRow));if(eid){const idx=bookings.findIndex(r=>ri?r.ri===ri:r.id===eid);if(idx>=0)bookings[idx]=bkObj;}else bookings.push(bkObj);
    st.textContent='Saved!';st.className='smsg ok';setTimeout(()=>{document.getElementById('bkModal').classList.remove('open');renderBk();if(curDog)buildServices(curDog);updatePL();renderBoard();updatePendingBadge();},1400);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent=eid?'Modify Booking':'Save Booking';_bkSaving=false;}
}
function confirmDeleteBk(){const eid=document.getElementById('bm_eid').value;const ri=parseInt(document.getElementById('bm_ridx').value)||null;_delBkId=eid;_delBkRi=ri;document.getElementById('deleteBkInput').value='';document.getElementById('deleteBkConfirm').classList.add('open');}
async function doDeleteBk(){
  if(document.getElementById('deleteBkInput').value.trim()!=='DELETE'){alert('Type DELETE to confirm');return;}
  document.getElementById('deleteBkConfirm').classList.remove('open');
  if(_delBkRi){try{await clearRow(TABS.BK,_delBkRi);}catch(e){alert('Error: '+e.message);return;}}
  bookings=_delBkRi?bookings.filter(b=>b.ri!==_delBkRi):bookings.filter(b=>b.id!==_delBkId);document.getElementById('bkModal').classList.remove('open');renderBk();if(curDog)buildServices(curDog);updatePL();
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
    const oc="openBkModal('"+r.id+"',false,"+r.ri+")";
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
  document.getElementById('costBody').innerHTML=filtered.map(c=>{const i=costs.indexOf(c);return'<tr><td><input type="date" value="'+(normDate(c.date)||'')+'" oninput="costs['+i+'].date=this.value" style="'+inStyle+'width:100px;"></td><td><select onchange="costs['+i+'].cat=this.value" style="'+inStyle+'">'+COST_CATS.map(o=>'<option'+(o===c.cat?' selected':'')+'>'+o+'</option>').join('')+'</select></td><td><input type="number" value="'+(c.amount||0)+'" oninput="costs['+i+'].amount=parseFloat(this.value)||0" style="'+inStyle+'width:56px;"></td><td><input type="text" value="'+(c.notes||'')+'" oninput="costs['+i+'].notes=this.value" style="'+inStyle+'width:100px;"></td><td style="white-space:nowrap;"><button onclick="dupCostRow('+i+')" title="Duplicate" style="background:none;border:none;cursor:pointer;color:var(--or);font-size:13px;padding:0 3px;">⧉</button><button onclick="deleteCostRow('+i+')" style="background:none;border:none;cursor:pointer;color:var(--rd);font-size:13px;padding:0;">✕</button></td></tr>';}).join('');
}
function dupCostRow(i){const o=costs[i];costs.push({date:o.date,cat:o.cat,amount:o.amount,notes:o.notes,ri:null});renderCostTable();document.getElementById('costBody').lastElementChild?.scrollIntoView({behavior:'smooth'});}
// Delete a cost row. If it's already saved (has a sheet row-index), clear that row in the sheet too — otherwise the
// deletion is local-only and the cost reappears on the next Sync. Unsaved rows (ri=null) just drop from the array.
async function deleteCostRow(i){const c=costs[i];if(!c)return;if(!confirm('Delete this cost row?'))return;if(c.ri){try{await clearRow(TABS.COSTS,c.ri);}catch(e){alert('Error deleting from sheet: '+e.message);return;}}costs.splice(i,1);renderCostTable();updatePL();}
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
  bookings.forEach(r=>{const rev=actualRev(r),rov=r.roverAmt||0,isA=active.includes(r.status);bkMonthFractions(r).forEach(s=>{if(s.y!==yr||!monthly[s.mo])return;monthly[s.mo].rev+=rev*s.frac;if(isA)monthly[s.mo].rover+=rov*s.frac;});});
  costs.forEach(c=>{const nd=normDate(c.date);if(!nd||!nd.startsWith(yr))return;const mo=new Date(nd+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo])monthly[mo].cost+=(c.amount||0);});
  document.getElementById('plTbl').innerHTML=MOS.map(m=>{const tgt=tgts[m];const act=monthly[m];const totalCost=act.cost+act.rover;const net=act.rev-totalCost;
    const netTgt=tgt.rev-tgt.cost;
    return'<tr><td style="font-weight:700;">'+m+'</td><td><input class="pl-inp" type="number" id="tr_'+m+'" value="'+tgt.rev+'"></td><td><input class="pl-inp" type="number" id="tc_'+m+'" value="'+tgt.cost+'"></td><td style="font-weight:700;color:var(--gn);">'+fmtGBP(netTgt)+'</td><td style="color:var(--gn);font-weight:700;">'+fmtGBP(act.rev)+'</td><td style="color:var(--rd);">'+fmtGBP(totalCost)+(act.rover>0?'<br><span style="font-size:7px;color:var(--gr3);">incl '+fmtGBP(act.rover)+' Rover</span>':'')+'</td><td style="font-weight:700;'+(net>=0?'color:var(--gn)':'color:var(--rd)')+';">'+fmtGBP(net)+'</td></tr>';
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
  const active=['Prepaid','Fully Paid','Credit'];const fracYr=r=>bkMonthFractions(r).filter(s=>s.y===yr).reduce((a,s)=>a+s.frac,0);const yRec=bookings.filter(r=>fracYr(r)>0);const normCosts=costs.map(c=>({...c,_nd:normDate(c.date)}));
  const totalRev=yRec.reduce((s,r)=>s+actualRev(r)*fracYr(r),0);const totalRover=yRec.filter(r=>active.includes(r.status)).reduce((s,r)=>s+(r.roverAmt||0)*fracYr(r),0);
  const totalCost=normCosts.filter(c=>c._nd&&c._nd.startsWith(yr)).reduce((s,c)=>s+(c.amount||0),0)+totalRover;const net=totalRev-totalCost;const pct=revTgt>0?(totalRev/revTgt*100):0;
  document.getElementById('kpi_rev').textContent=fmtGBP(totalRev);document.getElementById('kpi_rev_s').textContent='vs '+fmtGBP(revTgt)+' target';
  document.getElementById('kpi_pct').textContent=pct.toFixed(1)+'%';document.getElementById('kpi_cost').textContent=fmtGBP(totalCost);
  document.getElementById('kpi_cost_s').textContent='vs '+fmtGBP(costTgt)+' target'+(totalRover>0?' (incl '+fmtGBP(totalRover)+' Rover)':'');
  const netTgt=revTgt-costTgt;const netEl=document.getElementById('kpi_net');netEl.textContent=fmtGBP(net);netEl.style.color=net>=0?'var(--gn)':'var(--rd)';
  const netDiff=net-netTgt;document.getElementById('kpi_net_s').textContent='vs '+fmtGBP(netTgt)+' target'+(netTgt>0?' ('+(netDiff>=0?'+':'')+fmtGBP(netDiff)+')':'');
  // Monthly averages — divide the year's totals by the number of months that actually had any cash-in or cost
  const moAgg={};MOS.forEach(m=>{moAgg[m]={rev:0,cost:0};});
  bookings.forEach(r=>{const rev=actualRev(r),rov=r.roverAmt||0,isA=active.includes(r.status);bkMonthFractions(r).forEach(s=>{if(s.y!==yr||!moAgg[s.mo])return;moAgg[s.mo].rev+=rev*s.frac;if(isA)moAgg[s.mo].cost+=rov*s.frac;});});
  normCosts.forEach(c=>{if(!c._nd||!c._nd.startsWith(yr))return;const mo=new Date(c._nd+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(moAgg[mo])moAgg[mo].cost+=(c.amount||0);});
  const activeMonths=MOS.filter(m=>moAgg[m].rev>0||moAgg[m].cost>0).length||1;
  const avgProfit=net/activeMonths;
  document.getElementById('avg_cash').textContent=fmtGBP(totalRev/activeMonths);
  document.getElementById('avg_cost').textContent=fmtGBP(totalCost/activeMonths);
  const apEl=document.getElementById('avg_profit');apEl.textContent=fmtGBP(avgProfit);apEl.style.color=avgProfit>=0?'var(--gn)':'var(--rd)';
  document.getElementById('avg_note').textContent='Averaged over '+activeMonths+' active month'+(activeMonths!==1?'s':'')+' (months with any cash-in or cost)';
  buildPLTable(yr);drawChart(yr,tgts);
}
function drawChart(yr,tgts){
  const monthly={};MOS.forEach(m=>{monthly[m]={rev:0,cost:0};});const active=['Prepaid','Fully Paid','Credit'];
  bookings.forEach(r=>{const rev=actualRev(r),rov=r.roverAmt||0,isA=active.includes(r.status);bkMonthFractions(r).forEach(s=>{if(s.y!==yr||!monthly[s.mo])return;monthly[s.mo].rev+=rev*s.frac;if(isA)monthly[s.mo].cost+=rov*s.frac;});});
  costs.forEach(c=>{const nd=normDate(c.date);if(!nd||!nd.startsWith(yr))return;const mo=new Date(nd+'T12:00:00').toLocaleString('en-GB',{month:'short'});if(monthly[mo])monthly[mo].cost+=(c.amount||0);});
  const rd=MOS.map(m=>monthly[m].rev);const cd=MOS.map(m=>monthly[m].cost);const rt=MOS.map(m=>tgts[m].rev);const ct=MOS.map(m=>tgts[m].cost);
  const nd=MOS.map(m=>monthly[m].rev-monthly[m].cost);const nt=MOS.map(m=>tgts[m].rev-tgts[m].cost);
  const maxV=Math.max(...rd,...cd,...rt,...ct,...nd,...nt,100);const W=560,H=190,PL=40,PR=14,PT=14,PB=26;const cW=W-PL-PR,cH=H-PT-PB;
  const xi=i=>PL+i*(cW/(MOS.length-1));const yi=v=>PT+cH-(v/maxV*cH);
  let g='';[0,.25,.5,.75,1].forEach(ratio=>{const yy=PT+cH-ratio*cH;g+='<line x1="'+PL+'" y1="'+yy+'" x2="'+(W-PR)+'" y2="'+yy+'" stroke="#E7E5E4" stroke-width="1"/>';if(ratio>0)g+='<text x="'+(PL-4)+'" y="'+(yy+3)+'" font-size="8" fill="#A8A29E" text-anchor="end">'+(maxV*ratio).toFixed(0)+'</text>';});
  const lbl=MOS.map((m,i)=>'<text x="'+xi(i)+'" y="'+(H-5)+'" font-size="8" fill="#A8A29E" text-anchor="middle">'+m+'</text>').join('');
  const poly=(pts,col,dash)=>'<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
  const dots=rd.map((v,i)=>'<circle cx="'+xi(i)+'" cy="'+yi(v)+'" r="3" fill="#F97316"/>').join('');
  document.getElementById('plChart').innerHTML='<g font-family="system-ui,sans-serif">'+g+poly(nt.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#DCFCE7','4,3')+poly(rt.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#FED7AA','4,3')+poly(ct.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#7DD3FC','3,3')+poly(cd.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#1E40AF')+poly(nd.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#16A34A')+poly(rd.map((v,i)=>xi(i)+','+yi(v)).join(' '),'#F97316')+dots+lbl+'</g>';
}

// ==================== CALENDAR (Feature 1) ====================
// Availability calendar. Capacity = 4 dogs/night (boarding + dog-sit occupy each night sd..ed-1; day-care occupies its day).
const CAL_CAP=4;
let _calView='month',_calAnchor=todayStr(),_calSelDay='';
const CAL_ACTIVE=['Booked','Prepaid','Fully Paid','Credit','Completed'];
function _svcKind(b){const s=(b.svc||'').toLowerCase();if(s.includes('boarding')||s.includes('dogsit')||s.includes('dog sit'))return'stay';if(s.includes('daycare')||s.includes('day care'))return'day';return'visit';}
// Dogs occupying an overnight place on the night of dateStr (boarding/dog-sit nights sd..ed-1; day-care on its day).
function occupantsOn(dateStr){
  const res=[];
  bookings.forEach(b=>{if(!CAL_ACTIVE.includes(b.status))return;const k=_svcKind(b);const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd)return;
    if(k==='stay'){if(nsd<=dateStr&&dateStr<=(ned||nsd))res.push(b);}
    else if(k==='day'){if(nsd<=dateStr&&dateStr<=(ned||nsd))res.push(b);}});
  return res;
}
// Quoted (not-yet-committed) dogs occupying a date — shown faded so we know how many we could still commit / chase.
function quotedOn(dateStr){
  const res=[];
  bookings.forEach(b=>{if(b.status!=='Quoted')return;const k=_svcKind(b);const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd)return;
    if(k==='stay'){if(nsd<=dateStr&&dateStr<=(ned||nsd))res.push(b);}
    else if(k==='day'){if(nsd<=dateStr&&dateStr<=(ned||nsd))res.push(b);}});
  return res;
}
// All events touching a date: arrivals (drop-off), departures (pick-up), day-care visits, other visits — with times.
function eventsOn(dateStr){
  const arrivals=[],departures=[],daycare=[],visits=[];
  bookings.forEach(b=>{if(!CAL_ACTIVE.includes(b.status))return;const k=_svcKind(b);const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd)return;
    if(k==='stay'){if(nsd===dateStr)arrivals.push({b,t:b.st||'09:00'});if(ned===dateStr)departures.push({b,t:b.et||'18:00'});}
    else if(k==='day'){if(nsd<=dateStr&&dateStr<=(ned||nsd))daycare.push({b,drop:b.st||'07:00',pick:b.et||'18:00'});}
    else{if(nsd===dateStr)visits.push({b,t:b.st||''});}});
  const byT=(a,c)=>(a.t||'').localeCompare(c.t||'');
  return{arrivals:arrivals.sort(byT),departures:departures.sort(byT),daycare:daycare.sort((a,c)=>(a.drop||'').localeCompare(c.drop||'')),visits:visits.sort(byT)};
}
function _capCol(n){return n>=CAL_CAP?'var(--rd)':n===CAL_CAP-1?'var(--or)':n>0?'var(--gn)':'var(--gr3)';}
// Light box background by occupancy: 1=green, 2=yellow, 3=orange, 4=red.
function _capBg(n){return n>=CAL_CAP?'#FEE2E2':n===3?'#FFEDD5':n===2?'#FEF9C3':n===1?'#DCFCE7':'var(--wh)';}
// Row indexes of each dog's first-ever booking (= "new"/non-returning). Set once per render.
let _calNewRis=new Set();
function _computeNewRis(){const first={};bookings.forEach(b=>{if(!CAL_ACTIVE.includes(b.status))return;const k=b.customerId||b.dog;if(!k)return;const sd=normDate(b.sd)||'';const c=first[k];if(!c||sd<c.sd||(sd===c.sd&&(b.ri||0)<c.ri))first[k]={sd,ri:b.ri||0};});_calNewRis=new Set(Object.values(first).map(f=>f.ri));}
function openDogByCid(cid){if(!cid)return;const d=allDogs.find(x=>x.cid===cid);if(d){openProfile(d);showScreen('sc-profile');}}
// New dogs = dark-orange name (returning dogs stay blue) — a colour cue that takes no extra width, so long names aren't truncated by a badge.
function _dogChip(b){const isNew=_calNewRis.has(b.ri);return'<span class="cal-dog" onclick="event.stopPropagation();openDogByCid(\''+(b.customerId||'')+'\')"'+(isNew?' style="color:var(--cn);font-weight:700;"':'')+' title="'+(b.dog||'')+(isNew?' (new dog)':'')+'">'+(b.dog||'')+'</span>';}
function setCalView(v){_calView=v;renderCalendar();}
function calShift(dir){const d=new Date(_calAnchor+'T12:00:00');if(_calView==='month')d.setMonth(d.getMonth()+dir);else d.setDate(d.getDate()+dir*(_calView==='slots'?1:7));_calAnchor=d.toISOString().slice(0,10);_calSelDay='';renderCalendar();}
function calToday(){_calAnchor=todayStr();_calSelDay='';renderCalendar();}
function _mondayOf(dateStr){const d=new Date(dateStr+'T12:00:00');const wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return d;}
function _dstr(d){return d.toISOString().slice(0,10);}
const CAL_T0=6,CAL_T1=21;// week-view timeline window (06:00–21:00)
function _hm(t){const p=(t||'').split(':');const h=parseInt(p[0],10),m=parseInt(p[1],10);return(isNaN(h)?12:h)+((isNaN(m)?0:m)/60);}
function _tpct(t){return Math.max(0,Math.min(100,((_hm(t)-CAL_T0)/(CAL_T1-CAL_T0))*100));}
function renderCalendar(){
  const host=document.getElementById('sc-calendar');if(!host)return;
  _computeNewRis();
  document.querySelectorAll('.cal-view-btn').forEach(b=>b.classList.toggle('active',b.dataset.v===_calView));
  document.getElementById('calBody').innerHTML=_calView==='month'?_calMonthHtml():_calView==='slots'?_calSlotsHtml():_calWeekHtml();
}
// Tapping a day in Month view jumps straight to that day's Hour view.
function openDayHour(ds){_calAnchor=ds;_calSelDay='';_calView='slots';renderCalendar();}
function _calMonthHtml(){
  const anchor=new Date(_calAnchor+'T12:00:00');const y=anchor.getFullYear(),m=anchor.getMonth();
  const title=anchor.toLocaleString('en-GB',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);const start=_mondayOf(_dstr(first));const today=todayStr();
  let cells='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=_dstr(d);const inMo=d.getMonth()===m;
    const occs=occupantsOn(ds);const occ=occs.length;const quo=quotedOn(ds);const ev=eventsOn(ds);const isToday=ds===today;
    const bg=inMo?_capBg(occ):'var(--gr5)';
    const names=occs.map(b=>_dogChip(b)).join('')+quo.map(b=>'<span class="cal-dog cal-quo" onclick="event.stopPropagation();openDogByCid(\''+(b.customerId||'')+'\')" title="Quoted — not yet committed">'+(b.dog||'')+' (Q)</span>').join('');
    const newArr=ev.arrivals.some(a=>_calNewRis.has(a.b.ri));
    const foot=(ev.arrivals.length?'<span style="color:var(--gn);font-weight:800;">▲'+ev.arrivals.length+'</span> ':'')+(ev.departures.length?'<span style="color:var(--sk);font-weight:800;">▼'+ev.departures.length+'</span>':'')+(quo.length?' <span title="Quoted, not committed" style="color:var(--gr3);font-weight:800;">'+quo.length+'Q</span>':'')+(newArr?' <span title="New (non-returning) dog" style="color:var(--or);font-weight:800;">🆕</span>':'');
    cells+='<div class="cal-cell'+(inMo?'':' out')+(isToday?' today':'')+'" data-d="'+ds+'" onclick="openDayHour(\''+ds+'\')" style="background:'+bg+';cursor:pointer;">'+
      '<div class="cal-cell-hd"><span style="font-weight:700;'+(inMo?'':'color:var(--gr3);')+'">'+d.getDate()+'</span>'+
      (occ>0?'<span style="font-weight:800;color:'+_capCol(occ)+';">'+occ+'/'+CAL_CAP+'</span>':'')+'</div>'+
      '<div class="cal-names">'+names+'</div>'+
      '<div class="cal-foot">'+foot+'</div></div>';
  }
  const hdr=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div style="font-size:8px;font-weight:700;color:var(--gr2);text-align:center;padding:2px 0;">'+d+'</div>').join('');
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px;"><span style="font-size:14px;font-weight:800;">'+title+'</span>'+
    '<span style="font-size:8px;color:var(--gr2);">▲ arrive · ▼ depart · <span style="color:var(--cn);font-weight:700;">orange name</span> = new dog · tap a day → hour view</span></div>'+
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">'+hdr+cells+'</div>';
}
// Normalise any time to HH:MM (strip seconds, pad hour) so the calendar shows 09:00-19:00 consistently.
function _fmtT(t){if(!t)return'';const p=String(t).split(':');const h=(p[0]||'0').padStart(2,'0');const m=(p[1]||'00').slice(0,2).padStart(2,'0');return h+':'+m;}
// Resource grid: 4 "places" (rows) × N days (columns) for boarding/day-care, plus rows for other services.
function _calGridHtml(start,nDays){
  const today=todayStr();
  const days=[];for(let i=0;i<nDays;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(_dstr(d));}
  // Overnight (boarding/dog-sit) + day-care as 4-place bars (committed OR quoted).
  const items=[];
  bookings.forEach(b=>{const committed=CAL_ACTIVE.includes(b.status),quoted=b.status==='Quoted';if(!committed&&!quoted)return;const k=_svcKind(b);if(k==='visit')return;const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd)return;
    const idx=[];days.forEach((ds,i)=>{if(nsd<=ds&&ds<=(ned||nsd))idx.push(i);});
    if(idx.length)items.push({b,quoted,k,s:idx[0],e:idx[idx.length-1]});});
  items.sort((a,c)=>(a.quoted-c.quoted)||(a.s-c.s)||((c.e-c.s)-(a.e-a.s)));
  const lanes=[];items.forEach(it=>{let L=lanes.findIndex(lane=>lane.every(x=>it.s>x.e||it.e<x.s));if(L<0){L=lanes.length;lanes.push([]);}lanes[L].push(it);it.lane=L;});
  const nLanes=Math.max(CAL_CAP,lanes.length);
  // Non-overnight services → their own rows (walk / drop-in / taxi / training) shown per day with times.
  const SVC_ROWS=[['🐕 Walk',['walking','walk']],['🔑 Drop-in',['drop-in','dropin']],['🚕 Taxi',['taxi']],['🎓 Train',['training']]];
  const svcRows=SVC_ROWS.map(([lbl,al])=>{const perDay=days.map(()=>[]);
    bookings.forEach(b=>{const committed=CAL_ACTIVE.includes(b.status),quoted=b.status==='Quoted';if(!committed&&!quoted)return;const s=(b.svc||'').toLowerCase();if(!al.some(a=>s.includes(a)))return;const di=days.indexOf(normDate(b.sd));if(di>=0)perDay[di].push({b,quoted});});
    return{lbl,perDay,has:perDay.some(a=>a.length)};}).filter(r=>r.has);
  let g='<div class="cw-grid" style="grid-template-columns:34px repeat('+nDays+',minmax(0,1fr));">';
  g+='<div class="cw-cell cw-corner" style="grid-row:1;grid-column:1;"></div>';
  days.forEach((ds,i)=>{const d=new Date(ds+'T12:00:00');const occ=occupantsOn(ds).length;const q=quotedOn(ds).length;
    g+='<div class="cw-cell cw-dayhd'+(ds===today?' cw-today':'')+'" style="grid-row:1;grid-column:'+(i+2)+';"><div>'+d.toLocaleDateString('en-GB',{weekday:'short'})+' '+d.getDate()+'</div><div style="font-weight:800;color:'+_capCol(occ)+';">'+occ+'/'+CAL_CAP+(q?' <span style="color:var(--gr3);">+'+q+'Q</span>':'')+'</div></div>';});
  for(let L=0;L<nLanes;L++){
    g+='<div class="cw-cell cw-lanelbl'+(L>=CAL_CAP?' cw-over':'')+'" style="grid-row:'+(L+2)+';grid-column:1;" title="'+(L>=CAL_CAP?'Overbooked':'Place '+(L+1))+'">'+(L>=CAL_CAP?'⚠':'#'+(L+1))+'</div>';
    for(let i=0;i<nDays;i++)g+='<div class="cw-cell cw-bgcell'+(days[i]===today?' cw-today':'')+'" style="grid-row:'+(L+2)+';grid-column:'+(i+2)+';"></div>';
  }
  items.forEach(it=>{const b=it.b;const nm=b.dog||'';const per=_fmtT(b.st||(it.k==='day'?'07:00':'09:00'))+'-'+_fmtT(b.et||'18:00');
    const bg=it.quoted?'':('background:'+(it.k==='day'?'var(--or)':'var(--sk)')+';');
    g+='<div class="cw-bar'+(it.quoted?' cw-quo':'')+'" style="grid-row:'+(it.lane+2)+';grid-column:'+(it.s+2)+' / '+(it.e+3)+';'+bg+'" onclick="openDogByCid(\''+(b.customerId||'')+'\')" title="'+nm+(it.quoted?' (QUOTED)':'')+' · '+per+'"><span class="cw-nm">'+nm+(it.quoted?' (Q)':'')+'</span><span class="cw-per">'+per+'</span></div>';});
  svcRows.forEach((row,ri)=>{const R=nLanes+ri+2;
    g+='<div class="cw-cell cw-svclbl" style="grid-row:'+R+';grid-column:1;" title="'+row.lbl+'">'+row.lbl.split(' ')[0]+'</div>';
    for(let i=0;i<nDays;i++){const inner=row.perDay[i].map(x=>'<div class="cw-visit'+(x.quoted?' cw-quo':'')+'" onclick="openDogByCid(\''+(x.b.customerId||'')+'\')" title="'+(x.b.dog||'')+' · '+row.lbl+' · '+_fmtT(x.b.st||'')+'">'+_fmtT(x.b.st||'')+' '+(x.b.dog||'')+(x.quoted?' (Q)':'')+'</div>').join('');
      g+='<div class="cw-cell cw-bgcell'+(days[i]===today?' cw-today':'')+'" style="grid-row:'+R+';grid-column:'+(i+2)+';">'+inner+'</div>';}
  });
  g+='</div>';
  return g;
}
function _calGridHdr(title,note){return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px;"><span style="font-size:14px;font-weight:800;">'+title+'</span><span style="font-size:8px;color:var(--gr2);">'+note+'</span></div>';}
function _calWeekHtml(){
  const start=_mondayOf(_calAnchor);const end=new Date(start);end.setDate(start.getDate()+6);
  const title=start.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' - '+end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return _calGridHdr(title,'4 places · blue=board · orange=daycare · hatched=quoted · other services below')+_calGridHtml(start,7);
}
// ---- 30-min view: how many dogs are on-site in each half-hour slot of the anchor day ----
function _minOf(t){const p=String(t||'').split(':');const h=parseInt(p[0],10),m=parseInt(p[1],10);return isNaN(h)?NaN:h*60+(isNaN(m)?0:m);}
// Is booking b present during the [slotStart, slotStart+30) minutes window on day ds?
function _slotPresent(b,ds,slotStart){
  const k=_svcKind(b);const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd)return false;
  if(!(nsd<=ds&&ds<=(ned||nsd)))return false;
  const stM=_minOf(b.st),etM=_minOf(b.et);const slotEnd=slotStart+30;
  if(k==='stay'){// boarding/dog-sit: present overnight; bounded by drop-off on arrival day and pick-up on departure day
    let from=0,to=1440;if(ds===nsd&&!isNaN(stM))from=stM;if(ds===ned&&!isNaN(etM))to=etM;
    return slotStart<to&&slotEnd>from;}
  if(k==='day'){const from=isNaN(stM)?7*60:stM;const to=isNaN(etM)?18*60:etM;return slotStart<to&&slotEnd>from;}
  // visit (walk/drop-in/taxi/training): only on its own day, within its time window
  if(ds!==nsd)return false;const from=isNaN(stM)?9*60:stM;let to=isNaN(etM)?from+60:etM;if(to<=from)to=from+30;
  return slotStart<to&&slotEnd>from;
}
function _slotDogs(ds,slotStart){return bookings.filter(b=>CAL_ACTIVE.includes(b.status)&&_slotPresent(b,ds,slotStart));}
// Hour view: places = COLUMNS (#1–#4), hours = ROWS. Each booking renders as ONE merged cell spanning the hours it
// occupies (name shown once). Overbooked dogs (lanes beyond #4) each get their own ⚠ column showing the dog's name.
function _calSlotsHtml(){
  const ds=_calAnchor;const d=new Date(ds+'T12:00:00');
  const title=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  const H0=6,H1=22;const nRows=H1-H0;// hourly rows 06:00–21:00
  const overlaps=(from,to,h)=>from<(h+1)*60&&to>h*60;
  // First/last visible hour-row a [from,to] range covers → [firstRowIdx,lastRowIdx] (0-based) or null
  const rowSpan=(from,to)=>{let f=-1,l=-1;for(let h=H0;h<H1;h++){if(overlaps(from,to,h)){if(f<0)f=h-H0;l=h-H0;}}return f<0?null:[f,l];};
  // Overnight (boarding/dog-sit) + day-care → assign each to a place lane; extra lanes beyond CAL_CAP = overbooked
  const items=[];
  bookings.forEach(b=>{const committed=CAL_ACTIVE.includes(b.status),quoted=b.status==='Quoted';if(!committed&&!quoted)return;const k=_svcKind(b);if(k==='visit')return;const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(!nsd||!(nsd<=ds&&ds<=(ned||nsd)))return;
    const stM=_minOf(b.st),etM=_minOf(b.et);let from,to;
    if(k==='stay'){from=(ds===nsd&&!isNaN(stM))?stM:0;to=(ds===ned&&!isNaN(etM))?etM:1440;}
    else{from=isNaN(stM)?7*60:stM;to=isNaN(etM)?18*60:etM;}
    items.push({b,quoted,k,from,to});});
  items.sort((a,c)=>(a.quoted-c.quoted)||(a.from-c.from)||((c.to-c.from)-(a.to-a.from)));
  const lanes=[];items.forEach(it=>{let L=lanes.findIndex(lane=>lane.every(x=>it.from>=x.to||it.to<=x.from));if(L<0){L=lanes.length;lanes.push([]);}lanes[L].push(it);it.lane=L;});
  // Other services (walk / drop-in / taxi / training) on this day
  const visits=[];
  bookings.forEach(b=>{const committed=CAL_ACTIVE.includes(b.status),quoted=b.status==='Quoted';if(!committed&&!quoted)return;if(_svcKind(b)!=='visit')return;if(normDate(b.sd)!==ds)return;const stM=_minOf(b.st);let etM=_minOf(b.et);if(isNaN(stM))return;if(isNaN(etM)||etM<=stM)etM=stM+60;visits.push({b,quoted,from:stM,to:etM});});
  const hasOther=visits.length>0;
  // Columns: places #1–#4, one ⚠ column per overbooked lane (shows the dog's name), then Other if any.
  const nLanes=Math.max(CAL_CAP,lanes.length);
  const cols=[];for(let p=0;p<nLanes;p++)cols.push({type:'place',lane:p,over:p>=CAL_CAP,lbl:p>=CAL_CAP?'⚠':'#'+(p+1)});
  if(hasOther)cols.push({type:'other',lbl:'Other'});
  const nCol=cols.length;
  let g='<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><div class="cw-grid" style="grid-template-columns:40px repeat('+nCol+',minmax(30px,1fr));min-width:'+(40+nCol*34)+'px;">';
  // header row
  g+='<div class="cw-cell cw-corner" style="grid-row:1;grid-column:1;"></div>';
  cols.forEach((c,ci)=>g+='<div class="cw-cell cw-dayhd" style="grid-row:1;grid-column:'+(ci+2)+';'+(c.over?'color:var(--rd);':'')+'">'+c.lbl+'</div>');
  // hour labels + empty background cells for every row/column
  for(let r=0;r<nRows;r++){
    g+='<div class="cw-cell cw-lanelbl" style="font-size:9px;grid-row:'+(r+2)+';grid-column:1;">'+String(H0+r).padStart(2,'0')+':00</div>';
    cols.forEach((c,ci)=>g+='<div class="cw-cell cw-bgcell" style="grid-row:'+(r+2)+';grid-column:'+(ci+2)+';"></div>');
  }
  // merged booking cells (name once, spanning its hours) — placed on top of the background cells
  const barSty='font-weight:700;justify-content:center;align-items:center;line-height:1;';
  const vnm='writing-mode:vertical-rl;transform:rotate(180deg);max-height:100%;';// dog name reads bottom→top so columns can stay narrow
  cols.forEach((c,ci)=>{
    if(c.type==='place'){(lanes[c.lane]||[]).forEach(it=>{const sp=rowSpan(it.from,it.to);if(!sp)return;const b=it.b;
      let fill;
      if(it.quoted)fill='background:var(--gr5);color:var(--gr2);border-left:3px solid var(--gr3);font-style:italic;';
      else if(c.over)fill='background:var(--rdl);color:var(--rd);border-left:3px solid var(--rd);';
      else if(it.k==='day')fill='background:var(--orxl);color:var(--cn);border-left:3px solid var(--or);';
      else fill='background:var(--bll);color:var(--bl);border-left:3px solid var(--sk);';
      const per=_fmtT(b.st||(it.k==='day'?'07:00':'09:00'))+'-'+_fmtT(b.et||'18:00');
      g+='<div class="cw-bar" style="grid-column:'+(ci+2)+';grid-row:'+(sp[0]+2)+' / '+(sp[1]+3)+';font-size:9px;'+barSty+fill+'" onclick="openDogByCid(\''+(b.customerId||'')+'\')" title="'+(b.dog||'')+(c.over?' (OVERBOOKED)':'')+' · '+per+'"><span class="cw-nm" style="'+vnm+'">'+(b.dog||'')+(it.quoted?' (Q)':'')+'</span></div>';});
    }else{visits.forEach(v=>{const sp=rowSpan(v.from,v.to);if(!sp)return;
      g+='<div class="cw-bar" style="grid-column:'+(ci+2)+';grid-row:'+(sp[0]+2)+' / '+(sp[1]+3)+';font-size:8px;'+barSty+'background:var(--pul);color:var(--pu);border-left:3px solid var(--pu);" onclick="openDogByCid(\''+(v.b.customerId||'')+'\')" title="'+(v.b.dog||'')+'"><span class="cw-nm" style="'+vnm+'">'+(v.b.dog||'')+(v.quoted?' (Q)':'')+'</span></div>';});}
  });
  g+='</div></div>';
  const pre=bookings.filter(b=>CAL_ACTIVE.includes(b.status)&&_svcKind(b)==='stay'&&_slotPresent(b,ds,5*60)).length;
  return _calGridHdr(title,'Places = columns · hours = rows · blue=board · orange=daycare · ⚠=overbooked · ‹ › = other days')+
    '<div style="font-size:9px;color:var(--gr2);margin-bottom:6px;background:var(--gr5);padding:5px 8px;border-radius:var(--r);">🌙 Overnight (before 06:00): <b>'+pre+'</b> boarder'+(pre!==1?'s':'')+' on-site</div>'+g;
}

// ==================== ANALYSIS ====================
function renderAnalysis(){
  const yr=document.getElementById('anYear')?.value||'2026';
  const today=todayStr();
  // Revenue reports count Prepaid (deposit) + Fully Paid + Credit + Completed. actualRev() handles how much
  // of each counts (Prepaid → deposit only; the rest → full settlement).
  const paid=['Prepaid','Fully Paid','Credit','Completed'];
  const active=['Booked','Prepaid','Fully Paid','Credit','Completed']; // occupancy = physical presence
  const svcCols={Boarding:'#F97316',DayCare:'#EAB308',Walking:'#22C55E','Drop-in':'#8B5CF6','Dog Sit':'#06B6D4','Pet Taxi':'#EC4899',Training:'#6366F1',Other:'#A8A29E'};
  // Cross-year/month split: a booking is in-year if any night falls in yr; revenue counts only its in-year portion.
  const yBks=bookings.filter(b=>paid.includes(b.status)&&bkMonthFractions(b).some(s=>s.y===yr));// cash-in reports (Prepaid deposit + Fully Paid/Credit/Completed)
  const fpBks=bookings.filter(b=>b.status==='Fully Paid'&&bkMonthFractions(b).some(s=>s.y===yr));// "Fully Paid only" reports
  const fracInYr=b=>bkMonthFractions(b).filter(s=>s.y===yr);
  const revY=b=>actualRev(b)*fracInYr(b).reduce((a,s)=>a+s.frac,0);
  const yrN=parseInt(yr);
  const isLeap=yrN%4===0&&(yrN%100!==0||yrN%400===0);const daysInYr=isLeap?366:365;

  // ── 1. Revenue by Service — stacked bar chart by month ──
  const moSvcRev={};MOS.forEach(m=>moSvcRev[m]={});
  yBks.forEach(b=>{const s=b.svc||'Other';const rev=actualRev(b);fracInYr(b).forEach(seg=>{if(!moSvcRev[seg.mo])return;moSvcRev[seg.mo][s]=(moSvcRev[seg.mo][s]||0)+rev*seg.frac;});});
  const allSvcsSet=new Set();MOS.forEach(m=>Object.keys(moSvcRev[m]).forEach(s=>allSvcsSet.add(s)));
  const svcTotals={};[...allSvcsSet].forEach(s=>svcTotals[s]=MOS.reduce((sum,m)=>sum+(moSvcRev[m][s]||0),0));
  const svcsOrd=[...allSvcsSet].sort((a,b)=>svcTotals[b]-svcTotals[a]);
  {
    const W=560,H=200,PL=40,PR=10,PT=14,PB=26,cW=W-PL-PR,cH=H-PT-PB;
    const bStep=cW/MOS.length,bW=Math.floor(bStep*0.68);
    const maxSt=Math.max(...MOS.map(m=>Object.values(moSvcRev[m]).reduce((s,v)=>s+v,0)),100);
    let g='';
    [0,.25,.5,.75,1].forEach(r=>{const yy=PT+cH-r*cH;g+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#E7E5E4" stroke-width="1"/>`;if(r>0)g+=`<text x="${PL-4}" y="${yy+3}" font-size="7" fill="#A8A29E" text-anchor="end">${(maxSt*r).toFixed(0)}</text>`;});
    MOS.forEach((m,i)=>{const x=PL+i*bStep+(bStep-bW)/2;let cumH=0;svcsOrd.forEach(s=>{const v=moSvcRev[m][s]||0;if(v<=0)return;const bH=Math.max(v/maxSt*cH,1);const y=PT+cH-cumH-bH;g+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW}" height="${bH.toFixed(1)}" fill="${svcCols[s]||'#A8A29E'}" rx="1"/>`;cumH+=bH;});g+=`<text x="${(x+bW/2).toFixed(1)}" y="${H-5}" font-size="7" fill="#A8A29E" text-anchor="middle">${m}</text>`;});
    const leg=svcsOrd.map(s=>`<div class="leg"><div class="leg-d" style="background:${svcCols[s]||'#A8A29E'};"></div>${s}</div>`).join('');
    document.getElementById('anRevBreakdown').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;"><svg viewBox="0 0 560 200" style="width:100%;display:block;"><g font-family="system-ui,sans-serif">'+g+'</g></svg><div class="legend" style="margin-top:6px;">'+leg+'</div></div>';
  }

  // ── 2. Bookings Count & AOV (numbers outside bar to the right) ──
  const moBkCnt={};const moBkRev={};MOS.forEach(m=>{moBkCnt[m]=0;moBkRev[m]=0;});
  fpBks.forEach(b=>{const segs=fracInYr(b);if(!segs.length)return;const rev=actualRev(b);if(moBkCnt[segs[0].mo]!==undefined)moBkCnt[segs[0].mo]++;segs.forEach(seg=>{if(moBkRev[seg.mo]!==undefined)moBkRev[seg.mo]+=rev*seg.frac;});});
  const totalBks=fpBks.length,totalRevY=fpBks.reduce((s,b)=>s+revY(b),0),aov=totalBks>0?Math.round(totalRevY/totalBks):0;
  const maxCnt=Math.max(...MOS.map(m=>moBkCnt[m]),1);
  document.getElementById('anBkCount').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;"><div style="display:flex;gap:8px;margin-bottom:10px;"><div style="flex:1;text-align:center;background:var(--gr5);border-radius:var(--r);padding:8px 4px;"><div style="font-size:20px;font-weight:800;color:var(--bl);">'+totalBks+'</div><div style="font-size:8px;color:var(--gr2);">Bookings</div></div><div style="flex:1;text-align:center;background:var(--gr5);border-radius:var(--r);padding:8px 4px;"><div style="font-size:20px;font-weight:800;color:var(--or);">'+fmtGBP(totalRevY)+'</div><div style="font-size:8px;color:var(--gr2);">Revenue</div></div><div style="flex:1;text-align:center;background:var(--gr5);border-radius:var(--r);padding:8px 4px;"><div style="font-size:20px;font-weight:800;color:var(--gn);">'+fmtGBP(aov)+'</div><div style="font-size:8px;color:var(--gr2);">Avg Order</div></div></div>'+MOS.map(m=>{const cnt=moBkCnt[m];const pct=cnt/maxCnt*100;const ov=cnt>0?fmtGBP(Math.round(moBkRev[m]/cnt)):'-';return'<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;"><div style="font-size:9px;color:var(--gr2);width:22px;flex-shrink:0;">'+m+'</div><div style="flex:1;height:12px;background:var(--gr4);border-radius:3px;"><div style="height:12px;background:var(--bl);border-radius:3px;width:'+pct+'%;min-width:'+(cnt?2:0)+'px;"></div></div><div style="font-size:8px;color:var(--gr);min-width:90px;text-align:right;white-space:nowrap;">'+cnt+(cnt>0?' · AOV '+ov:'')+'</div></div>';}).join('')+'</div>';

  // ── 3. Service Type Revenue Share (% of total revenue) ──
  const svcRevMap={};yBks.forEach(b=>{const s=b.svc||'Other';svcRevMap[s]=(svcRevMap[s]||0)+revY(b);});
  const totalSvcRev=Object.values(svcRevMap).reduce((s,v)=>s+v,0);
  const svcRevSorted=Object.entries(svcRevMap).sort((a,b)=>b[1]-a[1]);
  document.getElementById('anSvcCount').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">'+(totalSvcRev>0?svcRevSorted.map(([s,v])=>{const pct=(v/totalSvcRev*100).toFixed(1);const col=svcCols[s]||'#A8A29E';return'<div style="margin-bottom:7px;"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;margin-bottom:2px;"><span>'+s+'</span><span style="color:'+col+';">'+fmtGBP(v)+' ('+pct+'%)</span></div><div style="height:6px;background:var(--gr4);border-radius:3px;"><div style="height:6px;background:'+col+';border-radius:3px;width:'+pct+'%;"></div></div></div>';}).join('')+'<div style="border-top:1px solid var(--gr4);margin-top:7px;padding-top:6px;font-size:9px;color:var(--gr2);">Total revenue: '+fmtGBP(totalSvcRev)+'</div>':'<div style="color:var(--gr3);font-size:11px;">No paid bookings for '+yr+'</div>')+'</div>';

  // ── 4. Rover vs Direct (with % of total revenue) ──
  const chMap={};
  fpBks.forEach(b=>{const k=(b.ch||'TCL').toLowerCase().includes('rover')?'Rover':'Direct (TCL)';if(!chMap[k])chMap[k]={count:0,rev:0};chMap[k].count++;chMap[k].rev+=revY(b);});
  const chCols={'Direct (TCL)':'#F97316',Rover:'#1E40AF'};
  const totalChRev=Object.values(chMap).reduce((s,d)=>s+d.rev,0);
  const chEntries=Object.entries(chMap).sort((a,b)=>b[1].rev-a[1].rev);
  let chHtml='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">';
  if(chEntries.length){
    chHtml+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px;">';
    chHtml+=chEntries.map(([ch,d])=>{const col=chCols[ch]||'#A8A29E';const pctRev=totalChRev>0?Math.round(d.rev/totalChRev*100):0;return'<div style="background:var(--gr5);border-radius:var(--r);padding:10px;text-align:center;border-top:3px solid '+col+';"><div style="font-size:11px;font-weight:700;color:var(--gr);margin-bottom:4px;">'+ch+'</div><div style="font-size:18px;font-weight:800;color:'+col+';">'+fmtGBP(d.rev)+'</div><div style="font-size:10px;font-weight:700;color:'+col+';margin-bottom:4px;">'+pctRev+'% of revenue</div><div style="font-size:9px;color:var(--gr2);">'+d.count+' booking'+(d.count!==1?'s':'')+'</div><div style="font-size:8px;color:var(--gr3);margin-top:2px;">AOV: '+fmtGBP(Math.round(d.rev/(d.count||1)))+'</div></div>';}).join('');
    chHtml+='</div>';
    if(chEntries.length===2){const a=chEntries[0][1],b2=chEntries[1][1];const diff=b2.rev>0?Math.round((a.rev-b2.rev)/b2.rev*100):null;if(diff!==null)chHtml+='<div style="font-size:9px;color:var(--gr2);text-align:center;">'+chEntries[0][0]+' generates <span style="font-weight:700;color:var(--gr);">'+diff+'% more</span> revenue than '+chEntries[1][0]+'</div>';}
  }else{chHtml+='<div style="color:var(--gr3);font-size:11px;">No paid bookings for '+yr+'</div>';}
  document.getElementById('anChannel').innerHTML=chHtml+'</div>';

  // ── 5. Breed Distribution (dogs with bookings in this year only) ──
  const breedMap={};const _seenBreedDogs=new Set();
  fpBks.forEach(b=>{const k=b.customerId||b.dog;if(!k||_seenBreedDogs.has(k))return;_seenBreedDogs.add(k);const d=allDogs.find(x=>x.cid===b.customerId)||allDogs.find(x=>(x.name||'').toLowerCase()===(b.dog||'').toLowerCase());const br=((d&&d.breed||'').trim()||'Unknown');breedMap[br]=(breedMap[br]||0)+1;});
  const breedSorted=Object.entries(breedMap).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const maxBreed=breedSorted[0]?.[1]||1,totalDogs=_seenBreedDogs.size;
  document.getElementById('anBreed').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">'+(breedSorted.length?breedSorted.map(([b,v])=>'<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;margin-bottom:2px;"><span>'+b+'</span><span style="color:var(--sk);">'+v+' dog'+(v!==1?'s':'')+' ('+(v/totalDogs*100).toFixed(0)+'%)</span></div><div style="height:5px;background:var(--gr4);border-radius:3px;"><div style="height:5px;background:var(--sk);border-radius:3px;width:'+(v/maxBreed*100).toFixed(0)+'%;"></div></div></div>').join('')+'<div style="border-top:1px solid var(--gr4);margin-top:7px;padding-top:6px;font-size:9px;color:var(--gr2);">'+totalDogs+' booked dog'+(totalDogs!==1?'s':'')+(Object.keys(breedMap).length>12?' · top 12 shown':'')+'</div>':'<div style="color:var(--gr3);font-size:11px;">No booked dogs for '+yr+'</div>')+'</div>';

  // ── 6. Dog Age at Booking ──
  const dogBdays={};allDogs.forEach(d=>{if(d.birthday){const k=(d.cid||'')+'_'+(d.name||'').toLowerCase();dogBdays[k]=d.birthday;}});
  const ageBuckets={'Puppy (<1yr)':0,'1–2 yrs':0,'3–5 yrs':0,'6–9 yrs':0,'10+ yrs':0,'Unknown':0};
  const ageCols={'Puppy (<1yr)':'#F97316','1–2 yrs':'#EAB308','3–5 yrs':'#22C55E','6–9 yrs':'#0284C7','10+ yrs':'#8B5CF6','Unknown':'#A8A29E'};
  fpBks.forEach(b=>{const bday=dogBdays[(b.customerId||'')+'_'+(b.dog||'').toLowerCase()];if(!bday){ageBuckets['Unknown']++;return;}const ageYrs=(new Date((normDate(b.sd)||yr+'-01-01')+'T12:00:00Z')-new Date(normDate(bday)+'T12:00:00Z'))/(365.25*864e5);if(ageYrs<1)ageBuckets['Puppy (<1yr)']++;else if(ageYrs<3)ageBuckets['1–2 yrs']++;else if(ageYrs<6)ageBuckets['3–5 yrs']++;else if(ageYrs<10)ageBuckets['6–9 yrs']++;else ageBuckets['10+ yrs']++;});
  const maxAge=Math.max(...Object.values(ageBuckets),1);
  document.getElementById('anAge').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">'+['Puppy (<1yr)','1–2 yrs','3–5 yrs','6–9 yrs','10+ yrs','Unknown'].map(k=>{const v=ageBuckets[k];const col=ageCols[k];return'<div style="margin-bottom:7px;"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;margin-bottom:2px;"><span>'+k+'</span><span style="color:'+col+';">'+v+' booking'+(v!==1?'s':'')+'</span></div><div style="height:8px;background:var(--gr4);border-radius:3px;"><div style="height:8px;background:'+col+';border-radius:3px;width:'+(v/maxAge*100).toFixed(0)+'%;"></div></div></div>';}).join('')+'</div>';

  // ── 7. Repeat vs New Bookings (first-ever sd per dog = New, rest = Repeat) ──
  // First-ever booking per dog = New. Tie-break by row index (ri) so two bookings sharing the same sd
  // don't both count as New — exactly one booking per dog is the "first".
  const firstBk={};
  bookings.filter(b=>b.status==='Fully Paid'&&b.sd).forEach(b=>{const k=b.customerId||b.dog;if(!k)return;const nsd=normDate(b.sd)||'';const cur=firstBk[k];if(!cur||nsd<cur.sd||(nsd===cur.sd&&(b.ri||0)<cur.ri))firstBk[k]={sd:nsd,ri:b.ri||0};});
  let newBks=0,repBks=0,newRev=0,repRev=0;
  fpBks.forEach(b=>{const k=b.customerId||b.dog;if(!k)return;const nsd=normDate(b.sd)||'';const rev=revY(b);const f=firstBk[k];if(f&&f.sd===nsd&&f.ri===(b.ri||0)){newBks++;newRev+=rev;}else{repBks++;repRev+=rev;}});
  const totalRN=newBks+repBks;
  const newPct=totalRN>0?Math.round(newBks/totalRN*100):0,repPct=totalRN>0?Math.round(repBks/totalRN*100):0;
  document.getElementById('anRepeat').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><div style="background:var(--gr5);border-radius:var(--r);padding:10px;text-align:center;border-top:3px solid var(--gn);"><div style="font-size:11px;font-weight:700;color:var(--gr);margin-bottom:4px;">🆕 New</div><div style="font-size:24px;font-weight:800;color:var(--gn);">'+newBks+'</div><div style="font-size:10px;font-weight:700;color:var(--gn);">'+newPct+'% of bookings</div><div style="font-size:9px;color:var(--or);font-weight:700;margin-top:4px;">'+fmtGBP(newRev)+'</div></div><div style="background:var(--gr5);border-radius:var(--r);padding:10px;text-align:center;border-top:3px solid var(--bl);"><div style="font-size:11px;font-weight:700;color:var(--gr);margin-bottom:4px;">🔄 Repeat</div><div style="font-size:24px;font-weight:800;color:var(--bl);">'+repBks+'</div><div style="font-size:10px;font-weight:700;color:var(--bl);">'+repPct+'% of bookings</div><div style="font-size:9px;color:var(--or);font-weight:700;margin-top:4px;">'+fmtGBP(repRev)+'</div></div></div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;"><div style="width:'+newPct+'%;background:var(--gn);"></div><div style="flex:1;background:var(--bl);"></div></div><div style="display:flex;justify-content:space-between;font-size:8px;color:var(--gr3);margin-top:3px;"><span>New</span><span>Repeat</span></div></div>';

  // ── 8. Average Stay Length — fixed order ──
  const stays=bookings.filter(b=>b.sd&&b.ed&&normDate(b.ed).startsWith(yr)&&b.status==='Fully Paid'&&(b.svc||'').toLowerCase().includes('boarding')).map(b=>{const d1=new Date(normDate(b.sd)+'T12:00:00Z');const d2=new Date(normDate(b.ed)+'T12:00:00Z');return Math.round((d2-d1)/864e5);}).filter(n=>n>0);
  let stayHtml='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">';
  if(stays.length){
    const avg=(stays.reduce((s,v)=>s+v,0)/stays.length).toFixed(1);
    const distrib={'1 night':0,'2–3 nights':0,'4–7 nights':0,'1–2 weeks':0,'2+ weeks':0};
    stays.forEach(n=>{if(n===1)distrib['1 night']++;else if(n<=3)distrib['2–3 nights']++;else if(n<=7)distrib['4–7 nights']++;else if(n<=14)distrib['1–2 weeks']++;else distrib['2+ weeks']++;});
    const maxD=Math.max(...Object.values(distrib),1);
    stayHtml+='<div style="display:flex;gap:10px;margin-bottom:10px;"><div style="flex:1;text-align:center;"><div style="font-size:24px;font-weight:800;color:var(--or);">'+avg+'</div><div style="font-size:9px;color:var(--gr2);">Avg nights</div></div><div style="flex:1;text-align:center;"><div style="font-size:24px;font-weight:800;color:var(--bl);">'+Math.max(...stays)+'</div><div style="font-size:9px;color:var(--gr2);">Longest</div></div><div style="flex:1;text-align:center;"><div style="font-size:24px;font-weight:800;color:var(--gn);">'+Math.min(...stays)+'</div><div style="font-size:9px;color:var(--gr2);">Shortest</div></div></div><div style="border-top:1px solid var(--gr4);padding-top:8px;">'+Object.keys(distrib).map(k=>'<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;"><div style="font-size:9px;color:var(--gr2);width:64px;flex-shrink:0;">'+k+'</div><div style="flex:1;height:10px;background:var(--gr4);border-radius:3px;"><div style="height:10px;background:var(--or);border-radius:3px;width:'+(distrib[k]/maxD*100).toFixed(0)+'%;"></div></div><div style="font-size:9px;font-weight:700;min-width:16px;text-align:right;">'+distrib[k]+'</div></div>').join('')+'</div>';
  }else{stayHtml+='<div style="color:var(--gr3);font-size:11px;">No boarding stays found for '+yr+'</div>';}
  document.getElementById('anAvgStay').innerHTML=stayHtml+'</div>';

  // ── 9. Occupancy Rate by Day (+ yearly total) ──
  const boardingDays={};MOS.forEach(m=>boardingDays[m]=new Set());
  bookings.filter(b=>b.sd&&b.ed&&active.includes(b.status)&&(b.svc||'').toLowerCase().includes('boarding')).forEach(b=>{let d=new Date(normDate(b.sd)+'T12:00:00Z');const end=new Date(normDate(b.ed)+'T12:00:00Z');while(d<=end){const ds=d.toISOString().slice(0,10);if(ds.startsWith(yr)){const mo=new Date(ds+'T12:00:00Z').toLocaleString('en-GB',{month:'short'});if(boardingDays[mo])boardingDays[mo].add(ds);}d=new Date(d.getTime()+864e5);}});
  const totalOccDays=MOS.reduce((s,m)=>s+boardingDays[m].size,0);
  const yrOccPct=Math.round(totalOccDays/daysInYr*100);
  const yrOccCol=yrOccPct>=80?'var(--gn)':yrOccPct>=50?'var(--or)':'var(--gr3)';
  document.getElementById('anOccupancy').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">'+MOS.map((m,i)=>{const dim=new Date(yrN,i+1,0).getDate();const occ=boardingDays[m].size;const pct=Math.round(occ/dim*100);const col=pct>=80?'var(--gn)':pct>=50?'var(--or)':'var(--gr3)';return'<div style="text-align:center;background:var(--gr5);border-radius:var(--r);padding:7px 4px;"><div style="font-size:17px;font-weight:800;color:'+col+';">'+pct+'%</div><div style="font-size:8px;color:var(--gr2);">'+m+'</div><div style="font-size:7px;color:var(--gr3);">'+occ+'/'+dim+'d</div></div>';}).join('')+'</div><div style="border-top:1px solid var(--gr4);padding-top:8px;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:10px;color:var(--gr2);font-weight:600;">'+yr+' Total</span><span style="font-size:16px;font-weight:800;color:'+yrOccCol+';">'+yrOccPct+'%</span><span style="font-size:9px;color:var(--gr3);">'+totalOccDays+'/'+daysInYr+' days</span></div></div>';

  // ── 10. Occupancy Rate by Places (max 4 dogs/day, Boarding + DayCare) + yearly total ──
  const placesMo={};MOS.forEach(m=>placesMo[m]=0);
  bookings.filter(b=>b.sd&&b.ed&&active.includes(b.status)).forEach(b=>{
    const svcL=(b.svc||'').toLowerCase();const isB=svcL.includes('boarding');const isDC=svcL.includes('daycare')||svcL.includes('day care');
    if(!isB&&!isDC)return;
    const nsd=normDate(b.sd);const ned=normDate(b.ed);if(!nsd||!ned)return;
    if(isB){let d=new Date(nsd+'T12:00:00Z');const end=new Date(ned+'T12:00:00Z');while(d<=end){const ds=d.toISOString().slice(0,10);if(ds.startsWith(yr)){const mo=new Date(ds+'T12:00:00Z').toLocaleString('en-GB',{month:'short'});if(placesMo[mo]!==undefined)placesMo[mo]++;}d=new Date(d.getTime()+864e5);}}
    else{let d=new Date(nsd+'T12:00:00Z');const end=new Date(ned+'T12:00:00Z');while(d<=end){const ds=d.toISOString().slice(0,10);if(ds.startsWith(yr)){const mo=new Date(ds+'T12:00:00Z').toLocaleString('en-GB',{month:'short'});if(placesMo[mo]!==undefined)placesMo[mo]++;}d=new Date(d.getTime()+864e5);}}
  });
  const totalPlacesUsed=MOS.reduce((s,m)=>s+placesMo[m],0);const totalCapYr=4*daysInYr;const yrPlacesPct=Math.round(totalPlacesUsed/totalCapYr*100);
  const yrPlacesCol=yrPlacesPct>=80?'var(--gn)':yrPlacesPct>=50?'var(--or)':'var(--gr3)';
  document.getElementById('anOccPlaces').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">'+MOS.map((m,i)=>{const dim=new Date(yrN,i+1,0).getDate();const cap=4*dim;const occ=placesMo[m];const pct=Math.round(occ/cap*100);const col=pct>=80?'var(--gn)':pct>=50?'var(--or)':'var(--gr3)';return'<div style="text-align:center;background:var(--gr5);border-radius:var(--r);padding:7px 4px;"><div style="font-size:17px;font-weight:800;color:'+col+';">'+pct+'%</div><div style="font-size:8px;color:var(--gr2);">'+m+'</div><div style="font-size:7px;color:var(--gr3);">'+occ+'/'+cap+'</div></div>';}).join('')+'</div><div style="border-top:1px solid var(--gr4);padding-top:8px;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><span style="font-size:10px;color:var(--gr2);font-weight:600;">'+yr+' Total</span><span style="font-size:16px;font-weight:800;color:'+yrPlacesCol+';">'+yrPlacesPct+'%</span><span style="font-size:9px;color:var(--gr3);">'+totalPlacesUsed+'/'+totalCapYr+' places</span></div><div style="font-size:8px;color:var(--gr3);text-align:center;">Capacity: 4 dogs × days in month · Boarding days present + Day Care visits</div></div>';

  // ── 11. Customer LTV — Top 10, with next booking date. Own year selector (All Time default). ──
  const ltvYr=document.getElementById('ltvYear')?.value||'all';const ltvAll=(ltvYr==='all');
  const _ll=document.getElementById('ltvYearLbl');if(_ll)_ll.textContent=ltvAll?'All time':ltvYr;
  const ltvMap={};
  bookings.filter(b=>active.includes(b.status)&&(ltvAll||bkMonthFractions(b).some(s=>s.y===ltvYr))).forEach(b=>{const k=b.customerId||b.dog;if(!k)return;if(!ltvMap[k])ltvMap[k]={dog:b.dog,cid:b.customerId,count:0,total:0,lastDate:''};ltvMap[k].count++;const inYrRev=ltvAll?actualRev(b):actualRev(b)*bkMonthFractions(b).filter(s=>s.y===ltvYr).reduce((a,s)=>a+s.frac,0);ltvMap[k].total+=inYrRev;const ned=normDate(b.ed)||'';const nsd=normDate(b.sd)||'';if(nsd&&nsd<=today&&ned>ltvMap[k].lastDate)ltvMap[k].lastDate=ned;});// 'last' = most recent booking that has already started (never a future one)
  const nextBk={};
  bookings.filter(b=>b.sd&&normDate(b.sd)>today&&active.includes(b.status)).forEach(b=>{const k=b.customerId||b.dog;if(!k)return;const nsd=normDate(b.sd)||'';if(!nextBk[k]||nsd<nextBk[k])nextBk[k]=nsd;});
  const top10=Object.values(ltvMap).sort((a,b)=>b.total-a.total).slice(0,10);
  const maxLtv=top10[0]?.total||1;
  document.getElementById('anLTV').innerHTML='<div style="background:var(--wh);border:1px solid var(--gr4);border-radius:var(--r);padding:11px;">'+(top10.length?top10.map((c,i)=>{const pct=c.total/maxLtv*100;const nxt=nextBk[c.cid||c.dog];return'<div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;margin-bottom:2px;"><span>'+(i+1)+'. '+c.dog+(c.cid&&c.cid!==c.dog?' <span style="font-weight:400;color:var(--gr3);font-size:9px;">'+c.cid+'</span>':'')+'</span><span style="color:var(--or);">'+fmtGBP(c.total)+'</span></div><div style="height:5px;background:var(--gr4);border-radius:3px;margin-bottom:3px;"><div style="height:5px;background:var(--or);border-radius:3px;width:'+pct+'%;"></div></div><div style="display:flex;gap:10px;font-size:8px;color:var(--gr3);"><span>'+c.count+' booking'+(c.count!==1?'s':'')+'</span>'+(c.lastDate?'<span>last: '+c.lastDate+'</span>':'')+(nxt?'<span style="color:var(--gn);font-weight:700;">next: '+nxt+'</span>':'')+'</div></div>';}).join(''):'<div style="color:var(--gr3);font-size:11px;">No paid bookings found</div>')+'</div>';
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
    const curMonth=todayStr().slice(0,7);
    const hasThisMonth=trainRecords.some(r=>r.date&&r.date.startsWith(curMonth));
    localStorage.setItem('tcl_train_month',curMonth+':'+(hasThisMonth?'1':'0'));
    updatePendingBadge();
    list.innerHTML=trainRecords.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>{
      const rd=JSON.stringify([r.date,r.staff,r.cat,r.obj,r.prov,r.learnt,r.cpd,r.link]).replace(/'/g,"\\'");
      return '<div class="hi"><div class="hi-h"><span class="hi-d">'+r.date+'</span><span style="font-size:9px;font-weight:700;color:var(--gr);">'+r.staff+'</span>'+(r.cat?'<span class="htype hti">'+r.cat+'</span>':'')+'<button class="ebtn" style="margin-left:auto;" onclick="editTrainingRow('+r.ri+','+rd+')">Edit</button></div>'+(r.obj?'<div class="hsum">'+r.obj+'</div>':'')+(r.cpd?'<div style="font-size:8px;color:var(--gn);margin-top:2px;">CPD: '+r.cpd+' pts</div>':'')+(r.link?'<div style="font-size:8px;margin-top:2px;"><a href="'+r.link+'" target="_blank" style="color:var(--bl);">Link</a></div>':'')+'</div>';
    }).join('')||'<div class="hload">No records</div>';
  }catch(e){list.innerHTML='<div class="hload" style="color:var(--rd)">'+e.message+'</div>';}
}
function exportTraining(){const recs=trainRecords.length?trainRecords:[{date:'',staff:'No records - tap Load first',cat:'',obj:'',prov:'',learnt:'',cpd:'',cert:''}];const rows=[['THE CUDDLY LANE - Staff Training Log'],['AWLA Licence: AWLA/124654'],[''],['Date','Staff Member','Category','Development Objective','Course Provider','What I Learnt','CPD Points','Certificate Link'],...recs.map(r=>[r.date,r.staff,r.cat,r.obj,r.prov,r.learnt,r.cpd,r.cert])];const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='TCL-Training-'+todayStr()+'.csv';a.click();}

// ==================== MESSAGE TEMPLATES ====================
function saveMsgTpls(){localStorage.setItem('tcl_msg_tpls',JSON.stringify(msgTpls));}
function setTplCat(cat){_tplCat=cat;document.querySelectorAll('.tpl-cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));const pw=document.getElementById('paySettingsWrap');if(pw)pw.style.display=(cat==='Payment')?'block':'none';renderTplHub();}
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
  // Delete from the Google Sheet FIRST. If that fails we must NOT remove it locally, otherwise the next
  // sync (which replaces local with the sheet) would resurrect it. Only splice locally once the sheet is clear.
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D');
    // clear EVERY matching row (handles duplicate names accumulated by the old bug), bottom-up
    const matches=rows.map((r,i)=>r[0]===tpl.name?i+2:-1).filter(n=>n>0).sort((a,b)=>b-a);
    for(const ri of matches)await clearRow(TABS.TPLS,ri);
  }catch(e){
    alert('Could not delete from Google Sheet (check connection): '+e.message+'\nThe template was NOT deleted — please try again.');
    return;
  }
  msgTpls.splice(idx,1);saveMsgTpls();renderTplHub();
}
// Render the fill-in field for one template variable. `otherDogs`/`dogList` get a dog multi-select picker
// that outputs formatted lines like "🐾 3 y/o spayed female Schnauzer"; everything else gets a text input.
function tplFieldHtml(v,idx,varLabels){
  const lbl='<label style="font-size:10px;color:var(--gr2);font-weight:600;display:block;margin-bottom:3px;">'+(varLabels[v]||v)+'</label>';
  if(v==='otherDogs'||v==='dogList'){
    const opts=[...allDogs].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(d=>'<label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 2px;cursor:pointer;"><input type="checkbox" class="otherDogChk" value="'+encodeURIComponent(d.cid)+'" onchange="updateCopyPreview('+idx+')" style="width:14px;height:14px;flex-shrink:0;">'+(d.name||'(no name)')+' <span style="color:var(--gr3);font-size:9px;">'+fmtDogDesc(d).replace('🐾 ','')+'</span></label>').join('');
    return '<div style="margin-bottom:7px;">'+lbl+'<input class="fi" placeholder="Search dogs..." oninput="filterOtherDogs(this.value)" style="font-size:11px;margin-bottom:5px;"><div id="otherDogPick" style="max-height:170px;overflow-y:auto;border:1px solid var(--gr4);border-radius:8px;padding:6px;">'+(opts||'<div style="font-size:10px;color:var(--gr3);">No dogs registered</div>')+'</div></div>';
  }
  return '<div style="margin-bottom:7px;">'+lbl+'<input class="fi" id="ctplv_'+v+'" placeholder="Enter '+(varLabels[v]||v)+'..." style="font-size:11px;" oninput="updateCopyPreview('+idx+')"></div>';
}
function filterOtherDogs(q){q=(q||'').toLowerCase();document.querySelectorAll('#otherDogPick label').forEach(l=>{l.style.display=l.textContent.toLowerCase().includes(q)?'':'none';});}
function openCopyTpl(idx){
  const tpl=msgTpls[idx];if(!tpl)return;
  const content=tpl.content||'';
  const vars=[...new Set((content.match(/\{\{(\w+)\}\}/g)||[]).map(m=>m.slice(2,-2)))];
  document.getElementById('ctpl_title').textContent=tpl.name;
  document.getElementById('ctpl_idx').value=idx;
  const fEl=document.getElementById('ctpl_fields');
  const varLabels={ownerName:'Owner name',dogs:'Dog name(s)',dropoff:'Drop-off date',pickup:'Pick-up date',dropoffTime:'Drop-off time',pickupTime:'Pick-up time',service:'Service',total:'Total amount',prepayAmt:'Prepayment amount',finalAmt:'Balance due',payRef:'Payment reference',payLink:'Payment link',rateBlock:'Rate block',discount:'Discount line',otherDogs:'Other dogs (pick from profiles)',dogList:'Dog list (pick from profiles)'};
  if(vars.length){
    fEl.innerHTML=vars.map(v=>tplFieldHtml(v,idx,varLabels)).join('');
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
  vars.forEach(v=>{
    let val;
    if(v==='otherDogs'||v==='dogList'){
      const cids=[...document.querySelectorAll('.otherDogChk:checked')].map(c=>decodeURIComponent(c.value));
      const list=cids.map(cid=>fmtDogDesc(allDogs.find(d=>d.cid===cid))).filter(Boolean).join('\n');
      val=list||'{{'+v+'}}';
    }else{const el=document.getElementById('ctplv_'+v);val=el&&el.value?el.value:'{{'+v+'}}';}
    msg=msg.replace(new RegExp('\\{\\{'+v+'\\}\\}','g'),val);
  });
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
  let oldName='',key='';
  if(idx2!==''){const prev=msgTpls[parseInt(idx2)];oldName=prev.name;key=prev.key||'';msgTpls[parseInt(idx2)]={...prev,_prev:{name:prev.name,content:prev.content,cat:prev.cat||''},name,content,cat};}
  else{msgTpls.push({name,content,cat,key:''});}
  saveMsgTpls();st.textContent='Saving...';st.className='smsg';
  try{
    const rows=await readSheet(TABS.TPLS,'A2:D').catch(()=>[]);
    const lookupName=oldName||name;
    const existIdx=rows.findIndex(r=>r[0]===lookupName);
    if(existIdx>=0){await updateRow(TABS.TPLS,existIdx+2,[name,cat,content,new Date().toISOString(),key]);}
    else{await appendRow(TABS.TPLS,[name,cat,content,new Date().toISOString(),key]);}
    st.textContent='Saved & synced!';st.className='smsg ok';
  }catch(e){st.textContent='Saved locally (sheet: '+e.message+')';st.className='smsg err';}
  setTimeout(()=>{st.className='smsg';renderTplHub();document.getElementById('tplModal').classList.remove('open');},1800);
}
function redoTplHub(){const idx=document.getElementById('tpl_eidx').value;if(idx!==''){const t=msgTpls[parseInt(idx)];if(t._prev){document.getElementById('tpl_name').value=t._prev.name;document.getElementById('tpl_content').value=t._prev.content;document.getElementById('tpl_cat').value=t._prev.cat||'';alert('Reverted.');}else alert('No previous version.');}else alert('Save first.');}
async function syncTplsFromSheet(){
  const el=document.getElementById('tplHubList');el.innerHTML='<div class="hload">Syncing...</div>';
  try{
    const rows=await readSheet(TABS.TPLS,'A2:E');
    const sheetTpls=rows.map(r=>({name:r[0]||'',cat:r[1]||'',content:r[2]||'',_updated:r[3]||'',key:r[4]||''})).filter(t=>t.name);
    msgTpls=sheetTpls;saveMsgTpls();
    renderTplHub();renderPayFallbacks();
  }catch(e){el.innerHTML='<div class="hload" style="color:var(--rd)">'+e.message+'</div>';}
}

// ==================== ACTIVITIES ====================
function saveActivities(){localStorage.setItem('tcl_acts',JSON.stringify(activities));}
function loadActivities(){activities=JSON.parse(localStorage.getItem('tcl_acts')||'[]');}
// Activity filter state. loc/energy/cost = multi-select (OR within a facet, AND across facets); dur/travel = single-select max caps.
let _actF={loc:new Set(),energy:new Set(),cost:new Set(),dur:'',travel:''};
function toggleActChip(btn,single){
  const facet=btn.dataset.facet,val=btn.dataset.val;
  if(single){_actF[facet]=(_actF[facet]===val)?'':val;document.querySelectorAll('.af-chip[data-facet="'+facet+'"]').forEach(b=>b.classList.toggle('on',b.dataset.val===_actF[facet]));}
  else{const set=_actF[facet];if(set.has(val))set.delete(val);else set.add(val);btn.classList.toggle('on',set.has(val));}
  renderActs();
}
function clearActFilters(){_actF={loc:new Set(),energy:new Set(),cost:new Set(),dur:'',travel:''};document.querySelectorAll('.af-chip').forEach(b=>b.classList.remove('on'));renderActs();}
function getFilteredActs(){
  const f=_actF;const durCap={'30':30,'60':60,'120':120};const travCap={'15':15,'30':30,'60':60};
  return activities.filter(a=>{
    if(f.loc.size&&!f.loc.has(a.io))return false;// Location stored in a.io (Home/Garden/Indoor/Outdoor)
    if(f.energy.size){const e=(a.energy||'').replace(/\s*energy/i,'').trim();if(!f.energy.has(e))return false;}
    if(f.cost.size){const want=(parseFloat(a.cost)||0)>0?'Paid':'Free';if(!f.cost.has(want))return false;}
    if(f.dur){const d=parseFloat(a.dur)||0;if(f.dur==='over'){if(d<=120)return false;}else if(d>durCap[f.dur])return false;}
    if(f.travel){const t=parseFloat(a.dist)||0;if(f.travel==='over'){if(t<=60)return false;}else if(f.travel==='15'){if(t>=15)return false;}else if(t>travCap[f.travel])return false;}
    return true;
  });
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
  const mc=document.getElementById('actMatchCount');if(mc)mc.textContent=filtered.length+' / '+activities.length+' match';
  if(!activities.length){el.innerHTML='<div class="hload">No activities yet - tap + Add to build your library</div>';return;}
  if(!filtered.length){el.innerHTML='<div class="hload">No activities match these filters</div>';return;}
  const energyCls={'Low':'cat-low','Medium':'cat-med','High':'cat-high'};
  el.innerHTML=filtered.map(a=>{
    const idx=activities.indexOf(a);const lastLog=actLogs.filter(l=>l.activity===a.title).sort((x,y)=>y.date.localeCompare(x.date))[0];
    const lastStr=lastLog?fmtDate(lastLog.date)+' - '+lastLog.dogs:'Never done yet';
    const en=(a.energy||'').replace(/\s*energy/i,'').trim();
    return'<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:8px;">'+
      '<div class="act-item" style="flex:1;margin-bottom:0;" onclick="openActModal('+idx+')">'+
      '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">'+
      (a.io?'<span class="act-cat cat-'+((a.io==='Indoor'||a.io==='Home')?'in':'out')+'">'+a.io+'</span>':'')+
      (en?'<span class="act-cat '+(energyCls[en]||'cat-any')+'">'+en+' energy</span>':'')+
      '<span class="act-cat cat-any">'+((parseFloat(a.cost)||0)>0?fmtGBP(a.cost):'Free')+'</span>'+
      '</div>'+
      '<div class="act-title">'+a.title+'</div>'+
      '<div class="act-meta">'+
      (a.location?'<span class="act-m">'+a.location+'</span>':'')+
      (a.dur?'<span class="act-m">⏱️ '+a.dur+' mins</span>':'')+
      (a.dist!==undefined&&a.dist!==null&&a.dist!==''?'<span class="act-m">'+(parseInt(a.dist)>0?'🚗 '+a.dist+' mins drive':'🏠 At home')+'</span>':'')+
      (a.mapsUrl?'<a class="maps-btn" href="'+a.mapsUrl+'" target="_blank" onclick="event.stopPropagation()">Map</a>':'')+
      '<span class="act-last">'+lastStr+'</span>'+
      '</div>'+
      (a.notes?'<div style="font-size:9px;color:var(--gr3);margin-top:4px;">'+a.notes+'</div>':'')+
      '</div>'+
      '<button class="act-log-btn" title="Log this activity for dogs" onclick="event.stopPropagation();openActLog('+idx+')">+</button>'+
      '</div>';
  }).join('');
}
function showAllActs(){renderActs();}
// ---- Per-activity quick logger: pick ≥1 dog + date, append to Activity-Log (one row per dog) ----
let _actLogIdx=null;const _actLogDogs=new Set();
function openActLog(idx){
  _actLogIdx=idx;_actLogDogs.clear();const a=activities[idx];
  document.getElementById('alTitle').textContent='Log: '+(a?a.title:'Activity');
  document.getElementById('al_date').value=todayStr();
  document.getElementById('al_dog_search').value='';document.getElementById('al_dur').value=(a&&a.dur)?a.dur:'';document.getElementById('al_staff').value='';document.getElementById('al_notes').value='';
  const s=document.getElementById('alStatus');s.textContent='';s.className='smsg';
  renderAlDogs();document.getElementById('actLogModal').classList.add('open');
}
function renderAlDogs(){
  const q=(document.getElementById('al_dog_search').value||'').toLowerCase();const el=document.getElementById('al_dog_ms');if(!el)return;
  const list=allDogs.filter(d=>!q||d.name.toLowerCase().includes(q)||(d.breed||'').toLowerCase().includes(q)||d.cid.toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  el.innerHTML=list.length?list.map(d=>'<button class="af-chip'+(_actLogDogs.has(d.cid)?' on':'')+'" style="margin:2px;" onclick="toggleAlDog(\''+d.cid+'\',this)">'+(d.name||'')+'</button>').join(''):'<div style="font-size:9px;color:var(--gr3);padding:6px;">No dogs found</div>';
}
function toggleAlDog(cid,btn){if(_actLogDogs.has(cid))_actLogDogs.delete(cid);else _actLogDogs.add(cid);if(btn)btn.classList.toggle('on',_actLogDogs.has(cid));}
// Pre-select the dogs on-site today (boarding/day-care occupants) — staff can then edit before saving.
function fillOnSiteDogs(){
  const today=todayStr();
  bookings.forEach(b=>{if(!CAL_ACTIVE.includes(b.status))return;if(_svcKind(b)==='visit')return;const nsd=normDate(b.sd),ned=normDate(b.ed||b.sd);if(nsd&&nsd<=today&&today<=(ned||nsd)&&b.customerId)_actLogDogs.add(b.customerId);});
  renderAlDogs();
}
async function saveActLog(){
  if(_actLogIdx===null)return;const a=activities[_actLogIdx];const st=document.getElementById('alStatus');const btn=document.getElementById('alSaveBtn');
  if(!_actLogDogs.size){st.textContent='Pick at least one dog';st.className='smsg err';return;}
  const date=gv('al_date')||todayStr();const dur=gv('al_dur');const staff=gv('al_staff');const notes=gv('al_notes');
  btn.disabled=true;btn.textContent='Saving...';st.textContent='';st.className='smsg';
  const saves=[],names=[];
  _actLogDogs.forEach(cid=>{const d=allDogs.find(x=>x.cid===cid);const nm=d?d.name:cid;names.push(nm);
    saves.push(appendRow(TABS.ACTLOG,rowFromMap(actlogHdrRow,{CustomerID:cid,DogName:nm,Date:date,Activity:a.title,Staff:staff,Duration:dur,Notes:notes},TABS.ACTLOG.h)));});
  try{await Promise.all(saves);
    names.forEach(nm=>actLogs.push({date,activity:a.title,dogs:nm,staff,dur,notes}));histCache={};
    st.textContent='Logged for '+names.length+' dog'+(names.length>1?'s':'')+'!';st.className='smsg ok';
    setTimeout(()=>{document.getElementById('actLogModal').classList.remove('open');renderActs();},1000);
  }catch(e){st.textContent=e.message;st.className='smsg err';}finally{btn.disabled=false;btn.textContent='Save Log';}
}
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
  const en=(a.energy||'').replace(/\s*energy/i,'').trim();const meta=[a.io,en?en+' energy':'',a.dur?'⏱️ '+a.dur+' mins':'',distStr,(parseFloat(a.cost)||0)>0?fmtGBP(a.cost):'Free',a.location].filter(Boolean).join(' - ');
  w.innerHTML='<div class="surprise-card"><div style="font-size:8px;color:var(--hnl);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Today&#39;s Activity Pick</div><div class="surprise-title">'+a.title+'</div><div class="surprise-meta">'+meta+'</div>'+(a.notes?'<div style="font-size:10px;color:rgba(255,255,255,.6);margin-bottom:13px;">'+a.notes+'</div>':'')+(a.mapsUrl?'<a class="maps-btn" href="'+a.mapsUrl+'" target="_blank" style="margin-bottom:12px;display:inline-flex;">Map</a><br>':'')+'<button class="surprise-btn" onclick="surpriseAct()">Try another</button></div>';
  document.getElementById('actList').innerHTML='';
}
function openActModal(idx){
  document.getElementById('act_eidx').value=idx!==null?idx:'';document.getElementById('actMTitle').textContent=idx!==null?'Edit Activity':'New Activity';
  const a=idx!==null?activities[idx]:{};const ss=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  ss('act_title',a.title);ss('act_io',a.io);ss('act_energy',a.energy);ss('act_dur',a.dur);ss('act_dist',a.dist);ss('act_location',a.location);ss('act_maps',a.mapsUrl);ss('act_cost',a.cost);ss('act_notes',a.notes);
  document.getElementById('actModal').classList.add('open');
}
async function saveAct(){
  const title=document.getElementById('act_title').value.trim();if(!title){alert('Title required');return;}
  const idx2=document.getElementById('act_eidx').value;const st=document.getElementById('actStatus');
  const act={title,cat:'',io:gv('act_io'),energy:gv('act_energy'),weather:'',dur:gv('act_dur'),dist:gv('act_dist'),location:gv('act_location'),mapsUrl:gv('act_maps'),cost:gv('act_cost'),notes:gv('act_notes')};
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

// ==================== MANIFEST / PWA ====================
function registerSW(){if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}}

// ==================== INIT ====================
loadConfig();checkCreds();loadQSettings();initPin();
msgTpls=JSON.parse(localStorage.getItem('tcl_msg_tpls')||'[]');
loadActivities();
document.getElementById('boardDate').textContent='· '+new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
// Promote the footer version (tcl-vXX) into the header so staff can see which build they're on.
(function(){const fm=(document.getElementById('verFooter')?.textContent||'').match(/tcl-v[\w.]+/);const av=document.getElementById('appVer');if(fm&&av)av.textContent=fm[0].replace('tcl-','');})();
document.getElementById('backBtn').style.display='none';
document.getElementById('reg_eid').value='';document.getElementById('reg_ridx').value='';
document.getElementById('st_date').value=todayStr();
const bmDog=document.getElementById('bm_dog');if(bmDog)bmDog.addEventListener('change',updateDogIdHint);
registerSW();
renderSubTabs();
initPin();
