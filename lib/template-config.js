export const TEMPLATE_IDS = [
  'standard','blue','minimal','split','photo','ceremony',
  'legacy','legacyWhite','legacyCenter','legacyRight','legacyTwoBlue','legacyTwoWhite',
];

const modern = (name, use, palette, layout, decorations=[]) => ({group:'ERICA MODERN',name,use,palette,layout,decorations});
const legacy = (name, page, palette, layout, decorations) => ({group:'시설팀 기존 양식',name,use:`공식 양식 p.${page}`,palette,layout,decorations});
const light={background:'#ffffff',title:'#132033',subtitle:'#435a70',meta:'#526474',accent:'#0e4a84',line:'#0e4a84',logoVariant:'blue'};
const dark={background:'#0d3968',title:'#ffffff',subtitle:'#dce8f3',meta:'#dce8f3',accent:'#6fb7e8',line:'#ffffff',logoVariant:'white'};
const L=(title,subtitle,meta,host,fontSize=76,align='left',titleWidth=82,safeMargin=4)=>({title,subtitle,meta,host,fontSize,lineHeight:1.02,letterSpacing:0,align,titleWidth,titleMaxHeight:58,safeMargin});

export const TEMPLATES={
  standard:modern('ERICA STANDARD','공식행사 · 세미나',{...light},L({x:6,y:32},{x:6,y:12},{x:6,y:81},{x:94,y:82}),[{type:'bar',x:0,y:0,w:1.1,h:100,color:'accent'}]),
  blue:modern('ERICA BLUE','대학 주요 행사',{...dark,background:'#0a3565',accent:'#69b4e6'},L({x:7,y:29},{x:7,y:11},{x:7,y:80},{x:94,y:81},76),[{type:'gradient'},{type:'line',x:4,y:91,w:92,h:1,color:'accent'}]),
  minimal:modern('MINIMAL WHITE','포럼 · 학술행사',{...light,background:'#f8fafc',line:'#dce7ef'},L({x:50,y:29},{x:50,y:12},{x:50,y:81},{x:94,y:82},72,'center',86),[{type:'line',x:4,y:91,w:92,h:4,color:'line'}]),
  split:modern('SPLIT','긴 제목 대응',{...light,accent:'#0e4a84',line:'#0e4a84'},L({x:5,y:23},{x:5,y:9},{x:5,y:82},{x:96,y:84},62,'left',56),[{type:'panel',x:64,y:0,w:36,h:100,color:'accent'},{type:'line',x:5,y:75,w:54,h:1,color:'line'}]),
  photo:modern('PHOTO','대외행사 · 키비주얼',{...dark,background:'#153c60',overlay:'#081525',overlayOpacity:.58,shadow:true},L({x:7,y:28},{x:7,y:10},{x:7,y:81},{x:94,y:82},72,'left',80),[]),
  ceremony:modern('CEREMONY','개회식 · 협약식',{...dark,background:'#132033',accent:'#ad8a57',line:'#ad8a57'},L({x:50,y:28},{x:50,y:11},{x:50,y:80},{x:94,y:82},70,'center',82),[{type:'line',x:0,y:5,w:100,h:1.4,color:'line'},{type:'line',x:0,y:94,w:100,h:1.4,color:'line'}]),
  legacy:legacy('LEGACY BLUE',2,{...dark,background:'#125285',accent:'#ffffff',line:'#ffffff'},L({x:50,y:13},{x:50,y:8},{x:50,y:57},{x:96,y:83},62,'center',66,3),[{type:'line',x:0,y:76,w:87,h:2,color:'line'},{type:'line',x:0,y:82,w:100,h:4,color:'line'}]),
  legacyWhite:legacy('LEGACY WHITE',3,{...light,title:'#125285',accent:'#9dcc3b',line:'#125285'},L({x:50,y:13},{x:50,y:8},{x:50,y:57},{x:96,y:83},62,'center',66,3),[{type:'line',x:0,y:76,w:87,h:2,color:'line'},{type:'line',x:0,y:82,w:100,h:4,color:'accent'}]),
  legacyCenter:legacy('LEGACY CENTER',4,{...light,title:'#125285',line:'#125285'},L({x:50,y:13},{x:50,y:8},{x:50,y:57},{x:96,y:83},62,'center',66,3),[{type:'line',x:0,y:76,w:87,h:2,color:'line'},{type:'line',x:0,y:82,w:100,h:4,color:'line'}]),
  legacyRight:legacy('LEGACY RIGHT',5,{...light,title:'#125285',line:'#125285'},L({x:48,y:13},{x:48,y:8},{x:48,y:57},{x:96,y:83},62,'center',62,3),[{type:'line',x:1,y:79,w:86,h:3,color:'line'}]),
  legacyTwoBlue:legacy('LEGACY TWO BLUE',6,{...dark,background:'#347db5',accent:'#ffffff',line:'#ffffff'},L({x:52,y:8},{x:52,y:5},{x:52,y:77},{x:97,y:80},48,'center',68,3),[{type:'line',x:0,y:70,w:85,h:2,color:'line'},{type:'line',x:0,y:94,w:100,h:3,color:'line'}]),
  legacyTwoWhite:legacy('LEGACY TWO WHITE',7,{...light,title:'#347db5',meta:'#347db5',line:'#125285'},L({x:48,y:8},{x:48,y:5},{x:48,y:77},{x:97,y:80},48,'center',68,3),[{type:'line',x:0,y:70,w:85,h:2,color:'line'},{type:'line',x:0,y:94,w:100,h:3,color:'line'}]),
};

