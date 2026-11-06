/* IELTS Writing checker (Task 1 & Task 2) — automatic, no AI.
   Gives an estimated band for each criterion and a feedback table (English + Arabic).
   The teacher's band is always the final one. */
(function(){
const STOP=new Set('a an the and or but so to of in on at for from by with about as into than then that this these those it its is are was were be been being am do does did have has had will would can could should may might must not no yes i you he she we they me him her us them my your his our their there here what which who whom whose when where why how all any some many much more most very also just only such too own same other another each every both either neither one two three first second if because while although though however therefore moreover furthermore'.split(' '));
const LINKERS=['however','moreover','furthermore','in addition','additionally','therefore','consequently','as a result','on the other hand','in contrast','whereas','while','although','even though','firstly','secondly','thirdly','finally','lastly','for example','for instance','such as','in conclusion','to conclude','to sum up','overall','nevertheless','nonetheless','similarly','likewise','in fact','thus','hence','meanwhile','besides','in other words','to begin with','on the contrary','as well as','not only','because of','due to'];
const COMPLEX=['because','although','though','even though','which','who','whose','whom','if','unless','when','whenever','while','whereas','since','so that','in order to','not only','until','before','after','as long as','despite','in spite of'];
const OPINION=/\b(in my (opinion|view)|i (strongly )?(believe|think|feel|agree|disagree)|from my (point of view|perspective)|personally|i am convinced|it is my view)\b/i;
const CONCL=/\b(in conclusion|to conclude|to sum up|in summary|to summari[sz]e|all in all|overall,)\b/i;
const OVERVIEW=/\b(overall|in general|generally|it is clear|it can be seen|it is evident|in summary|the most (striking|noticeable)|the main trend)\b/i;
const COMPARE=/\b(higher|lower|more|less|fewer|greater|smaller|larger|bigger|compared|in comparison|whereas|while|than|the highest|the lowest|the most|the least|rose|fell|increased|decreased|declined|grew|dropped|peaked|doubled|tripled)\b/gi;
const EXAMPLES=/\b(for example|for instance|such as|e\.g\.|a good example|to illustrate)\b/gi;
const INFORMAL=['gonna','wanna','kids','stuff','ok','okay','guys','cool','awesome','nowadays people','a lot of','lots of','thing','things','get','got','big','huge','really','super'];
const UNCOUNT={informations:'information',advices:'advice',knowledges:'knowledge',equipments:'equipment',furnitures:'furniture',homeworks:'homework',evidences:'evidence',luggages:'luggage',traffics:'traffic',researchs:'research',peoples:'people',childs:'children',womans:'women',mans:'men'};
const THIRD={have:'has',do:'does',go:'goes',make:'makes',take:'takes',want:'wants',need:'needs',think:'thinks',say:'says',get:'gets',give:'gives',use:'uses',help:'helps',like:'likes',know:'knows',see:'sees',come:'comes',become:'becomes',seem:'seems',cause:'causes',lead:'leads',allow:'allows',mean:'means',show:'shows',provide:'provides',affect:'affects',spend:'spends',live:'lives',work:'works',play:'plays',increase:'increases',reduce:'reduces'};
const BASE=Object.fromEntries(Object.entries(THIRD).map(([a,b])=>[b,a]));
const PAST_BASE={went:'go',saw:'see',came:'come',did:'do',made:'make',took:'take',had:'have',gave:'give',got:'get',bought:'buy',thought:'think',said:'say',found:'find',knew:'know',left:'leave',wrote:'write',ate:'eat'};
const COMPAR=['better','worse','bigger','smaller','easier','harder','cheaper','faster','higher','lower','larger','longer','shorter','richer','poorer','happier','healthier'];

let DICT=null,DICT_P=null;
function loadDict(url){if(DICT)return Promise.resolve(DICT);if(!DICT_P)DICT_P=fetch(url||'ielts-words.txt').then(r=>r.ok?r.text():'').then(t=>{DICT=new Set(t.split(/\r?\n/).map(w=>w.trim().toLowerCase()).filter(Boolean));return DICT}).catch(()=>{DICT=new Set();return DICT});return DICT_P}
function known(w){if(!DICT||!DICT.size)return true;w=w.toLowerCase().replace(/^'+|'+$/g,'');if(w.length<3||DICT.has(w))return true;
 const stems=[w.replace(/'s$/,''),w.replace(/s$/,''),w.replace(/es$/,''),w.replace(/ies$/,'y'),w.replace(/ed$/,''),w.replace(/ed$/,'e'),w.replace(/d$/,''),w.replace(/ing$/,''),w.replace(/ing$/,'e'),w.replace(/ly$/,''),w.replace(/ier$/,'y'),w.replace(/iest$/,'y'),w.replace(/ies$/,'y'),w.replace(/able$/,''),w.replace(/ation$/,'e'),w.replace(/ily$/,'y'),w.replace(/er$/,''),w.replace(/est$/,''),w.replace(/ment$/,''),w.replace(/ness$/,''),w.replace(/(.)\1ed$/,'$1'),w.replace(/(.)\1ing$/,'$1')];
 return stems.some(x=>x.length>2&&DICT.has(x))}
const SPECIAL={alot:'a lot',dont:"don't",doesnt:"doesn't",didnt:"didn't",cant:"can't",wont:"won't",isnt:"isn't",arent:"aren't",im:"I'm",ive:"I've",thats:"that's",theres:"there's",wasnt:"wasn't",couldnt:"couldn't",shouldnt:"shouldn't",wouldnt:"wouldn't",becuase:'because',beacuse:'because',untill:'until',goverment:'government',enviroment:'environment'};
function edits(w){const a='abcdefghijklmnopqrstuvwxyz',o=new Set();for(let i=0;i<=w.length;i++){for(const c of a){o.add(w.slice(0,i)+c+w.slice(i));if(i<w.length)o.add(w.slice(0,i)+c+w.slice(i+1))}if(i<w.length)o.add(w.slice(0,i)+w.slice(i+1));if(i<w.length-1)o.add(w.slice(0,i)+w[i+1]+w[i]+w.slice(i+2))}return o}
function best(w,list){const pre=x=>{let i=0;while(i<x.length&&i<w.length&&x[i]===w[i])i++;return i};return list.sort((x,y)=>pre(y)-pre(x)||Math.abs(x.length-w.length)-Math.abs(y.length-w.length)||x.length-y.length)[0]}
function suggest(w){w=w.toLowerCase();if(SPECIAL[w])return SPECIAL[w];if(!DICT||!DICT.size)return '';
 const e1=edits(w),c1=[...e1].filter(x=>DICT.has(x));if(c1.length)return best(w,c1);
 if(w.length>12)return '';const c2=new Set();for(const x of e1)for(const y of edits(x))if(DICT.has(y))c2.add(y);return c2.size?best(w,[...c2]):''}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const cnt=(t,re)=>(t.match(re)||[]).length;
function phraseCount(low,list){const out={};list.forEach(p=>{const re=new RegExp('\\b'+p.replace(/ /g,'\\s+')+'\\b','g');const n=(low.match(re)||[]).length;if(n)out[p]=n});return out}

function grammarFixes(text){
 const fixes=[],add=(w,r,why)=>{if(fixes.length<14&&!fixes.some(f=>f[0].toLowerCase()===w.toLowerCase()))fixes.push([w,r,why])};let m;
 const sv1=/\b(he|she|it|this|that|everyone|everybody|nobody|someone|technology|the government|society)\s+(have|do|go|make|take|want|need|think|say|get|give|use|help|like|know|see|come|become|seem|cause|lead|allow|mean|show|provide|affect|spend|live|work|play|increase|reduce)\b/gi;
 while((m=sv1.exec(text)))add(m[0],m[1]+' '+THIRD[m[2].toLowerCase()],'sv');
 const sv2=/\b(they|we|you|people|children|students|parents|many|governments|countries)\s+(has|does|goes|makes|takes|wants|needs|thinks|says|gets|gives|uses|helps|likes|knows|sees|comes|becomes|seems|causes|leads|allows|means|shows|provides|affects|spends|lives|works|plays|increases|reduces|is|was)\b/gi;
 while((m=sv2.exec(text))){const v=m[2].toLowerCase();add(m[0],m[1]+' '+(v==='is'?'are':v==='was'?'were':BASE[v]||v),'sv')}
 const sv3=/\bi\s+(is|are)\b/gi;while((m=sv3.exec(text)))add(m[0],'I am','sv');
 const mb=new RegExp('\\b(more|most)\\s+('+COMPAR.join('|')+'|best|worst)\\b','gi');while((m=mb.exec(text)))add(m[0],m[2],'comp');
 const an=/\ba\s+([aeiou][a-z]+)/gi;while((m=an.exec(text))){const w=m[1].toLowerCase();if(!/^(uni|use|usu|eu|one|once|ur)/.test(w))add(m[0],'an '+m[1],'art')}
 const a=/\ban\s+([b-df-hj-np-tv-z][a-z]+)/gi;while((m=a.exec(text))){const w=m[1].toLowerCase();if(!/^(hour|honest|honour|honor|heir)/.test(w))add(m[0],'a '+m[1],'art')}
 const unc=new RegExp('\\b('+Object.keys(UNCOUNT).join('|')+')\\b','gi');while((m=unc.exec(text)))add(m[0],UNCOUNT[m[1].toLowerCase()],'unc');
 const did=/\b(didn'?t|did not|doesn'?t|does not|don'?t|do not|can'?t|cannot|can|could|will|would|should|must|may|might)\s+(went|saw|came|did|made|took|had|gave|got|bought|thought|said|found|knew|left|wrote|ate)\b/gi;
 while((m=did.exec(text)))add(m[0],m[1]+' '+PAST_BASE[m[2].toLowerCase()],'base');
 const mto=/\b(must|can|should|could|will|would|might|may)\s+to\s+([a-z]+)/gi;while((m=mto.exec(text)))add(m[0],m[1]+' '+m[2],'modal');
 const ph=[[/\baccording to me\b/gi,'in my opinion'],[/\bin the other hand\b/gi,'on the other hand'],[/\bdiscuss about\b/gi,'discuss'],[/\bemphasi[sz]e on\b/gi,'emphasise'],[/\bcan able to\b/gi,'can'],[/\bdepend of\b/gi,'depend on'],[/\bmore and more\b/gi,'increasingly'],[/\bnowadays,? in these days\b/gi,'nowadays'],[/\bthe most of\b/gi,'most of'],[/\bevery days\b/gi,'every day'],[/\bspend (a lot of|much) times\b/gi,'spend $1 time']];
 ph.forEach(([re,r])=>{text.replace(re,(w,g1)=>{add(w,r.replace('$1',g1||''),'phr');return w})});
 return fixes}
function punctFixes(text){
 const fixes=[],add=(w,r)=>{if(fixes.length<10&&!fixes.some(f=>f[0]===w))fixes.push([w,r])};let m;
 const lower_i=/(^|\s)i(\s|'m|'ve|'ll|'d)/g;while((m=lower_i.exec(text)))add(('i'+m[2]).trim(),('I'+m[2]).trim());
 const start=/(?:^|[.!?]\s+)([a-z][a-z']*)/g;while((m=start.exec(text)))add(m[1],m[1][0].toUpperCase()+m[1].slice(1));
 const apos=/\b(dont|doesnt|didnt|cant|wont|isnt|arent|wasnt|werent|shouldnt|couldnt|wouldnt|im|ive|thats|theres|its a)\b/gi;
 const AP={dont:"don't",doesnt:"doesn't",didnt:"didn't",cant:"can't",wont:"won't",isnt:"isn't",arent:"aren't",wasnt:"wasn't",werent:"weren't",shouldnt:"shouldn't",couldnt:"couldn't",wouldnt:"wouldn't",im:"I'm",ive:"I've",thats:"that's",theres:"there's"};
 while((m=apos.exec(text))){const k=m[1].toLowerCase();if(AP[k])add(m[1],AP[k])}
 const sp=/\s+([,.;:!?])/g;while((m=sp.exec(text)))add(m[0].trim()==m[1]?' '+m[1]:m[0],m[1]);
 const nosp=/[,.;:](?=[A-Za-z])/g;while((m=nosp.exec(text))){const ctx=text.slice(Math.max(0,m.index-6),m.index+6);if(!/\d[.,]\d|e\.g|i\.e|\.\w{2,3}\b/.test(ctx))add(text.slice(m.index-3<0?0:m.index-3,m.index+4),text.slice(m.index-3<0?0:m.index-3,m.index+1)+' '+text.slice(m.index+1,m.index+4))}
 if(text.trim()&&!/[.!?]["')]?\s*$/.test(text.trim()))add('(end of essay)','add a full stop .');
 return fixes}

function analyse(text,task,prompt){
 task=task===1?1:2;text=String(text||'').replace(/\r/g,'');const low=text.toLowerCase();
 const words=text.match(/[A-Za-z][A-Za-z'’-]*/g)||[],wc=words.length,min=task===1?150:250;
 const sents=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>/[a-z]/i.test(s));const ns=Math.max(1,sents.length);
 const paras=text.split(/\n+/).map(p=>p.trim()).filter(p=>(p.match(/[A-Za-z]+/g)||[]).length>=5);const np=paras.length;
 const content=words.map(w=>w.toLowerCase().replace(/[’']s$/,'')).filter(w=>!STOP.has(w)&&w.length>2);
 const freq={};content.forEach(w=>freq[w]=(freq[w]||0)+1);
 const promptWords=[...new Set((String(prompt||'').toLowerCase().match(/[a-z]{5,}/g)||[]).filter(w=>!STOP.has(w)&&!/^(write|words|least|essay|question|answer|discuss|views|opinion|reasons|include|relevant|examples|knowledge|experience|summari[sz]e|information|selecting|reporting|features|comparisons|where|minutes|should|spend|about|following|topic)$/.test(w)))];
 const promptSet=new Set((String(prompt||'').match(/[A-Za-z]+/g)||[]).map(w=>w.toLowerCase()));
 const rows={tr:{good:[],bad:[]},cc:{good:[],bad:[]},lr:{good:[],bad:[]},gra:{good:[],bad:[]}};
 const G=(k,en,ar)=>rows[k].good.push([en,ar]),B=(k,en,ar,fx)=>rows[k].bad.push([en,ar,fx||[]]);
 if(wc<20){const z={tr:1,cc:1,lr:1,gra:1};B('tr','Your answer is too short to be marked. Write at least '+min+' words.','إجابتك قصيرة جدًا. اكتب '+min+' كلمة على الأقل.');return finish(task,wc,min,z,rows,np,ns)}

 // ---- Task Achievement / Task Response ----
 let tr=5;
 if(wc>=min){tr+=1;G('tr','Good length: '+wc+' words (minimum '+min+').','طول مناسب: '+wc+' كلمة (الحد الأدنى '+min+').')}
 else{tr-=wc<min*0.8?2:1;B('tr','Too short: '+wc+' words. You need at least '+min+' words — short answers lose marks.','قصيرة جدًا: '+wc+' كلمة. تحتاج إلى '+min+' كلمة على الأقل، والإجابة القصيرة تفقد درجات.')}
 if(promptWords.length>=3){const hit=promptWords.filter(w=>low.includes(w.slice(0,Math.max(5,w.length-2))));const r=hit.length/promptWords.length;
  if(r>=0.4){tr+=0.5;G('tr','You stayed on the topic of the question ('+hit.slice(0,5).join(', ')+').','التزمت بموضوع السؤال.')}
  else if(r<0.2){tr-=1;B('tr','Your essay does not clearly answer this question. Use the key ideas of the question: '+promptWords.slice(0,6).join(', ')+'.','مقالك لا يجيب عن السؤال بوضوح. استخدم الأفكار الرئيسية في السؤال.')}}
 if(task===2){
  if(OPINION.test(text)){tr+=1;G('tr','You give a clear position (your opinion).','عبّرت عن رأيك بوضوح.')}else{tr-=0.5;B('tr','Give your position clearly, e.g. “In my opinion, …” in the introduction and the conclusion.','وضّح رأيك، مثل: In my opinion في المقدمة والخاتمة.')}
  if(CONCL.test(text)){tr+=0.5;G('tr','You have a conclusion.','كتبت خاتمة.')}else B('tr','Add a conclusion that sums up your position (In conclusion, …).','أضف خاتمة تلخّص رأيك (In conclusion …).');
  const ex=cnt(text,EXAMPLES);if(ex>=2){tr+=0.5;G('tr','You support your ideas with examples.','دعمت أفكارك بالأمثلة.')}else B('tr','Support each main idea with a reason and an example (for example, for instance, such as).','ادعم كل فكرة بسبب ومثال (for example …).');
 }else{
  if(OVERVIEW.test(text)){tr+=1;G('tr','You include an overview of the main trends.','كتبت نظرة عامة على الاتجاهات الرئيسية.')}else{tr-=1;B('tr','Add an overview: “Overall, it is clear that …” — without it the band is limited to 5.','أضف نظرة عامة: Overall, it is clear that … بدونها لا تتجاوز الدرجة 5.')}
  const nums=cnt(text,/\d+(\.\d+)?\s?(%|percent|per cent|million|billion|thousand)?/gi);if(nums>=3){tr+=0.5;G('tr','You support the description with data ('+nums+' figures).','دعمت الوصف بالأرقام.')}else{tr-=0.5;B('tr','Use figures from the chart/table to support your points.','استخدم أرقامًا من الرسم أو الجدول لدعم أفكارك.')}
  if(cnt(text,COMPARE)>=3){tr+=0.5;G('tr','You compare the data and describe changes.','قارنت البيانات ووصفت التغيّرات.')}else B('tr','Make comparisons: higher than, whereas, the highest, rose, fell.','قارن بين البيانات: higher than, whereas, rose, fell.');
  if(OPINION.test(text)){tr-=0.5;B('tr','Do not give your opinion in Task 1 — only report the information.','لا تكتب رأيك في المهمة الأولى، صف المعلومات فقط.')}
 }
 // ---- Coherence & Cohesion ----
 let cc=5;const lk=phraseCount(low,LINKERS),nl=Object.keys(lk).length;
 if(nl>=6){cc+=1.5;G('cc','Good range of linking words ('+Object.keys(lk).slice(0,6).join(', ')+').','استخدمت أدوات ربط متنوعة.')}
 else if(nl>=4){cc+=1;G('cc','You use linking words ('+Object.keys(lk).join(', ')+').','استخدمت أدوات الربط.')}
 else{cc-=nl<=1?1:0;B('cc','Use more linking words: however, moreover, as a result, on the other hand, for example.','استخدم أدوات ربط أكثر: however, moreover, as a result …')}
 const over=Object.entries(lk).filter(([,n])=>n>=4);if(over.length){cc-=0.5;B('cc','You repeat “'+over[0][0]+'” '+over[0][1]+' times. Vary your linking words.','كرّرت “'+over[0][0]+'” '+over[0][1]+' مرات. نوّع أدوات الربط.')}
 const needP=task===2?4:3;
 if(np>=needP){cc+=1;G('cc','Clear paragraphs ('+np+').','فقرات واضحة ('+np+').')}
 else if(np<=1){cc-=1.5;B('cc','Your answer is one block of text. Use '+needP+' paragraphs'+(task===2?' (introduction, two body paragraphs, conclusion)':' (introduction, overview, details)')+'.','إجابتك فقرة واحدة. قسّمها إلى '+needP+' فقرات.')}
 else{cc-=0.5;B('cc','Use '+needP+' paragraphs'+(task===2?': introduction, two body paragraphs, conclusion.':': introduction, overview and two detail paragraphs.'),'استخدم '+needP+' فقرات.')}
 const asl=wc/ns;if(asl>35){cc-=0.5;B('cc','Some sentences are very long (about '+Math.round(asl)+' words). Split them into shorter sentences.','بعض الجمل طويلة جدًا. قسّمها إلى جمل أقصر.')}else if(asl<9){cc-=0.5;B('cc','Your sentences are very short. Join some ideas with because, which, although.','جملك قصيرة جدًا. اربط الأفكار بـ because و which و although.')}else{cc+=0.5;G('cc','Sentence length is easy to follow.','طول الجمل مناسب وسهل المتابعة.')}
 const ref=cnt(low,/\b(this|these|such|which|who|the former|the latter)\b/g);if(ref>=4){cc+=0.5;G('cc','You refer back to ideas (this, these, which) to connect sentences.','تربط الجمل بالإشارة إلى الأفكار السابقة (this, these, which).')}
 const andStart=sents.filter(s=>/^(and|but|so|because)\b/i.test(s)).length;if(andStart>=2)B('cc','Do not start sentences with And / But / So. Use However, Therefore, In addition.','لا تبدأ الجمل بـ And/But/So. استخدم However, Therefore.');
 // ---- Lexical Resource ----
 let lr=5;const uniq=new Set(content).size,ttr=content.length?uniq/content.length:0;
 if(ttr>=0.7){lr+=1;G('lr','Wide range of vocabulary — you rarely repeat words.','مفردات متنوعة، ونادرًا ما تكرر الكلمات.')}else if(ttr>=0.6){lr+=0.5;G('lr','Good variety of vocabulary.','تنوع جيد في المفردات.')}else if(ttr<0.45){lr-=1;B('lr','You repeat many words. Use synonyms and different word forms.','تكرر كلمات كثيرة. استخدم المرادفات وأشكالًا مختلفة للكلمة.')}
 const acad=content.filter(w=>w.length>=8&&!promptSet.has(w)&&known(w));const longW=[...new Set(acad)];const lwr=content.length?acad.length/content.length:0;
 if(lwr>=0.15){lr+=1;G('lr','Good less common / academic words: '+longW.slice(0,6).join(', ')+'.','كلمات أكاديمية جيدة: '+longW.slice(0,6).join(', ')+'.')}else if(lwr>=0.1){lr+=0.5;G('lr','Some academic words: '+longW.slice(0,5).join(', ')+'.','بعض الكلمات الأكاديمية: '+longW.slice(0,5).join(', ')+'.')}else B('lr','Use more topic and academic words (e.g. significant, consequently, contribute, essential).','استخدم كلمات أكاديمية أكثر (significant, essential …).');
 const rep=Object.entries(freq).filter(([w,n])=>n>=5&&!promptSet.has(w)&&!promptSet.has(w.replace(/s$/,''))&&!promptSet.has(w+'s')).sort((a,b)=>b[1]-a[1]);if(rep.length){lr-=0.5;B('lr','You use “'+rep[0][0]+'” '+rep[0][1]+' times. Try a synonym.','استخدمت “'+rep[0][0]+'” '+rep[0][1]+' مرات. جرّب مرادفًا.')}
 const inf=INFORMAL.filter(p=>new RegExp('\\b'+p+'\\b','i').test(text));if(inf.length>=2){lr-=0.5;B('lr','Avoid informal words in academic writing: '+inf.slice(0,4).join(', ')+'.','تجنّب الكلمات غير الرسمية: '+inf.slice(0,4).join(', ')+'.')}
 const miss=[];sents.forEach(s=>{(s.match(/[A-Za-z][A-Za-z'’]*/g)||[]).forEach((w,i)=>{const lw=w.toLowerCase().replace(/’/g,"'");if(i>0&&/^[A-Z]/.test(w))return;if(/^[A-Z]{2,}$/.test(w))return;if(SPECIAL[lw]){if(!/'/.test(SPECIAL[lw])&&!miss.some(x=>x[0].toLowerCase()===lw))miss.push([w,SPECIAL[lw]]);return}if(promptSet.has(lw)||miss.some(x=>x[0].toLowerCase()===lw))return;if(!known(lw)){const s2=suggest(lw);miss.push([w,s2||'?'])}})});
 const sr=wc?miss.length/wc:0;
 if(DICT&&DICT.size){if(!miss.length){lr+=1;G('lr','No spelling mistakes found.','لا توجد أخطاء إملائية.')}else if(sr<=0.01){lr+=0.5;B('lr','A few spelling mistakes — check these:','بعض الأخطاء الإملائية، راجع:',miss.slice(0,8))}else{lr-=sr>0.06?1.5:sr>0.03?1:0;B('lr','Spelling mistakes ('+miss.length+'). Check these words:','أخطاء إملائية ('+miss.length+'). راجع هذه الكلمات:',miss.slice(0,10))}}
 // ---- Grammatical Range & Accuracy ----
 let gra=5;const cx=phraseCount(low,COMPLEX),ncx=Object.keys(cx).length;
 if(ncx>=5){gra+=1;G('gra','Good range of complex sentences ('+Object.keys(cx).slice(0,6).join(', ')+').','تنوع جيد في الجمل المركبة.')}else if(ncx>=3){gra+=0.5;G('gra','Some complex sentences ('+Object.keys(cx).join(', ')+').','بعض الجمل المركبة.')}else{gra-=1;B('gra','Use more complex sentences: because, although, which, if, while.','استخدم جملًا مركبة أكثر: because, although, which, if.')}
 if(/\b(is|are|was|were|be|been|being)\s+([a-z]+ed|made|done|built|taken|given|seen|known|shown|grown|written)\b/i.test(text)){gra+=0.5;G('gra','You use the passive voice correctly in places.','استخدمت المبني للمجهول.')}
 if(/\b(if [^.]{3,60}(will|would|could|might))\b/i.test(text))G('gra','You use conditional sentences (if … will / would).','استخدمت جمل الشرط.');
 const gf=grammarFixes(text),pf=punctFixes(text);const er=(gf.length+pf.length*0.5)/ns;
 if(!gf.length){gra+=1;G('gra','No common grammar mistakes found.','لا توجد أخطاء نحوية شائعة.')}
 else{gra+=er<0.15?0.5:er<0.35?0:er<0.6?-1:-2;B('gra','Grammar to correct ('+gf.length+'):','أخطاء نحوية للتصحيح ('+gf.length+'):',gf.map(f=>[f[0],f[1]]))}
 if(pf.length)B('gra','Punctuation and capital letters:','علامات الترقيم والحروف الكبيرة:',pf.slice(0,8));else G('gra','Good punctuation and capital letters.','علامات ترقيم وحروف كبيرة صحيحة.');
 const bands={tr:Math.round(clamp(tr,1,8)),cc:Math.round(clamp(cc,1,8)),lr:Math.round(clamp(lr,1,8)),gra:Math.round(clamp(gra,1,8))};
 if(task===1&&!OVERVIEW.test(text))bands.tr=Math.min(bands.tr,5);
 if(wc<min*0.6){Object.keys(bands).forEach(k=>bands[k]=Math.min(bands[k],4))}
 return finish(task,wc,min,bands,rows,np,ns)}

const NAMES={tr:['Task Response','الاستجابة للمهمة'],ta:['Task Achievement','إنجاز المهمة'],cc:['Coherence & Cohesion','الترابط والتماسك'],lr:['Lexical Resource','الثروة اللغوية'],gra:['Grammatical Range & Accuracy','التنوع والدقة النحوية']};
const TIPS={tr:['Answer every part of the question and develop each idea with a reason and an example.','أجب عن كل أجزاء السؤال وطوّر كل فكرة بسبب ومثال.'],cc:['Plan 4 paragraphs and start each body paragraph with a clear topic sentence.','خطّط لأربع فقرات وابدأ كل فقرة بجملة رئيسية واضحة.'],lr:['Learn topic vocabulary and use synonyms instead of repeating words; check your spelling.','تعلّم مفردات الموضوع واستخدم المرادفات بدل التكرار، وراجع الإملاء.'],gra:['Mix simple and complex sentences and check verb forms (he goes / they go).','نوّع بين الجمل البسيطة والمركبة وراجع صيغ الأفعال.']};
function finish(task,wc,min,bands,rows,np,ns){
 const avg=(bands.tr+bands.cc+bands.lr+bands.gra)/4,overall=Math.round(avg*2)/2;
 const weak=Object.keys(bands).sort((a,b)=>bands[a]-bands[b])[0];
 return {v:1,task,wc,min,paras:np,sentences:ns,bands,overall,rows,next:[`To reach band ${Math.min(9,overall+0.5).toFixed(1)}: ${TIPS[weak][0]}`,`للوصول إلى ${Math.min(9,overall+0.5).toFixed(1)}: ${TIPS[weak][1]}`]}}

const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function html(r,opts){opts=opts||{};if(!r)return '';const crit=['tr','cc','lr','gra'];const nm=k=>k==='tr'&&r.task===1?NAMES.ta:NAMES[k];
 const pt=p=>`<div class="ic-pt">${e(p[0])}<div class="ic-ar" dir="rtl">${e(p[1])}</div>${(p[2]||[]).length?`<div class="ic-fx">${p[2].map(f=>`<span><s>${e(f[0])}</s> → <b>${e(f[1])}</b></span>`).join('')}</div>`:''}</div>`;
 return `<div class="ic-wrap"><div class="ic-head"><div class="ic-circle"><b>${r.overall.toFixed(1)}</b><small>${opts.final?'Band':'Estimated band'}</small></div>
 <div class="ic-chips">${crit.map(k=>`<div class="ic-chip"><span>${e(nm(k)[0])}<br><small dir="rtl">${e(nm(k)[1])}</small></span><b>${r.bands[k]}</b></div>`).join('')}</div></div>
 <p class="ic-note">${r.wc} words (minimum ${r.min}) · ${r.paras} paragraph${r.paras===1?'':'s'}${opts.final?'':' · <b>Computer check</b> — your teacher gives the final band. | تقدير آلي، والدرجة النهائية من المعلم.'}</p>
 <div class="ic-tw"><table class="ic-tbl"><tr><th></th><th>✅ Good points | نقاط القوة</th><th>👉 To improve | ما يجب تحسينه</th></tr>
 ${crit.map(k=>`<tr><td class="ic-k"><b>${e(nm(k)[0])}</b><br><span dir="rtl">${e(nm(k)[1])}</span><div class="ic-b">Band ${r.bands[k]}</div></td><td class="ic-g">${r.rows[k].good.map(pt).join('')||'—'}</td><td class="ic-i">${r.rows[k].bad.map(pt).join('')||'—'}</td></tr>`).join('')}</table></div>
 <div class="ic-next">🎯 ${e(r.next[0])}<div class="ic-ar" dir="rtl">${e(r.next[1])}</div></div></div>`}
const CSS=`.ic-wrap{border:1px solid #d9d3c3;border-radius:14px;padding:14px;background:#fff;margin:10px 0}.ic-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.ic-circle{width:110px;height:110px;border-radius:50%;border:7px solid #0f7b55;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:0 0 auto}.ic-circle b{font-size:30px;line-height:1}.ic-circle small{font-size:11px;color:#55606e;text-align:center}.ic-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;flex:1}.ic-chip{display:flex;justify-content:space-between;align-items:center;background:#f3f7f5;border:1px solid #cfe3da;border-radius:10px;padding:6px 10px;font-size:13px}.ic-chip b{font-size:20px;color:#0f7b55}.ic-note{font-size:13px;color:#55606e;margin:10px 0}.ic-tw{overflow-x:auto}.ic-tbl{width:100%;border-collapse:collapse;font-size:14px}.ic-tbl th{background:#1e3a8a;color:#fff;padding:8px;text-align:left}.ic-tbl td{border:1px solid #e3e7ef;padding:8px;vertical-align:top}.ic-k{background:#eef2fb;width:22%;color:#1e3a8a}.ic-b{margin-top:6px;font-weight:800;color:#0f7b55}.ic-g{background:#f3fbf6}.ic-i{background:#fff8ef}.ic-pt{margin:0 0 10px}.ic-ar{color:#55606e;font-size:13px;margin-top:2px}.ic-fx{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}.ic-fx span{background:#fff;border:1px solid #f0d9b5;border-radius:7px;padding:2px 7px;font-size:13px}.ic-fx s{color:#dc2626}.ic-fx b{color:#15803d}.ic-next{background:#eef7ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;margin-top:10px;font-weight:600}.ic-tbl td,.ic-tbl th{box-sizing:border-box}@media(max-width:640px){.ic-k{width:auto}.ic-tbl,.ic-tbl tbody,.ic-tbl tr,.ic-tbl td{display:block;width:100%}.ic-tbl tr:first-child{display:none}.ic-g::before{content:'✅ Good points | نقاط القوة';display:block;font-weight:800;color:#15803d;margin-bottom:6px}.ic-i::before{content:'👉 To improve | ما يجب تحسينه';display:block;font-weight:800;color:#b45309;margin-bottom:6px}.ic-wrap{padding:10px}}`;
try{const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st)}catch(_){}
window.IELTSCheck={analyse,html,loadDict,isReady:()=>!!(DICT&&DICT.size)};
})();
