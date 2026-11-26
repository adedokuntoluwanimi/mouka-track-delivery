'use strict';

const ui = id => document.getElementById(id);
const shell = ui('driverWorkspace');
const settings = ui('driverSettings');
const finder = ui('quickSearch');
const themeQuery = matchMedia('(prefers-color-scheme: dark)');
const mobileNav = matchMedia('(max-width: 760px)');
const links = [
  ['overview','Dispatch Overview','grid'], ['trips','My Trips','truck'], ['notifications','Notifications','bell'],
  ['sync','Sync & Tracking','gps'], ['issue','Report an Issue','warning'], ['profile','Profile','user'], ['help','Help & Support','help']
];
Object.assign(shapes, {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4m-9 4h6m-6 4h6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 6 0 0 1 16 0v2"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3V8m-8 12h4"/>',
  warning:'<path d="M12 3 2 21h20L12 3Zm0 7v4m0 3h.01"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1.1-1 2m0 3h.01"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>', up:'<path d="m6 15 6-6 6 6"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  system:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  dark:'<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>',
  logout:'<path d="M10 5H5v14h5m2-7h8m-3-3 3 3-3 3"/>',
  wifi:'<path d="M2 9a15 15 0 0 1 20 0M5.500 12.500a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.500h.01"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 1-9.900A6 6 0 0 1 20 11a3.500 3.500 0 0 1-1 7z"/>',
  pencil:'<path d="m4 20 1-5L16 4l4 4L9 19zM14 6l4 4"/>', shield:'<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>'
});

let driverProfile;
let driverData;
let page = 'overview';
let profileEditing = false;
let feedback = '';
let homeTrip = '';
let homeZoom = 1;
let tripFilter = '';
let tripQuery = '';
let tripLayout = 'grid';
const closedSections = new Set();
const noticeView = {query:'', kind:'', read:''};
let reportDraft = {trip:'', type:'', note:''};
let reportFilter = '';
let faqTopic = '';
let faqQuery = '';
let railed = false;
const accountCache = new Map();
try { railed = localStorage.getItem('mouka-driver:rail') === 'true'; } catch {}
try { if (localStorage.getItem('mouka-driver:trip-layout') === 'list') tripLayout = 'list'; } catch {}

function getDriverData(driverId) {
  if (accountCache.has(driverId)) return accountCache.get(driverId);
  let saved;
  try { saved = JSON.parse(localStorage.getItem('mouka-driver:workspace:' + driverId)); } catch {}
  const data = {theme:'light', font:'standard', proofs:[], issues:[], read:[], profile:{}, adminNotices:[], ...saved};
  accountCache.set(driverId, data);
  return data;
}
function saveDriverData() {
  try {
    localStorage.setItem('mouka-driver:workspace:' + driverProfile.id, JSON.stringify(driverData));
    return true;
  } catch {
    return false;
  }
}

const darkNow = () => driverData?.theme === 'dark' || (driverData?.theme === 'system' && themeQuery.matches);
function applyAppearance() {
  if (!driverData) return;
  shell.dataset.theme = darkNow() ? 'dark' : 'light';
  shell.dataset.font = driverData.font;
  ui('driverFont').value = driverData.font;
  for (const button of ui('appearanceOptions').children) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === driverData.theme));
  ui('darkSwitch')?.setAttribute('aria-checked', String(darkNow()));
}
function setSettings(open) {
  settings.hidden = !open;
  ui('accountSettings').setAttribute('aria-expanded', String(open));
}
function setNavigation(open, restoreFocus = true) {
  shell.classList.toggle('nav-open', open);
  ui('navScrim').hidden = !open;
  shell.querySelector('.workspace-body').inert = open;
  dock.inert = open;
  ui('navToggle').setAttribute('aria-expanded', String(open));
  if (open) ui('navClose').focus();
  else {
    setSettings(false);
    if (restoreFocus && mobileNav.matches) ui('navToggle').focus();
  }
}

// ---- What the screens are built from ----
const activeTrip = () => state.assignments.find(trip => phase(trip.id) === 'active');
const byPhase = key => state.assignments.filter(trip => phase(trip.id) === key);
const stopTotal = () => state.assignments.reduce((sum, trip) => sum + trip.stops.length, 0);
const stopsDone = () => state.assignments.reduce((sum, trip) => sum + doneStops(trip), 0);
const initialsOf = name => name.split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase();
const prettyDate = input => input ? new Intl.DateTimeFormat('en-NG', {dateStyle:'medium', timeStyle:'short'}).format(new Date(input)) : 'Earlier in this demo';
const statusMessage = () => feedback ? `<p class="form-result" role="status">${safe(feedback)}</p>` : '';

function inbox() {
  const admin = driverData.adminNotices.map(entry => ({id:entry.id, kind:'account', title:'Profile change queued for admin', detail:entry.fields.join(', '), time:prettyDate(entry.time), icon:'user'}));
  const trips = state.assignments.map(trip => ({id:trip.id, kind:'trip', title:destination(trip) + ' delivery assigned', detail:`${trip.id} · ${trip.origin}`, time:trip.window, trip:trip.id, icon:'truck'}));
  return [...admin, ...trips].map(item => ({...item, unread:!driverData.read.includes(item.id)}));
}
const unreadCount = () => inbox().filter(item => item.unread).length;

function topTools() {
  return `<div class="tools"><button type="button" class="search-pill" data-open-search>${svg('search')}<span>Search trips and pages…</span><kbd>Ctrl K</kbd></button>
    <button type="button" class="round" data-page="notifications" aria-label="Notifications, ${unreadCount()} unread" title="Notifications">${svg('bell')}${unreadCount() ? '<i class="dot"></i>' : ''}</button>
    <button type="button" class="round" data-page="help" aria-label="Help and support" title="Help and support">${svg('help')}</button>
    <button type="button" class="round me" data-page="profile" aria-label="Your profile" title="Your profile">${safe(initialsOf(driverProfile.name))}</button></div>`;
}
const pageHeader = title => `<header class="page-head"><h1 tabindex="-1">${title}</h1>${topTools()}</header>`;
const statRow = (label, attribute, pressed, items) => `<div class="stat-row" role="group" aria-label="${label}">${items.map(([key, icon, title, value, note]) => {
  const inner = `<i>${svg(icon)}</i><span><span>${title}</span><b>${value}</b><small>${note}</small></span>`;
  return attribute ? `<button type="button" ${attribute}="${key}" aria-pressed="${pressed === key}">${inner}</button>` : `<div>${inner}</div>`;
}).join('')}</div>`;
const panel = (title, note, content, extra = '', look = '') => `<section class="panel ${look}"><header><div><h2>${title}</h2>${note ? `<small>${note}</small>` : ''}</div>${extra}</header>${content}</section>`;
const moreButton = (target, label) => `<button type="button" class="more" data-page="${target}">${label} ${svg('chevron')}</button>`;
const empty = (icon, title, text, action = '') => `<div class="empty">${svg(icon)}<h2>${title}</h2><p>${text}</p>${action}</div>`;
const truckPhoto = plate => `<canvas class="truck-photo" data-photo="${safe(vehicleType(plate))}|${safe(plate)}" width="720" height="400" aria-hidden="true"></canvas>`;

