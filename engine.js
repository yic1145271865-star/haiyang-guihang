// Question definitions live outside the persisted state. On recovery they are
// rebuilt from the trusted task catalogue, never from a saved numeric score.
const definitions = new WeakMap();
const stages = ['home', 'draw', 'inspect', 'incident', 'result'];
const isEmergency = id => id.includes('-E');
const known = state => definitions.get(state) || new Map();
const unique = values => [...new Set(values)];
const hazard = (state, id) => known(state).get(id)?.kind === 'hazard' || state.found.includes(id) || id.includes('-H');

export function createState(taskId = null, team = '') {
  return { version: 1, taskId, team, stage: 'home', found: [], solved: [], inspectionIds: [], wrong: {}, active: null, startedAt: null, finishedAt: null, attempt: 1, manual: false };
}

export function selectTask(state, id) {
  if (state.taskId === null && typeof id === 'string' && id) state.taskId = id;
  return state;
}

export function discover(state, questionId) {
  if (state.stage !== 'inspect' || typeof questionId !== 'string' || !questionId) return state;
  if (!inspectionDone(state) && state.active && !state.solved.includes(state.active) && state.wrong[state.active]?.length) return state;
  if (!state.found.includes(questionId)) state.found.push(questionId);
  state.active = state.solved.includes(questionId) ? null : questionId;
  return state;
}

export function answer(state, q, optionIndex) {
  if (!q || typeof q.id !== 'string' || !Array.isArray(q.options) || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length) return state;
  if (state.solved.includes(q.id)) return state;
  const isHazard = hazard(state, q.id);
  if (isHazard && (state.stage !== 'inspect' || state.active !== q.id)) return state;
  if (!isHazard && state.stage !== 'incident') return state;
  const map = known(state);
  map.set(q.id, { ...q, kind: isHazard ? 'hazard' : isEmergency(q.id) ? 'emergency' : 'recap' });
  definitions.set(state, map);
  if (optionIndex === 0) {
    state.solved.push(q.id);
    if (isHazard && state.inspectionIds.length < 3) state.inspectionIds.push(q.id);
    if (state.active === q.id) state.active = null;
  } else {
    const wrong = state.wrong[q.id] || [];
    if (!wrong.includes(optionIndex)) state.wrong[q.id] = [...wrong, optionIndex];
  }
  return state;
}

export function score(state) {
  const map = known(state);
  const earned = unique(state.solved).reduce((sum, id) => {
    if (hazard(state, id) && !state.inspectionIds.slice(0, 3).includes(id)) return sum;
    const q = map.get(id);
    const points = Number.isFinite(q?.points) && q.points >= 0 ? q.points : isEmergency(id) ? 20 : 10;
    return sum + points;
  }, 0);
  const deductions = Object.entries(state.wrong).reduce((sum, [id, values]) => sum + (hazard(state,id) && !state.inspectionIds.includes(id) ? 0 : unique(values).length * 5), 0);
  return Math.max(0, earned - deductions);
}

export function inspectionDone(state) {
  return unique(state.inspectionIds).filter(id => state.solved.includes(id)).length >= 3;
}

export function emergencyDone(state, task) {
  if (!task || !Array.isArray(task.emergencies)) return false;
  return task.emergencies.filter(q => state.solved.includes(q.id)).length >= 3 && task.emergencies.filter(q => q.critical).every(q => state.solved.includes(q.id));
}

export function complete(state, task) {
  const recap = Array.isArray(task?.recap) ? task.recap : task?.recap ? [task.recap] : [];
  return inspectionDone(state) && emergencyDone(state, task) && recap.length > 0 && recap.every(q => state.solved.includes(q.id));
}

export function result(state, task) {
  return complete(state, task) ? score(state) >= 70 ? 'pass' : 'review' : 'incomplete';
}

export function retry(state) {
  const next = createState(state.taskId, state.team);
  next.manual = state.manual;
  next.attempt = state.attempt + 1;
  next.stage = 'inspect';
  next.startedAt = Date.now();
  definitions.delete(state);
  return Object.assign(state, next);
}

