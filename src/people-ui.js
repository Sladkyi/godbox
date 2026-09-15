import { JOBS, TRAITS, REASONS, activityLabel, humanMood } from './humans.js';
import { icon } from './icons.js';
import { RACES, MATERIALS, STOCKS, RESOURCES, inventoryText, structureName } from './civilizations.js';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SKILLS={forage:'Forage',chop:'Wood',farm:'Farm',build:'Build',combat:'Combat',mine:'Mine',dig:'Clay',cultivate:'Fungi',fish:'Fish'};
const MEMORY={wood:'Gathered wood',build:'Finished a building',friend:'Spent time with someone close',family:'Started a family',birth:'Became a parent',loss:'Lost a partner',move:'Moved to a new town',defend:'Defended the people',hunt:'Fed on a hunt',steal:'Stole foreign stores',clash:'Clashed with a stranger',disaster:'Survived a disaster',scout:'Scouted a foreign town',siege:'Stormed a building',refuge:'Fled as a refugee',gift:'Saw a gift of the land'};
const head=title=>`<div class="panel-heading"><span>${title}</span><button class="icon-button" data-person-action="close" aria-label="Close details">${icon('close')}</button></div>`;
const link=u=>`<button class="person-link" data-citizen="${u.id}">${escape(u.name)}</button>`;