// ---- Dispatch Overview ----
function overview() {
  const active = activeTrip();
  const upcoming = byPhase('assigned');
  const trip = state.assignments.find(item => item.id === homeTrip) || active || upcoming[0] || state.assignments[0];
  const status = phase(trip.id);
  const done = doneStops(trip);
  const next = trip.stops[done];
  const hour = Number(new Intl.DateTimeFormat('en-GB', {hour:'2-digit', hourCycle:'h23', timeZone:'Africa/Lagos'}).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-NG', {weekday:'long', day:'numeric', month:'long', timeZone:'Africa/Lagos'}).format(new Date());
  const tracking = status === 'active' && state.tracking;
  const stat = (target, filter, label, value, badge, note) => `<button type="button" data-home-stat="${target}:${filter}"><span>${label}</span><b>${value}${badge ? `<em>${badge}</em>` : ''}</b><small>${note}</small></button>`;
  const steps = [{label:trip.origin, note:status === 'assigned' ? 'Pickup' : 'Departed', reached:status !== 'assigned'},
    ...trip.stops.map((stop, i) => ({label:stop.name, note:i < done ? 'Delivered' : i === done && status === 'active' ? 'Next stop' : 'Pending', reached:i < done}))];
  const current = status === 'completed' ? -1 : status === 'assigned' ? 0 : Math.min(done + 1, steps.length - 1);
  const history = tripHistory(trip).slice(0, 4);
  return `<header class="home-head">
      <div><p>${safe(today)}</p><h1 tabindex="-1">${greeting}, ${safe(driverProfile.name.split(' ')[0])}</h1><p class="sub">Here’s your delivery work at a glance.</p></div>${topTools()}
    </header>
    <div class="home-stats" role="group" aria-label="Your trip totals">
      ${stat('trips','','Assigned trips',state.assignments.length,'','in your list')}
      ${stat('trips','active','In progress',byPhase('active').length,active ? 'live' : '',active ? active.id : 'no active trip')}
      ${stat('trips','assigned','Upcoming',upcoming.length,'',upcoming[0] ? upcoming[0].window : 'nothing waiting')}
      ${stat('trips','completed','Completed',byPhase('completed').length,'','trips finished')}
      ${stat('sync','','Stops confirmed',stopsDone(),stopTotal() ? Math.round(stopsDone() / stopTotal() * 100) + '%' : '',`of ${stopTotal()} stops`)}
    </div>
    <div class="home-hero">
      <section class="stage" aria-label="Selected trip">
        <div class="stage-top">
          <div><p class="flag ${status}"><i></i>${status === 'active' ? 'Trip in progress' : status === 'completed' ? 'Trip completed' : 'Next assignment'}</p>
            <h2>${safe(trip.origin)} to ${safe(destination(trip))} ${chip(trip.id)}</h2><small>${safe(trip.id)} · ${safe(trip.truck)} · ${safe(vehicleType(trip.truck))}</small></div>
          <dl><div><dt>Departure</dt><dd>${safe(trip.window)}</dd></div><div><dt>Stops</dt><dd>${done} of ${trip.stops.length}</dd></div><div><dt>Tracking</dt><dd class="${tracking ? 'good' : ''}">${tracking ? 'On' : 'Off'}</dd><small>simulated</small></div></dl>
        </div>
        <div class="home-map">${tripMap(trip).map}
          <p class="map-key"><span class="pickup"><i></i>Pickup</span><span class="drop"><i></i>Delivery</span><span class="done"><i></i>Delivered</span></p>
          <div class="map-zoom" role="group" aria-label="Map zoom"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><output>100%</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="reset">Reset</button></div>
          <p class="tr-note">Illustrative map</p>
        </div>
        <ol class="route-line">${steps.map((step, i) => `<li class="${step.reached ? 'done' : ''} ${i === current ? 'now' : ''}"><i></i><span>${safe(step.label)}</span><small>${safe(step.note)}</small></li>`).join('')}</ol>
        <div class="stage-actions"><button type="button" class="primary purple" data-open-trip="${safe(trip.id)}">${svg('route')} ${status === 'active' ? 'Resume trip' : status === 'completed' ? 'Review trip' : 'Open trip details'}</button>
          <button type="button" class="button" data-report="${safe(trip.id)}">${svg('warning')} Report an issue</button><button type="button" class="button" data-page="sync">${svg('gps')} Sync status</button></div>
      </section>
      <aside class="picker" aria-label="Choose a trip">
        <header><h2>Choose a trip</h2><small>${plural(state.assignments.length,'assignment')}</small></header>
        <ul>${state.assignments.map(item => `<li><button type="button" data-home-trip="${safe(item.id)}" aria-pressed="${item.id === trip.id}">
          <span class="ride-icon">${svg('truck')}</span><span class="ride-copy"><strong>${safe(destination(item))} delivery</strong><small>${safe(item.id)} · ${plural(item.stops.length,'stop')}</small><small>${safe(item.window)}</small></span>${chip(item.id)}</button></li>`).join('')}</ul>
        <div class="day"><span><strong>Your progress</strong><small>${stopsDone()} of ${stopTotal()} stops confirmed</small></span><progress class="meter violet" value="${stopsDone()}" max="${Math.max(1,stopTotal())}"></progress></div>
      </aside>
    </div>
    <div class="three">
      ${panel('Delivery stops',safe(trip.id),`<ol class="stops">${trip.stops.map((stop, i) => `<li class="${i < done ? 'done' : i === done && status === 'active' ? 'next' : ''}"><i>${i < done ? svg('check') : i + 1}</i><span><strong>${safe(stop.name)}</strong><small>${safe(stop.area)}</small></span></li>`).join('')}</ol>`)}
      ${panel('Trip activity','Newest first',`<ol class="history">${history.map(event => `<li><strong>${safe(event.title)}</strong>${event.time ? `<small>${safe(event.time)}</small>` : ''}</li>`).join('')}</ol>`)}
      ${panel('Quick actions','Common tasks',`<ul class="quick">${[['trips','truck','My Trips','See every assignment'],['issue','warning','Report an issue','Delay, breakdown or address'],['profile','user','Update your profile','Contact and licence details'],['help','help','Get help','Answers about trips and PINs']].map(([target,icon,title,note]) => `<li><button type="button" data-page="${target}"><span>${svg(icon)}</span><span><strong>${title}</strong><small>${note}</small></span>${svg('chevron')}</button></li>`).join('')}</ul>`)}
    </div>`;
}

function applyZoom() {
  const map = screen.querySelector('.home-map');
  if (!map) return;
  const width = 600 / homeZoom, height = 460 / homeZoom;
  map.querySelector('svg').setAttribute('viewBox', `${300 - width / 2} ${230 - height / 2} ${width} ${height}`);
  map.querySelector('output').textContent = Math.round(homeZoom * 100) + '%';
}

// ---- My Trips ----
const tripSections = [['active','In progress','The trip you are driving now','truck'],['assigned','Upcoming','Assigned and waiting to start','time'],['completed','Completed','Finished deliveries','check']];
const tripText = trip => [trip.id, trip.truck, trip.origin, trip.window, ...trip.stops.flatMap(stop => [stop.name, stop.area])].join(' ').toLowerCase();
function tripTile(trip) {
  const status = phase(trip.id);
  const done = doneStops(trip);
  return `<li class="trip-card" data-search="${safe(tripText(trip))}">
    <div class="trip-top">${chip(trip.id)}<div class="trip-name"><h3>${safe(trip.id)}</h3><small>${safe(destination(trip))} delivery • ${plural(trip.stops.length,'stop')}</small></div><div class="trip-photo">${svg('truck')}${truckPhoto(trip.truck)}</div></div>
    <div class="trip-info"><div class="line"><strong>${safe(trip.origin)} → ${safe(destination(trip))}</strong><small>${safe(trip.truck)} • ${safe(trip.window)}</small></div>
      <div class="measure"><span>Delivery progress</span><b>${done} of ${trip.stops.length} stops</b></div>
      <progress class="meter ${status === 'completed' ? 'green' : status === 'active' ? 'violet' : 'amber'}" value="${done}" max="${trip.stops.length}"></progress>
      <button type="button" class="button wide" data-open-trip="${safe(trip.id)}">${status === 'active' ? 'Resume trip' : status === 'completed' ? 'Review trip' : 'Open trip'}</button></div></li>`;
}
function tripsResults() {
  const query = tripQuery.toLowerCase().trim();
  let shown = 0;
  const sections = tripSections.filter(([key]) => !tripFilter || key === tripFilter).map(([key, title, note, icon]) => {
    const trips = byPhase(key).filter(trip => tripText(trip).includes(query));
    shown += trips.length;
    if ((query || tripFilter) && !trips.length) return '';
    return `<details class="section ${key}" data-section="${key}" ${closedSections.has(key) && !query ? '' : 'open'}>
      <summary><span class="section-icon">${svg(icon)}</span><span><h2>${title} <em>${trips.length}</em></h2><small>${note}</small></span>${svg('chevron')}</summary>
      ${trips.length ? `<ul class="trip-grid ${tripLayout}">${trips.map(tripTile).join('')}</ul>` : '<p class="none">No trips in this section right now.</p>'}</details>`;
  }).join('');
  return shown || (!query && !tripFilter) ? sections : empty('truck','No trips match','Try another search or clear your filter.','<button type="button" class="button" data-trip-reset>Clear filters</button>');
}
function tripsPage() {
  const stat = (key, icon, title, note) => `<button type="button" class="tile-stat" data-trip-filter="${key}" aria-pressed="${tripFilter === key}"><span>${svg(icon)}${title}</span><b>${String(key ? byPhase(key).length : state.assignments.length).padStart(2,'0')}</b><small>${note}</small></button>`;
  return `${pageHeader('My Trips')}
    <section class="panel"><header><div><h2>Trip overview</h2></div><small>${stopsDone()} of ${stopTotal()} stops confirmed</small></header>
      <div class="tile-stats" role="group" aria-label="Filter your trips">${stat('','grid','All trips','Everything assigned to you')}${stat('active','truck','In progress','On the road now')}${stat('assigned','time','Upcoming','Waiting to start')}${stat('completed','check','Completed','Finished runs')}</div></section>
    <div class="toolbar"><label class="search-box">${svg('search')}<input type="search" data-trip-query value="${safe(tripQuery)}" placeholder="Search trip, depot or stop" aria-label="Search your trips"></label>
      <div class="switch" role="group" aria-label="Choose a view">${[['grid','Grid'],['list','List']].map(([key,label]) => `<button type="button" data-layout="${key}" aria-pressed="${tripLayout === key}">${svg(key)} ${label}</button>`).join('')}</div></div>
    <div id="tripResults">${tripsResults()}</div>`;
}

// ---- Notifications ----
function noticeResults() {
  const query = noticeView.query.toLowerCase().trim();
  const items = inbox().filter(item => (!noticeView.kind || (noticeView.kind === 'unread' ? item.unread : item.kind === noticeView.kind))
    && (!noticeView.read || (noticeView.read === 'unread') === item.unread) && `${item.title} ${item.detail}`.toLowerCase().includes(query));
  if (!items.length) return empty('bell','No notifications match','Try another search or filter.','<button type="button" class="button" data-notice-reset>Clear filters</button>');
  return `<ul class="notice-list">${items.map(item => `<li class="${item.unread ? 'unseen' : ''}">
    <span class="solid-icon">${svg(item.icon)}</span><div class="notice-copy"><strong>${safe(item.title)}${item.unread ? '<i aria-label="Unread"></i>' : ''}</strong><small>${safe(item.detail)}</small></div>
    <span class="chip ${item.kind === 'trip' ? 'violet' : 'green'}">${item.kind === 'trip' ? 'Trip' : 'Account'}</span><time>${safe(item.time)}</time>
    <div class="notice-actions">${item.trip ? `<button type="button" class="button small" data-open-trip="${safe(item.trip)}" data-read-notice>Open trip</button>` : '<button type="button" class="button small" data-page="sync">View outbox</button>'}
      <button type="button" class="icon-only" data-toggle-read="${safe(item.id)}" aria-label="${item.unread ? 'Mark as read' : 'Mark as unread'}" title="${item.unread ? 'Mark as read' : 'Mark as unread'}">${svg(item.unread ? 'check' : 'mail')}</button></div></li>`).join('')}</ul>
    <p class="list-foot" role="status">${plural(items.length,'notification')}</p>`;
}
function notificationsPage() {
  const items = inbox();
  const select = (key, label, all, choices) => `<label class="field-soft"><span>${label}</span><select data-notice-field="${key}"><option value="">${all}</option>${choices.map(([value,text]) => `<option value="${value}" ${noticeView[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  const active = activeTrip();
  const next = active || byPhase('assigned')[0];
  return `${pageHeader('Notifications')}
    ${statRow('Filter notifications','data-notice-stat',noticeView.kind,[['','bell','All notifications',items.length,'Your updates'],['unread','mail','Unread',unreadCount(),'Waiting for you'],['trip','truck','Trips',items.filter(i => i.kind === 'trip').length,'Assignments'],['account','user','Account',items.filter(i => i.kind === 'account').length,'Profile notices']])}
    <div class="filters"><label class="field-soft grow"><span>Search</span><input type="search" data-notice-field="query" value="${safe(noticeView.query)}" placeholder="Notifications…"></label>
      ${select('read','Read status','Read and unread',[['unread','Unread only'],['read','Read only']])}
      <button type="button" class="button solid" data-read-all ${unreadCount() ? '' : 'disabled'}>${svg('check')} Mark all as read</button></div>
    <div class="with-side"><section id="noticeResults" aria-label="Notification list">${noticeResults()}</section>
      ${panel('Needs your action','What to do next',`<ul class="quick">${next ? `<li><button type="button" data-open-trip="${safe(next.id)}"><span>${svg('truck')}</span><span><strong>${active ? 'Resume your trip' : 'Start your next trip'}</strong><small>${safe(next.id)} to ${safe(destination(next))}</small></span>${svg('chevron')}</button></li>` : ''}
        <li><button type="button" data-page="sync"><span>${svg('cloud')}</span><span><strong>Check queued updates</strong><small>${plural((state.pending || 0) + driverData.adminNotices.length,'item')} on this device</small></span>${svg('chevron')}</button></li></ul>`)}</div>`;
}

// ---- Sync & Tracking ----
function syncPage() {
  const active = activeTrip();
  const online = navigator.onLine;
  const health = [
    ['gps','Location sharing',state.tracking ? 'Demo tracking active' : 'Idle',state.tracking ? 'green' : 'gray',state.tracking ? 'A trip is in progress. Location is simulated.' : 'Tracking starts when you start a trip.'],
    ['wifi','Browser connection',online ? 'Online' : 'Offline',online ? 'green' : 'amber',online ? 'Your browser reports a connection.' : 'Changes stay on this device.'],
    ['cloud','Dispatch delivery','Preview only','amber','Updates are not sent to a Dispatch server.']
  ];
  const rows = [
    ...state.assignments.flatMap(trip => (state.trips[trip.id]?.log || []).map(([action, index, stamp]) => ({type:'Trip update', icon:'route', title:action === 'start' ? 'Trip started' : action === 'end' ? 'Trip ended' : 'Delivery confirmed at ' + trip.stops[index].name, ref:trip.id, when:stamp, status:'Queued'}))),
    ...driverData.adminNotices.map(entry => ({type:'Admin notice', icon:'user', title:'Profile change: ' + entry.fields.join(', '), ref:driverProfile.id, when:entry.time, status:'Queued'})),
    ...driverData.issues.map(entry => ({type:'Issue report', icon:'warning', title:entry.type, ref:entry.trip || 'General', when:entry.time, status:'Saved locally'}))
  ].sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));
  return `${pageHeader('Sync & Tracking')}
    ${statRow('Saved on this device','',null,[['','route','Trip updates',state.pending || 0,'Waiting in the queue'],['','user','Admin notices',driverData.adminNotices.length,'Profile changes'],['','warning','Issue reports',driverData.issues.length,'Saved in this browser'],['','truck','Active trip',active ? safe(active.id) : 'None',active ? 'In progress' : 'Not driving']])}
    <div class="health">${health.map(([icon,title,value,tone,note]) => `<article class="${tone}"><span class="health-icon">${svg(icon)}</span><div><small>${title}</small><strong>${value}</strong><p>${note}</p></div></article>`).join('')}</div>
    <div class="row-actions"><button type="button" class="button solid" data-refresh-sync>${svg('gps')} Refresh status</button>${active ? `<button type="button" class="button" data-open-trip="${safe(active.id)}">Open active trip</button>` : ''}${statusMessage()}</div>
    ${panel('Outbox','Everything waiting on this device',rows.length ? `<div class="table-scroll"><table class="table"><thead><tr><th>Update</th><th>Type</th><th>Reference</th><th>Saved</th><th>Status</th></tr></thead><tbody>${rows.map(row => `<tr><td data-label="Update"><span class="cell"><span class="solid-icon small">${svg(row.icon)}</span><strong>${safe(row.title)}</strong></span></td><td data-label="Type">${row.type}</td><td data-label="Reference">${safe(row.ref)}</td><td data-label="Saved">${safe(prettyDate(row.when))}</td><td data-label="Status"><span class="chip amber">${row.status}</span></td></tr>`).join('')}</tbody></table></div>` : empty('cloud','Nothing is waiting','Trip updates, reports and profile changes appear here.'))}
    ${state.pending ? '<details class="demo-reset"><summary>Demo trip controls</summary><p>Reset the trip simulation and its queued trip updates.</p><button type="button" class="button" data-reset-progress>Reset demo trip progress</button></details>' : ''}`;
}

// ---- Report an Issue ----
const issueTypes = [['Delay','time','amber','Running behind schedule'],['Vehicle breakdown','truck','red','The truck cannot continue'],['Wrong address','route','violet','Location does not match'],['Rejected delivery','file','red','Customer would not accept'],['Other','help','green','Something else']];
function reportRows() {
  const entries = driverData.issues.filter(entry => !reportFilter || entry.type === reportFilter);
  if (!entries.length) return empty('warning',reportFilter ? 'No reports of this type' : 'No issue reports yet',reportFilter ? 'Choose another type.' : 'Reports you save appear here.');
  return `<ul class="report-list">${entries.map(entry => `<li><span class="solid-icon small">${svg(issueTypes.find(item => item[0] === entry.type)?.[1] || 'warning')}</span><div><strong>${safe(entry.type)}${entry.trip ? ' · ' + safe(entry.trip) : ''}</strong><small>${safe(entry.ref || 'Demo report')} · ${safe(prettyDate(entry.time))}</small><p>${safe(entry.note)}</p></div><span class="chip amber">Saved locally</span></li>`).join('')}</ul>`;
}
function issuePage() {
  const active = activeTrip();
  const trip = reportDraft.trip || active?.id || '';
  const type = reportDraft.type || 'Delay';
  return `${pageHeader('Report an Issue')}
    <section class="panel"><header><div><h2>What happened?</h2><small>Choose the closest category.</small></div></header>
      <div class="categories" role="group" aria-label="Issue category">${issueTypes.map(([name,icon,tone,note]) => `<button type="button" class="${tone}" data-issue-type="${name}" aria-pressed="${type === name}"><span>${svg(icon)}</span><strong>${name}</strong><small>${note}</small><em>${plural(driverData.issues.filter(entry => entry.type === name).length,'report')}</em></button>`).join('')}</div></section>
    <div class="two">
      ${panel('New report','Saved in this browser. For urgent problems, also contact your dispatcher.',`<form class="form" data-record-form="issue">
        <label for="issueTrip">Trip</label><select id="issueTrip" name="trip"><option value="">General issue</option>${state.assignments.map(item => `<option value="${safe(item.id)}" ${trip === item.id ? 'selected' : ''}>${safe(item.id)} · ${safe(destination(item))}</option>`).join('')}</select>
        <label for="issueType">Issue type</label><select id="issueType" name="type">${issueTypes.map(([name]) => `<option ${type === name ? 'selected' : ''}>${name}</option>`).join('')}</select>
        <label for="issueNote">What happened?</label><textarea id="issueNote" name="note" required maxlength="500" placeholder="Include the stop or location if relevant">${safe(reportDraft.note)}</textarea>
        <p class="count"><span id="noteCount">${reportDraft.note.length}</span> of 500</p>
        <button type="submit" class="primary">Save report</button></form>${statusMessage()}`)}
      ${panel('Report history',plural(driverData.issues.length,'saved report'),`<div id="reportRows">${reportRows()}</div>`,`<select class="mini" data-report-filter aria-label="Filter reports by type"><option value="">All types</option>${issueTypes.map(([name]) => `<option ${reportFilter === name ? 'selected' : ''}>${name}</option>`).join('')}</select>`)}
    </div>`;
}

// ---- Profile ----
const profileGroups = [
  ['Contact details','user',[['name','Full name','text',90],['email','Email','email',120],['phone','Phone number','tel',24],['depot','Home depot','text',65]]],
  ['Driving licence','shield',[['licence','Driver licence number','text',45],['licenceExpiry','Licence expiry date','date',10]]],
  ['Emergency contact','phone',[['emergencyName','Emergency contact','text',90],['emergencyPhone','Emergency phone','tel',24]]]
];
const profileFields = profileGroups.flatMap(group => group[2]);
function profileValue(key) {
  const value = driverProfile[key] || '';
  return key === 'phone' && value ? '+' + value : value;
}
function licenceNote() {
  if (!driverProfile.licenceExpiry) return ['gray','No expiry date added'];
  const days = Math.ceil((new Date(driverProfile.licenceExpiry) - Date.now()) / 86400000);
  return days < 0 ? ['red','Licence date has passed'] : days <= 30 ? ['amber',`Expires in ${plural(days,'day')}`] : ['green','Licence date is current'];
}
function profilePage() {
  const filled = profileFields.filter(([key]) => driverProfile[key]).length;
  const [tone, note] = licenceNote();
  const latest = driverData.adminNotices[0];
  const body = profileEditing ? `<form class="form" data-record-form="profile">${profileGroups.map(([title,,fields]) => `<fieldset><legend>${title}</legend><div class="fields">${fields.map(([key,label,type,max]) => `<label>${label}<input ${['name','email','phone'].includes(key) ? 'required' : ''} name="${key}" type="${type}" maxlength="${max}" value="${safe(profileValue(key))}"></label>`).join('')}</div></fieldset>`).join('')}
      <div class="row-actions"><button type="submit" class="primary">Save profile</button><button type="button" class="button" data-profile-edit="off">Cancel</button></div></form>${statusMessage()}`
    : `${profileGroups.map(([title,icon,fields]) => panel(title,'',`<dl class="read">${fields.map(([key,label]) => `<div><dt>${label}</dt><dd class="${profileValue(key) ? '' : 'missing'}">${safe(profileValue(key) || 'Not added')}</dd></div>`).join('')}</dl>`,`<span class="section-icon plain">${svg(icon)}</span>`)).join('')}${statusMessage()}`;
  return `${pageHeader('Profile')}
    <section class="profile-banner"><span class="avatar large">${safe(initialsOf(driverProfile.name))}</span><div><h2>${safe(driverProfile.name)}</h2><p>${safe(driverProfile.depot || 'Home depot not added')} · Driver ID ${safe(driverProfile.id)}</p><span class="chip ${tone}">${note}</span></div>
      <div class="complete"><span><strong>Profile details</strong><small>${filled} of ${profileFields.length} added</small></span><progress class="meter violet" value="${filled}" max="${profileFields.length}"></progress></div>
      ${profileEditing ? '' : `<button type="button" class="button solid" data-profile-edit="on">${svg('pencil')} Edit profile</button>`}</section>
    <div class="with-side"><div class="column">${profileEditing ? panel('Edit driver details','Saving a change queues an admin notice.',body) : body}</div>
      <div class="column">${panel('Your account','Your Driver ID is set by Dispatch.',`<dl class="read one"><div><dt>Driver ID</dt><dd>${safe(driverProfile.id)}</dd></div><div><dt>Trips assigned</dt><dd>${state.assignments.length}</dd></div><div><dt>Stops confirmed</dt><dd>${stopsDone()}</dd></div></dl>`)}
      ${panel('Latest admin notice','Profile updates appear in the demo admin outbox.',latest ? `<p><strong>${safe(latest.fields.join(', '))}</strong><br><small>${safe(prettyDate(latest.time))}</small></p><div class="row-actions"><span class="chip amber">Queued for admin</span>${moreButton('sync','View outbox')}</div>` : empty('user','No profile changes yet','Changes you save are listed here.'))}</div></div>`;
}

// ---- Help & Support ----
const faqs = [
  ['Trips','How do I start or end a trip?','Open My Trips, select the assignment, then start at departure. Confirm each stop in order before ending the trip.'],
  ['Deliveries','Where can I find directions to a stop?','Open the assignment in My Trips. Directions appear beside the stops when the trip includes addresses. The sample trips use an illustrative map.'],
  ['Tracking','What happens if I lose connection?','Open Sync & Tracking to see your queued updates. This browser demo stores them locally and simulates tracking.'],
  ['Account','How do I update my phone number or email?','Open Profile, choose Edit profile and save. A notice is added to the demo admin outbox.'],
  ['Account','How do I recover my PIN?','Contact your dispatcher using the details your depot gave you. Have your Driver ID ready.'],
  ['Trips','What if I cannot complete a delivery?','Open Report an Issue, choose the trip and type of issue, and describe what happened. Contact your dispatcher directly if you need an immediate response.']
];
function faqRows() {
  const query = faqQuery.toLowerCase().trim();
  const rows = faqs.filter(([topic,question,answer]) => (!faqTopic || topic === faqTopic) && `${topic} ${question} ${answer}`.toLowerCase().includes(query));
  return rows.length ? `<div class="faq">${rows.map(([topic,question,answer]) => `<details><summary><span class="chip violet">${topic}</span><strong>${question}</strong>${svg('chevron')}</summary><p>${answer}</p></details>`).join('')}</div><p class="list-foot" role="status">${plural(rows.length,'answer')}</p>` : empty('help','No answers match','Try a different word or topic.');
}
function helpPage() {
  return `${pageHeader('Help & Support')}
    <section class="help-hero"><h2>How can we help?</h2><label class="search-box big">${svg('search')}<input type="search" data-faq-query value="${safe(faqQuery)}" placeholder="Try PIN, directions or tracking" aria-label="Search help"></label>
      <div class="topics" role="group" aria-label="Help topics">${['', ...new Set(faqs.map(item => item[0]))].map(topic => `<button type="button" data-faq-topic="${topic}" aria-pressed="${faqTopic === topic}">${topic || 'All topics'}</button>`).join('')}</div></section>
    <div class="shortcuts">${[['trips','truck','Find a trip','Your assignments'],['issue','warning','Report an issue','Tell us what happened'],['sync','gps','Check tracking','Connection and queue'],['profile','user','Update details','Contact and licence']].map(([target,icon,title,note]) => `<button type="button" data-page="${target}"><span>${svg(icon)}</span><strong>${title}</strong><small>${note}</small></button>`).join('')}</div>
    <div class="with-side"><section id="faqRows" aria-label="Common questions">${faqRows()}</section>
      ${panel('Still need help?','App support by email',`<p class="muted">Include your trip number, the time and what you expected to happen. Leave out your PIN.</p><a class="button solid wide" href="mailto:contact@terracodeanalytics.com">${svg('mail')} Email app support</a>`)}</div>`;
}

const screens = {overview, trips:tripsPage, notifications:notificationsPage, sync:syncPage, issue:issuePage, profile:profilePage, help:helpPage};

// ---- Sidebar, redraw and 3D ----
function renderSidebar() {
  const current = page === 'detail' ? 'trips' : page;
  const unread = unreadCount();
  const item = ([key,label,icon], badge = '') => `<button type="button" class="side-link" data-page="${key}" title="${label}" ${current === key ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span>${badge}</button>`;
  const by = key => links.find(link => link[0] === key);
  const open = shell.classList.contains('trips-open') || current === 'trips';
  const group = (label, content) => `<div class="side-group"><p>${label}</p>${content}</div>`;
  const nav = ui('driverNav');
  const scroll = nav.scrollTop;
  nav.innerHTML = group('Main menu', item(by('overview')) +
      `<div class="branch ${open ? 'open' : ''}">${item(by('trips'),`<em>${state.assignments.length}</em>`)}<button type="button" class="fold" data-fold aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} trip shortcuts">${svg('chevron')}</button>
        <ul ${open ? '' : 'hidden'}>${tripSections.map(([key,label]) => `<li><button type="button" data-home-stat="trips:${key}" ${page === 'trips' && tripFilter === key ? 'aria-current="true"' : ''}><span>${label}</span><em>${byPhase(key).length}</em></button></li>`).join('')}</ul></div>` +
      item(by('notifications'), unread ? `<em>${unread}</em>` : '')) +
    group('On the road', item(by('sync'), state.pending ? `<em>${state.pending}</em>` : '') + item(by('issue'), driverData.issues.length ? `<em>${driverData.issues.length}</em>` : '')) +
    group('Account', item(by('profile')) + item(by('help'))) +
    `<button type="button" class="side-card" data-page="trips"><span><strong>Your progress</strong><small>${stopsDone()} of ${stopTotal()} stops confirmed</small></span><progress class="meter green" value="${stopsDone()}" max="${Math.max(1,stopTotal())}"></progress></button>`;
  nav.scrollTop = scroll;
  for (const link of ui('tabbar').querySelectorAll('[data-page]')) link.toggleAttribute('data-current', link.dataset.page === current);
}

let truckLibrary;
const photos = new Map();
function mountTrucks() {
  if (!screen.querySelector('canvas[data-photo]') || !window.loadTrucks) return;
  truckLibrary ||= window.loadTrucks();
  truckLibrary.then(async library => {
    for (const canvas of screen.querySelectorAll('canvas[data-photo]:not(.ready)')) {
      const key = canvas.dataset.photo;
      if (!photos.has(key)) {
        const store = document.createElement('canvas');
        store.width = 720; store.height = 400;
        const [type, plate] = key.split('|');
        await library.truckSnapshot(type, plate, store);
        photos.set(key, store);
      }
      canvas.getContext('2d').drawImage(photos.get(key), 0, 0);
      canvas.classList.add('ready');
    }
  }).catch(() => {});  // The truck icon stays when the browser cannot draw 3D.
}

window.closeDriverNavigation = () => setNavigation(false, false);
window.renderWorkspace = () => {
  if (!driverProfile) return;
  shell.dataset.page = page;
  ui('workspaceCrumb').textContent = page === 'detail' ? 'Trip Details' : links.find(item => item[0] === page)[1];
  renderSidebar();
  if (page === 'detail') {
    render();
    return;
  }
  dock.hidden = true;
  dock.innerHTML = '';
  notice.hidden = true;
  screen.innerHTML = screens[page]();
  applyZoom();
  mountTrucks();
};

// Redraws and keeps the keyboard user on the control they used.
function redraw(selector) {
  window.renderWorkspace();
  if (selector) (screen.querySelector(selector) || ui('driverNav').querySelector(selector))?.focus({preventScroll:true});
}
function openPage(next) {
  page = next;
  profileEditing = false;
  feedback = '';
  shell.classList.remove('trips-open');
  setNavigation(false, false);
  window.renderWorkspace();
  const title = screen.querySelector('h1');
  title?.setAttribute('tabindex', '-1');
  title?.focus({preventScroll:true});
  window.scrollTo(0, 0);
}
function openTrip(id) {
  selected = id;
  openPage('detail');
}
function markNotice(id) {
  if (!driverData.read.includes(id)) driverData.read.push(id);
  saveDriverData();
}

// ---- Quick search ----
function searchResults(query = '') {
  const words = query.toLowerCase().trim().split(/\s+/);
  const items = [...links.map(([key,label,icon]) => ({label, note:'Page', icon, attribute:`data-page="${key}"`})),
    ...state.assignments.map(trip => ({label:`${trip.id} · ${destination(trip)} delivery`, note:`${phaseText[phase(trip.id)]} · ${tripText(trip)}`, icon:'truck', attribute:`data-open-trip="${safe(trip.id)}"`}))];
  const found = items.filter(item => words.every(word => `${item.label} ${item.note}`.toLowerCase().includes(word)));
  return found.length ? found.map(item => `<li><button type="button" ${item.attribute}><span>${svg(item.icon)}</span><strong>${safe(item.label)}</strong>${svg('chevron')}</button></li>`).join('') : '<li class="none">No matches. Try a trip number or page name.</li>';
}
function openSearch() {
  finder.innerHTML = `<div class="finder-box">${svg('search')}<input type="search" id="finderInput" placeholder="Search trips and pages" aria-label="Search trips and pages" autocomplete="off"><button type="button" data-close-search aria-label="Close search">esc</button></div><ul>${searchResults()}</ul>`;
  if (!finder.open) finder.showModal();
  ui('finderInput').focus();
}
finder.addEventListener('input', event => { if (event.target.id === 'finderInput') finder.querySelector('ul').innerHTML = searchResults(event.target.value); });
finder.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.id === 'finderInput') { event.preventDefault(); finder.querySelector('ul button')?.click(); }
});
finder.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (event.target === finder || button?.hasAttribute('data-close-search')) return finder.close();
  if (!button) return;
  finder.close();
  if (button.dataset.openTrip) openTrip(button.dataset.openTrip);
  else if (button.dataset.page) openPage(button.dataset.page);
});

