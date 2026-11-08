// Version 2: inspection learning only; no numeric scores or emergency questions.
const STAGES = ['draw', 'intro', 'inspect', 'incident', 'result'];
const unique = a => new Set(a).size === a.length;
const hazardId = (s, id) => typeof id === 'string' && id.startsWith(`${s.taskId}-H`);
export function createState(taskId = null, team = '') {
  return {version:2,taskId,team,stage:taskId?'intro':'draw',found:[],solved:[],wrong:{},active:null,overviewConfirmed:false,startedAt:null,finishedAt:null,attempt:1,manual:false};
}
export function selectTask(s,id){if(s.stage==='draw'&&s.taskId===null&&typeof id==='string'&&id){s.taskId=id;s.stage='intro'}return s}
export function beginInspection(s,now=Date.now()){if(s.stage==='intro'&&s.taskId){s.stage='inspect';s.startedAt=now}return s}
export function inspectionDone(s){return new Set(s.solved).size>=4}
export function discover(s,id){
  if(s.stage!=='inspect'||!hazardId(s,id))return s;
  if(!inspectionDone(s)&&s.active&&!s.solved.includes(s.active)&&s.wrong[s.active]?.length)return s;
  if(!s.found.includes(id))s.found.push(id);
  s.active=s.solved.includes(id)?null:id;return s;
}
export function answer(s,q,index){
  if(s.stage!=='inspect'||!q||s.active!==q.id||!hazardId(s,q.id)||s.solved.includes(q.id)||!Number.isInteger(index)||!Array.isArray(q.options)||index<0||index>=q.options.length)return s;
  if(index===0){s.solved.push(q.id);s.active=null}
  else{const values=s.wrong[q.id]||[];if(!values.includes(index))s.wrong[q.id]=[...values,index]}
  return s;
}
export function confirmOverview(s){if(s.stage==='inspect'&&inspectionDone(s)){s.overviewConfirmed=true;s.active=null;s.stage='incident'}return s}
export function finish(s,now=Date.now()){
  if(s.stage==='incident'&&s.finishedAt===null&&inspectionDone(s)&&s.overviewConfirmed&&Number.isFinite(s.startedAt)&&Number.isFinite(now)&&now>=s.startedAt){s.finishedAt=now}return s;
}
export function complete(s){return inspectionDone(s)&&s.overviewConfirmed&&s.stage==='incident'&&Number.isFinite(s.startedAt)&&Number.isFinite(s.finishedAt)&&s.finishedAt>=s.startedAt}
export function retry(s){const next=createState(s.taskId,s.team);next.manual=s.manual;next.attempt=s.attempt+1;return Object.assign(s,next)}
export function validateState(raw,tasks){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==2||!STAGES.includes(raw.stage))return null;
  if(typeof raw.team!=='string'||raw.team.length>200||typeof raw.manual!=='boolean'||!Number.isSafeInteger(raw.attempt)||raw.attempt<1||typeof raw.overviewConfirmed!=='boolean')return null;
  for(const key of ['startedAt','finishedAt'])if(raw[key]!==null&&!(Number.isFinite(raw[key])&&raw[key]>=0))return null;
  if(raw.finishedAt!==null&&(raw.startedAt===null||raw.finishedAt<raw.startedAt))return null;
  const t=tasks.find(t=>t.id===raw.taskId),map=new Map((t?.hazards||[]).map(q=>[q.id,q]));
  if(raw.taskId!==null&&!t)return null;
  for(const key of ['found','solved'])if(!Array.isArray(raw[key])||!unique(raw[key])||raw[key].some(id=>!map.has(id)))return null;
  if(raw.solved.some(id=>!raw.found.includes(id)))return null;
  if(raw.active!==null&&(!map.has(raw.active)||!raw.found.includes(raw.active)||raw.solved.includes(raw.active)))return null;
  if(!raw.wrong||typeof raw.wrong!=='object'||Array.isArray(raw.wrong))return null;
  const wrong={};
  for(const [id,values] of Object.entries(raw.wrong)){
    const q=map.get(id);if(!q||!raw.found.includes(id)||!Array.isArray(values)||!unique(values)||values.some(i=>!Number.isInteger(i)||i<=0||i>=q.options.length))return null;
    wrong[id]=[...values];
  }
  const s={...createState(raw.taskId,raw.team),stage:raw.stage==='result'?'incident':raw.stage,found:[...raw.found],solved:[...raw.solved],wrong,active:raw.active,overviewConfirmed:raw.overviewConfirmed,startedAt:raw.startedAt,finishedAt:raw.finishedAt,attempt:raw.attempt,manual:raw.manual};
  if(s.stage==='draw'&&(s.taskId!==null||s.startedAt!==null||s.found.length||s.active!==null||s.overviewConfirmed||s.finishedAt!==null))return null;
  if(s.stage!=='draw'&&!t)return null;
  if(s.stage==='intro'&&(s.startedAt!==null||s.found.length||s.active!==null||s.overviewConfirmed||s.finishedAt!==null))return null;
  if(['inspect','incident','result'].includes(s.stage)&&s.startedAt===null)return null;
  if(s.stage==='inspect'&&(s.overviewConfirmed||s.finishedAt!==null))return null;
  if(!inspectionDone(s)){
    const locked=Object.keys(wrong).filter(id=>wrong[id].length&&!s.solved.includes(id));
    if(locked.length>1||(locked.length&&s.active!==locked[0]))return null;
  }
  if(['incident','result'].includes(s.stage)&&(!inspectionDone(s)||!s.overviewConfirmed||s.active!==null))return null;
  if(raw.stage==='result'&&!complete(s))return null;
  return s;
}