export class PeopleUI {
  constructor(panel,getWorld,renderer) { this.panel=panel;this.getWorld=getWorld;this.renderer=renderer;this.selected=null;this.mode=null;this.page=0;this.lastHTML=''; }
  openList() {this.mode='list';this.selected=null;this.renderer.selectedId=null;this.renderer.followId=null;this.renderer.inspectorOpen=true;this.page=0;this.panel.hidden=false;this.panel.scrollTop=0;this.update();}
  select(id) {if(this.renderer.followId)this.renderer.followId=id;this.selected=id;this.mode='person';this.panel.hidden=false;this.renderer.inspectorOpen=true;this.renderer.selectedId=id;this.panel.scrollTop=0;this.update();}
  close() {this.mode=null;this.lastHTML='';this.panel.hidden=true;this.renderer.selectedId=null;this.renderer.followId=null;this.renderer.inspectorOpen=false;}
  action(name) {
    if(name==='close')this.close();
    if(name==='list')this.openList();
    if(name==='next')this.page++;
    if(name==='previous')this.page=Math.max(0,this.page-1);
    if(name==='follow'){this.renderer.watch=false;this.renderer.followId=this.renderer.followId===this.selected?null:this.selected;if(this.renderer.followId&&this.renderer.zoom<2)this.renderer.changeZoom(2/this.renderer.zoom);}
    this.update();
  }
  update() {
    if(!this.mode||this.panel.hidden)return;
    const w=this.getWorld();let html='';
    if(this.mode==='list') {
      const humans=w.units.filter(u=>u.kind==='human'),size=12;this.page=Math.min(this.page,Math.max(0,Math.ceil(humans.length/size)-1));
      html=head(`PEOPLE · ${humans.length}`)+`<p class="people-intro">Each one has a job, a temperament, and a story. Choose a person to watch their choices.</p><div class="people-list">`;
      for(const u of humans.slice(this.page*size,(this.page+1)*size)) {
        const v=w.villages.find(v=>v.id===u.villageId);
        html+=`<button data-citizen="${u.id}" class="person-row"><span class="person-avatar" style="--person-color:${v?.color??'#c8d6b7'}">${icon(u.age<18?'heart':u.race)}</span><span><strong>${escape(u.name)} <small>${Math.floor(u.age)}</small></strong><em>${RACES[u.race].singular} · ${escape(activityLabel(u))}</em></span>${icon('chevron')}</button>`;
      }
      html+=`</div><div class="people-pages"><button data-person-action="previous" ${this.page===0?'disabled':''}>←</button><span>${this.page+1} / ${Math.max(1,Math.ceil(humans.length/size))}</span><button data-person-action="next" ${(this.page+1)*size>=humans.length?'disabled':''}>→</button></div>`;
      if(!humans.length)html+=`<p>Place people on land with the Humans tool.</p>`;
    } else {
      const u=w.units.find(u=>u.id===this.selected);
      if(!u){html=head('STORY ENDED')+'<p>This person no longer lives in the world.</p><button class="text-button full-width" data-person-action="list">Other people</button>';this.renderer.followId=null;}
      else if(u.kind==='human') {
        const v=w.villages.find(v=>v.id===u.villageId),partner=w.units.find(p=>p.id===u.partnerId),kids=w.units.filter(p=>p.kind==='human'&&p.parentIds.includes(u.id));
        const home=w.buildings.find(b=>b.id===u.homeId),parents=w.units.filter(p=>u.parentIds.includes(p.id));
        const mood=humanMood(u);
        html=head('A LIFE')+`<div class="person-title"><span class="person-avatar large" style="--person-color:${v?.color??'#c8d6b7'}">${icon(u.race)}</span><div><h3>${escape(u.name)} ${escape(u.surname)}</h3><span>${Math.floor(u.age)} years · ${u.age<18?(u.sex==='f'?'Girl':'Boy'):(u.sex==='f'?'Woman':'Man')}${v?.leaderId===u.id?' · Elder':''}</span></div></div><div class="person-tags"><b>${RACES[u.race].singular}</b><b>${JOBS[u.job]}</b>${u.traits.map(t=>`<span>${TRAITS[t]}</span>`).join('')}</div><div class="decision-card"><span class="eyebrow">NOW</span><strong>${escape(activityLabel(u))}</strong><p>${REASONS[u.reason]}</p>${u.path.length?'<small>Following a found path</small>':''}</div><div class="needs">`;
        for(const [label,value,color]of [['Health',u.hp,'#ddaca1'],['Fullness',100-u.hunger,'#d6cb8c'],['Energy',u.energy,'#a4cca7'],['Company',100-u.social,'#b8b4d9']])html+=`<div class="need"><label>${label}<b>${Math.round(value)}%</b></label><div><i style="width:${Math.round(value)}%;background:${color}"></i></div></div>`;
        html+=`</div><div class="person-facts"><p><span>Mood</span><b>${mood>70?'Content':mood>40?'Calm':'Needs help'}</b></p><p><span>Town</span><b>${escape(v?.name??'Wanderer')}</b></p><p><span>Home</span><b>${home?structureName(home):'None yet'}</b></p><p><span>Carrying</span><b>${inventoryText(u.inventory)}</b></p><p><span>Stores delivered</span><b>${Math.floor(u.delivered)}</b></p></div><div class="settlement-stock"><span class="eyebrow">TOWN STORES</span>${v?`<div>${STOCKS.map(k=>`<span style="--resource:${RESOURCES[k].color}">${RESOURCES[k].name}<b>${Math.floor(v[k])}</b></span>`).join('')}</div><p>New houses: <b>${MATERIALS[v.planMaterial]}</b></p>`:'No town founded yet'}</div><div class="person-family"><span class="eyebrow">FAMILY</span><p>${partner?`Partner: ${link(partner)}`:'No partner yet'}${u.pregnancy>0?' · Expecting a child':''}</p>${kids.length?`<p>Children: ${kids.map(link).join(', ')}</p>`:''}${parents.length?`<p>Parents: ${parents.map(link).join(', ')}</p>`:''}</div><div class="person-skills"><span class="eyebrow">SKILLS · GROW WITH PRACTICE</span><div>${Object.entries(SKILLS).map(([key,label])=>`<span>${label}<b>${u.skills[key].toFixed(1)}</b></span>`).join('')}</div></div>`;
        if(u.memories.length)html+=`<div class="person-history"><span class="eyebrow">PERSONAL HISTORY</span>${u.memories.slice(0,3).map(m=>`<p><span>Year ${m.year}</span>${MEMORY[m.type]}</p>`).join('')}</div>`;
        html+=`<div class="person-actions"><button class="text-button ${this.renderer.followId===u.id?'primary':''}" data-person-action="follow">${icon('inspect')}${this.renderer.followId===u.id?'Watching':'Follow'}</button><button class="text-button" data-person-action="list">All people</button></div>`;
      }
    }
    if(html!==this.lastHTML){const scroll=this.panel.scrollTop;this.panel.innerHTML=html;this.panel.scrollTop=scroll;this.lastHTML=html;}
  }
}