// ---- Static controls ----
ui('appearanceOptions').innerHTML = ['system','light','dark'].map(theme => `<button type="button" data-theme-choice="${theme}">${svg(theme)}${theme[0].toUpperCase() + theme.slice(1)}</button>`).join('');
ui('tabbar').innerHTML = [['overview','Home','grid'],['trips','Trips','truck'],['notifications','Alerts','bell'],['issue','Report','warning'],['profile','Profile','user']]
  .map(([key,label,icon]) => `<button type="button" data-page="${key}">${svg(icon)}<span>${label}</span></button>`).join('');
ui('navToggle').innerHTML = svg('menu');
ui('navClose').innerHTML = svg('close');
ui('railToggle').innerHTML = svg('panel');
ui('sideSearch').innerHTML = svg('search') + '<span>Search</span><kbd>Ctrl K</kbd>';
ui('darkSwitch').innerHTML = svg('dark') + '<span>Dark mode</span><i aria-hidden="true"></i>';
ui('accountChevron').innerHTML = svg('up');
ui('signOut').insertAdjacentHTML('afterbegin', svg('logout'));
shell.classList.toggle('railed', railed);

mobileNav.addEventListener('change', () => setNavigation(false, false));
themeQuery.addEventListener('change', applyAppearance);
ui('navToggle').addEventListener('click', () => setNavigation(true));
ui('navClose').addEventListener('click', () => setNavigation(false));
ui('navScrim').addEventListener('click', () => setNavigation(false));
ui('accountSettings').addEventListener('click', () => setSettings(settings.hidden));
ui('sideSearch').addEventListener('click', openSearch);
ui('railToggle').addEventListener('click', () => {
  railed = !railed;
  shell.classList.toggle('railed', railed);
  ui('railToggle').setAttribute('aria-label', railed ? 'Expand sidebar' : 'Collapse sidebar');
  try { localStorage.setItem('mouka-driver:rail', String(railed)); } catch {}
});
ui('darkSwitch').addEventListener('click', () => {
  driverData.theme = darkNow() ? 'light' : 'dark';
  saveDriverData();
  applyAppearance();
});
ui('driverFont').addEventListener('change', event => {
  driverData.font = event.target.value;
  saveDriverData();
  applyAppearance();
});
document.addEventListener('keydown', event => {
  if (shell.hidden) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!finder.open && !dialog.open) openSearch();
    return;
  }
  if (event.key !== 'Escape') return;
  if (!settings.hidden) {
    setSettings(false);
    ui('accountSettings').focus();
  } else if (shell.classList.contains('nav-open')) setNavigation(false);
});

