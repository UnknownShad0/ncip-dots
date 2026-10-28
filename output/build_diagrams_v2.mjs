import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('output/dots-guide-diagrams');
fs.mkdirSync(out, { recursive: true });
const C = { navy:'#123f59', blue:'#1b6680', teal:'#087f8c', ink:'#213746', muted:'#5d7380', bg:'#f2f7f9', line:'#8aa6b2', green:'#e5f4ee', amber:'#fff2d7', red:'#a84450', rose:'#fae9eb', white:'#fff' };
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function box(x,y,w,h,lines,fill=C.white,tag='') {
  const text = lines.map((s,i)=>`<text x="${x+w/2}" y="${y+h/2+(i-(lines.length-1)/2)*27}" text-anchor="middle" dominant-baseline="middle" class="${i===0?'main':'sub'}">${esc(s)}</text>`).join('');
  const badge = tag ? `<rect x="${x+12}" y="${y+10}" width="${Math.min(w-24,tag.length*10+22)}" height="25" rx="12" fill="${C.blue}"/><text x="${x+23}" y="${y+28}" class="tag">${esc(tag)}</text>` : '';
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="17" fill="${fill}" stroke="${C.navy}" stroke-width="2.6"/>${badge}${text}</g>`;
}
function link(x1,y1,x2,y2,label='',color=C.teal) {
  return `<g><path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="${color}" stroke-width="4" marker-end="url(#arrow)"/>${label?`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-12}" class="edge" fill="${color}">${esc(label)}</text>`:''}</g>`;
}
function elbow(d,color=C.teal){ return `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" marker-end="url(#arrow)"/>`; }
function page(title,w,h,body,note='') {
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>*{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;background:${C.bg};overflow:hidden}svg{display:block;width:${w}px;height:${h}px}.title{font:700 27px Arial,sans-serif;fill:${C.navy}}.main{font:700 21px Arial,sans-serif;fill:${C.ink}}.sub{font:500 17px Arial,sans-serif;fill:${C.muted}}.edge{font:600 16px Arial,sans-serif;text-anchor:middle}.tag{font:700 13px Arial,sans-serif;fill:#fff}.note{font:500 16px Arial,sans-serif;fill:${C.muted}}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="${C.teal}"/></marker></defs><rect width="100%" height="100%" fill="${C.bg}"/><text x="${w/2}" y="39" text-anchor="middle" class="title">${esc(title)}</text>${body}${note?`<text x="${w/2}" y="${h-18}" text-anchor="middle" class="note">${esc(note)}</text>`:''}</svg></body></html>`;
}
const D={};
D.login=page('DOTS sign-in and access checks',1500,460,
  box(35,125,190,125,['Open DOTS','Sign-in page'])+link(225,187,260,187)+
  box(260,125,220,125,['Enter account','and password'])+link(480,187,515,187)+
  box(515,125,215,125,['Account checks','active • unlocked'])+link(730,187,765,187)+
  box(765,125,220,125,['Security checks','email / challenge'])+link(985,187,1020,187)+
  box(1020,125,220,125,['Role + office','access checks'])+link(1240,187,1275,187)+
  box(1275,125,190,125,['Allowed','workspace'],C.green)+
  elbow('M370 250 L370 323 L430 323',C.blue)+box(430,292,240,72,['Forgot password?','Email reset link'],C.amber)+
  elbow('M875 250 L875 323 L940 323',C.blue)+box(940,292,265,72,['Repeated failures','may trigger CAPTCHA'],C.amber),
  'Access to records and actions is checked again after sign-in.');
D.lifecycle=page('Document preparation and tracking',1500,470,
  box(35,135,200,130,['Prepare or intake','Write in DOTS','or upload a file'])+link(235,200,270,200)+
  box(270,135,205,130,['Ready file','or draft tracking','record'])+link(475,200,510,200)+
  box(510,135,220,130,['Register tracking','Assign number','Stamp eligible PDF'],C.green)+link(730,200,765,200)+
  box(765,135,185,130,['Forward','Select route'])+link(950,200,985,200)+
  box(985,135,190,130,['Receive','Office confirms'])+link(1175,200,1210,200)+
  box(1210,135,245,130,['Review + decide','Approve / changes','Reject']),
  elbow('M620 265 L620 342',C.blue)+box(480,325,280,72,['Tracking number + QR','on eligible records'],C.amber)+
  elbow('M1332 265 L1332 342',C.blue)+box(1195,325,275,72,['Continue route','or mark Terminal'],C.green),
  'Finalizing an authored file makes it ready for routing; registration assigns the tracking number.');
D.sequential=page('Sequential routing • one active office at a time',1500,430,
  box(40,125,205,120,['Current office','sends the record'])+link(245,185,290,185)+
  box(290,125,245,120,['1 • Office A','Receive → review','Approve to advance'],C.green,'ACTIVE')+link(535,185,590,185)+
  box(590,125,245,120,['2 • Office B','Waits for Office A','then receives'],C.amber,'NEXT')+link(835,185,890,185)+
  box(890,125,245,120,['3 • Office C','Activates after','Office B approves'],C.amber,'QUEUED')+link(1135,185,1190,185)+
  box(1190,125,260,120,['All required steps','approved → continue'],C.green)+
  elbow('M715 245 L715 330 L790 330',C.red)+box(790,300,385,72,['Change request or rejection pauses the route'],C.rose),
  'Office order can be arranged before the route starts; recorded work remains in the history.');
D.parallel=page('Parallel routing • offices work at the same time',1500,530,
  box(45,195,235,110,['Tracked document','Select offices'])+
  elbow('M280 250 L385 250 L385 130 L430 130')+elbow('M280 250 L430 250')+elbow('M280 250 L385 250 L385 370 L430 370')+
  box(430,88,255,85,['Office A','Receive + review'],C.green)+box(430,208,255,85,['Office B','Receive + review'],C.green)+box(430,328,255,85,['Office C','Receive + review'],C.green)+
  elbow('M685 130 L810 130 L810 250 L855 250')+elbow('M685 250 L855 250')+elbow('M685 370 L810 370 L810 250 L855 250')+
  box(855,190,275,120,['Wait for all','required decisions','progress per office'],C.amber)+link(1130,250,1170,250)+
  box(1170,190,285,120,['All required offices','approve → continue'],C.green)+
  elbow('M990 310 L990 395',C.red)+box(795,390,390,75,['Change request / rejection pauses route'],C.rose),
  'The route remains pending until every required office approves.');
D.childroute=page('Child route • branch work returns to the parent office',1500,495,
  box(40,175,255,125,['Parent Office A','Active route step','sends a child route'],C.green,'PARENT')+
  elbow('M295 237 L390 237 L390 125 L435 125')+elbow('M295 237 L435 237')+elbow('M295 237 L390 237 L390 349 L435 349')+
  box(435,82,255,86,['Child Office B','Receive + decide'],C.amber)+box(435,194,255,86,['Child Office C','Receive + decide'],C.amber)+box(435,306,255,86,['Other selected office','Receive + decide'],C.amber)+
  elbow('M690 125 L820 125 L820 237 L865 237')+elbow('M690 237 L865 237')+elbow('M690 349 L820 349 L820 237 L865 237')+
  box(865,177,240,120,['All required','child steps','complete'],C.green)+link(1105,237,1150,237)+
  box(1150,177,310,120,['Return to Parent A','parent office still','records its decision'],C.green),
  'A completed child branch does not replace the parent office’s own decision.');
D.qr=page('QR tracking and protected document actions',1500,460,
  box(35,125,205,125,['Scan QR','Open signed link'])+link(240,187,270,187)+
  box(270,125,220,125,['View allowed','status + timeline'])+link(490,187,520,187)+
  box(520,125,220,125,['Enter registered','official email'])+link(740,187,770,187)+
  box(770,125,215,125,['Verify 6-digit','email OTP'])+link(985,187,1015,187)+
  box(1015,125,225,125,['Check role, office','and route step'])+link(1240,187,1270,187)+
  box(1270,125,195,125,['Limited session','one document'],C.green)+
  elbow('M880 250 L880 335 L950 335',C.red)+box(950,300,280,72,['Invalid / expired / ineligible','protected actions stay closed'],C.rose),
  'OTP: 10-minute validity • 60-second resend cooldown • session: 20 minutes.');
D.archive=page('Completion, archive, and permitted restore',1500,390,
  box(65,122,245,112,['Holding office','finishes processing'])+link(310,178,365,178)+
  box(365,122,220,112,['Mark Terminal','record completion'])+link(585,178,640,178)+
  box(640,122,220,112,['Archived record','history retained'],C.green)+link(860,178,915,178)+
  box(915,122,240,112,['Search by year,','text, or office'])+link(1155,178,1210,178)+
  box(1210,122,225,112,['Restore when','authorized'],C.amber),
  'Operational archiving is separate from a records-retention or disposal schedule.');
D.systems=page('Connected systems • summary data flows into DOTS',1500,390,
  box(80,122,340,112,['PDMIS • DRIP • iPluma','External services'])+link(420,178,560,178)+
  box(560,122,360,112,['Configured API summaries','Status • records • signers'],C.amber)+link(920,178,1060,178)+
  box(1060,122,360,112,['DOTS Connected Systems','Read-only summary views'],C.green),
  'External credentials and availability determine what appears; signing actions depend on the source service.');
D.overview=page('DOTS • complete system workflow',1700,820,
  box(30,115,200,130,['1 • Sign in','Account + role','+ office access'],C.white)+link(230,180,270,180)+
  box(270,115,220,130,['2 • Prepare','Author in DOTS','or upload a file'],C.white)+link(490,180,530,180)+
  box(530,115,235,130,['3 • Register','Create tracking record','Assign tracking number'],C.green)+link(765,180,805,180)+
  box(805,115,250,130,['4 • Send + route','Sequential • parallel','or child office route'],C.white)+link(1055,180,1095,180)+
  box(1095,115,260,130,['5 • Receive + review','Office confirms receipt','then records a decision'],C.white)+link(1355,180,1395,180)+
  box(1395,115,270,130,['6 • Complete','Continue route, mark','Terminal, then archive'],C.green)+
  elbow('M1225 245 L1225 330 L450 330 L450 380',C.blue)+
  box(320,380,260,105,['Changes requested','Revise file and','resubmit for review'],C.amber)+
  elbow('M1225 245 L1225 330 L880 330 L880 380',C.red)+
  box(750,380,260,105,['Rejected','Decision is recorded','route stops'],C.rose)+
  elbow('M1225 245 L1225 330 L1320 330 L1320 380',C.teal)+
  box(1190,380,260,105,['Approved','Proceed to next','required route step'],C.green)+
  elbow('M450 380 L450 300 L380 300 L380 245',C.amber)+
  box(70,570,360,115,['QR + signed tracking','Public status is limited;','OTP gates eligible actions'],C.white)+
  box(480,570,360,115,['Dashboard + work queues','Office tasks, archives,','and audit history'],C.white)+
  box(890,570,320,115,['Administration','Users, offices, routes,','reference data, templates'],C.white)+
  box(1260,570,370,115,['Connected services','Email + HRIS + configured','DRIP / PDMIS / iPluma'],C.white),
  'Work actions are checked against account, role, office, and route permissions; external services depend on configuration.');

for (const [name,html] of Object.entries(D)) fs.writeFileSync(path.join(out,`${name}.html`),html,'utf8');
console.log(`Wrote ${Object.keys(D).length} HTML workflow diagrams to ${out}`);