export function validateState(raw, tasks) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !stages.includes(raw.stage)) return null;
  if (typeof raw.team !== 'string' || raw.team.length > 200 || typeof raw.manual !== 'boolean' || !Number.isSafeInteger(raw.attempt) || raw.attempt < 1) return null;
  if (raw.startedAt !== null && !(Number.isFinite(raw.startedAt) && raw.startedAt >= 0)) return null;
  const finishedAt = raw.finishedAt === undefined ? null : raw.finishedAt;
  if (finishedAt !== null && !(Number.isFinite(finishedAt) && finishedAt >= 0 && (raw.startedAt === null || finishedAt >= raw.startedAt))) return null;
  const catalogue = Array.isArray(tasks) ? tasks : Object.values(tasks || {});
  const task = catalogue.find(t => t.id === raw.taskId);
  if (raw.taskId !== null && !task) return null;
  const map = new Map();
  if (task) {
    for (const [kind, items] of [['hazard', task.hazards || []], ['emergency', task.emergencies || []], ['recap', Array.isArray(task.recap) ? task.recap : task.recap ? [task.recap] : []]]) {
      for (const q of items) map.set(q.id, { ...q, kind });
    }
  }
  const ids = ['found', 'solved', 'inspectionIds'];
  for (const field of ids) {
    if (!Array.isArray(raw[field]) || unique(raw[field]).length !== raw[field].length || raw[field].some(id => typeof id !== 'string' || !map.has(id))) return null;
  }
  if (raw.inspectionIds.length > 3 || raw.found.some(id => map.get(id).kind !== 'hazard')) return null;
  if (raw.inspectionIds.some(id => map.get(id).kind !== 'hazard' || !raw.solved.includes(id) || !raw.found.includes(id))) return null;
  const completedHazards=raw.solved.filter(id=>map.get(id).kind==='hazard');
  if(completedHazards.some(id=>!raw.found.includes(id)) || JSON.stringify(completedHazards.slice(0,3))!==JSON.stringify(raw.inspectionIds))return null;
  if (!raw.wrong || typeof raw.wrong !== 'object' || Array.isArray(raw.wrong)) return null;
  const wrong = {};
  for (const [id, indexes] of Object.entries(raw.wrong)) {
    const q = map.get(id);
    if (!q || !Array.isArray(indexes) || unique(indexes).length !== indexes.length || indexes.some(n => !Number.isInteger(n) || n <= 0 || n >= q.options.length)) return null;
    if (q.kind === 'hazard' && !raw.found.includes(id)) return null;
    wrong[id] = [...indexes];
  }
  if (raw.active !== null && (!map.has(raw.active) || !raw.found.includes(raw.active) || raw.solved.includes(raw.active))) return null;
  const locked = Object.keys(wrong).filter(id => map.get(id).kind === 'hazard' && wrong[id].length && !raw.solved.includes(id));
  if(raw.inspectionIds.length<3 && (locked.length > 1 || (locked.length && raw.active !== locked[0]))) return null;
  const state = { ...createState(raw.taskId, raw.team), stage: raw.stage, found: [...raw.found], solved: [...raw.solved], inspectionIds: [...raw.inspectionIds], wrong, active: raw.active, startedAt: raw.startedAt, finishedAt, attempt: raw.attempt, manual: raw.manual };
  definitions.set(state, map);
  if (!task) {
    if (state.found.length || state.solved.length || Object.keys(wrong).length || state.active !== null) return null;
    if (stages.indexOf(state.stage) > 1) state.stage = 'home';
    return state;
  }
  // An emergency cannot legitimately be answered before three rectifications.
  if (!inspectionDone(state) && (state.solved.some(id => map.get(id).kind !== 'hazard') || Object.keys(wrong).some(id => map.get(id).kind !== 'hazard'))) return null;
  const maximumStage = complete(state, task) ? 'result' : inspectionDone(state) ? 'incident' : 'inspect';
  if (stages.indexOf(state.stage) > stages.indexOf(maximumStage)) state.stage = maximumStage;
  return state;
}