window.enterDriverWorkspace = profile => {
  Driver.useDriver(profile.id);
  driverData = getDriverData(profile.id);
  driverProfile = {...profile, ...driverData.profile, id:profile.id};
  updateDriverIdentity();
  applyAppearance();
  selected = null;
  homeTrip = '';
  page = 'overview';
  tripFilter = tripQuery = faqTopic = faqQuery = reportFilter = '';
  Object.assign(noticeView, {query:'', kind:'', read:''});
  reportDraft = {trip:'', type:'', note:''};
  profileEditing = false;
  feedback = '';
  signature = null;
};
function updateDriverIdentity() {
  ui('sidebarDriver').textContent = driverProfile.name;
  ui('sidebarInitials').textContent = initialsOf(driverProfile.name);
}

shell.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !driverData || finder.contains(button)) return;
  const data = button.dataset;
  if (button.hasAttribute('data-open-search')) openSearch();
  if (data.page && screens[data.page]) openPage(data.page);
  if (data.openTrip) {
    if (button.hasAttribute('data-read-notice')) markNotice(data.openTrip);
    openTrip(data.openTrip);
  }
  if (data.homeStat) {
    const [target, filter] = data.homeStat.split(':');
    if (target === 'trips') { tripFilter = filter; tripQuery = ''; closedSections.delete(filter); }
    openPage(target);
  }
  if (data.homeTrip) { homeTrip = data.homeTrip; homeZoom = 1; redraw(`[data-home-trip="${data.homeTrip}"]`); }
  if (data.report !== undefined) { reportDraft = {trip:data.report, type:'', note:''}; openPage('issue'); }
  if (data.zoom) {
    homeZoom = data.zoom === 'reset' ? 1 : Math.min(2, Math.max(1, homeZoom + (data.zoom === 'in' ? .25 : -.25)));
    applyZoom();
  }
  if (button.hasAttribute('data-fold')) { shell.classList.toggle('trips-open'); const branch = button.parentElement; const open = !branch.classList.contains('open'); branch.classList.toggle('open', open); branch.querySelector('ul').hidden = !open; button.setAttribute('aria-expanded', String(open)); }
  if (data.tripFilter !== undefined) { tripFilter = data.tripFilter; redraw(`[data-trip-filter="${tripFilter}"]`); }
  if (button.hasAttribute('data-trip-reset')) { tripFilter = tripQuery = ''; redraw('[data-trip-query]'); }
  if (data.layout) {
    tripLayout = data.layout;
    try { localStorage.setItem('mouka-driver:trip-layout', tripLayout); } catch {}
    redraw(`[data-layout="${tripLayout}"]`);
  }
  if (data.themeChoice) { driverData.theme = data.themeChoice; saveDriverData(); applyAppearance(); }
  if (data.noticeStat !== undefined) { Object.assign(noticeView, {kind:data.noticeStat, read:''}); redraw(`[data-notice-stat="${data.noticeStat}"]`); }
  if (button.hasAttribute('data-notice-reset')) { Object.assign(noticeView, {query:'', kind:'', read:''}); redraw('[data-notice-field="query"]'); }
  if (data.toggleRead) {
    driverData.read = driverData.read.includes(data.toggleRead) ? driverData.read.filter(id => id !== data.toggleRead) : [...driverData.read, data.toggleRead];
    saveDriverData();
    redraw(`[data-toggle-read="${CSS.escape(data.toggleRead)}"]`);
  }
  if (button.hasAttribute('data-read-all')) {
    driverData.read = [...new Set([...driverData.read, ...inbox().map(item => item.id)])];
    saveDriverData();
    redraw('[data-notice-field="query"]');
  }
  if (data.issueType) {
    reportDraft = {trip:ui('issueTrip').value, type:data.issueType, note:ui('issueNote').value};
    ui('issueType').value = data.issueType;
    for (const option of screen.querySelectorAll('[data-issue-type]')) option.setAttribute('aria-pressed', String(option.dataset.issueType === data.issueType));
    ui('issueNote').focus();
  }
  if (data.faqTopic !== undefined) { faqTopic = data.faqTopic; redraw(`[data-faq-topic="${faqTopic}"]`); }
  if (data.profileEdit) {
    profileEditing = data.profileEdit === 'on';
    feedback = '';
    window.renderWorkspace();
    (screen.querySelector('[name=name]') || screen.querySelector('[data-profile-edit]'))?.focus();
  }
  if (button.hasAttribute('data-reset-progress')) {
    feedback = 'Demo trip progress reset.';
    Driver.resetProgress();
    screen.querySelector('h1').focus();
  }
  if (button.hasAttribute('data-refresh-sync')) {
    feedback = 'Status refreshed at ' + new Intl.DateTimeFormat('en-NG', {timeStyle:'short'}).format(new Date()) + '.';
    redraw('[data-refresh-sync]');
  }
});

