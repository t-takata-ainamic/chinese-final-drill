const KEY='chinese-final-drill-v2',OLD_KEY='chinese-final-drill-v1',CFG='chinese-final-drill-sync';
const MODES=['ja-hanzi','hanzi-pinyin','hanzi-ja','audio-hanzi'];
const PLAN_REVISION='3day-20260718';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const day=()=>new Date().toISOString().slice(0,10);
function makePlan(){let start=new Date();start.setHours(0,0,0,0);let target=new Date(start);target.setDate(target.getDate()+2);target.setHours(23,59,59,999);return{start:start.toISOString(),target:target.toISOString(),days:3,revision:PLAN_REVISION}}
const fresh=()=>({version:3,cards:{},streak:{last:'',count:0},plan:makePlan(),updatedAt:new Date().toISOString()});
let state=load(),lessons=new Set(['5','6','7','8','9','10','11']),queue=[],card,mode,done=0,pushTimer;

function upgradeCard(x){if(!x)return x;if(x.stability)return x;return{...x,state:x.interval>=1?'review':'learning',stability:Math.max(.01,x.interval||.01),difficulty:Math.max(1,Math.min(10,7-(x.ease||2.5))),successes:x.reps||0,successDays:x.reps?[day()]:[],history:[]}}
function migrate(raw){if(!raw)return fresh();if(raw.version>=2){let resetPlan=raw.plan?.revision!==PLAN_REVISION,out={...fresh(),...raw,version:3,plan:resetPlan?makePlan():raw.plan,updatedAt:resetPlan?new Date().toISOString():raw.updatedAt,cards:{}};for(let [k,v] of Object.entries(raw.cards||{}))out.cards[k]=upgradeCard(v);return out}let migrated=fresh();migrated.streak=raw.streak||migrated.streak;for(let [id,value] of Object.entries(raw.cards||{}))for(let m of MODES)migrated.cards[`${id}:${m}`]=upgradeCard({...value});return migrated}
function load(){
  try{
    let current=localStorage.getItem(KEY);
    if(current){let migrated=migrate(JSON.parse(current));localStorage.setItem(KEY,JSON.stringify(migrated));return migrated}
    let old=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
    if(!old)return fresh();
    let migrated=migrate(old);
    localStorage.setItem(KEY,JSON.stringify(migrated));
    return migrated;
  }catch{return fresh()}
}
function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));stats()}
function key(v,m){return `${v.id}:${m}`}
function progress(v,m){return state.cards[key(v,m)]}
function norm(x){return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s·・,，。.!！?？/／()（）〜～-]/g,'')}
const marks={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù',v:'ǖǘǚǜ','ü':'ǖǘǚǜ'};
function toneNumbers(s){return s.toLowerCase().replace(/u:/g,'v').split(/(\s+)/).map(x=>{let m=x.match(/^([a-züv]+)([1-5])$/);if(!m)return x;if(m[2]==='5')return m[1].replace('v','ü');let y=m[1],n=+m[2]-1,i=y.search(/[ae]/);if(i<0&&y.includes('ou'))i=y.indexOf('o');if(i<0){let vs=[...y.matchAll(/[aeiouvü]/g)];i=vs.length?vs[vs.length-1].index:-1}return i<0?y:y.slice(0,i)+(marks[y[i]]?.[n]||y[i])+y.slice(i+1)}).join('')}
function correct(input){if(mode==='hanzi-pinyin')return norm(input)===norm(card.pinyin);if(mode==='ja-hanzi'||mode==='audio-hanzi')return norm(input)===norm(card.hanzi);return norm(input)===norm(card.ja)||card.ja.split(/[、,]/).some(x=>norm(input)===norm(x))}
function due(v,m){let x=progress(v,m);return !x?.due||new Date(x.due)<=new Date()}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function planDay(){let a=new Date(state.plan.start);a.setHours(0,0,0,0);let b=new Date();b.setHours(0,0,0,0);return Math.max(1,Math.min(state.plan.days,Math.floor((b-a)/86400000)+1))}
function isMastered(x){return !!x&&x.successes>=3&&new Set(x.successDays||[]).size>=2&&x.stability>=2}
function retention(x){if(!x?.last||!x.stability)return 0;return Math.exp(-((Date.now()-x.last)/86400000)/x.stability)}
function stats(){let all=VOCAB.flatMap(v=>MODES.map(m=>({v,m,x:progress(v,m)}))),dueN=all.filter(a=>a.x&&due(a.v,a.m)).length,mastered=all.filter(a=>isMastered(a.x)).length,unseen=all.filter(a=>!a.x).length,remaining=Math.max(1,state.plan.days+1-planDay()),quota=Math.ceil(unseen/remaining);$('#dueCount').textContent=dueN;$('#masteredCount').textContent=mastered;$('#streakCount').textContent=`${planDay()}/${state.plan.days}日`;$('#progressBar').style.width=`${mastered/all.length*100}%`;$('#planTitle').textContent=`${state.plan.days}日マスタープラン｜Day ${planDay()}`;$('#planDetail').textContent=`試験想定 ${new Date(state.plan.target).toLocaleDateString('ja-JP')}・未学習技能 ${unseen}・今日の新規目安 ${quota}（1技能あたり約${Math.ceil(quota/4)}）・定着 ${mastered}/${all.length}`}
function chips(){for(let n of lessons){let b=document.createElement('button');b.className='chip on';b.textContent=`第${n}課`;b.onclick=()=>{lessons.has(n)?lessons.delete(n):lessons.add(n);b.classList.toggle('on')};$('#lessonChips').append(b)}}
function start(){
  if(!lessons.size)return alert('課を1つ以上選んでください');
  let chosen=$('#mode').value,modes=chosen==='mixed'?MODES:[chosen],items=[];
  for(let v of VOCAB.filter(v=>lessons.has(v.lesson)))for(let m of modes)items.push({card:v,mode:m});
  let reviewItems=items.filter(x=>progress(x.card,x.mode)&&due(x.card,x.mode)),newItems=items.filter(x=>!progress(x.card,x.mode));
  reviewItems.sort((a,b)=>retention(progress(a.card,a.mode))-retention(progress(b.card,b.mode)));if($('#shuffle').checked){shuffle(reviewItems);shuffle(newItems)}
  queue=[...reviewItems,...newItems].slice(0,+$('#sessionSize').value);done=0;$('#home').hidden=true;$('#study').classList.add('active');next();
}
function next(){
  if(!queue.length){$('#study').innerHTML='<div class="prompt"><div><h2>今日の学習完了！</h2><p class="note">技能別の履歴を保存しました。</p><button class="primary" onclick="location.reload()">ホームへ</button></div></div>';return}
  let item=queue.shift();card=item.card;mode=item.mode;$('#qMeta').textContent=`第${card.lesson}課・${modeLabel(mode)}`;$('#qProgress').textContent=`${done+1}問目`;let prompt=$('#prompt');prompt.innerHTML='';if(mode==='audio-hanzi'){prompt.innerHTML='<button class="listen-btn" id="listenBtn" aria-label="もう一度聞く">🔊<small>タップして聞く</small></button>';setTimeout(()=>speak(card.hanzi),200)}else{let text=document.createElement('div');text.textContent=mode==='ja-hanzi'?card.ja:card.hanzi;let audio=document.createElement('button');audio.className='prompt-audio';audio.type='button';audio.textContent='🔊 発音を聞く';audio.setAttribute('aria-label',`${card.hanzi}の発音を聞く`);prompt.append(text,audio)}prompt.querySelector('button').onclick=()=>speak(card.hanzi);$('#answerInput').value='';$('#answerInput').placeholder=mode==='hanzi-pinyin'?'拼音（ni3 → nǐ）':mode==='hanzi-ja'?'日本語を入力':'簡体字を入力';$('#hint').textContent=mode==='hanzi-pinyin'?'数字を打つと声調記号へ自動変換します':mode==='audio-hanzi'?'何度でも音声を再生できます':'音声は何度でも再生できます';$('#answerForm').hidden=false;$('#result').classList.remove('show');showIntervals();setTimeout(()=>$('#answerInput').focus(),50);
}
function modeLabel(m){return {'ja-hanzi':'日→漢字','hanzi-pinyin':'漢字→拼音','hanzi-ja':'漢字→日','audio-hanzi':'音→漢字'}[m]}
function speak(text){if(!('speechSynthesis'in window))return alert('この端末は音声再生に対応していません');speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text),voices=speechSynthesis.getVoices();u.voice=voices.find(v=>/^zh(-|_)/i.test(v.lang))||null;u.lang='zh-CN';u.rate=.82;speechSynthesis.speak(u)}
function check(e){e.preventDefault();let input=$('#answerInput').value.trim();if(!input)return;let ok=correct(input);$('#judge').textContent=ok?'正解！':'答えを確認して自己評価してください';$('#judge').className=ok?'ok':'ng';$('#aHanzi').textContent=card.hanzi;$('#aPinyin').textContent=card.pinyin;$('#aJa').textContent=card.ja;$('#aYours').textContent=input;$('#answerForm').hidden=true;$('#result').classList.add('show')}
function scheduled(old,g,now=Date.now()){
  let x=upgradeCard(old?structuredClone(old):{stability:.01,difficulty:5,successes:0,successDays:[],history:[],reps:0,lapses:0}),r=old?retention(x):0,s=x.stability||.01,minutes;
  if(g==='again'){x.stability=Math.max(.007,s*.35);x.difficulty=Math.min(10,(x.difficulty||5)+.8);x.lapses=(x.lapses||0)+1;x.state='relearning';minutes=old?10:2}
  if(g==='hard'){x.stability=Math.max(.02,s*(1.15+(10-x.difficulty)*.02));x.difficulty=Math.min(10,(x.difficulty||5)+.3);x.successes=(x.successes||0)+1;x.state='learning';minutes=x.successes<=1?15:Math.max(30,x.stability*1440)}
  if(g==='good'){x.stability=old?s*(1.8+(1-r)*.7+(10-x.difficulty)*.03):.25;x.difficulty=Math.max(1,(x.difficulty||5)-.1);x.successes=(x.successes||0)+1;x.state=x.successes>=2?'review':'learning';minutes=x.successes<=1?360:Math.max(360,x.stability*1440)}
  if(g==='easy'){x.stability=old?s*(2.5+(1-r)+(10-x.difficulty)*.04):1;x.difficulty=Math.max(1,(x.difficulty||5)-.4);x.successes=(x.successes||0)+1;x.state='review';minutes=x.successes<=1?1440:Math.max(720,x.stability*1440)}
  if(g!=='again'){x.reps=(x.reps||0)+1;x.successDays=[...new Set([...(x.successDays||[]),day()])]}
  let untilTarget=(new Date(state.plan.target)-now)/60000;if(untilTarget>0)minutes=Math.min(minutes,Math.max(30,untilTarget-60));x.interval=minutes/1440;x.last=now;x.due=new Date(now+minutes*60000).toISOString();x.history=[...(x.history||[]),{at:new Date(now).toISOString(),grade:g,interval:x.interval}].slice(-30);return{x,minutes};
}
function formatInterval(m){if(m<60)return`${Math.round(m)}分`;if(m<1440)return`${Math.round(m/60)}時間`;return`${Math.round(m/1440*10)/10}日`}
function showIntervals(){let x=progress(card,mode);$$('.grades button').forEach(b=>b.querySelector('small').textContent=formatInterval(scheduled(x,b.dataset.grade).minutes))}
function grade(g){let now=Date.now(),k=key(card,mode),result=scheduled(state.cards[k],g,now);state.cards[k]=result.x;let t=day();if(state.streak.last!==t){let y=new Date(Date.now()-86400000).toISOString().slice(0,10);state.streak.count=state.streak.last===y?(state.streak.count||0)+1:1;state.streak.last=t}done++;save();autoPush();next()}
function level(v,m){let x=progress(v,m);if(!x)return'new';if(isMastered(x))return'mastered';if(x.state==='relearning'||x.stability<.25)return'hard';return'learning'}
function setLevel(v,m,value){
  let k=key(v,m),now=Date.now();
  if(value==='new')delete state.cards[k];
  if(value==='hard')state.cards[k]={state:'relearning',stability:.01,difficulty:8,successes:0,successDays:[],reps:0,lapses:2,history:[],last:now,due:new Date(now).toISOString()};
  if(value==='learning')state.cards[k]={state:'review',stability:1,difficulty:5,successes:2,successDays:[day()],reps:2,lapses:0,history:[],last:now,due:new Date(now+86400000).toISOString()};
  if(value==='mastered')state.cards[k]={state:'review',stability:3,difficulty:3,successes:4,successDays:[new Date(now-86400000).toISOString().slice(0,10),day()],reps:4,lapses:0,history:[],last:now,due:new Date(Math.min(now+2*86400000,new Date(state.plan.target).getTime())).toISOString()};
  save();autoPush();renderWords();
}
function renderWords(){
  let q=norm($('#wordSearch').value),lesson=$('#wordLesson').value,rows=VOCAB.filter(v=>(!lesson||v.lesson===lesson)&&(!q||norm(v.hanzi+v.pinyin+v.ja).includes(q)));
  $('#wordSummary').textContent=`${rows.length}語 / 全${VOCAB.length}語　各技能は別々に管理`;
  let body=$('#wordRows');body.innerHTML='';
  for(let v of rows){let tr=document.createElement('tr');tr.innerHTML=`<td>${v.lesson}</td><td>${v.hanzi}<button class="speak-mini" aria-label="${v.hanzi}を聞く">🔊</button></td><td>${v.pinyin}<small>${v.ja}</small></td><td class="skill-cell"></td><td class="due-cell"></td>`;tr.querySelector('.speak-mini').onclick=()=>speak(v.hanzi);let skills=tr.querySelector('.skill-cell'),dues=[];for(let m of MODES){let wrap=document.createElement('label');wrap.className='mini-skill';wrap.textContent=modeLabel(m);let sel=document.createElement('select');for(let [value,text] of [['new','未学習'],['hard','苦手'],['learning','学習中'],['mastered','定着']])sel.add(new Option(text,value));sel.value=level(v,m);sel.onchange=()=>setLevel(v,m,sel.value);wrap.append(sel);skills.append(wrap);let x=progress(v,m);dues.push(`${modeLabel(m)}: ${x?.due?new Date(x.due).toLocaleDateString('ja-JP'): '—'}${x?` / 想起${Math.round(retention(x)*100)}% / 安定${Math.round(x.stability*10)/10}日`:''}`)}tr.querySelector('.due-cell').innerHTML=dues.join('<br>');body.append(tr)}
}
function openWords(){renderWords();$('#wordList').showModal()}
function openSync(){let c=JSON.parse(localStorage.getItem(CFG)||'{}');$('#token').value=c.token||'';$('#gistId').value=c.gistId||'';$('#settings').showModal()}
function mergeStates(local,remote){let merged={...local,version:3,plan:remote.plan?.revision===PLAN_REVISION?remote.plan:local.plan,cards:{},updatedAt:new Date().toISOString()};for(let k of new Set([...Object.keys(local.cards||{}),...Object.keys(remote.cards||{})])){let a=local.cards?.[k],b=remote.cards?.[k];if(!a){merged.cards[k]=b;continue}if(!b){merged.cards[k]=a;continue}let newest=(b.last||0)>(a.last||0)?b:a,history=[...(a.history||[]),...(b.history||[])].filter((x,i,all)=>all.findIndex(y=>y.at===x.at&&y.grade===x.grade)===i).sort((x,y)=>new Date(x.at)-new Date(y.at)).slice(-30);merged.cards[k]={...newest,successDays:[...new Set([...(a.successDays||[]),...(b.successDays||[])])],history}}merged.streak=(remote.streak?.last||'')>(local.streak?.last||'')?remote.streak:local.streak;return merged}
async function sync(kind){let c=JSON.parse(localStorage.getItem(CFG)||'{}'),token=$('#token').value||c.token,id=$('#gistId').value||c.gistId;if(!token)throw Error('Tokenを入力してください');let h={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(kind==='push'){let body={description:'中国語期末対策ドリル 学習履歴',public:false,files:{'chinese-final-progress.json':{content:JSON.stringify(state,null,2)}}};let r=await fetch(id?`https://api.github.com/gists/${id}`:'https://api.github.com/gists',{method:id?'PATCH':'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(`GitHub API ${r.status}`);let j=await r.json();$('#gistId').value=j.id;localStorage.setItem(CFG,JSON.stringify({token,gistId:j.id}));return'クラウドへ保存しました'}if(!id)throw Error('Gist IDを入力してください');let r=await fetch(`https://api.github.com/gists/${id}`,{headers:h});if(!r.ok)throw Error(`GitHub API ${r.status}`);let j=await r.json(),text=j.files['chinese-final-progress.json']?.content;if(!text)throw Error('履歴ファイルがありません');state=mergeStates(state,migrate(JSON.parse(text)));save();setTimeout(()=>sync('push').catch(()=>{}),0);return'クラウド履歴と端末履歴を統合しました'}
function autoPush(){let c=JSON.parse(localStorage.getItem(CFG)||'{}');if(!c.token||!c.gistId)return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>sync('push').catch(()=>{}),800)}
function importShareLink(){if(!location.hash.startsWith('#sync='))return false;try{let x=location.hash.slice(6).replace(/-/g,'+').replace(/_/g,'/'),c=JSON.parse(decodeURIComponent(escape(atob(x))));if(!c.token||!c.gistId)throw Error();localStorage.setItem(CFG,JSON.stringify(c));history.replaceState(null,'',location.pathname+location.search);return true}catch{return false}}
async function copyShareLink(){let c={token:$('#token').value,gistId:$('#gistId').value};if(!c.token||!c.gistId)throw Error('先に「今すぐ保存」を押してください');let x=btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await navigator.clipboard.writeText(`${location.origin}${location.pathname}#sync=${x}`);return'共有リンクをコピーしました。別端末で開いてください'}

$('#startBtn').onclick=start;$('#answerForm').onsubmit=check;$('#answerInput').oninput=e=>{if(mode!=='hanzi-pinyin')return;let end=e.target.selectionStart,old=e.target.value,converted=toneNumbers(old);e.target.value=converted;let shift=converted.length-old.length;e.target.setSelectionRange(end+shift,end+shift)};
$$('.grades button').forEach(b=>b.onclick=()=>grade(b.dataset.grade));$('#wordListBtn').onclick=openWords;$('#closeWordList').onclick=()=>$('#wordList').close();$('#wordSearch').oninput=renderWords;$('#wordLesson').onchange=renderWords;
document.addEventListener('keydown',e=>{if(e.repeat||!$('#result').classList.contains('show'))return;let g={'1':'again','2':'hard','3':'good','4':'easy'}[e.key];if(!g)return;e.preventDefault();grade(g)});
$('#settingsBtn').onclick=openSync;$('#closeSettings').onclick=()=>$('#settings').close();$('#saveSettings').onclick=()=>{$('#syncStatus').textContent='設定を保存しました';localStorage.setItem(CFG,JSON.stringify({token:$('#token').value,gistId:$('#gistId').value}))};
for(let [id,k] of [['pushBtn','push'],['pullBtn','pull']])$('#'+id).onclick=async()=>{let s=$('#syncStatus');s.textContent='通信中…';try{s.textContent=await sync(k)}catch(e){s.textContent=`エラー: ${e.message}`}};
$('#shareBtn').onclick=async()=>{try{$('#syncStatus').textContent=await copyShareLink()}catch(e){$('#syncStatus').textContent=`エラー: ${e.message}`}};
$('#exportBtn').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`chinese-progress-${day()}.json`;a.click();URL.revokeObjectURL(a.href)};
$('#importInput').onchange=async e=>{try{let j=JSON.parse(await e.target.files[0].text());if(!j.cards)throw Error('形式が違います');state=migrate(j);save();$('#syncStatus').textContent='読み込みました'}catch(x){$('#syncStatus').textContent=`エラー: ${x.message}`}};
chips();stats();let shared=importShareLink(),cfg=JSON.parse(localStorage.getItem(CFG)||'{}');if(shared)$('#mode').value='mixed';if(cfg.token&&cfg.gistId)sync('pull').then(()=>{if(shared)alert('最新版へ更新し、共有設定と学習履歴を読み込みました')}).catch(()=>{});
