const KEY='chinese-final-drill-v2',OLD_KEY='chinese-final-drill-v1',CFG='chinese-final-drill-sync';
const MODES=['ja-hanzi','audio-pinyin'];
const PLAN_REVISION='1day-2mode-weighted-20260720';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const day=()=>new Date().toISOString().slice(0,10);
function makePlan(){let start=new Date();start.setHours(0,0,0,0);let target=new Date(start);target.setHours(23,59,59,999);return{start:start.toISOString(),target:target.toISOString(),days:1,revision:PLAN_REVISION}}
const fresh=()=>({version:3,cards:{},streak:{last:'',count:0},plan:makePlan(),updatedAt:new Date().toISOString()});
let state=load(),lessons=new Set(['5','6','7','8','9','10','11']),queue=[],card,mode,done=0,pushTimer;

function upgradeCard(x){if(!x)return x;if(x.stability)return x;return{...x,state:x.interval>=1?'review':'learning',stability:Math.max(.01,x.interval||.01),difficulty:Math.max(1,Math.min(10,7-(x.ease||2.5))),successes:x.reps||0,successDays:x.reps?[day()]:[],history:[]}}
function weightedJaCard(oldJa,oldPinyin){let a=upgradeCard(oldJa&&structuredClone(oldJa)),b=upgradeCard(oldPinyin&&structuredClone(oldPinyin));if(!a&&!b)return null;let weighted=(name,fallback=0)=>(a?.[name]??fallback)*.25+(b?.[name]??fallback)*.75,successes=Math.floor(weighted('successes')),dates=[...new Set([...(a?.successDays||[]),...(b?.successDays||[])])].sort().slice(-Math.min(2,Math.max(1,successes))),history=[...(a?.history||[]),...(b?.history||[])].sort((x,y)=>new Date(x.at)-new Date(y.at)).slice(-30);return{...(a||{}),...(b||{}),stability:Math.max(.01,weighted('stability')),interval:Math.max(.01,weighted('interval')),difficulty:Math.max(1,Math.min(10,weighted('difficulty',10))),successes,reps:Math.floor(weighted('reps')),lapses:Math.round(weighted('lapses')),successDays:successes?dates:[],history,last:Math.max(a?.last||0,b?.last||0),due:new Date().toISOString(),state:successes?'learning':'relearning'}}
function inheritTwoModes(cards){for(let v of VOCAB){let audio=`${v.id}:audio-pinyin`,oldAudio=cards[`${v.id}:audio-hanzi`],ja=`${v.id}:ja-hanzi`,combined=weightedJaCard(cards[ja],cards[`${v.id}:hanzi-pinyin`]);if(oldAudio)cards[audio]=upgradeCard(structuredClone(oldAudio));if(combined)cards[ja]=combined}return cards}
function migrate(raw){if(!raw)return fresh();if(raw.version>=2){let resetPlan=raw.plan?.revision!==PLAN_REVISION,out={...fresh(),...raw,version:3,plan:resetPlan?makePlan():raw.plan,updatedAt:resetPlan?new Date().toISOString():raw.updatedAt,cards:{}};for(let [k,v] of Object.entries(raw.cards||{}))out.cards[k]=upgradeCard(v);if(resetPlan)out.cards=inheritTwoModes(out.cards);return out}let migrated=fresh();migrated.streak=raw.streak||migrated.streak;for(let [id,value] of Object.entries(raw.cards||{}))for(let m of MODES)migrated.cards[`${id}:${m}`]=upgradeCard({...value});return migrated}
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
function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));stats();if($('#dashboard')?.open)renderDashboard()}
function key(v,m){return `${v.id}:${m}`}
function progress(v,m){return state.cards[key(v,m)]}
function norm(x){return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s·・,，。.!！?？/／()（）〜～-]/g,'')}
const marks={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù',v:'ǖǘǚǜ','ü':'ǖǘǚǜ'};
function toneNumbers(s){return s.toLowerCase().replace(/u:/g,'v').split(/(\s+)/).map(x=>{let m=x.match(/^([a-züv]+)([1-5])$/);if(!m)return x;if(m[2]==='5')return m[1].replace('v','ü');let y=m[1],n=+m[2]-1,i=y.search(/[ae]/);if(i<0&&y.includes('ou'))i=y.indexOf('o');if(i<0){let vs=[...y.matchAll(/[aeiouvü]/g)];i=vs.length?vs[vs.length-1].index:-1}return i<0?y:y.slice(0,i)+(marks[y[i]]?.[n]||y[i])+y.slice(i+1)}).join('')}
function correct(input){return mode==='audio-pinyin'?norm(input)===norm(card.pinyin):norm(input)===norm(card.hanzi)}
function due(v,m){let x=progress(v,m);return !x?.due||new Date(x.due)<=new Date()}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function planDay(){let a=new Date(state.plan.start);a.setHours(0,0,0,0);let b=new Date();b.setHours(0,0,0,0);return Math.max(1,Math.min(state.plan.days,Math.floor((b-a)/86400000)+1))}
function wordMetrics(v){let cards=MODES.map(m=>progress(v,m)).filter(Boolean);return{cards,successes:cards.reduce((n,x)=>n+(x.successes||0),0),stability:cards.reduce((n,x)=>n+(x.stability||0),0)}}
function isMastered(v){let x=wordMetrics(v);return x.successes>=3&&x.stability>=.75}
function retention(x){if(!x?.last||!x.stability)return 0;return Math.exp(-((Date.now()-x.last)/86400000)/x.stability)}
function stats(){let all=VOCAB.flatMap(v=>MODES.map(m=>({v,m,x:progress(v,m)}))),dueN=all.filter(a=>a.x&&due(a.v,a.m)).length,mastered=VOCAB.filter(isMastered).length,unseen=VOCAB.filter(v=>!MODES.some(m=>progress(v,m))).length,pending=VOCAB.length-mastered;$('#dueCount').textContent=dueN;$('#masteredCount').textContent=mastered;$('#streakCount').textContent='残り1日';$('#progressBar').style.width=`${mastered/VOCAB.length*100}%`;$('#planTitle').textContent='本日完結プラン';$('#planDetail').textContent=`今日 ${new Date(state.plan.target).toLocaleDateString('ja-JP')}中・要学習 ${pending}語（未学習 ${unseen}語）・期限到来 ${dueN}技能・定着 ${mastered}/${VOCAB.length}語`}
function chips(){for(let n of lessons){let b=document.createElement('button');b.className='chip on';b.textContent=`第${n}課`;b.onclick=()=>{lessons.has(n)?lessons.delete(n):lessons.add(n);b.classList.toggle('on')};$('#lessonChips').append(b)}}
function start(){
  if(!lessons.size)return alert('課を1つ以上選んでください');
  let chosen=$('#mode').value,modes=chosen==='mixed'?MODES:[chosen],items=[];
  for(let v of VOCAB.filter(v=>lessons.has(v.lesson)))for(let m of modes)items.push({card:v,mode:m});
  let reviewItems=items.filter(x=>progress(x.card,x.mode)&&!isMastered(x.card)),newItems=items.filter(x=>!progress(x.card,x.mode)&&!isMastered(x.card));
  reviewItems.sort((a,b)=>(due(b.card,b.mode)-due(a.card,a.mode))||retention(progress(a.card,a.mode))-retention(progress(b.card,b.mode)));if($('#shuffle').checked){let dueItems=reviewItems.filter(x=>due(x.card,x.mode)),earlyItems=reviewItems.filter(x=>!due(x.card,x.mode));shuffle(dueItems);shuffle(earlyItems);shuffle(newItems);reviewItems=[...dueItems,...earlyItems]}
  queue=[...reviewItems,...newItems].slice(0,+$('#sessionSize').value);done=0;$('#home').hidden=true;$('#study').classList.add('active');next();
}
function next(){
  if(!queue.length){$('#study').innerHTML='<div class="prompt"><div><h2>今日の学習完了！</h2><p class="note">技能別の履歴を保存しました。</p><button class="primary" onclick="location.reload()">ホームへ</button></div></div>';return}
  let item=queue.shift();card=item.card;mode=item.mode;$('#qMeta').textContent=`第${card.lesson}課・${modeLabel(mode)}`;$('#qProgress').textContent=`${done+1}問目`;let prompt=$('#prompt');prompt.innerHTML='';if(mode==='audio-pinyin'){prompt.innerHTML='<button class="listen-btn" id="listenBtn" aria-label="もう一度聞く">🔊<small>タップして聞く</small></button>';setTimeout(()=>speak(card.hanzi),200)}else{let text=document.createElement('div');text.textContent=card.ja;let audio=document.createElement('button');audio.className='prompt-audio';audio.type='button';audio.textContent='🔊 発音を聞く';audio.setAttribute('aria-label',`${card.hanzi}の発音を聞く`);prompt.append(text,audio)}prompt.querySelector('button').onclick=()=>speak(card.hanzi);$('#answerInput').value='';$('#answerInput').placeholder=mode==='audio-pinyin'?'拼音（ni3 → nǐ）':'簡体字を入力';$('#hint').textContent=mode==='audio-pinyin'?'聞こえた拼音を入力。数字は声調記号へ自動変換します':'答え合わせ後に拼音も確認できます';$('#answerForm').hidden=false;$('#result').classList.remove('show');showIntervals();setTimeout(()=>$('#answerInput').focus(),50);
}
function modeLabel(m){return {'ja-hanzi':'日→簡体字','audio-pinyin':'音→拼音'}[m]}
let chineseVoice=null;
function selectChineseVoice(){
  let female=/xiaoxiao|xiaoyi|xiaohan|xiaomeng|xiaomo|xiaoqiu|xiaorui|xiaoshuang|huihui|yaoyao|hanhan|ting.?ting|meijia|yu.?shu|sin.?ji|female/i,natural=/natural|neural|premium|enhanced|online|google|microsoft|apple/i;
  let voices=speechSynthesis.getVoices().filter(v=>/^zh(-|_)/i.test(v.lang));
  chineseVoice=voices.sort((a,b)=>score(b)-score(a))[0]||null;
  function score(v){return(/^zh-CN$/i.test(v.lang)?40:0)+(female.test(v.name)?35:0)+(natural.test(v.name)?20:0)+(v.localService?4:0)}
  return chineseVoice;
}
function speak(text){if(!('speechSynthesis'in window))return alert('この端末は音声再生に対応していません');speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text);u.voice=chineseVoice||selectChineseVoice();u.lang=u.voice?.lang||'zh-CN';u.rate=.72;u.pitch=1.06;u.volume=1;speechSynthesis.speak(u)}
if('speechSynthesis'in window){selectChineseVoice();speechSynthesis.addEventListener?.('voiceschanged',selectChineseVoice)}
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
function level(v,m){let x=progress(v,m);if(isMastered(v))return'mastered';if(!x)return'new';if(x.state==='relearning'||x.stability<.25)return'hard';return'learning'}
function wordLevel(v){if(isMastered(v))return'mastered';let cards=MODES.map(m=>progress(v,m)).filter(Boolean);if(!cards.length)return'new';if(cards.some(x=>x.state==='relearning'||x.stability<.25))return'hard';return'learning'}
function setLevel(v,m,value){
  let k=key(v,m),now=Date.now();
  if(value==='new')delete state.cards[k];
  if(value==='hard')state.cards[k]={state:'relearning',stability:.01,difficulty:8,successes:0,successDays:[],reps:0,lapses:2,history:[],last:now,due:new Date(now).toISOString()};
  if(value==='learning')state.cards[k]={state:'review',stability:1,difficulty:5,successes:2,successDays:[day()],reps:2,lapses:0,history:[],last:now,due:new Date(now+86400000).toISOString()};
  if(value==='mastered')state.cards[k]={state:'review',stability:3,difficulty:3,successes:4,successDays:[new Date(now-86400000).toISOString().slice(0,10),day()],reps:4,lapses:0,history:[],last:now,due:new Date(Math.min(now+2*86400000,new Date(state.plan.target).getTime())).toISOString()};
  save();autoPush();renderWords();
}
function distribution(items){let out={new:0,hard:0,learning:0,mastered:0};for(let a of items)out[level(a.v,a.m)]++;return out}
function wordDistribution(words){let out={new:0,hard:0,learning:0,mastered:0};for(let v of words)out[wordLevel(v)]++;return out}
function stackedBar(d,total){return `<div class="bar"><i class="seg-new" style="width:${d.new/total*100}%"></i><i class="seg-hard" style="width:${d.hard/total*100}%"></i><i class="seg-learning" style="width:${d.learning/total*100}%"></i><i class="seg-mastered" style="width:${d.mastered/total*100}%"></i></div>`}
function renderDashboard(){
  let all=VOCAB.flatMap(v=>MODES.map(m=>({v,m,x:progress(v,m)}))),d=wordDistribution(VOCAB),total=VOCAB.length,mastery=Math.round(d.mastered/total*100),dueN=all.filter(a=>a.x&&due(a.v,a.m)).length,todayReviews=all.flatMap(a=>a.x?.history||[]).filter(h=>h.at?.slice(0,10)===day()).length,daysLeft=Math.max(1,state.plan.days-planDay()+1),perDay=Math.ceil((total-d.mastered)/daysLeft),target=Math.round(total*planDay()/state.plan.days),paceDelta=d.mastered-target;
  $('#dashFreshness').textContent=`学習履歴からリアルタイム集計・最終更新 ${new Date(state.updatedAt).toLocaleString('ja-JP')}`;
  $('#dashHero').innerHTML=`<div class="dash-kpi primary-kpi"><div class="donut" style="background:conic-gradient(#3d8061 ${mastery}%,#e5ded3 0)"><b>${mastery}%</b></div><div><strong>${d.mastered}</strong><span>定着単語 / ${total}</span></div></div><div class="dash-kpi"><strong>${dueN}</strong><span>今すぐ復習</span></div><div class="dash-kpi"><strong>${d.hard}</strong><span>苦手単語</span></div><div class="dash-kpi"><strong>${todayReviews}</strong><span>今日の回答数</span></div><div class="dash-kpi"><strong>${perDay}</strong><span>今日必要な残り語</span><small class="${paceDelta>=0?'pace-good':'pace-bad'}">計画比 ${paceDelta>=0?'+':''}${paceDelta}</small></div>`;
  $('#dashModes').innerHTML=MODES.map(m=>{let items=VOCAB.map(v=>({v,m})),x=distribution(items);return `<div class="mode-row"><b>${modeLabel(m)}</b>${stackedBar(x,items.length)}<span>${Math.round(x.mastered/items.length*100)}%</span></div>`}).join('');
  $('#dashLessons').innerHTML=['5','6','7','8','9','10','11'].map(lesson=>{let words=VOCAB.filter(v=>v.lesson===lesson),x=wordDistribution(words);return `<div class="lesson-row"><b>第${lesson}課</b>${stackedBar(x,words.length)}<span>${x.mastered}/${words.length}</span></div>`}).join('');
  let dates=[...Array(7)].map((_,i)=>{let x=new Date();x.setDate(x.getDate()-(6-i));return x.toISOString().slice(0,10)}),activity=dates.map(date=>all.flatMap(a=>a.x?.history||[]).filter(h=>h.at?.slice(0,10)===date).length),max=Math.max(1,...activity);$('#dashActivity').innerHTML=dates.map((date,i)=>`<div class="activity-day"><b>${activity[i]}</b><i style="height:${activity[i]/max*110}px"></i>${new Date(date+'T00:00:00').toLocaleDateString('ja-JP',{weekday:'short'})}</div>`).join('');
  let weak=VOCAB.filter(v=>!isMastered(v)).map(v=>{let risks=MODES.map(m=>{let x=progress(v,m);return{x,m,score:x?(x.difficulty||5)+(x.lapses||0)*2+(1-retention(x))*10:5}}),worst=risks.sort((a,b)=>b.score-a.score)[0];return{v,...worst}}).sort((a,b)=>b.score-a.score).slice(0,7);$('#dashWeak').innerHTML=weak.length?weak.map(a=>`<div class="weak-item"><div><b>${a.v.hanzi}</b>　${a.v.pinyin}<small>${a.v.ja}・${modeLabel(a.m)}</small></div><span class="risk">${a.x?`想起 ${Math.round(retention(a.x)*100)}%`:'未学習'}</span></div>`).join(''):'<p class="note">全単語が定着しています。</p>';
}
function openDashboard(){renderDashboard();$('#dashboard').showModal()}
function renderWords(){
  let q=norm($('#wordSearch').value),lesson=$('#wordLesson').value,rows=VOCAB.filter(v=>(!lesson||v.lesson===lesson)&&(!q||norm(v.hanzi+v.pinyin+v.ja).includes(q)));
  $('#wordSummary').textContent=`${rows.length}語 / 全${VOCAB.length}語　各技能は別々に管理`;
  let body=$('#wordRows');body.innerHTML='';
  for(let v of rows){let tr=document.createElement('tr');tr.innerHTML=`<td>${v.lesson}</td><td>${v.hanzi}<button class="speak-mini" aria-label="${v.hanzi}を聞く">🔊</button></td><td>${v.pinyin}<small>${v.ja}</small></td><td class="skill-cell"></td><td class="due-cell"></td>`;tr.querySelector('.speak-mini').onclick=()=>speak(v.hanzi);let skills=tr.querySelector('.skill-cell'),dues=[];for(let m of MODES){let wrap=document.createElement('label');wrap.className='mini-skill';wrap.textContent=modeLabel(m);let sel=document.createElement('select');for(let [value,text] of [['new','未学習'],['hard','苦手'],['learning','学習中'],['mastered','定着']])sel.add(new Option(text,value));sel.value=level(v,m);sel.onchange=()=>setLevel(v,m,sel.value);wrap.append(sel);skills.append(wrap);let x=progress(v,m);dues.push(`${modeLabel(m)}: ${x?.due?new Date(x.due).toLocaleDateString('ja-JP'): '—'}${x?` / 想起${Math.round(retention(x)*100)}% / 安定${Math.round(x.stability*10)/10}日`:''}`)}tr.querySelector('.due-cell').innerHTML=dues.join('<br>');body.append(tr)}
}
function openWords(){renderWords();$('#wordList').showModal()}
function openSync(){let c=JSON.parse(localStorage.getItem(CFG)||'{}');$('#token').value=c.token||'';$('#gistId').value=c.gistId||'';$('#settings').showModal()}
function mergeStates(local,remote){let merged={...local,version:3,plan:remote.plan?.revision===PLAN_REVISION?remote.plan:local.plan,cards:{},updatedAt:new Date().toISOString()};for(let k of new Set([...Object.keys(local.cards||{}),...Object.keys(remote.cards||{})])){let a=local.cards?.[k],b=remote.cards?.[k];if(!a){merged.cards[k]=b;continue}if(!b){merged.cards[k]=a;continue}let newest=(b.last||0)>(a.last||0)?b:a,history=[...(a.history||[]),...(b.history||[])].filter((x,i,all)=>all.findIndex(y=>y.at===x.at&&y.grade===x.grade)===i).sort((x,y)=>new Date(x.at)-new Date(y.at)).slice(-30);merged.cards[k]={...newest,successDays:[...new Set([...(a.successDays||[]),...(b.successDays||[])])],history}}merged.streak=(remote.streak?.last||'')>(local.streak?.last||'')?remote.streak:local.streak;return merged}
async function githubError(r){let message='';try{let j=await r.clone().json();message=j.message||''}catch{}let permission=r.headers.get('x-accepted-github-permissions'),remaining=r.headers.get('x-ratelimit-remaining'),parts=[`GitHub API ${r.status}`,message];if(permission)parts.push(`必要権限: ${permission}`);if(remaining==='0')parts.push('API残量0');if(r.status===403)parts.push('TokenのGists: writeとGist所有者を確認');return Error(parts.filter(Boolean).join(' / '))}
async function sync(kind){let c=JSON.parse(localStorage.getItem(CFG)||'{}'),token=($('#token').value||c.token||'').trim(),id=($('#gistId').value||c.gistId||'').trim();if(!token)throw Error('Tokenを入力してください');let h={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(kind==='push'){let body={description:'中国語期末対策ドリル 学習履歴',public:false,files:{'chinese-final-progress.json':{content:JSON.stringify(state,null,2)}}};let r=await fetch(id?`https://api.github.com/gists/${id}`:'https://api.github.com/gists',{method:id?'PATCH':'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw await githubError(r);let j=await r.json();$('#gistId').value=j.id;localStorage.setItem(CFG,JSON.stringify({token,gistId:j.id}));return'クラウドへ保存しました'}if(!id)throw Error('Gist IDを入力してください');let r=await fetch(`https://api.github.com/gists/${id}`,{headers:h});if(!r.ok)throw await githubError(r);let j=await r.json(),text=j.files['chinese-final-progress.json']?.content;if(!text)throw Error('履歴ファイルがありません');state=mergeStates(state,migrate(JSON.parse(text)));save();setTimeout(()=>sync('push').catch(()=>{}),0);return'クラウド履歴と端末履歴を統合しました'}
function autoPush(){let c=JSON.parse(localStorage.getItem(CFG)||'{}');if(!c.token||!c.gistId)return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>sync('push').catch(()=>{}),800)}
function importShareLink(){if(!location.hash.startsWith('#sync='))return false;try{let x=location.hash.slice(6).replace(/-/g,'+').replace(/_/g,'/'),c=JSON.parse(decodeURIComponent(escape(atob(x))));if(!c.token||!c.gistId)throw Error();localStorage.setItem(CFG,JSON.stringify(c));history.replaceState(null,'',location.pathname+location.search);return true}catch{return false}}
async function copyShareLink(){let c={token:$('#token').value,gistId:$('#gistId').value};if(!c.token||!c.gistId)throw Error('先に「今すぐ保存」を押してください');let x=btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await navigator.clipboard.writeText(`${location.origin}${location.pathname}#sync=${x}`);return'共有リンクをコピーしました。別端末で開いてください'}

$('#startBtn').onclick=start;$('#answerForm').onsubmit=check;$('#answerInput').oninput=e=>{if(mode!=='audio-pinyin')return;let end=e.target.selectionStart,old=e.target.value,converted=toneNumbers(old);e.target.value=converted;let shift=converted.length-old.length;e.target.setSelectionRange(end+shift,end+shift)};
$$('.grades button').forEach(b=>b.onclick=()=>grade(b.dataset.grade));$('#dashboardBtn').onclick=openDashboard;$('#closeDashboard').onclick=()=>$('#dashboard').close();$('#wordListBtn').onclick=openWords;$('#closeWordList').onclick=()=>$('#wordList').close();$('#wordSearch').oninput=renderWords;$('#wordLesson').onchange=renderWords;
document.addEventListener('keydown',e=>{if(e.repeat||!$('#result').classList.contains('show'))return;let g={'1':'again','2':'hard','3':'good','4':'easy'}[e.key];if(!g)return;e.preventDefault();grade(g)});
$('#settingsBtn').onclick=openSync;$('#closeSettings').onclick=()=>$('#settings').close();$('#saveSettings').onclick=()=>{$('#syncStatus').textContent='設定を保存しました';localStorage.setItem(CFG,JSON.stringify({token:$('#token').value.trim(),gistId:$('#gistId').value.trim()}))};
for(let [id,k] of [['pushBtn','push'],['pullBtn','pull']])$('#'+id).onclick=async()=>{let s=$('#syncStatus');s.textContent='通信中…';try{s.textContent=await sync(k)}catch(e){s.textContent=`エラー: ${e.message}`}};
$('#shareBtn').onclick=async()=>{try{$('#syncStatus').textContent=await copyShareLink()}catch(e){$('#syncStatus').textContent=`エラー: ${e.message}`}};
$('#exportBtn').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`chinese-progress-${day()}.json`;a.click();URL.revokeObjectURL(a.href)};
$('#importInput').onchange=async e=>{try{let j=JSON.parse(await e.target.files[0].text());if(!j.cards)throw Error('形式が違います');state=migrate(j);save();$('#syncStatus').textContent='読み込みました'}catch(x){$('#syncStatus').textContent=`エラー: ${x.message}`}};
chips();stats();let shared=importShareLink(),cfg=JSON.parse(localStorage.getItem(CFG)||'{}');if(shared)$('#mode').value='mixed';if(cfg.token&&cfg.gistId)sync('pull').then(()=>{if(shared)alert('最新版へ更新し、共有設定と学習履歴を読み込みました')}).catch(()=>{});