// Folding a trip section is remembered while the app is open.
shell.addEventListener('toggle', event => {
  const key = event.target.dataset?.section;
  if (key && !tripQuery) closedSections[event.target.open ? 'delete' : 'add'](key);
}, true);

shell.addEventListener('input', event => {
  const field = event.target;
  const data = field.dataset;
  if (data.tripQuery !== undefined) { tripQuery = field.value; ui('tripResults').innerHTML = tripsResults(); mountTrucks(); }
  if (data.noticeField === 'query') { noticeView.query = field.value; ui('noticeResults').innerHTML = noticeResults(); }
  if (data.faqQuery !== undefined) { faqQuery = field.value; ui('faqRows').innerHTML = faqRows(); }
  if (field.id === 'issueNote') ui('noteCount').textContent = field.value.length;
  if (field.closest('[data-record-form="issue"]')) reportDraft = {trip:ui('issueTrip').value, type:ui('issueType').value, note:ui('issueNote').value};
});
shell.addEventListener('change', event => {
  const field = event.target;
  if (field.dataset.noticeField && field.dataset.noticeField !== 'query') { noticeView[field.dataset.noticeField] = field.value; ui('noticeResults').innerHTML = noticeResults(); }
  if (field.dataset.reportFilter !== undefined) { reportFilter = field.value; ui('reportRows').innerHTML = reportRows(); }
  if (field.id === 'issueType') for (const option of screen.querySelectorAll('[data-issue-type]')) option.setAttribute('aria-pressed', String(option.dataset.issueType === field.value));
});