export function titlePlan(title,template,requestedSize){
  const cfg=TEMPLATES[template], compact=title.replace(/\s/g,'').length, words=title.trim().split(/\s+/).filter(Boolean);
  const mustSplit=template==='split'||template==='legacyTwoBlue'||template==='legacyTwoWhite'||compact>34;
  const cut=Math.ceil(words.length/2),lines=mustSplit&&words.length>2?[words.slice(0,cut).join(' '),words.slice(cut).join(' ')]:[title||'행사명을 입력하세요'];
  const auto=compact>62?36:compact>46?42:compact>32?Math.min(cfg.layout.fontSize,52):cfg.layout.fontSize;
  const size=Math.max(34,Math.min(requestedSize||cfg.layout.fontSize,auto));
  return {lines,size,lineHeight:size*cfg.layout.lineHeight,height:lines.length*size*cfg.layout.lineHeight,overflow:compact>88};
}

export function templateDefaults(template){
  const c=TEMPLATES[template];return {positions:{title:{...c.layout.title},subtitle:{...c.layout.subtitle},meta:{...c.layout.meta},host:{...c.layout.host}},fontSize:c.layout.fontSize,align:c.layout.align};
}

export function contrastRatio(foreground,background){
  const luminance=hex=>{const values=hex.replace('#','').match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2]};
  const a=luminance(foreground),b=luminance(background),light=Math.max(a,b),dark=Math.min(a,b);return (light+.05)/(dark+.05);
}

export function validateTemplate(title,template,positions){
  const c=TEMPLATES[template],p=titlePlan(title,template,c.layout.fontSize),titlePos=positions?.title||c.layout.title;
  const top=titlePos.y/100*256,bottom=top+p.height,right=titlePos.x/100*2560+(c.layout.align==='center'?c.layout.titleWidth*12.8:c.layout.titleWidth*25.6);
  const safe=c.layout.safeMargin/100*256;
  const clipping=top<safe||bottom>256-safe||right>2560-safe;
  const textBoxes=[{top,bottom},{top:(positions?.meta||c.layout.meta).y/100*256,bottom:(positions?.meta||c.layout.meta).y/100*256+20}];
  const collision=c.decorations.some(d=>d.type==='line'&&textBoxes.some(box=>box.bottom>d.y/100*256&&box.top<(d.y+d.h)/100*256));
  return {clipping,collision,overflow:p.overflow,plan:p};
}
