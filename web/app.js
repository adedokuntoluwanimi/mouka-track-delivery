import {driverAccessMarkup, mountDriverAccess} from './driver/access.js';
import {legalItems, helpTopics} from './guidance.js';
import {seed, iconPaths} from './data.js';
import {currentSession, isRemembered, saveSession, demoPassword, makeDemoCredential, checkDemoPassword} from './demo-access.js';
import {dispatchAnswer, onDeviceAvailable, askOnDevice} from './aurora.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#dialog');
const feedback = document.querySelector('#feedback');
const assistant = document.querySelector('#aurora');
const storageKey = 'mouka-dispatch-demo-v1';
let state = structuredClone(seed);
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved?.fleet && saved?.trips && saved?.locations && saved?.activity && saved?.users) state = saved;
} catch {}
let current = '';
let filters = {};
let mapSelection = '';
let trackSelection = '';
let trackActivityOpen = true;
let trackAllActivity = false;
let overviewRide = '';
const truckPhotos = new Map();
let availableRefreshed = '';
let availableMenuOpen = false;
let availableLayout = 'grid';
const availableClosed = new Set();
const deliveryView = {query:'', status:'', type:'', depot:'', page:1, size:5, sort:'trip', dir:-1};
const deliveryPicked = new Set();
let trackPending = '';
const sideOpen = new Map();
try { if (localStorage.getItem('mouka-available-layout') === 'list') availableLayout = 'list'; } catch {}
let overviewFilter = 'all';
let overviewQuery = '';
let railed = false;
let tableView = 'table';
try {
  railed = localStorage.getItem('mouka-rail') === 'true';
  if (localStorage.getItem('mouka-table-view') === 'cards') tableView = 'cards';
} catch {}
const demoAdmin = {name:'Demo Administrator',email:'admin@example.com',role:'Administrator',status:'Active'};
let signedInEmail = currentSession();
if (signedInEmail !== demoAdmin.email && !state.users.some(u => u.email === signedInEmail && u.status === 'Active')) signedInEmail = '';
let pendingAccess;
let zoom = 1;
let navOpen = false;
const bayView = {query:'', stage:'', depot:'', type:''};
const noticeView = {query:'', kind:'', read:'', page:1, size:8};
const noticePicked = new Set();
let noticesRead = new Set();
try { noticesRead = new Set(JSON.parse(localStorage.getItem('mouka-read-notices')) || []); } catch {}
let authEmail = '';
let auroraOpen = false;
let auroraPending = false;
const auroraMessages = [];
const nav = [
  ['Operations', [['dispatch','Dispatch','grid'],['available','Available','truck'],['loading','Loading bay','bay'],['tracking','Live tracking','pin'],['deliveries','Deliveries','box']]],
  ['Administration', [['fleet','Fleet directory','list'],['verification','Verification','shield'],['users','Users & permissions','users'],['depots','Depot settings','settings']]]
];
const themeMedia = matchMedia('(prefers-color-scheme: dark)');
const themes = {system:['System','monitor'],light:['Light','sun'],dark:['Dark','moon']};
let themePreference = 'light';
try {
  const savedTheme = localStorage.getItem('mouka-appearance');
  if (Object.hasOwn(themes,savedTheme)) themePreference = savedTheme;
} catch {}
function applyTheme() {
  const dark = themePreference === 'dark' || (themePreference === 'system' && themeMedia.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0f1620' : '#f6f7f8';
  app.querySelectorAll('[data-action="theme"]').forEach(button =>
    button.setAttribute('aria-pressed',String(button.dataset.id === themePreference)));
  app.querySelector('[data-action="side-dark"]')?.setAttribute('aria-checked',String(dark));
}
themeMedia.addEventListener('change',applyTheme);
applyTheme();

const fontSizes = {compact:'Compact',standard:'Standard',large:'Large',extraLarge:'Extra large'};
let fontSize = 'standard';
try {
  const savedSize = localStorage.getItem('mouka-font-size');
  if (Object.hasOwn(fontSizes,savedSize)) fontSize = savedSize;
} catch {}
document.documentElement.dataset.fontSize = fontSize;

const names = Object.fromEntries(nav.flatMap(([, items]) => items.map(([path,title]) => [path,title])));
const roles = ['Administrator','Dispatch','Loading','Fleet verification'];
const tone = {
  'Available':'green', 'Verified':'green', 'Accepted':'green', 'Active':'green', 'Delivered':'green',
  'In transit':'blue', 'Assigned':'blue', 'At bay':'blue', 'Invited':'blue','Suspended':'red',
  'Awaiting response':'amber', 'Loading':'amber', 'Pending review':'amber', 'Stale GPS':'amber',
  'Declined':'red', 'Rejected':'red', 'Needs corrections':'amber'
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || iconPaths.info}</svg>`;
const link = (path, label, look='secondary', symbol='') => `<a class="btn ${look}" href="#/${path}">${symbol ? icon(symbol) : ''}${esc(label)}</a>`;
const btn = (action, label, look='secondary', id='', symbol='') => `<button type="button" class="btn ${look}" data-action="${action}" data-id="${esc(id)}">${symbol ? icon(symbol) : ''}${esc(label)}</button>`;
const iconBtn = (action, label, symbol, extra='') => `<button type="button" class="icon-btn ${extra}" aria-label="${label}" title="${label}" data-action="${action}">${icon(symbol)}</button>`;
const chip = label => `<span class="pill ${tone[label] || ''}">${esc(label)}</span>`;
const truck = id => state.fleet.find(t => t.id === id);
const trip = id => state.trips.find(t => t.id === id);
const account = () => signedInEmail === demoAdmin.email ? demoAdmin : state.users.find(u => u.email === signedInEmail);
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
const rememberAccount = (email, remember=false) => {
  signedInEmail = email;
  saveSession(email,remember);
};
const active = () => state.trips.filter(t => t.status === 'In transit');
const loading = () => state.trips.filter(t => ['At bay','Loading','Accepted'].includes(t.status));
const pending = () => state.trips.filter(t => t.status === 'Awaiting response');
const available = () => state.fleet.filter(t => t.review === 'Verified' && t.status === 'Available' && !state.trips.some(x => x.truck === t.id && !['Delivered','Declined'].includes(x.status))).sort((a,b) => (a.eta ?? Infinity) - (b.eta ?? Infinity));
const stale = t => (t?.fresh ?? 100) >= 15;
const localTime = () => new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'}).format();
const logo = (label='Mouka') => `<img src="/assets/mouka.svg" alt="${label}">`;
const auroraMark = () => `<span class="aurora-mark" aria-hidden="true">${logo('')}</span>`;
const route = () => {
  if (location.hash.startsWith('#/')) {
    const path = location.hash.slice(2).replace(/\/$/,'') || 'dispatch';
    if (path === 'request') return 'available';
    if (path === 'requests') return 'dispatch';
    return path;
  }
  return ['/', '/index.html'].includes(location.pathname) ? (signedInEmail ? 'dispatch' : 'sign-in') : 'not-found';
};
const go = to => { if (current === to) render(); else location.hash = '/' + to; };
const tile = (symbol, look='') => `<span class="tile-icon ${look}">${icon(symbol)}</span>`;
const date = () => new Intl.DateTimeFormat('en-NG',{weekday:'long',day:'numeric',month:'long',timeZone:'Africa/Lagos'}).format(new Date(2026,10,20,12));
const notice = (text, type='info') => `<div class="notice ${type}" role="${type === 'error' ? 'alert' : 'status'}">${icon(({warn:'warning',error:'warning',success:'check'})[type] || 'info')}<span>${esc(text)}</span></div>`;
const pageSymbols = Object.fromEntries(nav.flatMap(([, items]) => items.map(([path,,symbol]) => [path,symbol])));
const head = (title, desc, actions='') => {
  const page = current.split('/')[0];
  return `<header class="page-head operation-head">
    <div class="operation-heading">${tile(pageSymbols[page] || (page === 'truck' ? 'truck' : 'box'))}
      <div><h1 tabindex="-1">${esc(title)}</h1><p>${esc(desc)}</p></div>
    </div>${actions ? `<div class="actions">${actions}</div>` : ''}
  </header>`;
};
const stageStrip = (label, records, stages, matches=(r,status)=>[r.status,r.review].includes(status)) => `<div class="stage-strip" role="group" aria-label="${esc(label)}">${stages.map(([status, caption, symbol]) =>
  `<button type="button" class="stage-cell" data-action="status-filter" data-id="${esc(status)}" aria-pressed="${(filters.status || '') === status}">
    ${icon(symbol)}<strong>${status ? records.filter(r => matches(r,status)).length : records.length}</strong><span>${esc(caption)}</span>
  </button>`).join('')}</div>`;
const statsStrip = (label, items) => `<dl class="stats-strip" aria-label="${esc(label)}">${items.map(([caption,value,symbol]) =>
  `<div>${icon(symbol)}<dt>${esc(caption)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;

const card = (title, desc, content, action='') => `<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>${action}</div>${content}</section>`;
const body = inner => `<div class="card-body">${inner}</div>`;
const empty = (title, desc, action='') => `<div class="empty">${tile('box')}<h2>${esc(title)}</h2><p>${esc(desc)}</p>${action}</div>`;
const field = (label, control) => `<label class="field"><span>${esc(label)}</span>${control}</label>`;
const option = (values, selected='') => values.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
const textField = (label, name, placeholder='', type='text') => field(label,`<input name="${name}" type="${type}" placeholder="${esc(placeholder)}" required aria-describedby="error-${name}"><span class="field-error" id="error-${name}"></span>`);
const kv = pairs => `<dl class="kv">${pairs.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
const formActions = (label, cancel=true) => `<div class="actions">${cancel ? btn('close','Cancel') : ''}<button class="btn" type="submit">${esc(label)}</button></div>`;
const formError = '<div class="notice error" role="alert" data-form-error hidden></div>';
function save(message, mutate) {
  if (!navigator.onLine) {
    toast('Connection lost. Reconnect and try again.', 'error');
    return false;
  }
  const previous = structuredClone(state);
  try {
    mutate();
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    state = previous;
    toast('Your change could not be saved. Try again.', 'error');
    return false;
  }
  toast(message);
  return true;
}
function toast(message, type='success') {
  const wrap = document.createElement('div');
  wrap.innerHTML = notice(message,type);
  feedback.append(wrap.firstElementChild);
  const item = feedback.lastElementChild;
  setTimeout(() => item.remove(), 4300);
}
function log(title, detail, symbol='check') {
  state.activity.unshift([title,detail,localTime(),symbol]);
}
function event(record, label) { record.events.unshift([label,localTime()]); }
function activity(limit=5) {
  return `<ul class="activity">${state.activity.slice(0,limit).map(([title,detail,time,symbol]) => `<li>${tile(symbol,symbol === 'warning' ? 'amber' : symbol === 'close' ? 'gray' : '')}<div class="event-copy"><strong>${esc(title)}</strong><small>${esc(detail)}</small></div><time class="event-time">${esc(time)}</time></li>`).join('')}</ul>`;
}

const isMapped = vehicle => Array.isArray(vehicle?.demoPosition);
function table(headers, rows, label, {blank='No records match the current filters.', mobile}={}) {
  if (!rows.length) return empty('No records found',blank,Object.values(filters).some(Boolean) ? btn('clear-filters','Clear filters','light') : '');
  return `<div class="registry ${tableView==='cards'?'card-view':''}">
    <div class="table-wrap" tabindex="0" role="region" aria-label="${esc(label)}">
      <table class="data-table registry-table" role="table">
        <thead role="rowgroup"><tr role="row">${headers.map(h=>`<th role="columnheader" scope="col" ${h?'':'class="registry-actions-heading"'}>${h ? `<button type="button" class="sort" data-action="sort" data-id="">${esc(h)}<i aria-hidden="true"></i></button>` : 'Actions'}</th>`).join('')}</tr></thead>
        <tbody role="rowgroup">${rows.map(row=>`<tr role="row">${row.map((value,i)=>{
          const cell = i===0 ? 'th' : 'td';
          const attributes = i===0 ? 'scope="row" role="rowheader"' : 'role="cell"';
          const heading = headers[i];
          const cellClass = i===0?'registry-primary':!heading?'registry-actions':'';
          const hiddenOnMobile = i>0 && heading && mobile && !mobile.includes(heading);
          return `<${cell} ${attributes} class="${cellClass}${hiddenOnMobile?' registry-mobile-hidden':''}">
            ${i>0 && heading ? `<span class="registry-mobile-label" aria-hidden="true">${esc(heading)}</span>` : ''}${value}</${cell}>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="registry-footer">${rows.length} ${rows.length===1?'record':'records'}</div>
  </div>`;
}
function controls(placeholder, statuses=[], extraFields=[]) {
  const filterFields = statuses.length
    ? [{name:'status',label:'Status',all:'All statuses',choices:statuses.map(status=>[status,status])},...extraFields]
    : extraFields;
  const applied = filterFields.filter(({name})=>filters[name]).length;
  const id = 'registry-filter-options';
  return `<form class="filters registry-filters" data-form="filters">
    <div class="registry-search">${icon('search')}<input type="search" name="query" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(filters.query)}"></div>
    ${filterFields.length ? `<button class="btn registry-filter-toggle" type="button" data-action="filter-options" aria-expanded="false" aria-controls="${id}">
      ${icon('filter')} Filters${applied ? ` <span class="filter-count" aria-label="${applied} applied">${applied}</span>` : ''}${icon('chevron')}
    </button>` : ''}
    ${filters.query || applied ? btn('clear-filters','Clear','light') : ''}
    <div class="view-switch" role="group" aria-label="Choose a view">${[['table','list','Table view'],['cards','grid','Card view']].map(([key,symbol,label]) =>
      `<button type="button" data-action="table-view" data-id="${key}" aria-pressed="${tableView===key}" aria-label="${label}" title="${label}">${icon(symbol)}</button>`).join('')}</div>
    ${filterFields.length ? `<div id="${id}" class="registry-filter-panel" hidden>
      <div class="registry-filter-fields">${filterFields.map(({name,label,all,choices})=>`<label class="field">
        <span>${esc(label)}</span><select name="${name}"><option value="">${esc(all)}</option>
        ${choices.map(([value,text])=>`<option value="${esc(value)}"${value===filters[name]?' selected':''}>${esc(text)}</option>`).join('')}</select>
      </label>`).join('')}</div>
      <button class="btn primary" type="submit">Apply filters</button>
    </div>` : ''}
  </form>`;
}
function matchQuery(record) {
  return !filters.query || JSON.stringify(record).toLowerCase().includes(filters.query.toLowerCase().trim());
}
function match(record) { return (!filters.status || [record.status,record.review].includes(filters.status)) && matchQuery(record); }

function numberedField(records,key,name,label,all,describe) {
  const numbers = new Map(records.map((record,index)=>[record[key],index+1]));
  return {name,label,all,numbers,choices:records.map(record=>[record[key],`${numbers.get(record[key])}. ${describe(record)}`])};
}
function optionField(records,name,label,all) {
  const values = [...new Set(records.map(record=>record[name]).filter(value=>value!=null && value!==''))];
  return {name,label,all,choices:values.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true})).map(value=>[String(value),String(value)])};
}
function matchesFields(record,...names) {
  return names.every(name=>!filters[name] || String(record[name])===filters[name]);
}
function vehicleField(vehicles,name='vehicle') {
  return numberedField(vehicles,'id',name,'Vehicle','All vehicles',v=>`${v.plate} · ${v.type}`);
}
function tripVehicleField(records) {
  const ids = new Set(records.map(t=>t.truck));
  return vehicleField(state.fleet.filter(v=>ids.has(v.id)),'truck');
}
function registryIdentity(title, detail, symbol, path='', number) {
  const emblem = number == null ? icon(symbol) : number;
  const identity = `<span class="registry-emblem">${emblem}</span>
    <span class="registry-identity-text"><strong>${esc(title)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</span>`;
  return path ? `<a class="registry-identity" href="#/${esc(path)}">${identity}<span class="registry-open">${icon('chevron')}</span></a>` : `<span class="registry-identity">${identity}</span>`;
}
function registryStatus(label) {
  const color = tone[label] || '';
  const symbol = ({'Stale GPS':'warning','In transit':'truck','Verified':'shield','Invited':'send'})[label] ||
    ({green:'check',amber:'clock',red:'close',blue:'info'})[color] || 'info';
  return `<span class="pill registry-status ${color}">${icon(symbol)}${esc(label)}</span>`;
}
function registryProgress(value, total, label) {
  return `<span class="registry-progress"><strong>${esc(label)}</strong>
    <progress value="${value}" max="${Math.max(total,1)}" aria-label="${esc(label)}"></progress>
  </span>`;
}
const tripIdentity = (t,number) => registryIdentity(t.id,number==null?'':truck(t.truck)?.plate,'box','trip/'+t.id,number);

function tripTable(records, label, blank, numbers) {
  return table(['Trip','Destination','Truck','Status','ETA / stops'],records.map(t=>{
    const v = truck(t.truck);
    const progress = t.status==='In transit'
      ? (stale(v)?registryStatus('Stale GPS'):esc(t.eta ?? 'Pending'))
      : registryProgress(t.done,t.stops.length,`${t.done}/${t.stops.length} stops`);
    return [tripIdentity(t,numbers?.get(t.truck)),`<strong>${esc(t.stops.at(-1))}</strong><small>${esc(t.depot)}${t.stops.length>1 ? ` · ${t.stops.length} stops` : ''}</small>`,
      `<strong>${esc(v?.plate)}</strong><small>${esc(v?.operator)}</small>`,registryStatus(t.status),progress];
  }),label,{blank,mobile:['Destination','Status']});
}

// ---- Dispatch overview ----
const openTrips = () => trackingTrips().filter(t => t.status !== 'Delivered');
const eventTime = (t, pattern) => t.events.find(([label]) => pattern.test(label))?.[1];
const minutes = time => { const [h,m] = String(time).split(':').map(Number); return h * 60 + m; };
const clock = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const plural = (count, one, many = one + 's') => `${count} ${count === 1 ? one : many}`;
const rideDocs = ['Vehicle registration','Insurance certificate','Roadworthiness certificate'];
const rideFilters = [['all','All'],['trip','On a trip'],['free','Ready'],['attention','Attention']];

// Everything the overview needs to know about one vehicle.
function rideInfo(vehicle) {
  const trip = openTrips().find(t => t.truck === vehicle.id);
  const ready = available().some(v => v.id === vehicle.id);
  const status = trip ? trackingStatus(trip) : vehicle.review !== 'Verified' ? vehicle.review : ready ? 'Available' : vehicle.status;
  const groups = ['all', ...(trip ? ['trip'] : []), ...(ready ? ['free'] : []),
    ...(vehicle.review !== 'Verified' || ((trip?.status === 'In transit' || ready) && stale(vehicle)) ? ['attention'] : [])];
  const rank = status === 'Stale GPS' ? 0 : trip ? 1 : ready ? 2 : 3;
  return {vehicle, trip, ready, status, groups, rank};
}
const rides = () => state.fleet.map(rideInfo).sort((a,b) => a.rank - b.rank);
const rideChip = status => ['Available','Pending review','Needs corrections','Rejected','Assigned','Unavailable'].includes(status) ?
  `<span class="td-chip ${status === 'Available' ? 'done' : status === 'Rejected' ? 'stale' : 'pending'}">${esc(status === 'Available' ? 'Ready' : status)}</span>` : trackingChip(status);

function overviewTasks() {
  const exceptions = active().filter(t => stale(truck(t.truck)));
  const requests = pending();
  const bays = loading();
  const reviews = state.fleet.filter(v => v.review === 'Pending review');
  return [
    {key:'gps', count:exceptions.length, cause:'Overdue GPS updates', symbol:'pin', path:exceptions.length === 1 ? 'trip/'+exceptions[0].id : 'tracking',
      title:`Check ${plural(exceptions.length,'stale GPS trip')}`, note:'Confirm the position'},
    {key:'requests', count:requests.length, cause:'Requests awaiting a response', symbol:'send', path:requests.length === 1 ? 'trip/'+requests[0].id : 'deliveries',
      title:`Follow up ${plural(requests.length,'truck request')}`, note:'No operator reply yet'},
    {key:'bay', count:bays.length, cause:'Trips still in the loading bay', symbol:'bay', path:'loading',
      title:`Progress ${plural(bays.length,'loading bay trip')}`, note:'Update the bay stage'},
    {key:'fleet', count:reviews.length, cause:'Registrations pending review', symbol:'shield', path:'verification',
      title:`Review ${plural(reviews.length,'truck registration')}`, note:'Documents to check'}
  ].filter(task => task.count);
}

// Shown only when the browser cannot draw 3D.
const truckFallback = `<p class="ov-fallback">${icon('truck')} The 3D view needs WebGL, which this browser has not made available.</p>`;

function overviewStage(ride) {
  const {vehicle, trip, status} = ride;
  const {name} = driverContact(vehicle);
  const road = trip?.status === 'In transit';
  const late = status === 'Stale GPS';
  const released = trip && eventTime(trip,/released/i);
  const latest = trip?.events[0];
  const flag = late ? `GPS alert · last update ${vehicle.fresh ?? '—'} min ago` :
    road ? 'On the road' : trip?.status === 'Awaiting response' ? 'Waiting for the operator' : trip ? 'At the depot' :
    ride.ready ? 'Free for dispatch' : 'Not ready for dispatch';
  const facts = trip ? [
    ['Released', released || '—', released ? 'WAT' : 'not released'],
    ['GPS age', vehicle.fresh == null ? '—' : vehicle.fresh + ' min', late ? 'overdue' : vehicle.fresh == null ? 'unavailable' : 'reporting', late ? 'bad' : ''],
    ['Destination ETA', road && !late && trip.eta ? trip.eta : '—', late ? 'needs fresh GPS' : road ? 'sample estimate' : 'not on the road', 'good']
  ] : [
    ['Pickup ETA', ride.ready ? pickupTime(vehicle) : '—', ride.ready ? 'to Demo Depot A' : 'not available', 'good'],
    ['GPS age', vehicle.fresh == null ? '—' : vehicle.fresh + ' min', vehicle.fresh == null ? 'unavailable' : stale(vehicle) ? 'overdue' : 'reporting', vehicle.fresh != null && stale(vehicle) ? 'bad' : ''],
    ['Documents', vehicle.review === 'Verified' ? '3 of 3' : `${vehicle.docs?.length ?? 0} of 3`, vehicle.review.toLowerCase()]
  ];
  const stage = !trip ? -1 : road ? 2 : ['At bay','Loading'].includes(trip.status) ? 1 : 0;
  const steps = trip ? [
    [trip.depot, eventTime(trip,/accepted|requested/i) || '—'],
    ['Loading bay', eventTime(trip,/loading started|arrived/i) || '—'],
    [late ? 'Last reported' : 'On the road', released || '—'],
    [trip.stops.at(-1), road ? (late ? 'ETA hidden' : trip.eta || 'ETA pending') : 'Pending']
  ] : [];
  const next = trip && ({Accepted:'Record arrival','At bay':'Start loading',Loading:'Confirm loaded and release'})[trip.status];
  const actions = trip ? [
    next ? btn('stage',next,'ov-primary',trip.id) : road ? btn('deliver','Confirm next stop','ov-primary',trip.id) :
      trip.status === 'Awaiting response' ? btn('respond','Simulate operator response','ov-primary',trip.id) : '',
    link('trip/'+trip.id,'Trip details','secondary','box'), btn('track-call','Call driver','secondary',trip.id,'phone')
  ] : [
    vehicle.review === 'Pending review' ? btn('review','Review registration','ov-primary',vehicle.id,'shield') : '',
    link('truck/'+vehicle.id,'Truck record','secondary','truck')
  ];
  const viewButton = (key,text) => `<button type="button" data-action="ov-view" data-id="${key}">${text}</button>`;
  return `<section class="ov-card ov-stage ${late?'late':''}" aria-label="Selected vehicle">
    <div class="ov-stage-top">
      <div>
        <p class="ov-flag"><i></i>${esc(flag)}</p>
        <h2>${trip ? `${esc(trip.depot)} to ${esc(trip.stops.at(-1))}` : esc(vehicle.plate)} ${rideChip(status)}</h2>
        <small>${trip ? `${esc(trip.id)} · ${esc(vehicle.plate)} · ` : ''}${esc(vehicle.operator)} · ${esc(vehicle.type)}</small>
      </div>
      <dl>${facts.map(([label,value,note,look='']) => `<div class="${look}"><dt>${label}</dt><dd>${esc(value)}</dd><small>${esc(note)}</small></div>`).join('')}</dl>
    </div>
    <div class="ov-art">
      <div class="ov-3d" data-truck3d data-type="${esc(vehicle.type)}" data-plate="${esc(vehicle.plate)}">${truckFallback}</div>
      <a class="ov-chip driver" href="#/truck/${esc(vehicle.id)}">${driverAvatar(name)}<span><strong>${esc(name)}</strong><small>${esc(vehicle.plate)}</small></span></a>
      <div class="ov-chip place"><small>Last location</small><strong>${esc(vehicle.location)}</strong></div>
      <div class="ov-chip latest"><small>${latest ? `Latest · ${esc(latest[1])}` : 'Status'}</small><strong>${esc(latest ? latest[0] : status === 'Available' ? 'Ready for a trip' : status)}</strong></div>
      <div class="ov-chip stops"><small>${trip ? 'Delivery stops' : 'Vehicle type'}</small><strong>${trip ? `${trip.done} of ${trip.stops.length} confirmed` : esc(vehicle.type)}</strong></div>
    </div>
    <div class="ov-3d-bar">
      <span>${icon('target')} Drag the truck to turn it</span>
      <div role="group" aria-label="3D view">${viewButton('left','‹ Turn')}${viewButton('angle','Angle')}${viewButton('side','Side')}${viewButton('front','Front')}${viewButton('rear','Rear')}${viewButton('right','Turn ›')}
        <button type="button" data-action="ov-spin" aria-pressed="${Boolean(truckViewer?.spinning)}">360° spin</button></div>
    </div>
    ${trip ? `<ol class="ov-route">${steps.map(([label,time],i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}" ${i === stage ? 'aria-current="step"' : ''}><i></i><span>${esc(label)}</span><small>${esc(time)}</small></li>`).join('')}</ol>` :
      `<p class="ov-idle">${icon('info')} ${ride.ready ? 'This truck has no open trip.' : 'This truck cannot take a trip until its status changes.'}</p>`}
    <div class="ov-stage-actions">${actions.join('')}</div>
  </section>`;
}

function overviewPicker(list, selected) {
  const query = overviewQuery.toLowerCase();
  const shown = ride => ride.groups.includes(overviewFilter) && ride.search.includes(query);
  list.forEach(ride => { ride.search = `${ride.vehicle.plate} ${ride.vehicle.driver} ${ride.vehicle.operator} ${ride.vehicle.type} ${ride.trip?.id || ''}`.toLowerCase(); });
  const count = list.filter(shown).length;
  return `<aside class="ov-card ov-picker" aria-label="Choose a vehicle">
    <header><div><h2>Choose a vehicle</h2><small>${plural(list.length,'truck')} in the fleet</small></div>
      <span><button type="button" data-action="ov-step" data-id="-1" aria-label="Previous vehicle">${icon('chevron')}</button><button type="button" data-action="ov-step" data-id="1" aria-label="Next vehicle">${icon('chevron')}</button></span></header>
    <div class="ov-picker-search">${icon('search')}<input type="search" id="ride-search" value="${esc(overviewQuery)}" placeholder="Plate, driver or trip" aria-label="Search vehicles"></div>
    <div class="ov-tabs" role="group" aria-label="Filter vehicles">${rideFilters.map(([key,label]) => `<button type="button" data-action="ov-filter" data-id="${key}" aria-pressed="${overviewFilter === key}">${label}<em>${list.filter(ride => ride.groups.includes(key)).length}</em></button>`).join('')}</div>
    <ul>${list.map(ride => {
      const {vehicle,trip,status} = ride;
      return `<li data-search="${esc(ride.search)}" data-groups="${ride.groups.join(' ')}" ${shown(ride) ? '' : 'hidden'}><button type="button" data-action="ov-ride" data-id="${esc(vehicle.id)}" aria-pressed="${vehicle.id === selected.vehicle.id}">
        <span class="ov-ride-icon ${vehicle.type === 'Trailer' ? 'trailer' : ''}">${trackingTruckIcon}</span>
        <span class="ov-ride-copy"><strong>${esc(vehicle.plate)}</strong><small>${esc(vehicle.driver)} · ${esc(vehicle.type)}</small><small>${trip ? `${esc(trip.id)} to ${esc(trip.stops.at(-1))}` : esc(vehicle.location)}</small></span>
        ${rideChip(status)}</button></li>`;
    }).join('')}</ul>
    <p class="ov-picker-empty" role="status" ${count ? 'hidden' : ''}>No vehicles match.</p>
  </aside>`;
}

function overviewDetails(ride) {
  const {vehicle} = ride;
  const trip = ride.trip || state.trips.find(t => t.truck === vehicle.id);
  const none = text => `<p class="ov-none">${icon('box')} ${text}</p>`;
  const received = name => vehicle.review === 'Verified' || vehicle.docs?.includes(name);
  const panel = (title, note, content) => `<section class="ov-panel"><header><h2>${title}</h2><small>${note}</small></header>${content}</section>`;
  return `<div class="ov-three">
    ${panel('Delivery stops', trip ? `${esc(trip.id)}${ride.trip ? '' : ' · ' + esc(trip.status)}` : 'No trip on record', trip ?
      `<progress class="ov-meter" value="${trip.done}" max="${trip.stops.length}" aria-label="${trip.done} of ${trip.stops.length} stops confirmed"></progress>
      <ol class="ov-stops"><li class="done"><i>${icon('bay')}</i><span><strong>${esc(trip.depot)}</strong><small>Pickup depot</small></span></li>
      ${trip.stops.map((stop,i) => `<li class="${i < trip.done ? 'done' : i === trip.done && trip.status === 'In transit' ? 'next' : ''}"><i>${i < trip.done ? icon('check') : i + 1}</i><span><strong>${esc(stop)}</strong><small>${i < trip.done ? 'Delivered' : i === trip.done && trip.status === 'In transit' ? 'Next stop' : 'Pending'}</small></span></li>`).join('')}</ol>` :
      none('This truck has no delivery stops.'))}
    ${panel('Trip activity', trip ? 'Newest first' : 'No history', trip ?
      `<ol class="ov-history">${trip.events.slice(0,5).map(([label,time]) => `<li><strong>${esc(label)}</strong><small>${esc(time)} WAT</small></li>`).join('')}</ol>` :
      none('Activity appears when this truck gets a trip.'))}
    ${panel('Vehicle and documents', esc(vehicle.id), `<dl class="ov-spec">${[['Driver',vehicle.driver],['Operator',vehicle.operator],['Type',vehicle.type],['Verification',vehicle.review]].map(([key,value]) => `<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
      <ul class="ov-docs">${rideDocs.map(name => `<li class="${received(name)?'yes':''}">${icon(received(name)?'check':'clock')}<span>${name}</span><small>${received(name)?'Received':'Missing'}</small></li>`).join('')}</ul>
      <a class="ov-more" href="#/truck/${esc(vehicle.id)}">Open truck record ${icon('chevron')}</a>`)}
  </div>`;
}

function overviewBrief(tasks) {
  const attention = active().filter(t => stale(truck(t.truck))).length;
  const most = Math.max(1,...tasks.map(task => task.count));
  const headline = attention ? `${plural(attention,'trip needs','trips need')} a position check.` :
    tasks.length ? 'No GPS alerts. A few items are waiting for you.' : 'Everything is on track.';
  return `<section class="ov-card ov-brief" aria-label="Operations brief">
    <p class="ov-flag">${auroraMark()}Operations brief · from workspace records</p>
    <h2>${headline}</h2>
    ${tasks.length ? `<div class="ov-brief-columns"><div><h3>Open items</h3>
    <ul class="ov-causes">${tasks.map(task => `<li><a href="#/${esc(task.path)}"><b>${String(task.count).padStart(2,'0')}</b><span>${task.cause}</span><progress value="${task.count}" max="${most}" aria-hidden="true"></progress></a></li>`).join('')}</ul></div>
    <div><h3>Next steps · for your review</h3>
    <div class="ov-tasks">${tasks.map(task => `<label class="ov-task"><input type="checkbox" value="${task.key}"><span><strong>${esc(task.title)}</strong><small>${task.note}</small></span></label>`).join('')}</div></div></div>` : ''}
    <div class="ov-brief-actions">${tasks.length ? btn('ov-review','Review selected','ov-primary') : ''}<button type="button" class="ov-text" data-action="ov-aurora">Ask Aurora</button></div>
  </section>`;
}

function overviewNetwork() {
  const moving = active().filter(t => trackingRoutes[t.id]);
  return `<a class="ov-card ov-network td-scope" href="#/tracking" aria-label="Open live tracking. ${plural(active().length,'truck')} on the road">
    <svg viewBox="185 78 680 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${trackingStreets}
      ${moving.map(t => {
        const {path,at} = trackingRoutes[t.id];
        const late = stale(truck(t.truck));
        const points = list => list.map(point => point.join(',')).join(' ');
        return `<polyline class="ov-line ${late?'late':''}" points="${points(path.slice(0,at+1))}"/><polyline class="ov-line ahead" points="${points(path.slice(at))}"/>
          <circle class="ov-truck-dot ${late?'late':''}" cx="${path[at][0]}" cy="${path[at][1]}" r="11"/><circle class="ov-end" cx="${path.at(-1)[0]}" cy="${path.at(-1)[1]}" r="9"/>`;
      }).join('')}
      <circle class="ov-depot" cx="${trackingDepot[0]}" cy="${trackingDepot[1]}" r="10"/></svg>
    <span class="ov-network-tag"><i></i><strong>Network</strong> ${active().length} on road</span>
    <span class="ov-network-open">Open live map ${icon('chevron')}</span>
  </a>`;
}

function overviewTimeline() {
  const trips = openTrips().concat(state.trips.filter(t => t.status === 'Delivered')).slice(0,6);
  const times = trips.flatMap(t => t.events.map(([,time]) => minutes(time))).filter(Number.isFinite);
  const latest = times.length ? Math.max(...times) : 600;
  const start = Math.floor((times.length ? Math.min(...times) : 480) / 60) * 60;
  const end = Math.max(start + 240, Math.ceil((latest + 60) / 60) * 60);
  const x = value => (value - start) / (end - start) * 1000;
  const ticks = [];
  for (let value = start; value <= end; value += Math.max(60, Math.ceil((end-start)/360) * 60)) ticks.push(value);
  // Bars are drawn in SVG so their positions need no inline styles.
  const bar = (from, to, look, text) => {
    const width = Math.max(70, x(to) - x(from));
    const left = Math.min(x(from), 1000 - width);
    return `<rect class="${look}" x="${left/10}%" y="8" width="${width/10}%" height="24" rx="12"/><text class="${look}" x="${(left+14)/10}%" y="24">${esc(text)}</text>`;
  };
  const marker = `<line class="ov-now" x1="${x(latest)/10}%" x2="${x(latest)/10}%" y1="0" y2="100%"/>`;
  return `<section class="ov-panel ov-timeline" aria-label="Dispatch timeline">
    <header><div><h2>Dispatch timeline</h2><small>From trip history. Open requests are dashed. The marker is the latest recorded event.</small></div><a class="ov-more" href="#/deliveries">Open deliveries ${icon('chevron')}</a></header>
    <div class="ov-scroll"><div class="ov-grid">
      <div class="ov-row head"><span>Driver</span><svg aria-hidden="true">${ticks.map((value,i) => Math.abs(x(value) - x(latest)) < 70 ? '' : `<text x="${x(value)/10}%" y="19" text-anchor="${i === 0 ? 'start' : value === end ? 'end' : 'middle'}">${clock(value)}</text>`).join('')}
        <rect class="ov-now-tag" x="${Math.min(x(latest)/10, 90)}%" y="5" width="46" height="21" rx="10" transform="translate(-23 0)"/><text class="ov-now-text" x="${Math.min(x(latest)/10, 90)}%" y="19" text-anchor="middle">${clock(latest)}</text></svg></div>
      ${trips.map(t => {
        const {name} = driverContact(truck(t.truck));
        const stamps = t.events.map(([,time]) => minutes(time)).filter(Number.isFinite);
        const first = Math.min(...stamps);
        const released = eventTime(t,/released/i);
        const status = trackingStatus(t);
        const look = {'Stale GPS':'late','In transit':'moving','Delivered':'done','Awaiting response':'request'}[status] || 'bay';
        const split = released ? minutes(released) : undefined;
        const bars = !stamps.length ? '' : split !== undefined && t.status === 'In transit' ?
          (split > first ? bar(first,split-4,'past','Loading') : '') + bar(split,Math.max(latest,split+30),look,t.id) :
          bar(first, t.status === 'Delivered' ? Math.max(...stamps) : t.status === 'Awaiting response' ? first + 90 : Math.max(latest,first+30), look, t.id);
        return `<a class="ov-row" href="#/trip/${esc(t.id)}" aria-label="${esc(name)}, ${esc(t.id)}, ${esc(status)}">
          <span class="ov-who">${driverAvatar(name)}<span><strong>${esc(name)}</strong><small>${esc(status)}</small></span></span>
          <svg aria-hidden="true">${marker}${bars}</svg></a>`;
      }).join('')}
    </div></div>
  </section>`;
}

function overviewBays() {
  const busy = loading();
  return `<section class="ov-panel" aria-label="Loading bays">
    <header><div><h2>Loading bays</h2><small>${plural(state.locations.reduce((sum,d) => sum + d.bays,0),'bay')} across ${plural(state.locations.length,'depot')}</small></div><a class="ov-more" href="#/loading">Open loading bay ${icon('chevron')}</a></header>
    <div class="ov-depots">${state.locations.map(depot => `<div><h3>${esc(depot.name)} <small>${esc(depot.area)}</small></h3>
      <ul>${Array.from({length:depot.bays},(_,i) => {
        const bay = 'Bay ' + String(i+1).padStart(2,'0');
        const t = busy.find(item => item.depot === depot.name && item.bay === bay);
        return t ? `<li class="busy"><a href="#/trip/${esc(t.id)}"><small>${bay}</small><strong>${esc(t.id)}</strong><span>${esc(t.status)}</span></a></li>` :
          `<li><span><small>${bay}</small><strong>Free</strong><span>No truck</span></span></li>`;
      }).join('')}</ul></div>`).join('')}</div>
  </section>`;
}

function overviewReadiness(list) {
  const groups = [
    ['On a trip', list.filter(r => r.trip).length, 'trip'],
    ['Ready for dispatch', list.filter(r => r.ready).length, 'free'],
    ['Waiting on verification', list.filter(r => !r.trip && r.vehicle.review !== 'Verified').length, 'review']
  ];
  const rest = list.length - groups.reduce((sum,[,count]) => sum + count,0);
  if (rest > 0) groups.push(['Other', rest, 'other']);
  let offset = 0;
  return `<section class="ov-panel" aria-label="Fleet readiness">
    <header><div><h2>Fleet readiness</h2><small>${plural(list.length,'truck')}</small></div><a class="ov-more" href="#/fleet">Fleet directory ${icon('chevron')}</a></header>
    <div class="ov-ready">
      <svg viewBox="0 0 42 42" role="img" aria-label="${esc(groups.map(([label,count]) => `${label}: ${count}`).join(', '))}">${groups.map(([,count,look]) => {
        const share = count / list.length * 100;
        const arc = `<circle class="${look}" cx="21" cy="21" r="15.915" pathLength="100" stroke-dasharray="${Math.max(0,share - .8)} ${100 - Math.max(0,share - .8)}" stroke-dashoffset="${25 - offset}"/>`;
        offset += share;
        return arc;
      }).join('')}<text x="21" y="21.500">${list.length}</text><text class="caption" x="21" y="27">trucks</text></svg>
      <ul>${groups.map(([label,count,look]) => `<li class="${look}"><i></i><span>${label}</span><strong>${count}</strong></li>`).join('')}</ul>
    </div>
  </section>`;
}

function dashboard() {
  const open = openTrips();
  const exceptions = active().filter(t => stale(truck(t.truck)));
  const delivered = state.trips.filter(t => t.status === 'Delivered');
  const reviews = state.fleet.filter(v => v.review === 'Pending review');
  const tasks = overviewTasks();
  const list = rides();
  const selected = list.find(ride => ride.vehicle.id === overviewRide) || list[0];
  const viewer = account();
  const time = localTime();
  const hour = Number(time.slice(0,2));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const stat = (label, value, badge, look, note, path) => `<a class="ov-stat" href="#/${path}"><span>${label}</span><b>${value}${badge ? `<em class="${look}">${badge}</em>` : ''}</b><small>${note}</small></a>`;
  const recent = state.trips.filter(t => !['Declined','Awaiting response'].includes(t.status)).slice(0,6);
  return `<header class="ov-head">
    <div><p>${esc(date())} · ${esc(time)} WAT</p><h1 tabindex="-1">${greeting}${viewer ? ', ' + esc(viewer.name.split(' ')[0]) : ''}</h1><p class="ov-sub">Here’s what needs your attention across today’s operation.</p></div>
    <div class="ov-tools">
      <button type="button" class="ov-search" data-action="search">${icon('search')}<span>Search trips, drivers, trucks</span></button>
      <button type="button" class="ov-monitor" data-action="ov-aurora">${auroraMark()}<strong>Aurora</strong><span>${plural(tasks.length,'open item')}</span></button>
      <a class="ov-new" href="#/available">${icon('truck')} Find a truck</a>
      <button type="button" class="ov-round" data-action="activity" aria-label="Notifications">${icon('bell')}${unreadCount()?'<i class="unread"></i>':''}</button>
      <a class="ov-round" href="#/help" aria-label="Help and support">${icon('help')}</a>
    </div>
  </header>
  <div class="ov-stats" aria-label="Dispatch totals">
    ${stat('Open trips',open.length,'','',`${plural(state.trips.length,'trip')} on record`,'deliveries')}
    ${stat('In transit',active().length,open.length ? Math.round(active().length/open.length*100)+'%' : '','calm','share of open trips','tracking')}
    ${stat('Delivered',delivered.length,'','',`${plural(delivered.reduce((sum,t)=>sum+t.done,0),'stop')} confirmed`,'deliveries')}
    ${stat('Stale GPS',exceptions.length,exceptions.length?'check':'','bad',exceptions.length?'position may be old':'all reporting','tracking')}
    ${stat('Ready trucks',available().length,'','',`${state.fleet.length} in the fleet`,'available')}
    ${stat('Verification',reviews.length,reviews.length?'pending':'','violet','truck registrations','verification')}
  </div>
  ${selected ? `<div class="ov-hero">${overviewStage(selected)}${overviewPicker(list,selected)}</div>${overviewDetails(selected)}` : empty('No vehicles yet','Registered trucks appear here.')}
  <div class="ov-two">${overviewBrief(tasks)}${overviewNetwork()}</div>
  ${overviewTimeline()}
  <div class="ov-two even">${overviewBays()}${overviewReadiness(list)}</div>
  <section class="ov-panel ov-recent"><header><div><h2>Recent deliveries</h2><small>Latest trips from your depots</small></div><a class="ov-more" href="#/deliveries">All deliveries ${icon('chevron')}</a></header>
    ${tripTable(recent,'Recent deliveries')}</section>`;
}

// ---- 3D truck: loaded only when the overview is open ----
let truckViewer, truckModule;
const loadTruckModule = () => (truckModule ||= import('./truck3d.js'));
function mountTruck(scope=app) {
  if (!scope.querySelector('[data-truck3d]')) return;
  loadTruckModule().then(module => {
    const host = scope.querySelector('[data-truck3d]');
    if (!host) return;
    truckViewer ||= module.createTruckViewer();
    truckViewer.mount(host,{type:host.dataset.type, plate:host.dataset.plate});
  }).catch(() => scope.querySelector('[data-truck3d]')?.classList.add('failed'));
}

function updateOverview(action, id) {
  if (action === 'ov-view') {
    if (id === 'left' || id === 'right') truckViewer?.turn(id === 'left' ? .5 : -.5);
    else truckViewer?.view(id);
    if (!truckViewer?.spinning) app.querySelector('[data-action="ov-spin"]')?.setAttribute('aria-pressed','false');
    return;
  }
  if (action === 'ov-spin') {
    app.querySelector('[data-action="ov-spin"]').setAttribute('aria-pressed',String(Boolean(truckViewer?.toggleSpin())));
    return;
  }
  const listScroll = app.querySelector('.ov-picker ul')?.scrollTop ?? 0;
  const page = window.scrollY;
  if (action === 'ov-filter') overviewFilter = id;
  if (action === 'ov-ride') overviewRide = id;
  if (action === 'ov-step') {
    const visible = [...app.querySelectorAll('.ov-picker li:not([hidden]) button')].map(button => button.dataset.id);
    if (!visible.length) return;
    const current = app.querySelector('.ov-picker button[data-action="ov-ride"][aria-pressed="true"]')?.dataset.id;
    const index = visible.indexOf(current);
    overviewRide = visible[index < 0 ? 0 : (index + Number(id) + visible.length) % visible.length];
  }
  render();
  window.scrollTo(0,page);
  const list = app.querySelector('.ov-picker ul');
  if (list) {
    list.scrollTop = listScroll;
    const chosen = list.querySelector('[aria-pressed="true"]')?.parentElement;
    if (chosen && action === 'ov-step') {
      const top = chosen.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + chosen.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - 8;
    }
  }
  app.querySelector(`[data-action="${action}"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
}
// Remember which sections the user has folded away.
document.addEventListener('toggle', event => {
  const section = event.target.dataset?.section;
  if (section) availableClosed[event.target.open ? 'delete' : 'add'](section);
}, true);
document.addEventListener('input', event => {
  if (event.target.id !== 'av-query') return;
  filters = {...filters,query:event.target.value.trim()};
  const query = filters.query.toLowerCase();
  let total = 0;
  app.querySelectorAll('.av-section').forEach(section => {
    const cards = [...section.querySelectorAll('.av-card')];
    cards.forEach(item => { item.hidden = !item.dataset.search.includes(query); });
    const count = cards.filter(item => !item.hidden).length;
    total += count;
    section.hidden = Boolean(query || filters.type || filters.operator || filters.status) && !count;
    if (query && count) section.open = true;
    app.querySelectorAll(`[data-count="${section.dataset.section}"]`).forEach(badge => { badge.textContent = count; });
  });
  app.querySelector('.av-empty').hidden = total > 0 || !query;
});
document.addEventListener('click', event => {
  app.querySelectorAll('.av-menu[open]').forEach(menu => { if (!menu.contains(event.target) && event.target.isConnected) menu.open = false; });
});
document.addEventListener('input', event => {
  if (event.target.id !== 'ride-search') return;
  overviewQuery = event.target.value.trim();
  const query = overviewQuery.toLowerCase();
  let count = 0;
  app.querySelectorAll('.ov-picker li').forEach(item => {
    item.hidden = !(item.dataset.groups.split(' ').includes(overviewFilter) && item.dataset.search.includes(query));
    if (!item.hidden) count++;
  });
  app.querySelector('.ov-picker-empty').hidden = count > 0;
});

function pickupTime(vehicle) {
  if (stale(vehicle)) return 'Stale GPS';
  return Number.isFinite(vehicle.eta) ? `${vehicle.eta} min` : 'ETA unavailable';
}
const availabilityStages = [
  ['', 'All available', 'truck'],
  ['fresh', 'Fresh GPS', 'pin'],
  ['nearby', 'Pickup within 20 min', 'clock'],
  ['stale', 'GPS needs update', 'warning']
];
function matchesAvailability(vehicle,status) {
  if (status === 'stale') return stale(vehicle);
  if (status === 'fresh') return !stale(vehicle);
  if (status === 'nearby') return !stale(vehicle) && Number.isFinite(vehicle.eta) && vehicle.eta <= 20;
  return true;
}
const availableText = v => `${v.id} ${v.plate} ${v.driver} ${v.operator} ${v.type} ${v.location}`.toLowerCase();

// Truck pictures are rendered from the 3D model, so each one matches its type and plate.
const truckPhoto = (vehicle, className) => {
  const key = `${vehicle.type}|${vehicle.plate}`;
  const saved = truckPhotos.get(key);
  return `<img class="${className}${saved ? ' ready' : ''}" data-photo="${esc(key)}" ${saved ? `src="${saved}"` : ''} alt="">`;
};

function availableCard(v) {
  const free = available().some(item => item.id === v.id);
  const trip = openTrips().find(t => t.truck === v.id);
  const late = stale(v);
  let chipText, look, route, title, value, share;
  if (free) {
    chipText = late ? 'GPS needs update' : 'Ready';
    look = late ? 'amber' : 'green';
    route = [v.location,'Demo Depot A'];
    title = 'Pickup ETA';
    value = late || !Number.isFinite(v.eta) ? 'Unavailable' : `${v.eta} min`;
    // A fuller bar means the truck is closer, on a one hour scale.
    share = late || !Number.isFinite(v.eta) ? 0 : Math.max(5, Math.round(100 - v.eta / 60 * 100));
  } else if (trip) {
    chipText = trackingStatus(trip);
    look = chipText === 'Stale GPS' ? 'red' : trip.status === 'In transit' ? 'violet' : 'amber';
    route = [trip.depot,trip.stops.at(-1)];
    title = 'Trip progress';
    share = Math.round(trip.status === 'In transit' ? 55 + 40 * trip.done / trip.stops.length : (trackingProgress[trip.status] ?? 0) * 100);
    value = `${trip.done} of ${trip.stops.length} stops`;
  } else {
    chipText = v.review === 'Verified' ? v.status : v.review;
    look = 'gray';
    route = [v.location, v.review === 'Verified' ? 'No open trip' : 'Awaiting approval'];
    title = 'Documents received';
    const count = v.review === 'Verified' ? 3 : v.docs?.length ?? 0;
    share = Math.round(count / 3 * 100);
    value = `${count} of 3`;
  }
  return `<li class="av-card" data-search="${esc(availableText(v))}">
    <div class="av-top">
      <span class="av-chip ${look}">${esc(chipText)}</span>
      <div class="av-name"><h3><a href="#/truck/${esc(v.id)}">${esc(v.plate)}</a></h3>
        <small>${esc(v.type)} • ${v.fresh == null ? 'No GPS' : `GPS ${esc(v.fresh)} min ago`}</small></div>
      <div class="av-photo">${icon('truck')}${truckPhoto(v,'')}</div>
      <button type="button" class="av-3d" data-action="av-preview" data-id="${esc(v.id)}">View in 3D</button>
    </div>
    <div class="av-info">
      <div class="av-line"><strong>${esc(route[0])} <span aria-label="to">→</span> ${esc(route[1])}</strong><small>${esc(v.driver)} • ${esc(v.operator)}</small></div>
      <div class="av-measure"><span>${title}</span><b>${esc(value)}</b></div>
      <svg class="av-bar ${look}" aria-hidden="true"><rect class="track" width="100%" height="100%" rx="3"/><rect class="fill" width="${share}%" height="100%" rx="3"/></svg>
    </div>
  </li>`;
}

// Each truck appears in exactly one section: the first one whose rule it matches.
const availableSections = [
  ['garage','Available in garage','Verified and free to take a trip','bay',(v,trip,free) => free],
  ['bay','At the loading bay','Accepted, arrived or loading','box',(v,trip) => ['Accepted','At bay','Loading'].includes(trip?.status)],
  ['road','On the road','Delivering now','truck',(v,trip) => trip?.status === 'In transit'],
  ['reply','Waiting for operator reply','A truck request has been sent','send',(v,trip) => trip?.status === 'Awaiting response'],
  ['approval','Waiting for approval','Documents need a review before dispatch','shield',v => v.review !== 'Verified'],
  ['other','Other trucks','Not free, with no open trip','clock',() => true]
];
function groupedTrucks() {
  const free = new Set(available().map(v => v.id));
  const groups = Object.fromEntries(availableSections.map(([key]) => [key,[]]));
  for (const v of state.fleet) {
    const trip = openTrips().find(t => t.truck === v.id);
    groups[availableSections.find(section => section[4](v,trip,free.has(v.id)))[0]].push(v);
  }
  return groups;
}

function availablePage() {
  const candidates = available();
  const types = optionField(state.fleet,'type','Vehicle type','All vehicle types');
  const operators = optionField(state.fleet,'operator','Operator','All operators');
  const query = (filters.query || '').toLowerCase().trim();
  const applied = ['type','operator'].filter(name => filters[name]).length;
  const filtering = Boolean(query || applied || filters.status);
  const groups = groupedTrucks();
  const sections = availableSections.map(([key,title,note,symbol]) => {
    // The totals at the top (GPS and pickup time) only narrow the garage.
    const trucks = groups[key].filter(v => matchesFields(v,'operator','type') && (!filters.status || (key === 'garage' && matchesAvailability(v,filters.status))));
    const count = trucks.filter(v => availableText(v).includes(query)).length;
    return {key,title,note,symbol,trucks,count,total:groups[key].length};
  }).filter(section => section.total || section.key !== 'other');
  const select = field => `<label class="field"><span>${field.label}</span><select data-av-filter="${field.name}"><option value="">${field.all}</option>${field.choices.map(([value,text]) => `<option value="${esc(value)}"${filters[field.name] === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  const stat = (status,symbol,title,note) => {
    const count = candidates.filter(v => matchesAvailability(v,status)).length;
    return `<button type="button" class="av-stat" data-action="status-filter" data-id="${status}" aria-pressed="${(filters.status || '') === status}">
      <span>${icon(symbol)}${title}</span><b>${String(count).padStart(2,'0')}</b><small>${note}</small></button>`;
  };
  return `<header class="av-head">
    <h1 tabindex="-1">Available trucks</h1>
    <div>
      <button type="button" class="av-button" data-action="av-refresh">${icon('refresh')} Refresh</button>
      <button type="button" class="av-button square" data-action="ov-aurora" aria-label="Ask Aurora" title="Ask Aurora">${icon('message')}</button>
      <button type="button" class="av-button square" data-action="activity" aria-label="Notifications" title="Notifications">${icon('bell')}${unreadCount()?'<i class="unread"></i>':''}</button>
      <a class="av-button square" href="#/help" aria-label="Help and support" title="Help and support">${icon('help')}</a>
      <a class="av-button primary" href="#/loading">${icon('bay')} Loading bay</a>
    </div>
  </header>
  <section class="av-panel" aria-labelledby="av-overview">
    <header><h2 id="av-overview">Availability overview</h2><span>Last refreshed: Today, ${esc(availableRefreshed || (availableRefreshed = localTime()))} WAT</span>
      <details class="av-menu"><summary aria-label="More options">${icon('more')}</summary><div><a href="#/fleet">Fleet directory</a><a href="#/tracking">Live tracking</a><a href="#/verification">Verification</a></div></details></header>
    <div class="av-stats" role="group" aria-label="Filter trucks in the garage">
      ${stat('','truck','Available in garage','Verified and free')}
      ${stat('fresh','pin','Fresh GPS','Updated within 15 minutes')}
      ${stat('nearby','clock','Pickup within 20 min','To Demo Depot A')}
      ${stat('stale','warning','GPS needs update','Confirm the location')}
    </div>
  </section>
  <div class="av-bar-top">
    <nav class="av-jumps" aria-label="Jump to a section">${sections.map(section => `<button type="button" data-action="av-jump" data-id="${section.key}">${esc(section.title)}<em data-count="${section.key}">${section.count}</em></button>`).join('')}</nav>
    <div class="av-tools">
      <label class="av-search">${icon('search')}<input type="search" id="av-query" value="${esc(filters.query)}" placeholder="Search all trucks" aria-label="Search all trucks"></label>
      <details class="av-menu wide" ${availableMenuOpen ? 'open' : ''}><summary class="av-button">${icon('filter')} Filter${applied ? ` <em>${applied}</em>` : ''}</summary>
        <div>${select(types)}${select(operators)}<button type="button" class="av-button" data-action="clear-filters">Clear filters</button></div></details>
      <div class="av-switch" role="group" aria-label="Choose a view">${[['grid','Grid'],['list','List']].map(([key,text]) => `<button type="button" data-action="av-layout" data-id="${key}" aria-pressed="${availableLayout === key}">${icon(key)} ${text}</button>`).join('')}</div>
    </div>
  </div>
  ${sections.map(section => `<details class="av-panel av-section ${section.key}" id="av-section-${section.key}" data-section="${section.key}" ${availableClosed.has(section.key) ? '' : 'open'} ${filtering && !section.count ? 'hidden' : ''}>
    <summary><span class="av-section-icon">${icon(section.symbol)}</span>
      <span><h2>${esc(section.title)} <em data-count="${section.key}">${section.count}</em></h2><small>${esc(section.note)}</small></span>
      ${icon('chevron')}</summary>
    ${section.trucks.length ? `<ul class="av-grid ${availableLayout}">${section.trucks.map(v => availableCard(v).replace('<li class="av-card"', `<li class="av-card" ${availableText(v).includes(query) ? '' : 'hidden'}`)).join('')}</ul>` : `<p class="av-none">No trucks in this section right now.</p>`}
  </details>`).join('')}
  <div class="av-panel av-empty" role="status" ${sections.some(section => section.count) || !filtering ? 'hidden' : ''}>${icon('truck')}<p>No trucks match. Clear your search or filters.</p><button type="button" class="av-button" data-action="clear-filters">Clear filters</button></div>`;
}

function mountPhotos() {
  const images = [...app.querySelectorAll('img[data-photo]:not(.ready)')];
  if (!images.length) return;
  loadTruckModule().then(module => module.truckPicture).then(async picture => {
    for (const image of app.querySelectorAll('img[data-photo]:not(.ready)')) {
      const [type,plate] = image.dataset.photo.split('|');
      if (!truckPhotos.has(image.dataset.photo)) truckPhotos.set(image.dataset.photo, await picture(type,plate));
      image.src = truckPhotos.get(image.dataset.photo);
      image.classList.add('ready');
    }
  }).catch(() => {});  // The truck icon stays when the browser cannot draw 3D.
}

function previewTruck(id) {
  const v = truck(id);
  if (!v) return;
  openModal(v.plate, `<div class="av-preview"><div class="ov-3d" data-truck3d data-type="${esc(v.type)}" data-plate="${esc(v.plate)}">${truckFallback}</div>
    <div class="av-views" role="group" aria-label="3D view">${[['angle','Angle'],['side','Side'],['front','Front'],['rear','Rear']].map(([key,text]) => `<button type="button" class="av-button" data-action="ov-view" data-id="${key}">${text}</button>`).join('')}<small>Drag the truck to turn it</small></div></div>
    ${kv([['Driver',v.driver],['Operator',v.operator],['Vehicle type',v.type],['Last location',v.location]])}
    <div class="detail-actions actions">${link('truck/'+v.id,'Open truck record','primary')}</div>`);
  modal.classList.add('preview-dialog');
  mountTruck(modal);
}

// ---- Shared page parts, matching the Deliveries layout ----
function listHeader(title, searchText) {
  const viewer = account();
  return `<header class="dv-head">
    <h1 tabindex="-1">${title}</h1>
    <button type="button" class="dv-global" data-action="search">${icon('search')}<span>${searchText}</span><kbd>Ctrl K</kbd></button>
    <div>
      <button type="button" class="dv-round" data-action="ov-aurora" aria-label="Ask Aurora" title="Ask Aurora">${icon('message')}</button>
      <button type="button" class="dv-round" data-action="activity" aria-label="Notifications, ${unreadCount()} unread" title="Notifications">${icon('bell')}${unreadCount()?'<i class="unread"></i>':''}</button>
      <button type="button" class="dv-round dv-me" data-action="account-settings" aria-label="Account settings" title="Account settings">${viewer ? esc(initials(viewer.name)) : icon('user')}</button>
    </div>
  </header>`;
}
const statButtons = (label, action, pressed, items) => `<div class="dv-stats" role="group" aria-label="${label}">${items.map(([key,symbol,title,value,note]) => `<button type="button" data-action="${action}" data-id="${key}" aria-pressed="${pressed === key}">
  <i>${icon(symbol)}</i><span><span>${title}</span><b>${value}</b><small>${note}</small></span></button>`).join('')}</div>`;
const choiceField = (attribute, value, label, allText, choices) => `<label class="dv-field"><span>${label}</span><select ${attribute}><option value="">${allText}</option>${choices.map(([key,text]) => `<option value="${esc(key)}"${value === key ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
const findField = (attribute, value, placeholder) => `<label class="dv-field dv-find"><span>Search</span><span>${icon('search')}<input type="search" ${attribute} value="${esc(value)}" placeholder="${placeholder}"></span></label>`;
function pager(action, view, total, pages, noun) {
  const start = (view.page - 1) * view.size;
  return `<footer class="dv-footer"><span role="status">Showing ${total ? start + 1 : 0} to ${Math.min(total,start + view.size)} of ${plural(total,noun)}</span>
    <nav aria-label="Pages"><button type="button" data-action="${action}" data-id="${view.page - 1}" ${view.page === 1 ? 'disabled' : ''} aria-label="Previous page" class="dv-prev">${icon('chevron')}</button>
      ${Array.from({length:pages},(_,i) => `<button type="button" data-action="${action}" data-id="${i+1}" ${view.page === i+1 ? 'aria-current="page"' : ''}>${i+1}</button>`).join('')}
      <button type="button" data-action="${action}" data-id="${view.page + 1}" ${view.page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron')}</button></nav></footer>`;
}

// ---- Loading bay ----
const bayStages = ['Accepted','At bay','Loading'];
const bayStageName = status => status === 'Accepted' ? 'Awaiting arrival' : status;
const bayAction = status => ({Accepted:'Record arrival','At bay':'Start loading',Loading:'Confirm loaded and release'})[status];
const bayMinutes = t => t.arrivalAt ? Math.max(0,Math.floor((Date.now() - t.arrivalAt) / 60000)) : t.arrived ?? null;
const bayTime = t => { const value = bayMinutes(t); return value === null ? '—' : value < 60 ? `${value} min` : `${Math.floor(value/60)} hr ${value % 60} min`; };
const baySteps = status => {
  const stage = bayStages.indexOf(status);
  return `<span class="lb-steps" role="img" aria-label="Step ${stage + 1} of 3: ${bayStageName(status)}">${bayStages.map((_,i) => `<i class="${i <= stage ? 'on' : ''}"></i>`).join('')}</span>`;
};

function bayRecords() {
  const query = bayView.query.toLowerCase().trim();
  return loading().filter(t => !bayView.stage || t.status === bayView.stage)
    .filter(t => !bayView.depot || t.depot === bayView.depot)
    .filter(t => !bayView.type || truck(t.truck)?.type === bayView.type)
    .filter(t => !query || [t.id,t.depot,t.bay,...t.stops,truck(t.truck)?.plate,truck(t.truck)?.driver,truck(t.truck)?.operator].join(' ').toLowerCase().includes(query))
    .sort((a,b) => bayStages.indexOf(b.status) - bayStages.indexOf(a.status) || (bayMinutes(b) ?? 0) - (bayMinutes(a) ?? 0));
}
function bayResults() {
  const records = bayRecords();
  const filtered = bayView.query || bayView.stage || bayView.depot || bayView.type;
  if (!records.length) return `<div class="dv-empty">${icon('bay')}<h2>${filtered ? 'No bay trips match' : 'The queue is clear'}</h2><p>${filtered ? 'Try a different search or filter.' : 'Trips appear here once an operator accepts a truck request.'}</p>${filtered ? '<button type="button" class="dv-button" data-action="lb-reset">Clear filters</button>' : ''}</div>`;
  return `<div class="dv-scroll"><table class="dv-table lb-table">
    <thead><tr>${['Driver','Vehicle','Destination','Depot and bay','Time at bay','Progress','Stage','Next step','Actions'].map(text => `<th scope="col" class="${text === 'Actions' ? 'dv-actions' : ''}">${text}</th>`).join('')}</tr></thead>
    <tbody>${records.map(t => {
      const vehicle = truck(t.truck);
      const {name} = driverContact(vehicle);
      return `<tr data-trip="${esc(t.id)}">
        <td class="dv-driver" data-label="Driver"><div>${driverAvatar(name)}<span><strong><a href="#/trip/${esc(t.id)}">${esc(name)}</a></strong><small>#${esc(t.id)}</small></span></div></td>
        <td data-label="Vehicle"><strong>${esc(vehicle?.type)}</strong><small>${esc(vehicle?.plate)}</small></td>
        <td data-label="Destination"><strong>${esc(t.stops.at(-1))}</strong><small>${plural(t.stops.length,'stop')}</small></td>
        <td data-label="Depot and bay"><strong>${esc(t.bay || 'No bay yet')}</strong><small>${esc(t.depot)}</small></td>
        <td data-label="Time at bay">${bayTime(t)}</td>
        <td data-label="Progress">${baySteps(t.status)}</td>
        <td data-label="Stage"><span class="dv-pill ${t.status === 'Loading' ? 'bay' : t.status === 'At bay' ? 'road' : 'request'}">${bayStageName(t.status)}</span></td>
        <td data-label="Next step"><button type="button" class="dv-button solid lb-next" data-action="stage" data-id="${esc(t.id)}">${bayAction(t.status)}</button></td>
        <td class="dv-actions"><button type="button" data-action="dv-menu" data-id="${esc(t.id)}" aria-haspopup="true" aria-expanded="false" aria-label="Actions for ${esc(t.id)}">${icon('more')}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <footer class="dv-footer"><span role="status">${plural(records.length,'trip')} in the queue</span></footer>`;
}

function bayDock() {
  const busy = loading();
  const depots = state.locations.filter(depot => !bayView.depot || depot.name === bayView.depot);
  return depots.map(depot => {
    const bays = Array.from({length:depot.bays},(_,i) => 'Bay ' + String(i+1).padStart(2,'0'));
    const used = bays.filter(bay => busy.some(t => t.depot === depot.name && t.bay === bay)).length;
    return `<div class="lb-depot"><header><h3>${esc(depot.name)}</h3><small>${esc(depot.area)}</small><span>${used} of ${depot.bays} in use</span></header>
      <ul>${bays.map(bay => {
        const t = busy.find(item => item.depot === depot.name && item.bay === bay);
        if (!t) return `<li class="lb-bay free"><span class="lb-bay-name">${bay}</span><div>${icon('plus')}<strong>Free bay</strong><small>Ready for a truck</small></div></li>`;
        const vehicle = truck(t.truck);
        return `<li class="lb-bay busy ${t.status === 'Loading' ? 'loading' : 'arrived'}"><span class="lb-bay-name">${bay}</span>
          <span class="lb-bay-photo">${icon('truck')}${truckPhoto(vehicle,'')}</span>
          <div><strong><a href="#/trip/${esc(t.id)}">${esc(vehicle.plate)}</a></strong><small>${esc(t.id)} to ${esc(t.stops.at(-1))}</small>
            <p><span class="dv-pill ${t.status === 'Loading' ? 'bay' : 'road'}">${esc(t.status)}</span><span>${bayTime(t)}</span></p>
            ${baySteps(t.status)}
            <button type="button" class="dv-button solid" data-action="stage" data-id="${esc(t.id)}">${bayAction(t.status)}</button></div></li>`;
      }).join('')}</ul></div>`;
  }).join('');
}

function loadingPage() {
  const trips = loading();
  const capacity = state.locations.reduce((sum,depot) => sum + depot.bays,0);
  const occupied = trips.filter(t => t.bay && t.status !== 'Accepted').length;
  const count = status => trips.filter(t => t.status === status).length;
  const requests = pending();
  const released = state.trips.filter(t => eventTime(t,/released/i)).sort((a,b) => eventTime(b,/released/i).localeCompare(eventTime(a,/released/i))).slice(0,4);
  const row = (t,detail,end) => { const {name} = driverContact(truck(t.truck)); return `<li>${driverAvatar(name)}<span><strong><a href="#/trip/${esc(t.id)}">${esc(truck(t.truck)?.plate)}</a></strong><small>${esc(t.id)} · ${detail}</small></span>${end}</li>`; };
  return `${listHeader('Loading bay','Search driver, truck or trip…')}
    ${statButtons('Filter the queue by stage','lb-stat',bayView.stage,[
      ['','bay','All bay trips',trips.length,'In the loading workflow'],
      ['Accepted','clock','Awaiting arrival',count('Accepted'),'Accepted by operator'],
      ['At bay','pin','At bay',count('At bay'),'Ready to load'],
      ['Loading','box','Loading',count('Loading'),'Being loaded now'],
      ['free','plus','Free bays',capacity - occupied,`of ${capacity} across depots`]
    ])}
    <section class="lb-section" aria-labelledby="lb-dock-title">
      <header><div><h2 id="lb-dock-title">Dock board</h2><small>What is in each bay right now</small></div>
        <span class="lb-use"><progress value="${occupied}" max="${Math.max(capacity,1)}" aria-label="${occupied} of ${capacity} bays in use"></progress>${occupied} of ${capacity} bays in use</span></header>
      <div id="lb-dock">${bayDock()}</div>
    </section>
    <div class="dv-filters">
      ${findField('data-lb-field="query"',bayView.query,'Bay queue…')}
      ${choiceField('data-lb-field="stage"',bayView.stage,'Stage','All stages',bayStages.map(stage => [stage,bayStageName(stage)]))}
      ${choiceField('data-lb-field="depot"',bayView.depot,'Depot','All depots',state.locations.map(d => [d.name,d.name]))}
      ${choiceField('data-lb-field="type"',bayView.type,'Vehicle','All types',[...new Set(state.fleet.map(v => v.type))].map(type => [type,type]))}
      <div class="dv-primary"><a class="dv-button solid" href="#/available">${icon('truck')} Find a truck</a></div>
    </div>
    <h2 class="lb-title" id="lb-queue" tabindex="-1">Bay queue</h2>
    <section id="lb-results" aria-labelledby="lb-queue">${bayResults()}</section>
    <div class="lb-pair">
      <section class="lb-card"><header><h2>Coming next</h2><small>Truck requests waiting for an operator reply</small></header>
        ${requests.length ? `<ul>${requests.map(t => row(t,esc(t.depot),btn('respond','Simulate reply','secondary',t.id))).join('')}</ul>` : '<p class="lb-none">No requests are waiting.</p>'}</section>
      <section class="lb-card"><header><h2>Recently released</h2><small>Latest trucks to leave the bay</small></header>
        ${released.length ? `<ul>${released.map(t => row(t,'to '+esc(t.stops.at(-1)),`<span class="lb-time"><strong>${esc(eventTime(t,/released/i))}</strong><small>WAT</small></span>`)).join('')}</ul>` : '<p class="lb-none">No trucks have been released yet.</p>'}</section>
    </div>`;
}

function refreshBays(focus) {
  closeRowMenu();
  const results = app.querySelector('#lb-results');
  if (!results) return;
  results.innerHTML = bayResults();
  app.querySelector('#lb-dock').innerHTML = bayDock();
  app.querySelectorAll('[data-action="lb-stat"]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.id === bayView.stage)));
  app.querySelectorAll('[data-lb-field]').forEach(field => { if (field !== document.activeElement) field.value = bayView[field.dataset.lbField]; });
  mountPhotos();
  if (focus) app.querySelector(focus)?.focus({preventScroll:true});
}
function updateBays(action, id) {
  if (action === 'lb-reset') Object.assign(bayView,{query:'', stage:'', depot:'', type:''});
  if (action === 'lb-stat') {
    if (id === 'free') {
      app.querySelector('.lb-section')?.scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      return;
    }
    bayView.stage = id;
  }
  refreshBays();
}

// ---- Notifications ----
const noticeKinds = {
  alert:['Alert','warning'], bay:['Loading bay','bay'], request:['Truck request','send'], delivery:['Delivery','check'], fleet:['Fleet','shield'], update:['Update','bell']
};
const noticeKey = ([title,detail,time]) => `${title}|${detail}|${time}`;
function noticeKind(title) {
  if (/GPS|declined/i.test(title)) return 'alert';
  if (/loading|arriv|released/i.test(title)) return 'bay';
  if (/request/i.test(title)) return 'request';
  if (/deliver/i.test(title)) return 'delivery';
  if (/regist|verif/i.test(title)) return 'fleet';
  return 'update';
}
function notices() {
  return state.activity.map(entry => {
    const [title,detail,time] = entry;
    const key = noticeKey(entry);
    const tripId = detail.match(/MD-\d+/)?.[0];
    const vehicle = state.fleet.find(v => detail.includes(v.plate));
    const path = tripId && trip(tripId) ? 'trip/' + tripId : vehicle ? 'truck/' + vehicle.id : '';
    return {key, title, detail, time, kind:noticeKind(title), unread:!noticesRead.has(key), path};
  });
}
const unreadCount = () => state.activity.filter(entry => !noticesRead.has(noticeKey(entry))).length;
function saveNoticesRead() {
  try { localStorage.setItem('mouka-read-notices',JSON.stringify([...noticesRead].slice(-200))); } catch {}
}
function noticeRecords() {
  const query = noticeView.query.toLowerCase().trim();
  return notices()
    .filter(n => !noticeView.kind || (noticeView.kind === 'unread' ? n.unread : noticeView.kind === 'movement' ? ['delivery','request'].includes(n.kind) : n.kind === noticeView.kind))
    .filter(n => !noticeView.read || (noticeView.read === 'unread') === n.unread)
    .filter(n => !query || `${n.title} ${n.detail} ${noticeKinds[n.kind][0]}`.toLowerCase().includes(query));
}
function noticeResults() {
  const records = noticeRecords();
  const pages = Math.max(1,Math.ceil(records.length / noticeView.size));
  noticeView.page = Math.min(Math.max(1,noticeView.page),pages);
  const rows = records.slice((noticeView.page - 1) * noticeView.size,noticeView.page * noticeView.size);
  const filtered = noticeView.query || noticeView.kind || noticeView.read;
  const picked = notices().filter(n => noticePicked.has(n.key));
  return `${picked.length ? `<div class="dv-selection" role="status"><strong>${plural(picked.length,'notification')} selected</strong>
      <button type="button" data-action="nt-mark" data-id="read">${icon('check')} Mark as read</button><button type="button" data-action="nt-mark" data-id="unread">Mark as unread</button><button type="button" data-action="nt-unpick">Clear selection</button></div>` : ''}
    ${rows.length ? `<div class="nt-head"><label><input type="checkbox" data-nt-check="page" ${rows.every(n => noticePicked.has(n.key)) ? 'checked' : ''}> <span>Select all on this page</span></label><span>Today · newest first</span></div>
    <ul class="nt-list">${rows.map(n => `<li class="${n.unread ? 'unseen' : ''} ${noticePicked.has(n.key) ? 'picked' : ''}">
      <input type="checkbox" data-nt-check="row" value="${esc(n.key)}" ${noticePicked.has(n.key) ? 'checked' : ''} aria-label="Select ${esc(n.title)}, ${esc(n.detail)}">
      <span class="nt-icon ${n.kind}">${icon(noticeKinds[n.kind][1])}</span>
      <div class="nt-copy"><strong>${esc(n.title)}${n.unread ? '<i aria-label="Unread"></i>' : ''}</strong><small>${esc(n.detail)}</small></div>
      <span class="nt-kind ${n.kind}">${noticeKinds[n.kind][0]}</span>
      <time>${esc(n.time)} <small>WAT</small></time>
      <div class="nt-actions">${n.path ? `<button type="button" class="dv-button" data-action="nt-open" data-id="${esc(n.key)}">View</button>` : ''}
        <button type="button" class="nt-toggle" data-action="nt-toggle" data-id="${esc(n.key)}" aria-label="${n.unread ? 'Mark as read' : 'Mark as unread'}" title="${n.unread ? 'Mark as read' : 'Mark as unread'}">${icon(n.unread ? 'check' : 'mail')}</button></div>
    </li>`).join('')}</ul>` :
    `<div class="dv-empty">${icon('bell')}<h2>${filtered ? 'No notifications match' : 'You’re all caught up'}</h2><p>${filtered ? 'Try a different search or filter.' : 'New dispatch activity appears here.'}</p>${filtered ? '<button type="button" class="dv-button" data-action="nt-reset">Clear filters</button>' : ''}</div>`}
    ${pager('nt-page',noticeView,records.length,pages,'notification')}`;
}
function notificationsPage() {
  const all = notices();
  const count = test => all.filter(test).length;
  const tasks = overviewTasks();
  return `${listHeader('Notifications','Search driver, truck or trip…')}
    ${statButtons('Filter notifications','nt-stat',noticeView.kind,[
      ['','bell','All notifications',all.length,'Dispatch activity'],
      ['unread','mail','Unread',count(n => n.unread),'Waiting for you'],
      ['alert','warning','Alerts',count(n => n.kind === 'alert'),'GPS and declined requests'],
      ['bay','bay','Loading bay',count(n => n.kind === 'bay'),'Arrivals and releases'],
      ['movement','truck','Trips',count(n => ['delivery','request'].includes(n.kind)),'Requests and deliveries']
    ])}
    <div class="dv-filters">
      ${findField('data-nt-field="query"',noticeView.query,'Notifications…')}
      ${choiceField('data-nt-field="kind"',['unread','movement'].includes(noticeView.kind) ? '' : noticeView.kind,'Type','All types',Object.entries(noticeKinds).map(([key,[label]]) => [key,label]))}
      ${choiceField('data-nt-field="read"',noticeView.read,'Read status','Read and unread',[['unread','Unread only'],['read','Read only']])}
      <div class="dv-primary"><button type="button" class="dv-button solid" data-action="nt-all" ${unreadCount() ? '' : 'disabled'}>${icon('check')} Mark all as read</button></div>
    </div>
    <div class="nt-layout">
      <section id="nt-results" aria-label="Notification list">${noticeResults()}</section>
      <aside class="lb-card nt-tasks" aria-labelledby="nt-tasks-title"><header><h2 id="nt-tasks-title">Needs your action</h2><small>Open items in dispatch right now</small></header>
        ${tasks.length ? `<ul>${tasks.map(task => `<li><a href="#/${esc(task.path)}">${tile(task.symbol,task.key === 'gps' ? 'amber' : '')}<span><strong>${esc(task.title)}</strong><small>${esc(task.note)}</small></span>${icon('chevron')}</a></li>`).join('')}</ul>` : '<p class="lb-none">Nothing needs action.</p>'}
      </aside>
    </div>`;
}

// Keeps the unread dots and sidebar count in step without redrawing the page.
function syncUnread() {
  const count = unreadCount();
  app.querySelectorAll('[data-unread-count]').forEach(badge => { badge.textContent = count; badge.hidden = !count; });
  if (!count) app.querySelectorAll('.unread').forEach(dot => dot.remove());
}
function refreshNotices(focus) {
  const results = app.querySelector('#nt-results');
  if (!results) return;
  results.innerHTML = noticeResults();
  const values = Object.fromEntries(notices().map(n => [n.key,n.unread]));
  const unreadStat = app.querySelector('[data-action="nt-stat"][data-id="unread"] b');
  if (unreadStat) unreadStat.textContent = Object.values(values).filter(Boolean).length;
  app.querySelectorAll('[data-action="nt-stat"]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.id === noticeView.kind)));
  app.querySelectorAll('[data-nt-field]').forEach(field => {
    if (field !== document.activeElement) field.value = field.dataset.ntField === 'kind' && ['unread','movement'].includes(noticeView.kind) ? '' : noticeView[field.dataset.ntField];
  });
  const markAll = app.querySelector('[data-action="nt-all"]');
  if (markAll) markAll.disabled = !unreadCount();
  syncUnread();
  if (focus) (app.querySelector(focus) || app.querySelector('#nt-results input, #nt-results button:not(:disabled)'))?.focus({preventScroll:true});
}
function updateNotices(action, id) {
  const keySelector = (name) => `[data-action="${name}"][data-id="${CSS.escape(id)}"]`;
  if (action === 'nt-open') {
    const item = notices().find(n => n.key === id);
    noticesRead.add(id);
    saveNoticesRead();
    if (item?.path) location.hash = '/' + item.path;
    return;
  }
  if (action === 'nt-toggle') noticesRead[noticesRead.has(id) ? 'delete' : 'add'](id);
  if (action === 'nt-all') notices().forEach(n => noticesRead.add(n.key));
  if (action === 'nt-mark') { noticePicked.forEach(key => noticesRead[id === 'read' ? 'add' : 'delete'](key)); noticePicked.clear(); }
  if (action === 'nt-unpick') noticePicked.clear();
  if (['nt-toggle','nt-all','nt-mark'].includes(action)) saveNoticesRead();
  if (action === 'nt-stat') Object.assign(noticeView,{kind:id, read:'', page:1});
  if (action === 'nt-page') noticeView.page = Number(id);
  if (action === 'nt-reset') Object.assign(noticeView,{query:'', kind:'', read:'', page:1});
  refreshNotices(action === 'nt-toggle' ? keySelector('nt-toggle') : action === 'nt-page' ? '.dv-footer [aria-current="page"]' : '');
}

document.addEventListener('input', event => {
  const data = event.target.dataset || {};
  if (data.lbField === 'query') { bayView.query = event.target.value; refreshBays(); }
  if (data.ntField === 'query') { Object.assign(noticeView,{query:event.target.value, page:1}); refreshNotices(); }
});
document.addEventListener('change', event => {
  const {lbField, ntField, ntCheck} = event.target.dataset || {};
  if (lbField && lbField !== 'query') { bayView[lbField] = event.target.value; refreshBays(); }
  if (ntField && ntField !== 'query') { Object.assign(noticeView,{[ntField]:event.target.value, page:1}); refreshNotices(); }
  if (ntCheck) {
    const boxes = ntCheck === 'page' ? [...app.querySelectorAll('[data-nt-check="row"]')] : [event.target];
    const keys = boxes.map(box => box.value);
    keys.forEach(key => noticePicked[event.target.checked ? 'add' : 'delete'](key));
    refreshNotices(ntCheck === 'page' ? '[data-nt-check="page"]' : `[data-nt-check="row"][value="${CSS.escape(event.target.value)}"]`);
  }
});

// Tracking Delivery screen. Route shapes, progress and driver contacts are sample values for the UI.
const trackingOrder = ['In transit','Loading','At bay','Accepted','Awaiting response','Delivered'];
// Positions on the drawn street map. "at" is the point the truck has reached.
const trackingDepot = [470,105];
const trackingRoutes = {
  'MD-0042': {path:[trackingDepot,[540,105],[540,215],[505,245],[505,300],[470,345],[470,390],[605,430],[605,470],[665,470],[665,510]], at:4},
  'MD-0041': {path:[trackingDepot,[420,150],[420,255],[385,290],[385,350],[435,390],[435,490],[505,510]], at:4}
};
// An illustrative city map, so the screen works offline and needs no map service.
const trackingStreets = (() => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const steps = (from, to, min, spread) => {
    const list = [from];
    while (list.at(-1) < to) list.push(Math.round(list.at(-1) + min + random() * spread));
    return list;
  };
  const line = (d, kind) => `<path class="${kind}" d="${d}"/>`;
  const columns = steps(-160, 1180, 24, 30);
  const rows = steps(-200, 800, 18, 24);
  let buildings = '';
  for (let i = 0; i < columns.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const width = columns[i+1] - columns[i] - 6;
      const height = rows[j+1] - rows[j] - 6;
      for (let x = 0; x < width - 5;) {
        const size = Math.min(width - x, Math.round(6 + random() * 16));
        if (random() > .28) buildings += `M${columns[i]+3+x} ${rows[j]+3}h${size-2}v${Math.round(height * (.5 + random() * .5))}h${2-size}z`;
        x += size;
      }
    }
  }
  const grid = columns.map((x,i) => line(`M${x} -220V820`, i % 6 === 2 ? 'avenue' : 'street')).join('') +
    rows.map((y,i) => line(`M-180 ${y}H1200`, i % 7 === 3 ? 'avenue' : 'street')).join('');
  return `<rect class="land" width="1000" height="600"/>
    <g transform="rotate(-13 500 300)"><path class="building" d="${buildings}"/>${grid}</g>
    <path class="water-area" d="M262 -20 L318 -20 C330 60 292 128 340 196 C372 244 352 330 392 392 C420 440 398 520 440 620 L372 620 C340 530 368 462 336 410 C292 340 318 262 280 204 C236 138 276 60 262 -20Z M690 -20 C672 60 742 120 724 190 C708 252 760 282 850 262 C930 244 960 300 1020 292 L1020 360 C940 372 900 322 838 336 C730 362 640 300 662 212 C678 140 618 84 640 -20Z M540 620 C560 540 650 520 700 458 C752 396 860 424 1020 400 L1020 452 C890 470 790 448 748 500 C700 560 628 560 612 620Z"/>
    ${line('M318 150 C420 130 470 180 560 150 S650 120 660 130','water')}
    ${line('M-20 430 C100 400 180 450 330 412','water')}
    ${line('M-20 196 C150 232 260 180 420 232 S700 190 1020 96','highway')}
    ${line('M176 -20 C190 150 330 270 398 392 S560 520 598 620','highway')}
    ${line('M300 620 C420 490 560 470 650 372 S800 150 836 -20','highway')}
    ${line('M-20 548 C180 500 360 556 520 470 S860 520 1020 486','highway minor')}
    `;
})();
const trackingPlaces = [[432,112],[432,372],[726,520],[700,236]];
const trackingVehicle = `<svg viewBox="0 0 24 44" aria-hidden="true">
  <rect x="3" y="2" width="18" height="40" rx="5" fill="#fff" stroke="#1f2933" stroke-width="1.4"/>
  <path d="M5.5 8q6.5-4 13 0l-1 6h-11z" fill="#1f2933"/>
  <rect x="5.5" y="17" width="13" height="22" rx="1.5" fill="#eef0f2" stroke="#9aa4ad"/>
  <path d="M1.5 11h2m17 0h2" stroke="#1f2933" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
const trackingTruckIcon = `<svg class="td-truck-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.5h12.5V17H2zM15.5 9H19l3 4v4h-6.5z"/><circle cx="6.5" cy="17.5" r="2.3"/><circle cx="17.5" cy="17.5" r="2.3"/></svg>`;
const trackingProgress = {'Awaiting response':0,'Accepted':.08,'At bay':.14,'Loading':.2,'Delivered':1};
const trackingTrips = () => state.trips.filter(t => trackingOrder.includes(t.status))
  .sort((a,b) => trackingOrder.indexOf(a.status) - trackingOrder.indexOf(b.status) ||
    Number(stale(truck(a.truck))) - Number(stale(truck(b.truck))));
const trackingStatus = t => t.status === 'In transit' && stale(truck(t.truck)) ? 'Stale GPS' : t.status;
function driverContact(vehicle) {
  const number = String(vehicle?.driver?.match(/\d+/)?.[0] ?? 0);
  return {
    name: vehicle?.driver || 'Driver unassigned',
    email: `sample-driver-${number.padStart(2,'0')}@example.com`,
    phone: `+234 000 000 ${number.padStart(4,'0')}`
  };
}
// Illustrated portraits stand in for driver photos.
const avatarLooks = [['#f2d8c9','#8a5638','#2b211d','#2f6f62'],['#d9e4ee','#6f432c','#17120f','#374759'],
  ['#f4e3c4','#a56c47','#241a14','#8c4a3c'],['#dde8da','#5c3826','#120e0c','#3f5f8a']];
function driverAvatar(name) {
  const [back,skin,hair,shirt] = avatarLooks[Number(name.match(/\d+/)?.[0] ?? 0) % avatarLooks.length];
  return `<svg class="td-avatar" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="${back}"/>
    <path d="M6 40c1-9 7-12 14-12s13 3 14 12z" fill="${shirt}"/><path d="M16.5 22h7v8q-3.5 3-7 0z" fill="${skin}"/>
    <ellipse cx="20" cy="17.5" rx="7.8" ry="9" fill="${skin}"/>
    <path d="M12 17c-1-8 3-11 8-11s9 3 8 11c-1-4-2-5-3-6-3 2-8 2-11 1-1 1-2 3-2 5z" fill="${hair}"/></svg>`;
}
const trackingStamp = time => `20 Nov 2026 at ${time}`;
const trackingChip = status => {
  const [label,look] = {'In transit':['Transit','transit'],'Delivered':['Delivered','done'],'Awaiting response':['Pending','pending'],'Stale GPS':['Stale GPS','stale']}[status] || [status,'pending'];
  return `<span class="td-chip ${look}">${esc(label)}</span>`;
};

function trackingCard(t, selected) {
  const vehicle = truck(t.truck);
  const {name} = driverContact(vehicle);
  const status = trackingStatus(t);
  const progress = t.status === 'In transit' ? .55 + .4 * t.done / t.stops.length : trackingProgress[t.status];
  return `<li class="td-card ${selected?'selected':''} ${status === 'Stale GPS'?'is-stale':''}">
    <button type="button" class="td-card-select" data-action="track-select" data-id="${esc(t.id)}" aria-pressed="${selected}" aria-label="Track ${esc(t.id)} to ${esc(t.stops.at(-1))}"></button>
    <div class="td-card-top"><span class="td-box">${icon('box')}</span><strong>#${esc(t.id)}</strong>${trackingChip(status)}</div>
    <div class="td-progress" style="--progress:${progress}" aria-hidden="true">
      <i class="td-dot start"></i><i class="td-line"></i><span class="td-truck">${trackingTruckIcon}</span><i class="td-dot end"></i>
    </div>
    <div class="td-route">
      <span>${esc(t.depot)},<br>${esc(state.locations.find(d => d.name === t.depot)?.area || vehicle?.plate)}</span>
      <span>${esc(t.stops.at(-1))},<br>${t.done} of ${t.stops.length} ${t.stops.length === 1 ? 'stop' : 'stops'} done</span>
    </div>
    <div class="td-driver">
      ${driverAvatar(name)}<span><b>${esc(name)}</b><small>Driver</small></span>
      <button type="button" class="td-contact" data-action="track-call" data-id="${esc(t.id)}" aria-label="Call ${esc(name)}" title="Call driver">${icon('phone')}</button>
      <button type="button" class="td-contact" data-action="track-message" data-id="${esc(t.id)}" aria-label="Message ${esc(name)}" title="Message driver">${icon('mail')}</button>
    </div>
  </li>`;
}

function trackingMap(selected, trips) {
  const vehicle = truck(selected?.truck);
  const route = selected?.status === 'In transit' ? trackingRoutes[selected.id] : undefined;
  const points = list => list.map(p => p.join(',')).join(' ');
  const place = ([x,y]) => `left:${x/10}%;top:${y/6}%`;
  const others = trips.filter(t => t.status === 'In transit' && t.id !== selected?.id && trackingRoutes[t.id]);
  const truckPoint = id => trackingRoutes[id].path[trackingRoutes[id].at];
  const position = route ? truckPoint(selected.id) : undefined;
  const ahead = route?.path[route.at+1];
  const heading = ahead ? Math.round(Math.atan2(ahead[1]-position[1],ahead[0]-position[0]) * 180 / Math.PI + 90) : 0;
  const caption = !selected ? '' : selected.status !== 'In transit' ?
    (selected.status === 'Delivered' ? 'This trip is complete. There is no live position.' : 'This truck has not left the depot yet.') :
    stale(vehicle) ? `Last GPS update ${vehicle?.fresh ?? '—'} min ago. The position may be out of date.` : '';
  return `<section class="td-map" aria-label="Delivery map with sample positions">
    <div class="td-stage"><div class="td-layer" style="transform:scale(${zoom})">
      <svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        ${trackingStreets}
        ${route ? `<polyline class="td-path ahead" points="${points(route.path.slice(route.at))}"/>
        <polyline class="td-path done ${stale(vehicle)?'stale':''}" points="${points(route.path.slice(0,route.at+1))}"/>` : ''}
      </svg>
      ${trackingPlaces.map(point => `<span class="td-place" style="${place(point)}" aria-hidden="true"><i></i></span>`).join('')}
      <span class="td-stop pickup" style="${place(trackingDepot)}"><em>Pickup</em><i></i></span>
      ${route ? `<span class="td-stop dropoff" style="${place(route.path.at(-1))}"><i></i><em>Dropoff</em></span>` : ''}
      ${others.map(t => `<button type="button" class="td-other ${stale(truck(t.truck))?'stale':''}" style="${place(truckPoint(t.id))}" data-action="track-select" data-id="${esc(t.id)}" aria-label="Track ${esc(t.id)}" title="${esc(t.id)}">${icon('truck')}</button>`).join('')}
      ${position ? `<span class="td-vehicle ${stale(vehicle)?'stale':''}" style="${place(position)}" role="img" aria-label="${esc(vehicle.plate)} position"><span style="transform:rotate(${heading}deg)">${trackingVehicle}</span></span>` : ''}
    </div></div>
    ${caption ? `<p class="td-caption" role="status">${icon(selected.status === 'In transit' ? 'warning' : 'info')}<span>${esc(caption)}</span></p>` : ''}
    <div class="td-zoom">
      <button type="button" data-action="track-zoom-reset" data-id="" aria-label="Reset map view" title="Reset map view">${icon('target')}</button>
      <span><button type="button" data-action="track-zoom-out" data-id="" aria-label="Zoom out">${icon('minus')}</button>
      <output>${Math.round(zoom*100)}%</output>
      <button type="button" data-action="track-zoom-in" data-id="" aria-label="Zoom in">${icon('plus')}</button></span>
    </div>
    <p class="td-sample">Illustrative map</p>
  </section>`;
}

function trackingDriverCard(t) {
  const {name,email,phone} = driverContact(truck(t.truck));
  const contactRow = (symbol, value, label) => `<div class="td-copy-row">${icon(symbol)}<span>${esc(value)}</span>
    <button type="button" data-action="track-copy" data-id="${esc(value)}" aria-label="Copy ${label}" title="Copy ${label}">${icon('copy')}</button></div>`;
  return `<section class="td-float td-profile" aria-label="Driver details">
    <div class="td-driver">${driverAvatar(name)}<span><b>${esc(name)}</b><small>Driver · ${esc(truck(t.truck)?.operator)}</small></span></div>
    ${contactRow('mail',email,'email')}${contactRow('phone',phone,'phone number')}
  </section>`;
}

function trackingActivity(t) {
  const entries = [
    ...(t.comments || []).map(([text,time]) => [text,time,'comment']),
    ...t.events.map(([text,time]) => [text,time,''])
  ];
  const item = ([text,time,kind]) => `<li class="${kind}"><b>${esc(text)}</b><small>${kind ? 'Comment · ' : ''}${esc(trackingStamp(time))}</small></li>`;
  const toggle = label => `<li class="td-more-row"><button type="button" class="td-more" data-action="track-more" data-id="">${label}</button></li>`;
  const hidden = entries.length - 3;
  const rows = hidden > 0 && !trackAllActivity ?
    entries.slice(0,2).map(item).join('') + toggle(`Show ${hidden} more ${hidden === 1 ? 'activity' : 'activities'}`) + item(entries.at(-1)) :
    entries.map(item).join('') + (hidden > 0 ? toggle('Show less') : '');
  return `<section class="td-float td-activity" aria-labelledby="td-activity-title">
    <header><h2 id="td-activity-title">Activity</h2><kbd>esc</kbd>
      <button type="button" data-action="track-activity" data-id="" aria-label="Close activity">${icon('close')}</button></header>
    <form class="td-comment" data-form="track-comment" data-id="${esc(t.id)}" novalidate>
      <textarea name="comment" aria-label="Leave a comment on ${esc(t.id)}" placeholder="Leave a comment" maxlength="300" rows="2"></textarea>
      <button type="submit">Post</button>
    </form>
    <ol>${rows}</ol>
  </section>`;
}

function trackingPage() {
  const trips = trackingTrips();
  const selected = trips.find(t => t.id === trackSelection) || trips[0];
  return `<div class="td-board">
    <section class="td-list" aria-label="Tracked deliveries">
      <header><h1 tabindex="-1">Tracking Delivery</h1>
        <details class="td-menu"><summary aria-label="Tracking options" title="Tracking options">${icon('more')}</summary>
          <div>${selected ? `<a href="#/trip/${esc(selected.id)}">Trip details</a>` : ''}<a href="#/deliveries">All deliveries</a><a href="#/loading">Loading bay</a></div></details></header>
      ${trips.length ? `<ul>${trips.map(t => trackingCard(t, t === selected)).join('')}</ul>` : empty('No deliveries to track','New assignments appear here.')}
    </section>
    <div class="td-view">
      ${trackingMap(selected, trips)}
      ${selected ? `<div class="td-side">${trackingDriverCard(selected)}
        ${trackActivityOpen ? trackingActivity(selected) : `<button type="button" class="td-float td-reopen" data-action="track-activity" data-id="">${icon('clock')} Show activity</button>`}</div>` : ''}
    </div>
  </div>`;
}

function updateTracking(action, id) {
  const scroll = app.querySelector('.td-list > ul')?.scrollTop ?? 0;
  if (action==='track-select') { trackSelection = id; trackActivityOpen = true; trackAllActivity = false; }
  if (action==='track-activity') trackActivityOpen = !trackActivityOpen;
  if (action==='track-more') trackAllActivity = !trackAllActivity;
  if (action==='track-zoom-in') zoom = Math.min(2.5,Math.round((zoom+.25)*100)/100);
  if (action==='track-zoom-out') zoom = Math.max(1,Math.round((zoom-.25)*100)/100);
  if (action==='track-zoom-reset') zoom = 1;
  render();
  const list = app.querySelector('.td-list > ul');
  if (list) list.scrollTop = scroll;
  const target = action==='track-select' ? `[data-action="track-select"][data-id="${CSS.escape(id)}"]` :
    action==='track-activity' ? (trackActivityOpen ? '.td-activity header button' : '.td-reopen') : `[data-action="${action}"]`;
  app.querySelector(target)?.focus({preventScroll:true});
}

// ---- Deliveries ----
const deliveryStatuses = [['request','Awaiting reply'],['bay','At loading bay'],['road','In transit'],['done','Delivered'],['declined','Declined']];
function deliveryInfo(t) {
  const vehicle = truck(t.truck);
  const contact = driverContact(vehicle);
  const late = t.status === 'In transit' && stale(vehicle);
  const group = {'Awaiting response':'request','Accepted':'bay','At bay':'bay','Loading':'bay','In transit':'road','Delivered':'done','Declined':'declined'}[t.status] || 'bay';
  const label = {'Awaiting response':'Awaiting reply','In transit':'In transit'}[t.status] || t.status;
  const eta = t.status === 'In transit' ? (late ? 'Needs fresh GPS' : t.eta || 'Pending') : t.status === 'Delivered' ? 'Completed' : '—';
  return {t, vehicle, contact, late, group, label, eta, location:vehicle?.location || 'Unavailable'};
}
const deliverySorts = {
  driver:r => r.contact.name, destination:r => r.t.stops.at(-1), vehicle:r => r.vehicle?.plate || '',
  stops:r => r.t.done / r.t.stops.length, status:r => r.label, location:r => r.location, trip:r => r.t.id
};
function deliveryRecords() {
  const query = deliveryView.query.toLowerCase().trim();
  const value = deliverySorts[deliveryView.sort];
  return state.trips.map(deliveryInfo)
    .filter(r => !deliveryView.status || (deliveryView.status === 'stale' ? r.late : r.group === deliveryView.status))
    .filter(r => !deliveryView.type || r.vehicle?.type === deliveryView.type)
    .filter(r => !deliveryView.depot || r.t.depot === deliveryView.depot)
    .filter(r => !query || [r.t.id,...r.t.stops,r.t.depot,r.contact.name,r.contact.email,r.contact.phone,r.vehicle?.plate,r.vehicle?.operator,r.location].join(' ').toLowerCase().includes(query))
    .sort((a,b) => String(value(a)).localeCompare(String(value(b)),undefined,{numeric:true}) * deliveryView.dir);
}

function deliveryResults() {
  const records = deliveryRecords();
  const pages = Math.max(1,Math.ceil(records.length / deliveryView.size));
  deliveryView.page = Math.min(Math.max(1,deliveryView.page),pages);
  const start = (deliveryView.page - 1) * deliveryView.size;
  const rows = records.slice(start,start + deliveryView.size);
  const chosen = state.trips.filter(t => deliveryPicked.has(t.id)).length;
  const heading = (key,text) => `<th scope="col" ${deliveryView.sort === key ? `aria-sort="${deliveryView.dir > 0 ? 'ascending' : 'descending'}"` : ''}><button type="button" data-action="dv-sort" data-id="${key}">${text}<i aria-hidden="true"></i></button></th>`;
  const check = (action,id,checked,text) => `<input type="checkbox" data-dv-check="${action}" value="${esc(id)}" ${checked?'checked':''} aria-label="${esc(text)}">`;
  const cell = (label,main,sub,extra='') => `<td data-label="${label}" ${extra}><strong>${main}</strong>${sub ? `<small>${sub}</small>` : ''}</td>`;
  const filtered = deliveryView.query || deliveryView.status || deliveryView.type || deliveryView.depot;
  return `${chosen ? `<div class="dv-selection" role="status"><strong>${plural(chosen,'delivery','deliveries')} selected</strong>
      <button type="button" data-action="dv-export">${icon('download')} Export selected</button><button type="button" data-action="dv-unpick">Clear selection</button></div>` : ''}
    ${rows.length ? `<div class="dv-scroll"><table class="dv-table">
      <thead><tr><th scope="col" class="dv-check">${check('page','',rows.every(r => deliveryPicked.has(r.t.id)),'Select every delivery on this page')}</th>
        ${heading('driver','Driver')}<th scope="col">Contact</th>${heading('vehicle','Vehicle')}${heading('destination','Destination')}${heading('stops','Stops')}<th scope="col">ETA</th>${heading('status','Status')}${heading('location','Last location')}<th scope="col" class="dv-actions">Actions</th></tr></thead>
      <tbody>${rows.map(r => `<tr data-trip="${esc(r.t.id)}" class="${deliveryPicked.has(r.t.id)?'picked':''}">
        <td class="dv-check">${check('row',r.t.id,deliveryPicked.has(r.t.id),'Select '+r.t.id)}</td>
        <td class="dv-driver" data-label="Driver"><div>${driverAvatar(r.contact.name)}<span><strong><a href="#/trip/${esc(r.t.id)}">${esc(r.contact.name)}</a></strong><small>#${esc(r.t.id)}</small></span></div></td>
        ${cell('Contact',esc(r.contact.phone),esc(r.contact.email),'class="dv-contact"')}
        ${cell('Vehicle',esc(r.vehicle?.type),esc(r.vehicle?.plate))}
        ${cell('Destination',esc(r.t.stops.at(-1)),'From '+esc(r.t.depot))}
        <td data-label="Stops"><strong>${r.t.done} of ${r.t.stops.length}</strong><progress value="${r.t.done}" max="${r.t.stops.length}" aria-label="${r.t.done} of ${r.t.stops.length} stops confirmed"></progress></td>
        <td data-label="ETA" class="${r.late?'dv-warn':''}">${esc(r.eta)}</td>
        <td data-label="Status"><span class="dv-pill ${r.late?'late':r.group}">${esc(r.late ? 'Stale GPS' : r.label)}</span></td>
        <td data-label="Last location">${esc(r.location)}</td>
        <td class="dv-actions"><button type="button" data-action="dv-menu" data-id="${esc(r.t.id)}" aria-haspopup="true" aria-expanded="false" aria-label="Actions for ${esc(r.t.id)}">${icon('more')}</button></td>
      </tr>`).join('')}</tbody></table></div>` :
      `<div class="dv-empty">${icon('box')}<h2>No deliveries match</h2><p>Try a different search or filter.</p>${filtered ? '<button type="button" class="dv-button" data-action="dv-reset">Clear filters</button>' : ''}</div>`}
    <footer class="dv-footer">
      <span role="status">Showing ${records.length ? start + 1 : 0} to ${start + rows.length} of ${plural(records.length,'delivery','deliveries')}</span>
      <label>Rows <select data-dv-field="size">${[5,10,20].map(size => `<option ${deliveryView.size === size ? 'selected' : ''}>${size}</option>`).join('')}</select></label>
      <nav aria-label="Pages"><button type="button" data-action="dv-page" data-id="${deliveryView.page - 1}" ${deliveryView.page === 1 ? 'disabled' : ''} aria-label="Previous page" class="dv-prev">${icon('chevron')}</button>
        ${Array.from({length:pages},(_,i) => `<button type="button" data-action="dv-page" data-id="${i+1}" ${deliveryView.page === i+1 ? 'aria-current="page"' : ''}>${i+1}</button>`).join('')}
        <button type="button" data-action="dv-page" data-id="${deliveryView.page + 1}" ${deliveryView.page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron')}</button></nav>
    </footer>`;
}

function deliveriesPage() {
  const all = state.trips.map(deliveryInfo);
  const count = test => all.filter(test).length;
  const viewer = account();
  const stats = [
    ['','box','All deliveries',all.length,'Every trip on record'],
    ['road','truck','In transit',count(r => r.group === 'road'),'On the road now'],
    ['bay','bay','At loading bay',count(r => r.group === 'bay'),'Accepted or loading'],
    ['done','check','Delivered',count(r => r.group === 'done'),`${plural(state.trips.reduce((sum,t) => sum + t.done,0),'stop')} confirmed`],
    ['stale','warning','Stale GPS',count(r => r.late),'Position may be old']
  ];
  const select = (field,label,allText,choices) => `<label class="dv-field"><span>${label}</span><select data-dv-field="${field}"><option value="">${allText}</option>${choices.map(([value,text]) => `<option value="${esc(value)}"${deliveryView[field] === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  return `<header class="dv-head">
    <h1 tabindex="-1">Deliveries</h1>
    <button type="button" class="dv-global" data-action="search">${icon('search')}<span>Search driver, truck or trip…</span><kbd>Ctrl K</kbd></button>
    <div>
      <button type="button" class="dv-round" data-action="ov-aurora" aria-label="Ask Aurora" title="Ask Aurora">${icon('message')}</button>
      <button type="button" class="dv-round" data-action="activity" aria-label="Notifications" title="Notifications">${icon('bell')}${unreadCount()?'<i class="unread"></i>':''}</button>
      <button type="button" class="dv-round dv-me" data-action="account-settings" aria-label="Account settings" title="Account settings">${viewer ? esc(initials(viewer.name)) : icon('user')}</button>
    </div>
  </header>
  <div class="dv-stats" role="group" aria-label="Filter by delivery status">${stats.map(([key,symbol,label,value,note]) => `<button type="button" data-action="dv-stat" data-id="${key}" aria-pressed="${deliveryView.status === key}">
    <i>${icon(symbol)}</i><span><span>${label}</span><b>${value}</b><small>${note}</small></span></button>`).join('')}</div>
  <div class="dv-filters">
    <label class="dv-field dv-find"><span>Search</span><span>${icon('search')}<input type="search" data-dv-field="query" value="${esc(deliveryView.query)}" placeholder="Deliveries…"></span></label>
    ${select('status','Status','All status',[...deliveryStatuses,['stale','Stale GPS']])}
    ${select('type','Vehicle','All types',[...new Set(state.fleet.map(v => v.type))].map(type => [type,type]))}
    ${select('depot','Pickup depot','All depots',state.locations.map(depot => [depot.name,depot.name]))}
    <div class="dv-primary"><a class="dv-button solid" href="#/available">${icon('truck')} Find a truck</a>
      <button type="button" class="dv-button solid square" data-action="dv-export" aria-label="Export deliveries as a spreadsheet file" title="Export as CSV">${icon('download')}</button></div>
  </div>
  <section id="dv-results" aria-label="Delivery records">${deliveryResults()}</section>`;
}

// Redraws only the table, so the search box keeps its focus.
function refreshDeliveries(focus) {
  closeRowMenu();
  const results = app.querySelector('#dv-results');
  if (!results) return;
  results.innerHTML = deliveryResults();
  app.querySelectorAll('[data-action="dv-stat"]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.id === deliveryView.status)));
  app.querySelectorAll('[data-dv-field]').forEach(field => { if (field !== document.activeElement && field.dataset.dvField !== 'size') field.value = deliveryView[field.dataset.dvField]; });
  if (focus) app.querySelector(focus)?.focus({preventScroll:true});
}

function exportDeliveries() {
  const picked = state.trips.filter(t => deliveryPicked.has(t.id)).map(deliveryInfo);
  const records = picked.length ? picked : deliveryRecords();
  if (!records.length) return toast('There are no deliveries to export.','error');
  // A leading apostrophe stops spreadsheet programs treating a value as a formula.
  const safeCell = value => `"${String(value ?? '').replace(/^(?=[=+\-@\t\r])/,"'").replace(/"/g,'""')}"`;
  const lines = [['Trip','Driver','Vehicle type','Plate','Operator','Pickup depot','Destination','Stops confirmed','Total stops','Status','ETA','Last location'],
    ...records.map(r => [r.t.id,r.contact.name,r.vehicle?.type,r.vehicle?.plate,r.vehicle?.operator,r.t.depot,r.t.stops.at(-1),r.t.done,r.t.stops.length,r.late?'Stale GPS':r.label,r.eta,r.location])];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.map(line => line.map(safeCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const download = Object.assign(document.createElement('a'),{href:url, download:'mouka-deliveries.csv'});
  download.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  toast(`Exported ${plural(records.length,'delivery','deliveries')}.`);
}

// The row menu floats above the page so a scrolling table cannot cut it off.
function closeRowMenu(restore=false) {
  const menu = document.querySelector('.dv-menu');
  if (!menu) return;
  const opener = app.querySelector(`[data-action="dv-menu"][data-id="${CSS.escape(menu.dataset.id)}"]`);
  menu.remove();
  opener?.setAttribute('aria-expanded','false');
  if (restore) opener?.focus({preventScroll:true});
}
function openRowMenu(button, id) {
  const wasOpen = document.querySelector('.dv-menu')?.dataset.id === id;
  closeRowMenu();
  if (wasOpen) return;
  const t = trip(id);
  const next = {'Awaiting response':['respond','Simulate operator response'],'Accepted':['stage','Record arrival'],'At bay':['stage','Start loading'],'Loading':['stage','Confirm loaded and release'],'In transit':['deliver','Confirm next stop']}[t.status];
  const item = (action,symbol,text) => `<button type="button" data-action="${action}" data-id="${esc(id)}">${icon(symbol)}${text}</button>`;
  const menu = document.createElement('div');
  menu.className = 'dv-menu';
  menu.dataset.id = id;
  menu.innerHTML = `<a href="#/trip/${esc(id)}">${icon('box')}View trip</a>
    ${t.status === 'In transit' ? item('dv-track','pin','Track on map') : ''}
    ${next ? item(next[0],'check',next[1]) : ''}
    ${item('track-call','phone','Call driver')}
    <a href="#/truck/${esc(t.truck)}">${icon('truck')}Truck record</a>`;
  document.body.append(menu);
  const box = button.getBoundingClientRect();
  const below = box.bottom + menu.offsetHeight + 8 < innerHeight;
  menu.style.top = `${(below ? box.bottom + 6 : box.top - menu.offsetHeight - 6) + scrollY}px`;
  menu.style.left = `${Math.max(8,box.right - menu.offsetWidth) + scrollX}px`;
  button.setAttribute('aria-expanded','true');
  menu.querySelector('a').focus({preventScroll:true});
}

function updateDeliveries(action, id, element) {
  if (action === 'dv-menu') return openRowMenu(element,id);
  if (action === 'dv-export') return exportDeliveries();
  if (action === 'dv-track') {
    trackPending = id;
    location.hash = '/tracking';
    return;
  }
  if (action === 'dv-stat') Object.assign(deliveryView,{status:id, page:1});
  if (action === 'dv-page') deliveryView.page = Number(id);
  if (action === 'dv-sort') Object.assign(deliveryView,{dir:deliveryView.sort === id ? -deliveryView.dir : 1, sort:id, page:1});
  if (action === 'dv-reset') Object.assign(deliveryView,{query:'', status:'', type:'', depot:'', page:1});
  if (action === 'dv-unpick') deliveryPicked.clear();
  refreshDeliveries(action === 'dv-page' ? '.dv-footer [aria-current="page"]' : action === 'dv-sort' ? `[data-action="dv-sort"][data-id="${id}"]` : '');
}

document.addEventListener('input', event => {
  if (event.target.dataset?.dvField !== 'query') return;
  Object.assign(deliveryView,{query:event.target.value, page:1});
  refreshDeliveries();
});
document.addEventListener('change', event => {
  const {dvField, dvCheck} = event.target.dataset || {};
  if (dvField && dvField !== 'query') {
    Object.assign(deliveryView,{[dvField]:dvField === 'size' ? Number(event.target.value) : event.target.value, page:1});
    refreshDeliveries(dvField === 'size' ? '[data-dv-field="size"]' : '');
  }
  if (dvCheck) {
    const boxes = dvCheck === 'page' ? [...app.querySelectorAll('[data-dv-check="row"]')] : [event.target];
    boxes.forEach(box => deliveryPicked[event.target.checked ? 'add' : 'delete'](box.value));
    refreshDeliveries(dvCheck === 'page' ? '[data-dv-check="page"]' : `[data-dv-check="row"][value="${event.target.value}"]`);
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.dv-menu, [data-action="dv-menu"]')) closeRowMenu();
  else if (event.target.closest('.dv-menu a, .dv-menu button')) setTimeout(closeRowMenu);
  const row = event.target.closest('.dv-table tbody tr');
  if (row && !event.target.closest('a,button,input,label') && window.getSelection()?.isCollapsed !== false) location.hash = '/trip/' + row.dataset.trip;
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.querySelector('.dv-menu')) closeRowMenu(true); });
window.addEventListener('resize', () => closeRowMenu());
window.addEventListener('hashchange', () => closeRowMenu());

function fleetPage() {
  const vehicles = vehicleField(state.fleet);
  const fields = [vehicles,optionField(state.fleet,'type','Vehicle type','All vehicle types'),optionField(state.fleet,'operator','Operator','All operators')];
  const records = state.fleet.filter(t=>match(t) && (!filters.vehicle || t.id===filters.vehicle) && matchesFields(t,'type','operator'));
  return head('Fleet directory','Browse third-party operators, drivers and registered trucks.') +
    stageStrip('Fleet status',state.fleet,[['','All trucks','truck'],['Verified','Verified','shield'],['Pending review','Pending review','clock'],['Needs corrections','Needs corrections','warning']]) +
    card('Registered fleet','',
      controls('Search plate, driver or operator',['Available','Assigned','Verified','Pending review','Needs corrections','Rejected'],fields) +
      table(['Truck','Operator','Driver','Last location','Verification'],records.map(t=>[
        registryIdentity(t.plate,`${t.id} · ${t.type}`,'truck','truck/'+t.id,vehicles.numbers.get(t.id)),
        esc(t.operator),esc(t.driver),esc(t.location),registryStatus(t.review)
      ]),'Registered fleet',{mobile:['Operator','Verification']}));
}
function verificationPage() {
  const records = state.fleet.filter(t=>t.review!=='Verified');
  const vehicles = vehicleField(records);
  const fields = [vehicles,optionField(records,'type','Vehicle type','All vehicle types'),optionField(records,'operator','Operator','All operators')];
  const items = records.filter(t=>match(t) && (!filters.vehicle || t.id===filters.vehicle) && matchesFields(t,'type','operator'));
  return head('Verification','Review registration documents before approving a vehicle.') +
    stageStrip('Registration status',records,[['','All registrations','truck'],['Pending review','Pending review','clock'],['Needs corrections','Needs corrections','warning'],['Rejected','Rejected','close']]) +
    card('Truck registrations','',controls('Search registrations',['Pending review','Needs corrections','Rejected'],fields) +
      table(['Truck','Operator','Documents','Status'],items.map(t=>[
        registryIdentity(t.plate,t.id,'shield','truck/'+t.id,vehicles.numbers.get(t.id)),esc(t.operator),
        registryProgress(t.docs?.length ?? 0,3,`${t.docs?.length ?? 0} of 3 received`),registryStatus(t.review)
      ]),'Truck registrations',{blank:records.length?'No registrations match your filters.':'All registrations have been verified.',mobile:['Documents','Status']}));
}
function usersPage() {
  const users = numberedField(state.users,'email','email','Staff account','All staff',u=>u.name);
  const fields = [users,optionField(state.users,'role','Workspace role','All roles')];
  const records = state.users.filter(u=>match(u) && matchesFields(u,'email','role'));
  return head('Users & permissions','Manage roles for Mouka workspace staff.',btn('invite','Create demo invitation','primary','','plus')) +
    stageStrip('Staff status',state.users,[['','All staff','users'],['Active','Active accounts','check'],['Invited','Open invitations','send'],['Suspended','Suspended','warning']]) +
    card('Staff accounts','',controls('Search staff',['Active','Invited','Suspended'],fields) +
      table(['Name','Email','Role','Status'],records.map(u=>[
        `<button type="button" class="registry-identity staff-edit" data-action="edit-user" data-id="${esc(u.email)}" aria-label="Edit ${esc(u.name)}"><span class="registry-emblem">${users.numbers.get(u.email)}</span><strong>${esc(u.name)}</strong><span class="registry-open">${icon('chevron')}</span></button>`,
        esc(u.email),esc(u.role),registryStatus(u.status)]),
        'Staff accounts',{mobile:['Role','Status']}));
}
function depotsPage() {
  const depots = numberedField(state.locations,'name','name','Depot','All depots',d=>d.name);
  const fields = [depots,optionField(state.locations,'area','State','All states'),optionField(state.locations,'bays','Loading bays','Any bay count')];
  const records = state.locations.filter(d=>match(d) && matchesFields(d,'name','area','bays'));
  return head('Depot settings','Manage dispatch locations and loading bay capacity.',btn('new-depot','Add depot','primary','','plus')) +
    statsStrip('Depot capacity',[['Depots',state.locations.length,'pin'],['Loading bays',state.locations.reduce((sum,d)=>sum+d.bays,0),'bay']]) +
    card('Dispatch locations','',controls('Search depots',[],fields) +
      table(['Depot','State','Loading bays',''],records.map(d=>[registryIdentity(d.name,'','pin','',depots.numbers.get(d.name)),esc(d.area),
        `<span class="registry-capacity">${icon('bay')} <strong>${esc(d.bays)}</strong></span>`,btn('edit-depot','Edit','secondary registry-action',d.name,'settings')]),
        'Dispatch locations'));
}
function tripProgress(status) {
  const stages = [
    ['Requested','send',['Awaiting response']],
    ['Accepted','check',['Accepted']],
    ['At loading bay','bay',['At bay','Loading']],
    ['On the road','truck',['In transit']],
    ['Delivered','box',['Delivered']]
  ];
  const currentStage = stages.findIndex(([, , values]) => values.includes(status));
  if (currentStage < 0) return '';
  return `<ol class="trip-progress card" aria-label="Delivery progress">${stages.map(([label,symbol],index) =>
    `<li class="${index <= currentStage?'reached':''}" ${index === currentStage?'aria-current="step"':''}>
      <span>${icon(index < currentStage?'check':symbol)}</span><strong>${label}</strong>
    </li>`).join('')}</ol>`;
}
function tripDetail(id) {
  const t = trip(id);
  if (!t) return notFound('Trip not found');
  const v = truck(t.truck);
  const stageAction = ({Accepted:'Record arrival','At bay':'Start loading',Loading:'Confirm loaded and release'})[t.status];
  const actions = t.status==='Awaiting response' ? btn('respond','Simulate operator response','primary',t.id) :
    stageAction ? btn('stage',stageAction,'primary',t.id) :
    t.status==='In transit' ? btn('deliver','Confirm next stop','primary',t.id) :
    t.status==='Declined' ? link('available','Available trucks','primary') : '';
  return head(t.id,`${t.depot} to ${t.stops.at(-1)}`,actions) +
    (t.reason ? `<div class="notice-region">${notice(`Operator declined: ${t.reason}`,'error')}</div>` :
      t.status==='In transit' && stale(v) ? `<div class="notice-region">${notice('The last GPS update has expired. A fresh location is needed to estimate arrival.','warn')}</div>` : '') + tripProgress(t.status) +
    `<div class="split">${card('Trip details','',body(kv([['Status',t.status],['Truck',v?.plate],['Operator',v?.operator],['Driver',v?.driver],['Loading bay',t.bay || 'Pending'],['Destination ETA',t.status==='In transit' && !stale(v) ? t.eta || 'Pending' : '—'],
    ['Loading time',t.loadMinutes===undefined ? '—' : t.loadMinutes+' min']])+
    `<div class="section-bottom"><h3>Delivery stops</h3><ol class="list-stops">${t.stops.map((s,i)=>`<li>${esc(s)} · ${i<t.done?chip('Delivered'):chip('Pending')}</li>`).join('')}</ol></div>`))}
    ${card('Trip history','',body(`<ol class="timeline">${t.events.map(([s,time])=>`<li><strong>${esc(s)}</strong><br><small>${esc(time)} WAT</small></li>`).join('')}</ol>`))}</div>`;
}
function truckDetail(id) {
  const t = truck(id);
  if (!t) return notFound('Truck not found');
  const isAvailable = available().some(v=>v.id===t.id);
  return head(t.plate,`${t.id} · ${t.operator}`,link('fleet','Fleet directory')) +
    `<div class="split">${card('Vehicle details','',body(kv([['Operator',t.operator],['Driver',t.driver],['Vehicle type',t.type],['Last location',t.location],['GPS update',t.fresh == null ? 'Unavailable' : `${t.fresh} min ago`],['Availability',isAvailable?'Available':t.status==='Available'?'Reserved':t.status],['Verification',t.review],...(isAvailable?[['Ikeja pickup ETA',pickupTime(t)]]:[])])))}
    ${card('Document checklist','',body(`<div class="stack">${['Vehicle registration','Insurance certificate','Roadworthiness certificate'].map(doc=>`<div>${esc(doc)} · ${chip(t.review==='Verified'||t.docs?.includes(doc)?'Received':'Missing')}</div>`).join('')}${t.reviewNote ? notice(t.reviewNote,'warn') : ''}</div>
      ${t.review==='Pending review' ? `<div class="actions detail-actions">${btn('review','Review decision','primary',t.id)}</div>` : ''}`))}</div>`;
}
function notFound(title='Page not found') {
  return `<section class="center-page"><div class="center-card"><span class="error-code" aria-hidden="true">404</span><h1 tabindex="-1">${title}</h1><p class="muted">Check the address or return to the dispatch dashboard.</p><a class="btn primary" href="/#/dispatch">${icon('grid')} Back to dispatch</a></div></section>`;
}
const authModes = {
  'driver-sign-in': ['Driver sign in','',''],
  'sign-in': ['Sign in','Use a demo email and password to open the workspace.','Sign in'],
  'sign-up': ['Create your account','Preview email verification, then set a demo password.','Send one-time link'],
  'reset-password': ['Reset your password','Enter your demo email to preview a reset link.','Send reset link'],
  'set-password': ['Set your demo password','Choose a password you only use for this demo.','Save password'],
  'accept-invitation': ['Accept an invitation','Enter the demo email listed on your invitation.','Accept demo invitation']
};
const authTitles = Object.fromEntries(Object.entries(authModes).map(([mode,[title]]) => [mode,title]));
const rememberChoice = checked => `<label class="remember-choice"><input type="checkbox" name="remember" ${checked?'checked':''}><span>Keep me signed in for 30 days<small>Use only on a device you trust.</small></span></label>`;
const policyChoices = (prefix='admin') => `<fieldset class="access-legal"><legend>Demo acknowledgments</legend>
  <label class="legal-all"><input type="checkbox" name="accept-all"> Select all</label>
  ${Object.entries(legalItems).map(([key,[label]]) => `<div class="legal-option"><input type="checkbox" name="policy" value="${key}" aria-labelledby="policy-copy-${prefix}-${key}">
    <span id="policy-copy-${prefix}-${key}">I acknowledge the <button class="inline-link" type="button" data-action="access-policy" data-id="${key}">${label}</button>.</span></div>`).join('')}
</fieldset>`;
const passwordField = isNew => `<div class="field">
  <label for="demo-password">${isNew?'New demo password':'Demo password'}</label>
  <span class="password-wrap"><input id="demo-password" name="password" type="password" autocomplete="${isNew?'new-password':'current-password'}" ${isNew?'minlength="8"':''} maxlength="128" required aria-describedby="error-password">
  <button type="button" class="inline-link password-toggle" data-action="password-toggle" aria-controls="demo-password">Show</button></span><span id="error-password" class="field-error"></span></div>`;
const googleMark = () => icon('google');
function authPage(type) {
  const [title,description,submit] = authModes[type];
  const credentials = ['sign-in','sign-up'].includes(type);
  const driverEntry = type === 'driver-sign-in';
  const canSet = pendingAccess && pendingAccess.expires > Date.now();
  return `<div class="access-layout">
    <section class="access-art" aria-label="Mouka logistics">
      <a href="#/dispatch" class="access-brand">${logo()}<span>Mouka Logistics<small>Dispatch and Driver</small></span></a>
      <div class="access-story">
        <h2>From the depot<br>to the doorstep.</h2>
        <div class="access-route" aria-label="Depot to delivery">
          <span>${icon('bay')} Depot</span><i aria-hidden="true"></i><span>${icon('pin')} Delivery</span>
        </div>
      </div>
    </section>
    <section class="access-content">
      <div class="access-panel">
        <nav class="access-roles" aria-label="Sign-in role">
          <a href="#/sign-in"${driverEntry ? '' : ' aria-current="page"'}>${icon('shield')} Admin</a>
          <a href="#/driver-sign-in"${driverEntry ? ' aria-current="page"' : ''}>${icon('truck')} Driver</a>
        </nav>
        ${driverEntry ? driverAccessMarkup(policyChoices) : `
        <nav class="access-modes admin-modes" aria-label="Admin account actions">
          ${[['sign-in','Sign in'],['sign-up','Create account']].map(([mode,label]) =>
            `<a href="#/${mode}"${mode===type?' aria-current="page"':''}>${label}</a>`).join('')}
        </nav>
        <div class="access-heading">
          <span class="access-heading-icon">${icon(type==='sign-up'?'users':type==='reset-password'?'lock':'shield')}</span>
          <div><h1 tabindex="-1">${title}</h1><p class="access-description">${description}</p></div>
        </div>
        ${type==='sign-up' || (type==='set-password' && pendingAccess?.mode==='sign-up') ? `
          <ol class="access-steps" aria-label="Account setup progress">
            ${['Your details','Verify email','Set password'].map((label,i)=>`<li${i===(type==='set-password'?2:0)?' aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')}
          </ol>` : ''}
        ${type==='sign-in' ? `<div class="access-demo-card">${icon('info')}<div><strong>Try the Admin demo</strong><p>Fill the sample login, then confirm the acknowledgments.</p></div>${btn('fill-demo-email','Use demo credentials','light')}</div>` : ''}
        ${type==='set-password' && !canSet ? `<p class="access-description">This demo link has expired. <a class="inline-link" href="#/reset-password">Request another link</a>.</p>` : `
        <form class="form access-fields" data-form="auth" data-id="${type}" novalidate>
          ${type==='sign-up' ? field('Full name','<input name="name" autocomplete="name" placeholder="e.g. Sample Staff Member" required aria-describedby="error-name"><span id="error-name" class="field-error"></span>') : ''}
          ${type!=='set-password' ? field('Demo email',`<input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(authEmail)}" placeholder="name@example.com" required aria-describedby="error-email"><span id="error-email" class="field-error"></span>`) : passwordField(true)}
          ${type==='sign-in' ? `${passwordField(false)}<a class="inline-link forgot-link" href="#/reset-password">Forgot password?</a>` : ''}
          ${credentials ? rememberChoice(false) + policyChoices() : ''}
          ${formError}<div class="notice success" data-auth-result role="status" tabindex="-1" hidden></div>
          <button class="btn primary" type="submit">${submit}</button>
          ${credentials ? `<button class="btn secondary google-button" data-action="google-preview" type="button">${googleMark()} Continue with Google</button>` : ''}
        </form>`}
        <div class="access-footer">
          ${type==='accept-invitation' ? '<a href="#/sign-in">Return to sign in</a>' : '<a href="#/accept-invitation">Accept an invitation</a>'}
          <a href="mailto:contact@terracodeanalytics.com">Contact support</a>
          <a href="#/dispatch">Explore demo</a>
        </div>
        <p class="access-note">${icon('info')} Use sample credentials. Account changes stay in this browser.</p>`}
      </div>
    </section>
  </div>`;
}
const auroraPrompts = [
  ['Dispatch summary','Give me a dispatch overview','grid'],
  ['GPS exceptions','Which trips have stale GPS?','warning'],
  ['Available trucks','Which trucks are available?','truck']
];
function renderAurora() {
  document.body.classList.toggle('aurora-open',auroraOpen);
  if (auroraOpen && !assistant.querySelector('.aurora-panel')) {
    assistant.insertAdjacentHTML('beforeend',`<aside class="aurora-panel" id="aurora-panel" aria-labelledby="aurora-title">
      <header class="aurora-header">
        ${auroraMark()}<div><h2 id="aurora-title">Aurora</h2><p>Mouka Dispatch assistant</p></div>
        ${iconBtn('aurora-close','Close Aurora','close')}
      </header>
      <div class="aurora-thread" role="log" aria-label="Aurora conversation"></div>
      <div class="aurora-composer"><form class="aurora-form" data-form="aurora">
        <label class="sr-only" for="aurora-question">Your question</label>
        <input id="aurora-question" name="question" placeholder="Ask about a trip or truck" maxlength="400" required autocomplete="off">
        <button type="submit" class="btn primary" aria-label="Send question">${icon('send')}</button>
      </form><p class="aurora-footnote">${icon('info')} Answers use sample workspace records.</p></div>
    </aside>`);
    updateAuroraThread();
  } else if (!auroraOpen) {
    assistant.querySelector('.aurora-panel')?.remove();
  }
  if (!assistant.querySelector('.aurora-launcher')) {
    assistant.insertAdjacentHTML('afterbegin',`<button type="button" class="aurora-launcher" data-action="aurora-toggle" aria-label="Ask Aurora" aria-expanded="false">
      ${auroraMark()}<span class="aurora-launcher-label" aria-hidden="true">Ask Aurora</span>
    </button>`);
  }
  assistant.inert = navOpen;
  const toggle = assistant.querySelector('.aurora-launcher');
  toggle.hidden = auroraOpen || navOpen;
  toggle.setAttribute('aria-expanded',String(auroraOpen));
}
// Strip pictographs from assistant messages, including flags, keycaps and joined sequences.
const emojiPattern = /[#*0-9]\uFE0F?\u20E3|[©®™]\uFE0F|(?![©®™])(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier})|[\u200D\uFE0F]|[\u{E0020}-\u{E007F}]/gu;
function updateAuroraThread() {
  const thread = assistant.querySelector('.aurora-thread');
  if (!thread) return;
  const welcome = `<div class="aurora-welcome"><h3>What’s happening in dispatch?</h3>
    <p>Get a summary or look up a specific trip, truck, or depot.</p>
    <div class="aurora-prompts" aria-label="Suggested questions">${auroraPrompts.map(([label,prompt,symbol]) => btn('aurora-prompt',label,'light',prompt,symbol)).join('')}</div>
  </div>`;
  thread.innerHTML = welcome + auroraMessages.map(message => {
    const text = message.user ? message.text : message.text.replace(emojiPattern,'').trim() || 'Try asking about a trip, truck, or depot.';
    return `<div class="aurora-bubble ${message.user?'from-user':''}">
      <span class="aurora-speaker">${message.user?'You':'Aurora'}</span><p>${esc(text)}</p>
      ${message.path ? link(esc(message.path),message.label,'light','chevron') : ''}</div>`;
  }).join('') + (auroraPending ? `<div class="aurora-bubble" role="status">${icon('clock')} Checking workspace records…</div>` : '');
  thread.scrollTop = thread.scrollHeight;
  assistant.querySelector('[type="submit"]').disabled = auroraPending;
}
async function sendAurora(value) {
  const question = value.trim();
  if (!question || auroraPending) return;
  auroraMessages.push({user:true,text:question});
  if (auroraMessages.length > 23) auroraMessages.splice(0,2);
  const [page,selectedId] = current.split('/');
  const context = {state, active, available, loading, stale, page, selectedId};
  let reply = dispatchAnswer(question,context);
  // Structured dispatch answers retain exact counts, statuses and links. Use the local
  // language model for other questions only when the browser already has it.
  if (!reply.path) {
    auroraPending = true;
    updateAuroraThread();
    try {
      if (await onDeviceAvailable()) {
        const text = await askOnDevice(question,context);
        if (text) reply = {text};
      }
    } catch {
      // The structured fallback is available on every supported browser.
    } finally {
      auroraPending = false;
    }
  }
  auroraMessages.push(reply);
  updateAuroraThread();
}
function toggleAurora(open) {
  auroraOpen = open;
  renderAurora();
  if (open) assistant.querySelector('input')?.focus({preventScroll:true});
  else assistant.querySelector('.aurora-launcher')?.focus({preventScroll:true});
}
function profileMenu(viewer) {
  const avatar = viewer ? esc(initials(viewer.name)) : icon('user');
  return `<div class="account-dropdown">
    <button class="profile profile-trigger" data-action="profile" type="button" aria-label="Workspace account" aria-expanded="false" aria-controls="account-options">
      <span class="avatar">${avatar}</span><span class="profile-copy"><strong>${esc(viewer?.name || 'Guest')}</strong><small>${esc(viewer?.role || 'Demo workspace')}</small></span>${icon('more')}
    </button>
    <div id="account-options" class="account-options" hidden>
      <div class="account-summary"><strong>${esc(viewer?.name || 'Guest')}</strong><small>${esc(viewer ? viewer.role + ' · Demo workspace' : 'Demo workspace')}</small></div>
      <button type="button" data-action="account-settings">${icon('settings')} Account settings</button>
      <a href="#/depots">${icon('bay')} Depot settings</a>
      <a href="#/help">${icon('help')} Help and support</a>
      ${viewer ? `<button type="button" class="account-exit" data-action="sign-out">${icon('log-out')} Log out</button>` :
        `<a class="account-exit" href="#/sign-in">${icon('user')} Sign in</a>`}
    </div></div>`;
}
function setProfileOpen(open, restoreFocus=false) {
  const trigger = app.querySelector('.profile-trigger');
  const options = app.querySelector('#account-options');
  if (!trigger || !options) return;
  trigger.setAttribute('aria-expanded',String(open));
  options.hidden = !open;
  if (restoreFocus) trigger.focus();
}
function fontSizeControl() {
  return field('Font size',`<select data-font-size>${Object.entries(fontSizes).map(([size,label]) =>
    `<option value="${size}"${fontSize===size?' selected':''}>${label}</option>`).join('')}</select>`);
}
function administration() {
  return `<details class="admin-dropup">
    <summary class="admin-trigger" title="Settings">${icon('settings')}<span><strong>Settings</strong><small>Appearance and text size</small></span>${icon('chevron')}</summary>
    <div class="admin-panel" aria-label="Settings">
      <div class="admin-appearance"><strong>Appearance</strong><div class="theme-controls" role="group" aria-label="Appearance">
        ${Object.entries(themes).map(([key,[name,symbol]]) => `<button type="button" data-action="theme" data-id="${key}" aria-pressed="${themePreference===key}">${icon(symbol)}${name}</button>`).join('')}
      </div>${fontSizeControl()}</div>
    </div>
  </details>`;
}

// Shortcuts under a menu item: [target, label, how many records it will show].
function sideChildren(path) {
  if (path === 'available') {
    const groups = groupedTrucks();
    return availableSections.filter(([key]) => key !== 'other').map(([key,title]) => [key,title,groups[key].length]);
  }
  if (path === 'deliveries') {
    const all = state.trips.map(deliveryInfo);
    return [['','All deliveries',all.length],
      ...[['road','In transit'],['bay','At loading bay'],['done','Delivered'],['declined','Declined']].map(([key,label]) => [key,label,all.filter(r => r.group === key).length]),
      ['stale','Stale GPS',all.filter(r => r.late).length]];
  }
  return [];
}

function sideMenu(page, detail) {
  const [, operations] = nav[0];
  const [, management] = nav[1];
  const entry = path => [...operations,...management].find(item => item[0] === path);
  const counts = {available:available().length, loading:loading().length, tracking:active().length, deliveries:state.trips.length,
    fleet:state.fleet.length, verification:state.fleet.filter(v => v.review === 'Pending review').length, users:state.users.length, depots:state.locations.length};
  // Detail pages keep their parent highlighted.
  const here = detail && page === 'trip' ? 'deliveries' : detail && page === 'truck' ? 'fleet' : page;
  const row = (path, name, symbol, badge='') => `<a href="#/${path}" title="${name}" class="nav-link ${here===path?'active':''}" ${page===path?'aria-current="page"':''}>${icon(symbol)}<span>${name}</span>${badge}</a>`;
  const item = path => {
    const [, name, symbol] = entry(path);
    const link = row(path,name,symbol,counts[path] ? `<em>${counts[path]}</em>` : '');
    const children = sideChildren(path);
    if (!children.length) return link;
    const open = sideOpen.get(path) ?? here === path;
    return `<div class="nav-branch ${open?'open':''}">${link}<button type="button" class="nav-fold" data-action="side-fold" data-id="${path}" aria-expanded="${open}" aria-controls="side-sub-${path}" aria-label="${open?'Hide':'Show'} ${name} shortcuts">${icon('chevron')}</button>
      <ul id="side-sub-${path}" ${open?'':'hidden'}>${children.map(([key,label,count]) => `<li><button type="button" data-action="side-go" data-id="${path}:${key}" ${page===path && path==='deliveries' && deliveryView.status===key ? 'aria-current="true"' : ''}><span>${label}</span><em>${count}</em></button></li>`).join('')}</ul></div>`;
  };
  const group = (label, content) => `<div class="nav-group"><div class="nav-label">${label}</div>${content}</div>`;
  const unread = unreadCount();
  const ready = available().length;
  const onTrip = openTrips().length;
  return group('Main menu', ['dispatch','available','loading','tracking','deliveries'].map(item).join('') +
      row('notifications','Notifications','bell',`<em data-unread-count ${unread?'':'hidden'}>${unread}</em>${unread?'<i class="unread"></i>':''}`)) +
    group('Fleet', ['fleet','verification','depots'].map(item).join('')) +
    group('Team and support', item('users') + row('help','Help and support','help') + row('policies','Terms & policies','document') +
      `<button type="button" class="nav-link" data-action="ov-aurora" title="Ask Aurora">${icon('message')}<span>Ask Aurora</span></button>
       <a href="#/driver-sign-in" class="nav-link" title="Driver app">${icon('truck')}<span>Driver app</span></a>`) +
    `<a class="side-card" href="#/available">
      <span class="side-card-head">${tile('truck')}<span><strong>Fleet today</strong><small>${state.fleet.length} trucks registered</small></span></span>
      <progress value="${ready}" max="${Math.max(state.fleet.length,1)}" aria-label="${ready} of ${state.fleet.length} trucks ready"></progress>
      <span class="side-card-foot"><span><b>${ready}</b> ready</span><span><b>${onTrip}</b> on a trip</span></span>
    </a>`;
}

function followShortcut(id) {
  const [path,key] = id.split(':');
  const wasOpen = navOpen;
  navOpen = false;
  if (path === 'deliveries') Object.assign(deliveryView,{status:key, query:'', type:'', depot:'', page:1});
  const arrive = () => {
    if (path !== 'available') return;
    const section = app.querySelector(`#av-section-${key}`);
    if (!section) return;
    availableClosed.delete(key);
    section.open = true;
    section.scrollIntoView({block:'start'});
    section.querySelector('summary').focus({preventScroll:true});
  };
  if (current === path) {
    if (path === 'available') filters = {};
    render();
    arrive();
  } else {
    if (wasOpen) render();
    window.addEventListener('hashchange', () => setTimeout(arrive,60), {once:true});
    go(path);
  }
}

function closeAdministration(restoreFocus=false) {
  const menu = app.querySelector('.admin-dropup[open]');
  if (!menu) return;
  menu.open = false;
  if (restoreFocus) menu.querySelector('summary').focus();
}
function policySections(sections) {
  return sections.map(([heading,copy])=>`<section class="guidance-section"><h3>${esc(heading)}</h3><p>${esc(copy)}</p></section>`).join('');
}
function policiesPage() {
  return head('Terms & policies','Draft policies for the Mouka Dispatch pilot and planned rollout.') +
    `<div class="guidance-grid">${Object.entries(legalItems).map(([id,[title,symbol,sections]])=>`
      <details class="card guidance-card" data-policy="${id}"><summary>${tile(symbol)}<h2>${esc(title)}</h2>${icon('chevron')}</summary>
      <div class="guidance-content">${policySections(sections)}</div></details>`).join('')}</div>`;
}
function helpPage() {
  return head('Help and support','Guides for dispatch, depots and workspace administration.',
    btn('open-help-aurora','Ask Aurora','secondary','','message') + '<a class="btn primary help-contact" href="mailto:contact@terracodeanalytics.com">contact@terracodeanalytics.com</a>') +
    `<div class="help-search registry-search">${icon('search')}<input type="search" id="help-search" aria-label="Search help articles" placeholder="Search help articles"></div>
    <p class="guidance-empty" hidden role="status">No articles match your search.</p>
    <div class="guidance-grid help-topics">${helpTopics.map(([title,symbol,items])=>`<section class="card guidance-card">
      <header>${tile(symbol)}<h2>${esc(title)}</h2></header>
      <div class="guidance-questions">${items.map(([question,answer])=>`<details><summary><span>${esc(question)}</span>${icon('chevron')}</summary><p>${esc(answer)}</p></details>`).join('')}</div>
    </section>`).join('')}</div>`;
}
const renderers = {notifications:notificationsPage,dispatch:dashboard,available:availablePage,loading:loadingPage,tracking:trackingPage,deliveries:deliveriesPage,fleet:fleetPage,verification:verificationPage,users:usersPage,depots:depotsPage,policies:policiesPage,help:helpPage};
function render({focus=false}={}) {
  const [page,id,extra] = current.split('/');
  const title = names[page] || ({notifications:'Notifications',trip:'Trip details',truck:'Truck details',policies:'Terms & policies',help:'Help and support',...authTitles})[page] || 'Page not found';
  document.title = `${title} | Mouka Dispatch`;
  const content = extra ? notFound() : id && page==='trip' ? tripDetail(id) : id && page==='truck' ? truckDetail(id) :
    id ? notFound() : renderers[page] ? renderers[page]() : Object.hasOwn(authTitles,page) ? authPage(page) : notFound();
  const auth = Object.hasOwn(authTitles,page);
  const viewer = account();
  const menuScroll = app.querySelector('.side-scroll')?.scrollTop ?? 0;
  app.innerHTML = auth ? `<main id="main" class="auth-main" tabindex="-1"><div class="page">${content}</div></main>` : `
  <div class="shell ${railed?'railed':''}">
    <aside id="side" class="sidebar ${navOpen?'open':''}">
      <div class="brand"><a href="#/dispatch" aria-label="Mouka Dispatch home">${logo()}</a><div><strong>Dispatch</strong><small>Mouka Logistics</small></div>
        ${iconBtn('rail',railed?'Expand sidebar':'Collapse sidebar','panel','rail-toggle')}${iconBtn('menu','Close navigation','close','mobile-only side-close')}</div>
      <button type="button" class="side-search" data-action="search" title="Search">${icon('search')}<span>Search</span><kbd>Ctrl K</kbd></button>
      <nav class="side-scroll" aria-label="Main navigation">${sideMenu(page,id)}</nav>
      <div class="side-footer">
        <button type="button" class="side-dark" role="switch" aria-checked="${document.documentElement.dataset.theme==='dark'}" data-action="side-dark" title="Dark mode">${icon('moon')}<span>Dark mode</span><i aria-hidden="true"></i></button>
        ${administration()}${profileMenu(viewer)}</div>
    </aside>
    <button type="button" class="overlay ${navOpen?'open':''}" tabindex="-1" aria-label="Close navigation" data-action="menu"></button>
    <div class="workspace"${navOpen?' inert':''}><header class="top"><button type="button" class="icon-btn" data-action="menu" aria-expanded="${navOpen}" aria-controls="side" aria-label="Open navigation">${icon('menu')}</button>
      <strong>${title}</strong>
      <button type="button" class="icon-btn" data-action="search" aria-label="Search">${icon('search')}</button>
      <button type="button" class="icon-btn" data-action="activity" aria-label="Notifications">${icon('bell')}${unreadCount()?'<i class="unread"></i>':''}</button>
      </header><main id="main" class="${page === 'tracking' && !id ? 'td-main' : page === 'dispatch' && !id ? 'ov-main' : page === 'available' && !id ? 'av-main' : ['deliveries','loading','notifications'].includes(page) && !id ? 'dv-main' : ''}" tabindex="-1"><div id="connection" ${navigator.onLine?'hidden':''}>${notice('Connection lost. You can browse existing records. Reconnect to save changes.','warn')}</div><div class="page">${content}</div></main></div>
  </div>`;
  const menu = app.querySelector('.side-scroll');
  if (menu) menu.scrollTop = menuScroll;
  document.body.classList.toggle('account-access',auth);
  if (page==='driver-sign-in') mountDriverAccess(app.querySelector('#driver-entry'));
  mountTruck();
  mountPhotos();
  renderAurora();
  if (focus) document.querySelector('h1')?.focus({preventScroll:true});
}
function routeChanged() {
  const next = route();
  if (next === current) return;
  if (modal.open) modal.close();
  const previousEmail = app.querySelector('form[data-form="auth"] input[name="email"]');
  if (previousEmail) authEmail = previousEmail.value.trim();
  current = next;
  filters = {};
  mapSelection = '';
  trackSelection = trackPending;
  trackPending = '';
  deliveryPicked.clear();
  noticePicked.clear();
  trackActivityOpen = true;
  trackAllActivity = false;
  overviewQuery = '';
  overviewFilter = 'all';
  zoom = 1;
  navOpen = false;
  render({focus:true});
  window.scrollTo(0,0);
}
function searchItems() {
  const pages = [...nav.flatMap(([, items]) => items.map(([path,name,symbol]) => [name,'Page',symbol,path])),
    ['Help and support','Page','help','help'],['Terms & policies','Page','document','policies']];
  return [...pages, ['Notifications','Page','bell','notifications'],
    ...state.trips.map(t => [`${t.id} to ${t.stops.at(-1)}`,`Trip · ${t.status}`,'box','trip/'+t.id]),
    ...state.fleet.map(v => [`${v.plate} · ${v.driver}`,`Truck · ${v.operator}`,'truck','truck/'+v.id])];
}
function searchResults(query='') {
  const words = query.toLowerCase().trim().split(/\s+/);
  const found = searchItems().filter(([title,detail]) => words.every(word => `${title} ${detail}`.toLowerCase().includes(word))).slice(0,8);
  return found.length ? found.map(([title,detail,symbol,path],i) =>
    `<li><a href="#/${esc(path)}" data-action="search-go" class="${i?'':'current'}">${tile(symbol)}<span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${icon('chevron')}</a></li>`).join('') :
    '<li class="search-empty">No matches. Try a trip ID, plate or page name.</li>';
}
function openSearch() {
  modal.innerHTML = `<div class="search-box">${icon('search')}<input id="quick-search" type="search" autocomplete="off" aria-label="Search pages, trips and trucks" placeholder="Search pages, trips and trucks"><kbd>esc</kbd></div>
    <h2 id="dialog-title" class="sr-only">Search</h2><ul class="search-list">${searchResults()}</ul>
    <p class="search-hint"><kbd>↑</kbd><kbd>↓</kbd> to move <kbd>Enter</kbd> to open</p>`;
  modal.classList.add('search-dialog');
  if (!modal.open) modal.showModal();
  modal.querySelector('input').focus();
}
modal.addEventListener('close', () => modal.classList.remove('search-dialog','preview-dialog'));
modal.addEventListener('input', e => {
  if (e.target.id === 'quick-search') modal.querySelector('.search-list').innerHTML = searchResults(e.target.value);
});
modal.addEventListener('keydown', e => {
  if (e.target.id !== 'quick-search') return;
  const links = [...modal.querySelectorAll('.search-list a')];
  const index = links.findIndex(item => item.classList.contains('current'));
  if (e.key === 'Enter') { e.preventDefault(); links[index]?.click(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!links.length) return;
    links[index]?.classList.remove('current');
    const next = links[(index + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length];
    next.classList.add('current');
    next.scrollIntoView({block:'nearest'});
  }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !document.body.classList.contains('account-access')) {
    e.preventDefault();
    if (!modal.open) openSearch();
  }
});
function sortTable(button) {
  const heading = button.closest('th');
  const table = heading.closest('table');
  const index = heading.cellIndex;
  const direction = heading.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
  table.querySelectorAll('th').forEach(item => item.removeAttribute('aria-sort'));
  heading.setAttribute('aria-sort',direction);
  const value = row => {
    const cell = row.cells[index].cloneNode(true);
    cell.querySelectorAll('.registry-mobile-label,.registry-emblem').forEach(item => item.remove());
    return cell.textContent.trim();
  };
  const body = table.tBodies[0];
  body.append(...[...body.rows].sort((a,b) => value(a).localeCompare(value(b),undefined,{numeric:true}) * (direction === 'ascending' ? 1 : -1)));
}

function openModal(title, html) {
  modal.innerHTML = `<div class="card-head"><h2 id="dialog-title">${esc(title)}</h2>${iconBtn('close','Close dialog','close')}</div><div class="dialog-body">${html}</div>`;
  if (!modal.open) modal.showModal();
}
function modalForm(title, kind, id, fields, submit) {
  openModal(title,`<form class="form" data-form="${kind}" data-id="${esc(id)}" novalidate>${fields}${formError}${formActions(submit)}</form>`);
}
function setError(form, fieldName, message) {
  const input = form.elements.namedItem(fieldName);
  input?.setAttribute('aria-invalid','true');
  const span = form.querySelector('#error-'+fieldName);
  if (span) span.textContent = message;
  input?.focus();
}
function generalError(form, message) {
  const el = form.querySelector('[data-form-error]');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}
function valid(form) {
  for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  for (const span of form.querySelectorAll('.field-error')) span.textContent='';
  if (form.querySelector('[data-form-error]')) form.querySelector('[data-form-error]').hidden=true;
  if (form.querySelector('[data-auth-result]')) form.querySelector('[data-auth-result]').hidden=true;
  const el = [...form.elements].find(i=> i.validity && (!i.validity.valid || (i.required && typeof i.value==='string' && !i.value.trim())));
  if (!el) return true;
  setError(form,el.name,el.validity.typeMismatch?'Enter a valid email address.':el.validity.tooShort?'Use at least 8 characters.':el.type==='number'?'Enter a number between 1 and 30.':'Complete this field.');
  return false;
}
function finish(message, mutate, next) {
  if (!save(message,mutate)) {
    const form = modal.open ? modal.querySelector('form') : null;
    if (form) generalError(form,'Your change could not be saved. Check your connection or browser storage and try again.');
    return;
  }
  if (modal.open) modal.close();
  if (next && next !== current) go(next); else render({focus:true});
}

function stageModal(t) {
  if (!t) return;
  if (t.status==='Accepted') {
    const depot = state.locations.find(d=>d.name===t.depot);
    const bays = Array.from({length:depot?.bays ?? 1},(_,i)=>'Bay '+String(i+1).padStart(2,'0'));
    const open = bays.filter(bay=>!loading().some(x=>x.depot===t.depot && x.bay===bay));
    if (!open.length) return openModal('No loading bay available',notice('Wait for a truck at this depot to be released, then record the arrival.','warn'));
    return modalForm('Record truck arrival','stage',t.id,field('Loading bay',`<select name="bay">${option(open)}</select>`),'Record arrival');
  }
  if (t.status==='At bay') return modalForm('Start loading','stage',t.id,notice(`${t.id} is assigned to ${t.bay} at ${t.depot}.`),'Start loading');
  if (t.status==='Loading') return modalForm('Confirm loaded and release','stage',t.id,notice('This records the release by Mouka loading staff and starts tracking the delivery ETA.','warn'),'Release truck');
}
const staffStatuses = ['Active','Invited','Suspended'];
function userModal(u) {
  modalForm(u?'Edit staff account':'Create demo invitation',u?'edit-user':'invite',u?.email ?? '',
    field('Full name',`<input name="name" autocomplete="name" value="${esc(u?.name)}" required aria-describedby="error-name"><span id="error-name" class="field-error"></span>`) +
    field('Work email',`<input name="email" type="email" autocomplete="email" placeholder="name@example.com" value="${esc(u?.email)}" required aria-describedby="error-email"><span id="error-email" class="field-error"></span>`) +
    field('Workspace role',`<select name="role">${option(roles,u?.role)}</select>`) +
    (u ? field('Account status',`<select name="status">${option(staffStatuses,u.status)}</select>`) : ''),
    u?'Save changes':'Create invitation');
}
function depotModal(d) {
  modalForm(d?'Edit depot':'Add depot',d?'edit-depot':'new-depot',d?.name ?? '',
    field('Depot name',`<input name="name" required value="${esc(d?.name)}" aria-describedby="error-name"><span class="field-error" id="error-name"></span>`) +
    field('State',`<input name="area" required value="${esc(d?.area)}" aria-describedby="error-area"><span class="field-error" id="error-area"></span>`) +
    field('Loading bays',`<input type="number" name="bays" min="1" max="30" required value="${d?.bays ?? 1}" aria-describedby="error-bays"><span class="field-error" id="error-bays"></span>`),'Save depot');
}
document.addEventListener('change', e=>{
  const input = e.target;
  if (input.matches('[data-av-filter]')) {
    const name = input.dataset.avFilter;
    filters = {...filters,[name]:input.value};
    availableMenuOpen = true;
    render();
    availableMenuOpen = false;
    app.querySelector(`[data-av-filter="${name}"]`)?.focus({preventScroll:true});
    return;
  }
  if (input.matches('[data-font-size]') && Object.hasOwn(fontSizes,input.value)) {
    fontSize = input.value;
    document.documentElement.dataset.fontSize = fontSize;
    try { localStorage.setItem('mouka-font-size',fontSize); } catch {}
    document.querySelectorAll('[data-font-size]').forEach(control => { control.value = fontSize; });
    return;
  }
  if (!input.matches('.access-legal input')) return;
  const form = input.form;
  const all = form.elements.namedItem('accept-all');
  const choices = [...form.querySelectorAll('[name="policy"]')];
  if (input === all) choices.forEach(choice => { choice.checked = all.checked; });
  const selected = choices.filter(choice => choice.checked).length;
  all.checked = selected === choices.length;
  all.indeterminate = selected > 0 && selected < choices.length;
  form.querySelector('.access-legal').removeAttribute('aria-invalid');
});
async function handleAccess(form, mode, values) {
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  const email = values.email?.trim().toLowerCase();
  if (email !== undefined && !email.endsWith('@example.com')) {
    return setError(form,'email','Use an example.com email address for the demo.');
  }
  const user = mode==='sign-in' && email===demoAdmin.email ? demoAdmin : state.users.find(u=>u.email===email);
  if (['sign-in','sign-up'].includes(mode) &&
      form.querySelectorAll('[name="policy"]:checked').length !== Object.keys(legalItems).length) {
    form.querySelector('.access-legal').setAttribute('aria-invalid','true');
    generalError(form,'Confirm each demo acknowledgment to continue.');
    form.elements.namedItem('accept-all').focus();
    return;
  }
  if (mode==='sign-up' && (user || email===demoAdmin.email)) return setError(form,'email','This demo account already exists. Sign in or use another address.');
  if (mode==='reset-password' || mode==='sign-up') {
    const result = form.querySelector('[data-auth-result]');
    result.hidden = false;
    result.textContent = mode==='sign-up'
      ? 'Your demo one-time link is ready to preview. No email was sent.'
      : 'If this demo account exists, a reset link would be sent. No email was sent.';
    pendingAccess = mode==='sign-up' || user?.status==='Active'
      ? {mode,email,name:values.name?.trim(),remember:Boolean(values.remember),expires:Date.now()+15*60*1000} : undefined;
    if (pendingAccess) result.insertAdjacentHTML('beforeend',link('set-password','Open demo link','light'));
    if (mode==='sign-up') app.querySelector('.access-steps [aria-current]')?.removeAttribute('aria-current');
    if (mode==='sign-up') app.querySelector('.access-steps li:nth-child(2)')?.setAttribute('aria-current','step');
    result.focus();
    return;
  }
  if (mode==='accept-invitation') {
    if (user?.status!=='Invited') return setError(form,'email','No open demo invitation matches this email.');
    if (save('Demo invitation accepted.',()=>{user.status='Active';})) {
      rememberAccount(email);
      go('dispatch');
    } else generalError(form,'The invitation could not be saved.');
    return;
  }
  submit.disabled = true;
  try {
    if (mode==='sign-in') {
      const matched = user?.status==='Active' && await checkDemoPassword(user,values.password);
      if (!form.isConnected) return;
      if (!matched) return generalError(form,'The demo email or password did not match.');
      rememberAccount(email,Boolean(values.remember));
      go('dispatch');
    } else if (mode==='set-password') {
      const pending = pendingAccess;
      if (!pending || pending.expires <= Date.now()) return generalError(form,'This demo link has expired. Request a new link.');
      if (values.password.length < 8) return setError(form,'password','Use at least 8 characters.');
      const credential = await makeDemoCredential(values.password);
      if (!form.isConnected || pendingAccess !== pending) return;
      if (pending.expires <= Date.now()) return generalError(form,'This demo link has expired. Request a new link.');
      const existing = state.users.find(u => u.email===pending.email);
      if ((pending.mode==='sign-up' && existing) || (pending.mode==='reset-password' && existing?.status!=='Active')) {
        return generalError(form,'This demo link is no longer valid.');
      }
      const reset = pending.mode==='reset-password';
      if (!save(reset?'Demo password changed.':'Demo account created.',()=>{
        if (reset) existing.demoCredential = credential;
        else state.users.push({name:pending.name,email:pending.email,role:'Dispatch',status:'Active',demoCredential:credential});
      })) return generalError(form,'The password could not be saved in this browser.');
      pendingAccess = undefined;
      authEmail = pending.email;
      if (reset) {
        if (signedInEmail===pending.email) rememberAccount('');
        go('sign-in');
      } else {
        rememberAccount(pending.email,pending.remember);
        go('dispatch');
      }
    }
  } catch {
    if (form.isConnected) generalError(form,'This browser could not complete the demo account action.');
  } finally {
    submit.disabled = false;
  }
}

document.addEventListener('input',e=>{
  if (e.target.id !== 'help-search') return;
  const query = e.target.value.trim().toLowerCase();
  let matches = 0;
  app.querySelectorAll('.help-topics > section').forEach(section=>{
    const heading = section.querySelector('h2').textContent;
    const articles = Array.from(section.querySelectorAll('details'));
    articles.forEach(article=>{
      article.hidden = !`${heading} ${article.textContent}`.toLowerCase().includes(query);
      if (!article.hidden) matches++;
    });
    section.hidden = articles.every(article=>article.hidden);
  });
  app.querySelector('.guidance-empty').hidden = matches > 0;
});

document.addEventListener('click', e=>{
  if (!e.target.closest('.account-dropdown') || e.target.closest('.account-options a')) setProfileOpen(false);
  if (!e.target.closest('.admin-dropup') || e.target.closest('.admin-panel a')) closeAdministration();
  const el = e.target.closest('[data-action]');
  if (!el) {
    const row = e.target.closest('.registry-table tbody tr');
    if (row && !e.target.closest('a,button,input,select,textarea') &&
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && window.getSelection()?.isCollapsed !== false) {
      row.querySelector('a.registry-identity,button.staff-edit')?.click();
    }
    if (navOpen && e.target.closest('.sidebar a') && e.target.closest('a').hash===location.hash) {
      navOpen=false; render({focus:true});
    }
    return;
  }
  const {action,id} = el.dataset;
  if (action==='menu') {
    navOpen=!navOpen;
    render();
    app.querySelector(navOpen?'.side-close':'[aria-controls="side"]')?.focus();
  } else if (action==='aurora-toggle' || action==='aurora-close') toggleAurora(action==='aurora-toggle' && !auroraOpen);
  else if (action==='aurora-prompt') {
    sendAurora(id);
    assistant.querySelector('input')?.focus({preventScroll:true});
  }
  else if (action==='search') {
    if (navOpen) { navOpen=false; render(); }
    openSearch();
  } else if (action==='search-go') {
    modal.close();
  } else if (action==='sort') {
    sortTable(el);
  } else if (action==='table-view') {
    tableView = id;
    try { localStorage.setItem('mouka-table-view',id); } catch {}
    app.querySelectorAll('.registry').forEach(item => item.classList.toggle('card-view',id==='cards'));
    app.querySelectorAll('[data-action="table-view"]').forEach(item => item.setAttribute('aria-pressed',String(item.dataset.id===id)));
  } else if (action==='rail') {
    railed = !railed;
    try { localStorage.setItem('mouka-rail',String(railed)); } catch {}
    render();
    app.querySelector('[data-action="rail"]')?.focus({preventScroll:true});
  } else if (action==='av-preview') {
    previewTruck(id);
  } else if (action==='side-fold') {
    const open = el.getAttribute('aria-expanded') !== 'true';
    sideOpen.set(id,open);
    el.setAttribute('aria-expanded',String(open));
    el.setAttribute('aria-label',el.getAttribute('aria-label').replace(/^(Show|Hide)/,open?'Hide':'Show'));
    el.parentElement.classList.toggle('open',open);
    app.querySelector(`#side-sub-${id}`).hidden = !open;
  } else if (action==='side-go') {
    followShortcut(id);
  } else if (action==='side-dark') {
    themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('mouka-appearance',themePreference); } catch {}
    applyTheme();
  } else if (action.startsWith('lb-')) {
    updateBays(action,id);
  } else if (action.startsWith('nt-')) {
    updateNotices(action,id);
  } else if (action.startsWith('dv-')) {
    updateDeliveries(action,id,el);
  } else if (action==='av-jump') {
    const section = app.querySelector(`#av-section-${id}`);
    if (!section || section.hidden) { toast('No trucks in that section match your search or filters.'); return; }
    section.open = true;
    section.scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    section.querySelector('summary').focus({preventScroll:true});
  } else if (action==='av-refresh') {
    availableRefreshed = localTime();
    render();
    app.querySelector('[data-action="av-refresh"]')?.focus({preventScroll:true});
    toast('Availability refreshed from the sample records.');
  } else if (action==='av-layout') {
    availableLayout = id;
    try { localStorage.setItem('mouka-available-layout',id); } catch {}
    app.querySelectorAll('.av-grid').forEach(grid => { grid.classList.toggle('list',id==='list'); grid.classList.toggle('grid',id==='grid'); });
    app.querySelectorAll('[data-action="av-layout"]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.id===id)));
  } else if (action==='fill-demo-email') {
    const form = app.querySelector('form[data-form="auth"]');
    form.elements.email.value = demoAdmin.email;
    form.elements.password.value = demoPassword;
    form.elements.namedItem('accept-all').focus();
  } else if (action==='password-toggle') {
    const input = el.form.elements.password;
    input.type = input.type === 'password' ? 'text' : 'password';
    el.textContent = input.type === 'password' ? 'Show' : 'Hide';
  } else if (action==='theme' && Object.hasOwn(themes,id)) {
    themePreference = id;
    try { localStorage.setItem('mouka-appearance',id); } catch {}
    applyTheme();
  } else if (action==='access-policy') {
    const [title,,sections] = legalItems[id];
    openModal(title,`<div class="guidance-content">${policySections(sections)}</div>`);
  } else if (action==='google-preview') {
    openModal('Continue with Google',`<p>Google sign-in is unavailable in this demo. Use a demo account to explore the workspace.</p>`);
  } else if (action==='close') modal.close();
  else if (action==='filter-options') {
    const panel = document.getElementById(el.getAttribute('aria-controls'));
    panel.hidden = !panel.hidden;
    el.setAttribute('aria-expanded',String(!panel.hidden));
  } else if (action==='status-filter') {
    const query = app.querySelector('form[data-form="filters"] input[name="query"]')?.value;
    filters = {...filters,query: query?.trim() || '',status:id};
    render();
    [...app.querySelectorAll('[data-action="status-filter"]')].find(button => button.dataset.id === id)?.focus({preventScroll:true});
  }
  else if (['ov-ride','ov-filter','ov-step','ov-view','ov-spin'].includes(action)) {
    updateOverview(action,id);
  } else if (action==='ov-review') {
    const chosen = overviewTasks().filter(task => app.querySelector(`.ov-task input[value="${task.key}"]`)?.checked);
    openModal('Review next steps', chosen.length ?
      `<ul class="search-list">${chosen.map(task => `<li><a href="#/${esc(task.path)}" data-action="search-go">${tile(task.symbol)}<span><strong>${esc(task.title)}</strong><small>${esc(task.note)}</small></span>${icon('chevron')}</a></li>`).join('')}</ul>${notice('Open each step to act on it. Nothing changes until you confirm it there.','info')}` :
      notice('Tick at least one step to review.','warn'));
  } else if (action==='ov-aurora') {
    toggleAurora(true);
  } else if (action==='sign-out') {
    rememberAccount('');
    pendingAccess = undefined;
    go('sign-in');
  }
  else if (action==='activity') {
    if (navOpen) navOpen=false;
    go('notifications');
  } else if (action==='profile') {
    setProfileOpen(el.getAttribute('aria-expanded') !== 'true');
  } else if (action==='account-settings') {
    setProfileOpen(false,true);
    const viewer = account();
    if (viewer) openModal('Account settings',`<form class="form" data-form="account-settings">
      ${kv([['Name',viewer.name],['Demo email',viewer.email],['Role',viewer.role]])}
      ${fontSizeControl()}${rememberChoice(isRemembered(signedInEmail))}<button class="btn" type="submit">Save settings</button></form>`);
    else openModal('Account settings',`<div class="stack">${fontSizeControl()}<p>Sign in to change your demo account settings.</p></div><div class="detail-actions">${link('sign-in','Sign in','primary')}</div>`);
  } else if (action==='open-help-aurora') {
    modal.close();
    toggleAurora(true);
  } else if (action==='clear-filters') { filters={}; render({focus:true}); }
  else if (action==='track-call'||action==='track-message') {
    const contact = driverContact(truck(trip(id)?.truck));
    const calling = action==='track-call';
    openModal(`${calling?'Call':'Message'} ${contact.name}`,`${kv([[calling?'Phone':'Email',calling?contact.phone:contact.email],['Trip',id]])}${notice(`This is a sample contact. ${calling?'Calling':'Messaging'} is not connected yet.`)}`);
  } else if (action==='track-copy') {
    navigator.clipboard?.writeText(id).then(()=>toast('Copied.'),()=>toast('Copy is unavailable in this browser.','error'));
  } else if (action.startsWith('track-')) updateTracking(action,id);
  else if (action==='respond') modalForm('Simulate operator response','respond',id,
    field('Response','<select name="response"><option>Accepted</option><option>Declined</option></select>')+
    field('Reason for declining','<textarea name="reason" aria-describedby="error-reason"></textarea><span class="field-error" id="error-reason"></span>'),'Save response');
  else if (action==='stage') stageModal(trip(id));
  else if (action==='deliver') {
    const t=trip(id);
    if (t?.stops[t.done]) modalForm('Confirm delivery stop','deliver',id,notice(t.stops[t.done]),'Confirm delivered');
  } else if (action==='review') modalForm('Review truck registration','review',id,
    field('Decision','<select name="decision"><option>Verified</option><option>Needs corrections</option><option>Rejected</option></select>')+
    field('Review note','<textarea name="note" aria-describedby="error-note"></textarea><span class="field-error" id="error-note"></span>'),'Save decision');
  else if (action==='invite') userModal();
  else if (action==='edit-user') {
    const user = state.users.find(u=>u.email===id);
    if (user) userModal(user);
  }
  else if (action==='new-depot'||action==='edit-depot') depotModal(state.locations.find(d=>d.name===id));
});

document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const kind=form.dataset.form;
  const id=form.dataset.id;
  const f=Object.fromEntries(new FormData(form));
  if (kind==='aurora') {
    if (String(f.question || '').trim()) {
      sendAurora(f.question);
      form.reset();
    }
    return;
  }
  if (kind==='filters') {
    filters={...f,query:f.query?.trim() || ''};
    render({focus:Boolean(e.submitter)});
    if (!e.submitter) app.querySelector('.registry-search input')?.focus({preventScroll:true});
    return;
  }
  if (kind==='track-comment') {
    const t=trip(id);
    const text=String(f.comment || '').trim();
    if (t && text && save('Comment added.',()=>{ (t.comments ||= []).unshift([text,localTime()]); })) {
      render();
      app.querySelector('.td-comment textarea')?.focus({preventScroll:true});
    }
    return;
  }
  if (!valid(form)) return;
  if (kind==='account-settings') {
    if (signedInEmail) rememberAccount(signedInEmail,Boolean(f.remember));
    modal.close();
    toast('Account settings saved.');
    return;
  }

  if (kind==='auth') {
    await handleAccess(form,id,f);
    return;
  }
  if (kind==='respond') {
    const t=trip(id);
    if (!t || t.status!=='Awaiting response') return generalError(form,'This request already has a response. Close this window and refresh the queue.');
    if (f.response==='Declined'&&!f.reason.trim()) return setError(form,'reason','Enter a reason for declining.');
    finish('Operator response saved.',()=>{
      t.status=f.response;
      t.reason=f.response==='Declined'?f.reason.trim():'';
      const label='Truck request '+f.response.toLowerCase();
      event(t,label);
      log(label,id+' · '+truck(t.truck).operator,f.response==='Declined'?'close':'check');
    });
  } else if (kind==='stage') {
    const t=trip(id);
    if (!t) return generalError(form,'This trip is unavailable.');
    if (t.status==='Accepted') finish('Arrival recorded.',()=>{
      t.status='At bay'; t.bay=f.bay; t.arrivalAt=Date.now();
      event(t,'Truck arrived at '+f.bay); log('Truck arrived',id+' · '+t.depot,'bay');
    });
    else if (t.status==='At bay') finish('Loading started.',()=>{
      t.status='Loading'; t.loadingAt=Date.now(); event(t,'Loading started'); log('Loading started',id+' · '+t.bay,'bay');
    });
    else if (t.status==='Loading') finish('Truck released. Delivery tracking started.',()=>{
      t.status='In transit'; t.releasedAt=Date.now();
      t.loadMinutes=t.loadingAt?Math.floor((t.releasedAt-t.loadingAt)/60000):t.arrived ?? 0;
      t.eta='48 min (sample)'; event(t,'Truck released by loading staff'); log('Truck released',id+' · '+t.depot,'check');
    });
  } else if (kind==='deliver') {
    const t=trip(id);
    if (!t || t.done>=t.stops.length || t.status!=='In transit') return generalError(form,'No remaining delivery stop is available.');
    finish('Delivery stop confirmed.',()=>{
      const stop=t.stops[t.done++];
      event(t,'Delivery confirmed at '+stop);
      if (t.done===t.stops.length) { t.status='Delivered'; truck(t.truck).status='Available'; }
      log('Delivery confirmed',id+' · '+stop);
    });
  } else if (kind==='review') {
    const v=truck(id);
    if (!v||v.review!=='Pending review') return generalError(form,'This registration is no longer pending.');
    if (f.decision==='Verified' && (v.docs?.length ?? 0)<3) return generalError(form,'A required document is missing. Request corrections before approving this truck.');
    if (f.decision!=='Verified'&&!f.note.trim()) return setError(form,'note','Explain the decision so the operator can follow up.');
    finish('Verification decision saved.',()=>{
      v.review=f.decision; v.reviewNote=f.note.trim(); if(f.decision==='Verified') { v.status='Available'; v.fresh=null; }
      log('Registration reviewed',v.plate+' · '+f.decision,'shield');
    });
  } else if (kind==='invite'||kind==='edit-user') {
    const email=f.email.trim().toLowerCase();
    const editing = kind==='edit-user';
    const user = editing ? state.users.find(u=>u.email===id) : undefined;
    if (editing && !user) return generalError(form,'This account is no longer available.');
    if (!email.endsWith('@example.com')) return setError(form,'email','Use an example.com email address for this demo.');
    if (state.users.some(u=>u!==user && u.email.toLowerCase()===email)) return setError(form,'email','This email already has a workspace account.');
    if (!roles.includes(f.role) || (editing && !staffStatuses.includes(f.status))) return generalError(form,'Choose a valid role and account status.');
    const record = {name:f.name.trim(),email,role:f.role,status:editing?f.status:'Invited'};
    const isCurrentUser = editing && id===signedInEmail;
    const keepSession = isCurrentUser && isRemembered(id);
    if (!save(editing?'Staff account updated.':'Demo invitation created.',()=>{
      if (user) Object.assign(user,record);
      else state.users.push(record);
    })) return generalError(form,'The account could not be saved. Check your connection or browser storage and try again.');
    if (isCurrentUser && (email!==id || record.status!=='Active')) rememberAccount(record.status==='Active'?email:'',keepSession);
    if (editing && filters.email===id) filters.email=email;
    modal.close();
    render({focus:true});
  } else if (kind==='new-depot'||kind==='edit-depot') {
    const name=f.name.trim();
    if (state.locations.some(d=>d.name!==id && d.name.toLowerCase()===name.toLowerCase())) return setError(form,'name','A depot with this name already exists.');
    const record={name,area:f.area.trim(),bays:Number(f.bays)};
    if (loading().some(t=>t.depot===id && Number(t.bay?.split(' ').at(-1))>record.bays)) return generalError(form,'A truck is still using a bay that would be removed.');
    finish('Depot settings saved.',()=>{
      if (kind==='new-depot') state.locations.push(record);
      else {
        Object.assign(state.locations.find(d=>d.name===id),record);
        state.trips.filter(t=>t.depot===id).forEach(t=>{ t.depot=name; });
      }
    });
  }
});

document.addEventListener('keydown',e=>{
  if (e.key==='Enter' && !e.isComposing && e.target.matches('.registry-search input')) {
    e.preventDefault();
    e.target.form.requestSubmit();
    return;
  }
  if (e.key==='Escape' && !modal.open) {
    if (app.querySelector('.admin-dropup[open]')) {
      closeAdministration(true);
      return;
    }
    if (app.querySelector('.profile-trigger[aria-expanded="true"]')) {
      setProfileOpen(false,true);
      return;
    }
    if (auroraOpen && !navOpen) toggleAurora(false);
    else if (current === 'tracking' && trackActivityOpen && !navOpen) updateTracking('track-activity','');
  }
  if (e.key==='Escape'&&navOpen&&!modal.open) {
    navOpen=false; render(); app.querySelector('[aria-controls="side"]')?.focus();
  }
  if (e.key==='Tab' && navOpen && !modal.open) {
    const items=[...app.querySelectorAll('.sidebar a,.sidebar button,.sidebar summary')].filter(item => item.getClientRects().length && !item.closest('.admin-dropup:not([open]) .admin-panel'));
    if (e.shiftKey && document.activeElement===items[0]) { e.preventDefault(); items.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement===items.at(-1)) { e.preventDefault(); items[0].focus(); }
  }
});
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();document.querySelector('#main')?.focus();});
window.addEventListener('hashchange',routeChanged);
for (const eventType of ['online','offline']) window.addEventListener(eventType,()=>{
  const banner=document.querySelector('#connection');
  if (banner) banner.hidden=navigator.onLine;
});
routeChanged();