function profileError(form, text) {
  let error = form.querySelector('[role=alert]');
  if (!error) {
    error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.className = 'form-error';
    form.append(error);
  }
  error.textContent = text;
}
function saveProfile(form, values) {
  const next = Object.fromEntries(profileFields.map(([key]) => [key, String(values.get(key) ?? '').trim()]));
  next.email = next.email.toLowerCase();
  next.phone = normalizePhone(next.phone);
  if (!next.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next.email) || !/^[0-9]{8,15}$/.test(next.phone)) {
    profileError(form, 'Enter your name, a valid email, and a phone number with its country code.');
    return;
  }
  if (next.emergencyPhone && !/^[0-9]{8,15}$/.test(normalizePhone(next.emergencyPhone))) {
    profileError(form, 'Enter a valid emergency phone number.');
    return;
  }
  const emailOwner = findDriver(next.email, true) || findDriver(next.email, false);
  const phoneOwner = findDriver(next.phone, true) || findDriver(next.phone, false);
  if ([emailOwner, phoneOwner].some(owner => owner && owner.id !== driverProfile.id)) {
    profileError(form, 'That email or phone number is registered to another driver.');
    return;
  }
  const changes = profileFields.filter(([key]) => next[key] !== (driverProfile[key] || ''));
  if (!changes.length) {
    profileError(form, 'Change at least one field before saving.');
    return;
  }
  const entry = {
    id:'profile-' + window.demoId(),
    driverId:driverProfile.id,
    time:new Date().toISOString(),
    fields:changes.map(([, label]) => label),
    changes:Object.fromEntries(changes.map(([key]) => [key, {previous:driverProfile[key] || '', updated:next[key]}]))
  };
  driverData.profile = next;
  driverData.adminNotices.unshift(entry);
  driverProfile = {...driverProfile, ...next};
  updateDriverIdentity();
  feedback = saveDriverData() ? 'Profile saved. A notice is queued for the admin in this preview.' : 'Profile and admin notice saved for this visit only.';
  profileEditing = false;
  window.renderWorkspace();
  screen.querySelector('h1').focus();
}
shell.addEventListener('submit', event => {
  const form = event.target;
  if (!form.dataset.recordForm) return;
  event.preventDefault();
  const values = new FormData(form);
  if (form.dataset.recordForm === 'profile') return saveProfile(form, values);
  const note = String(values.get('note')).trim();
  if (!note) return;
  driverData.issues.unshift({trip:String(values.get('trip')), type:String(values.get('type')), note, ref:'ISS-' + window.demoId(3).toUpperCase(), time:new Date().toISOString()});
  reportDraft = {trip:'', type:'', note:''};
  reportFilter = '';
  feedback = saveDriverData() ? 'Saved in this browser.' : 'Saved for this visit. Browser storage is unavailable.';
  redraw('h1');
});
window.addEventListener('online', () => { if (page === 'sync') window.renderWorkspace(); });
window.addEventListener('offline', () => { if (page === 'sync') window.renderWorkspace(); });
