'use strict';
const $=id=>document.getElementById(id),meta=JSON.parse($('study-meta').textContent),initial=JSON.parse($('initial-scope').textContent);
const fmt=(n,d=0)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d}),pct=(n,d=1)=>n==null?'—':(n*100).toFixed(d)+'%',escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requested={category:new URLSearchParams(location.search).get('category'),mode:new URLSearchParams(location.search).get('mode')};
const cache=new Map([[initial.key,initial]]);let state={},requestId=0;const selected={};
function key(category,mode){return mode+'_'+category.replace('.','-')}
function evidence(week,bin='all',extra={}){const p=new URLSearchParams({category:state.data.category,mode:state.data.mode,bin,...extra});return 'evidence/'+(week?week+'.html':'index.html')+'?'+p}
function imagesFor(data){const k=data.key,mode=data.mode;return {'volume-plot':`charts/${k}_volume.svg`,'short-plot':`charts/${k}_short${$('short-threshold').value}.svg`,'bins-plot':`charts/${k}_bins-${$('stack-measure').value}.svg`,'distribution-plot':`charts/${k}_distribution.svg`,'season-plot':`charts/${k}_season.svg`,'field-volume':`charts/${mode}_volumeGrowth.svg`,'field-short':`charts/${mode}_short_change_pp.svg`,'all-field-plot':`charts/${mode}_all-fields-${$('all-field-measure').value}.svg`}}
function decodeImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(url);image.onerror=()=>reject(new Error('A chart image could not be loaded.'));image.src=url;if(image.complete&&image.naturalWidth)resolve(url)})}
function commit(data){
 const all=data.weeks.map(row=>Object.fromEntries(data.columns.map((c,i)=>[c,row[i]]))),rows=all.filter(r=>!r.partial&&r.metadata_complete);
 state={data,all,rows,positions:new Map(all.map((r,i)=>[r.week,i]))};
 $('selection-title').textContent=data.title;$('category').value=data.category;$('counting').value=data.mode;
 const c=data.comparison,vol=c.volumeGrowth,short=c.short_change_pp;
 $('volume-metric').textContent=(vol>=0?'+':'')+pct(vol);$('volume-detail').textContent=fmt(c.baseline_per_week,1)+' → '+fmt(c.current_per_week,1)+' papers/week';
 $('short-metric').textContent=(short>=0?'+':'')+short.toFixed(1)+' pp';$('short-detail').textContent=pct(c.baseline_shortShare)+' → '+pct(c.current_shortShare)+' of measured PDFs';
 const n=rows.reduce((s,r)=>s+r.n,0),m=rows.reduce((s,r)=>s+r.measured,0);$('papers-metric').textContent=fmt(n);$('papers-detail').textContent=rows.length+' complete weeks · '+pct(m/n,3)+' PDF coverage';
 $('year-table').innerHTML=data.years.map(r=>`<tr><td>${r.year}</td><td>${fmt(r.papers_per_week,1)}</td><td>${fmt(r.short10_per_week,1)}</td><td>${pct(r.share)}</td><td>${pct(r.coverage,3)}</td></tr>`).join('');
 $('context-table').innerHTML=data.periods.map(r=>`<tr><td><a href="${evidence(null,'all',{from:r.from_week,to:r.to_week})}" target="_blank" rel="noopener">${escape(r.era)}</a></td><td>${r.weeks}</td><td>${fmt(r.papers_per_week,1)}</td><td>${pct(r.shortShare)}</td><td>${fmt(r.median)}</td></tr>`).join('');
 const comparisons=meta.comparisons.filter(r=>r.mode===data.mode&&r.category!=='all').sort((a,b)=>b.volumeGrowth-a.volumeGrowth);
 $('field-table').innerHTML=comparisons.map(r=>`<tr><td><button data-category="${r.category}">${escape(meta.categories[r.category])}</button></td><td>${fmt(r.baseline_per_week,1)}</td><td>${fmt(r.current_per_week,1)}</td><td>${r.volumeGrowth>=0?'+':''}${pct(r.volumeGrowth)}</td><td>${r.short_change_pp>=0?'+':''}${r.short_change_pp.toFixed(1)} pp</td></tr>`).join('');
 for(const [id,url] of Object.entries(imagesFor(data)))$(id).src=url;
 for(const id of ['volume','short','bins']){selected[id]=rows.length-1;updateVerify(id,rows.at(-1))}
 $('browse-evidence').href=evidence(null);$('distribution-link').href=evidence(null,$('distribution-bin').value,{from:state.rows[0].week,to:state.rows.at(-1).week});$('short-title').textContent='Papers with '+$('short-threshold').value+' pages or fewer';
 $('plot-period').textContent=rows[0].week+' to '+rows.at(-1).week+' · week starts in UTC';
 $('status').textContent='All charts ready. Hover to inspect a week; click to verify its papers.';$('charts').setAttribute('aria-busy','false');
 const p=new URLSearchParams(location.search);p.set('category',data.category);p.set('mode',data.mode);try{history.replaceState(null,'','?'+p+location.hash)}catch(error){if(error.name!=='SecurityError')throw error}
}
async function changeScope(){
 const id=++requestId,k=key($('category').value,$('counting').value);$('status').textContent='Preparing selected category…';$('charts').setAttribute('aria-busy','true');
 try{let data=cache.get(k);if(!data){data=await window.ArxivData.load(k);cache.set(k,data)}await Promise.all(Object.values(imagesFor(data)).map(decodeImage));if(id===requestId)commit(data)}
 catch(error){if(id!==requestId)return;$('status').textContent=error.message+' Current charts retain the previous selection.';$('category').value=state.data.category;$('counting').value=state.data.mode;$('charts').setAttribute('aria-busy','false')}
}
function updateVerify(type,row){const bin=type==='bins'?$('evidence-bin').value:type==='short'?'short'+$('short-threshold').value:'all';const a=$(type+'-verify');a.href=evidence(row.week,bin);a.textContent='Verify papers · week of '+row.week}
function trailing(row,k){const i=state.positions.get(row.week),rs=state.all.slice(Math.max(0,i-12),i+1);if(rs.length!==13||rs.some(r=>r.partial||!r.metadata_complete))return null;const den=k==='n'?13:rs.reduce((s,r)=>s+r.measured,0);return den?rs.reduce((s,r)=>s+r[k],0)/den:null}
function tooltip(type,row,x,y){
 const box=$('hoverbox');let lines=[];
 if(type==='volume')lines=[['Papers',fmt(row.n)],['13-week average',trailing(row,'n')==null?'Not yet available':fmt(trailing(row,'n'),1)],['Measured PDFs',fmt(row.measured)],['Unknown lengths',fmt(row.unknown)]];
 else if(type==='short'){const threshold=$('short-threshold').value,n=row['short'+threshold],pooled=trailing(row,'short'+threshold);lines=[['Papers ≤'+threshold+' pages',fmt(n)],['Weekly share',pct(row.measured?n/row.measured:null)],['13-week pooled share',pct(pooled)],['Measured PDFs',fmt(row.measured)]]}
 else lines=meta.bins.map((bin,i)=>[bin+' pages',fmt(row['b'+(i+1)])]);
 box.innerHTML='<strong>Week of '+row.week+' · UTC</strong>'+lines.map(([label,value])=>'<span>'+escape(label)+'<b>'+escape(value)+'</b></span>').join('')+'<em>Click the chart to verify these papers.</em>';box.hidden=false;
 const width=box.offsetWidth,height=box.offsetHeight;box.style.left=Math.max(8,Math.min(innerWidth-width-8,x+16))+'px';box.style.top=Math.max(8,Math.min(innerHeight-height-8,y+12))+'px';updateVerify(type,row);
}
let pending=null,frame=0;
function pointer(event){pending={element:event.currentTarget,x:event.clientX,y:event.clientY};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const {element,x,y}=pending,rect=element.getBoundingClientRect(),f=((x-rect.left)/rect.width*960-66)/874;if(f<0||f>1){$('hoverbox').hidden=true;return}const i=Math.round(f*(state.rows.length-1)),type=element.dataset.chart;selected[type]=i;tooltip(type,state.rows[i],x,y)})}
for(const image of document.querySelectorAll('[data-chart]')){
 image.addEventListener('pointermove',pointer);image.addEventListener('pointerleave',()=>{$('hoverbox').hidden=true});
 image.addEventListener('click',()=>{const type=image.dataset.chart;window.open(evidence(state.rows[selected[type]??0].week,type==='bins'?$('evidence-bin').value:type==='short'?'short'+$('short-threshold').value:'all'),'_blank','noopener')});
 image.addEventListener('keydown',event=>{const type=image.dataset.chart;let i=selected[type]??0;if(event.key==='ArrowLeft')i=Math.max(0,i-1);else if(event.key==='ArrowRight')i=Math.min(state.rows.length-1,i+1);else if(event.key==='Enter'){image.click();return}else if(event.key==='Escape'){$('hoverbox').hidden=true;return}else return;event.preventDefault();selected[type]=i;const r=image.getBoundingClientRect();tooltip(type,state.rows[i],r.left+r.width/2,r.top+30)});
}
$('category').addEventListener('change',changeScope);$('counting').addEventListener('change',changeScope);
$('field-table').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){$('category').value=button.dataset.category;changeScope();$('weekly').scrollIntoView({behavior:'smooth'})}});
$('short-threshold').addEventListener('change',()=>{$('short-plot').src=imagesFor(state.data)['short-plot'];$('short-title').textContent='Papers with '+$('short-threshold').value+' pages or fewer';$('hoverbox').hidden=true;updateVerify('short',state.rows[selected.short??0])});
$('stack-measure').addEventListener('change',()=>{$('bins-plot').src=imagesFor(state.data)['bins-plot'];$('hoverbox').hidden=true});
$('all-field-measure').addEventListener('change',()=>{$('all-field-plot').src=imagesFor(state.data)['all-field-plot']});
$('distribution-bin').addEventListener('change',()=>{$('distribution-link').href=evidence(null,$('distribution-bin').value,{from:state.rows[0].week,to:state.rows.at(-1).week})});
$('evidence-bin').addEventListener('change',()=>updateVerify('bins',state.rows[selected.bins??0]));
$('season-plot').addEventListener('click',event=>{const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*960,y=(event.clientY-rect.top)/rect.height*482,c=Math.floor((x-59)/73),r=Math.floor((y-39)/39);if(c<0||c>11||r<0||r>10)return;const month=(2016+r)+'-'+String(c+1).padStart(2,'0');if(state.data.months.some(m=>m.month===month))window.open(evidence(null,'all',{month}),'_blank','noopener')});
commit(initial);const params=new URLSearchParams(location.search),category=params.get('category'),mode=params.get('mode');
// The original requested route is retained across the opening default commit.
if(requested.category||requested.mode){$('category').value=meta.categories[requested.category]||requested.category==='all'?requested.category:'all';$('counting').value=['primary','memberships'].includes(requested.mode)?requested.mode:'memberships';if($('category').value!==initial.category||$('counting').value!==initial.mode)changeScope()}

$('field-comparison').addEventListener('change',()=>{$('field-volume').hidden=$('field-comparison').value!=='volume';$('field-short').hidden=$('field-comparison').value!=='short'});
