'use strict';

// Mouka Driver for Android. Screens follow the Driver web app.
// Trip actions go through the native "Driver" bridge. Requests, reports and profile are demo data kept on the phone.
const shapes = {
  home:'<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H5m6 6-6-6 6-6"/>',
  route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
  truck:'<path d="M3 5h12v12H3zM15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  cross:'<path d="m6 6 12 12M18 6 6 18"/>',
  gps:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m10 7h-3m-7 10v-3M2 12h3"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  box:'<path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9"/>',
  depot:'<path d="M3 21V8l9-5 9 5v13M3 21h18M7 21V11h10v10M7 15h10"/>',
  inbox:'<path d="M4 4h16l2 10v6H2v-6zM2 14h6l2 3h4l2-3h6"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3V8m-8 12h4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  warning:'<path d="M12 3 2 21h20L12 3Zm0 7v4m0 3h.01"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 6 0 0 1 16 0v2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1.1-1 2m0 3h.01"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 20 11a3.5 3.5 0 0 1-1 7z"/>'
};
const svg = name => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (shapes[name] || shapes.help) + '</svg>';
const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const plural = (count, one, many = one + 's') => `${count} ${count === 1 ? one : many}`;
const byId = id => document.getElementById(id);
const screen = byId('screen');
const dock = byId('dock');
const tabs = byId('tabs');
const dialog = byId('confirm');
const notice = byId('notice');

// ---- Saved demo choices ----
const storeKey = 'mouka-android:demo:v1';
const defaults = {signedIn:false, theme:'light', requests:{}, reports:[], read:[], profile:{name:'Demo Driver', phone:'', depot:'Demo Depot A', emergency:''}};
let saved = JSON.parse(JSON.stringify(defaults));
let canSave = true;
try {
  const stored = JSON.parse(window.localStorage.getItem(storeKey));
  if (stored) saved = {...saved, ...stored, profile:{...saved.profile, ...stored.profile}};
} catch (error) { canSave = false; }
function persist() {
  try { window.localStorage.setItem(storeKey, JSON.stringify(saved)); canSave = true; } catch (error) { canSave = false; }
  return canSave;
}

// ---- Trip data ----
// The second bundled assignment is presented as a new request, so Accept and Decline can be tried.
const requestIds = ['MD-0045'];
let state;
let signature;
let nativeNote = '';
const record = id => state.trips[id] || {};
const phase = id => record(id).phase || 'assigned';
const doneStops = trip => record(trip.id).done || 0;
const destination = trip => trip.stops[trip.stops.length - 1].area.split(',')[0];
const findTrip = id => state.assignments.find(item => item.id === id);
function decision(id) {
  if (!requestIds.includes(id)) return 'accepted';
  if (phase(id) !== 'assigned') return 'accepted';
  return saved.requests[id]?.status || 'pending';
}
const myTrips = () => state.assignments.filter(trip => decision(trip.id) === 'accepted');
const newRequests = () => state.assignments.filter(trip => decision(trip.id) === 'pending');
const activeTrip = () => state.assignments.find(trip => phase(trip.id) === 'active');
const phaseText = {assigned:'Upcoming', active:'In progress', completed:'Completed'};
const phaseTone = {assigned:'amber', active:'violet', completed:'green'};
const chip = (text, tone) => `<span class="chip ${tone}">${text}</span>`;
const tripChip = trip => chip(phaseText[phase(trip.id)], phaseTone[phase(trip.id)]);
const truckPicture = trip => `<img class="truck-picture" src="truck-trailer.png" alt="">`;

// ---- Where the driver is in the app ----
let view = 'home';
let selected = '';
let tripFilter = '';
let draft = {trip:'', type:'Delay', note:''};
let declining = false;
const titles = {home:'Home', trips:'My Trips', trip:'Trip Details', requests:'Trip Requests', request:'Request Details', alerts:'Notifications', more:'More', report:'Report an Issue', sync:'Sync & Tracking', profile:'Profile', help:'Help & Support'};
const tabFor = {home:'home', trips:'trips', trip:'trips', requests:'requests', request:'requests', alerts:'alerts', more:'more', report:'more', sync:'more', profile:'more', help:'more'};
const parents = {trip:'trips', request:'requests', report:'more', sync:'more', profile:'more', help:'more'};

function alerts() {
  const items = [
    ...newRequests().map(trip => ({id:'request-' + trip.id, icon:'inbox', title:'New trip request', text:`${trip.id} to ${destination(trip)}`, go:'request', trip:trip.id})),
    ...myTrips().map(trip => ({id:'trip-' + trip.id, icon:'truck', title:destination(trip) + ' delivery assigned', text:`${trip.id} · ${trip.origin} · ${trip.window}`, go:'trip', trip:trip.id}))
  ];
  return items.map(item => ({...item, unread:!saved.read.includes(item.id)}));
}
const unreadCount = () => alerts().filter(item => item.unread).length;

// ---- Map, shared in style with the Driver web app ----
const cityBackground = (() => {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const steps = (from, to) => { const list = [from]; while (list[list.length - 1] < to) list.push(Math.round(list[list.length - 1] + 30 + random() * 32)); return list; };
  const columns = steps(-420, 1020);
  const rows = steps(-320, 800);
  let blocks = '';
  for (let i = 0; i < columns.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const width = columns[i + 1] - columns[i] - 8;
      const height = rows[j + 1] - rows[j] - 8;
      for (let x = 0; x < width - 6;) {
        const size = Math.min(width - x, Math.round(9 + random() * 20));
        if (random() > .35) blocks += `M${columns[i] + 4 + x} ${rows[j] + 4}h${size - 3}v${Math.round(height * (.5 + random() * .5))}h${3 - size}z`;
        x += size;
      }
    }
  }
  const streets = columns.map(x => 'M' + x + ' -380V860').join('') + rows.map(y => 'M-460 ' + y + 'H1080').join('');
  return `<rect class="land" x="-500" y="-400" width="1600" height="1300"/><g transform="rotate(-12 300 230)"><path class="building" d="${blocks}"/><path class="street" d="${streets}"/></g>
    <path class="water" d="M-300 330C-60 270 90 420 250 372S430 190 610 215S880 150 980 80"/>
    <path class="highway" d="M-300 90C20 150 220 40 380 130S700 330 960 300M60 -300C90 20 300 180 330 340S420 620 520 760"/>`;
})();
const stopPoints = count => ({2:[[170,100],[430,360]], 3:[[170,95],[420,215],[240,385]]})[count] || Array.from({length:count}, (_, i) => [170 + (i % 2) * 250, 90 + i * 300 / Math.max(1, count - 1)]);
function routeShape(points) {
  return points.slice(1).reduce((path, [x, y], i) => {
    const [fromX, fromY] = points[i];
    const middle = Math.round((fromY + y) / 2);
    return path.concat([[fromX, middle - 22], [fromX + (x - fromX) * .45, middle], [x, middle + 24], [x, y]]);
  }, [points[0]]);
}
function tripMap(trip, look = '') {
  const places = [{name:trip.origin, kind:'PICKUP'}, ...trip.stops.map((stop, i) => ({name:stop.name, kind:trip.stops.length === 1 ? 'DROPOFF' : 'STOP ' + (i + 1)}))];
  const points = stopPoints(places.length);
  const path = routeShape(points);
  const status = phase(trip.id);
  const done = doneStops(trip);
  const reached = status === 'completed' ? path.length - 1 : status === 'assigned' ? 0 : Math.min(path.length - 1, done * 4 + (done < trip.stops.length ? 2 : 0));
  const line = list => list.map(point => point.join(',')).join(' ');
  const [truckX, truckY] = path[reached];
  return `<figure class="map ${look}"><svg viewBox="40 0 520 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${safe('Illustrative map from ' + trip.origin + ' to ' + trip.stops.map(stop => stop.name).join(', '))}">
    ${cityBackground}
    <polyline class="route-ahead" points="${line(path.slice(reached))}"/><polyline class="route-done" points="${line(path.slice(0, reached + 1))}"/>
    <g class="vehicle" transform="translate(${truckX} ${truckY})"><circle class="halo" r="34"/><circle class="body" r="18"/><g transform="translate(-11 -11) scale(.92)" class="glyph"><path d="M3 5h12v12H3zM15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></g></g>
    ${points.map(([x, y], i) => {
      const width = Math.max(112, places[i].name.length * 9.6 + 28);
      return `<g class="marker ${i === 0 ? 'pickup' : i <= done ? 'done' : ''}"><circle cx="${x}" cy="${y}" r="11"/><rect x="${x - width / 2}" y="${y - 72}" width="${width}" height="52" rx="12"/><text class="kind" x="${x}" y="${y - 52}">${places[i].kind}</text><text x="${x}" y="${y - 32}">${safe(places[i].name)}</text></g>`;
    }).join('')}
  </svg><figcaption>Illustrative map</figcaption></figure>`;
}

// ---- Building blocks ----
const panel = (title, note, content, action = '') => `<section class="panel"><header><div><h2>${title}</h2>${note ? `<small>${note}</small>` : ''}</div>${action}</header>${content}</section>`;
const empty = (icon, title, text, action = '') => `<div class="empty">${svg(icon)}<h2>${title}</h2><p>${text}</p>${action}</div>`;
const go = (target, label, look = '', trip = '') => `<button type="button" class="button ${look}" data-go="${target}" ${trip ? `data-trip="${safe(trip)}"` : ''}>${label}</button>`;
const row = (target, icon, title, note, extra = '', trip = '') => `<li><button type="button" data-go="${target}" ${trip ? `data-trip="${safe(trip)}"` : ''}><span class="row-icon">${svg(icon)}</span><span class="row-copy"><strong>${title}</strong><small>${note}</small></span>${extra}${svg('arrow')}</button></li>`;
function trackingStatus() {
  const active = activeTrip();
  const on = Boolean(active && state.tracking);
  const sync = state.syncConfigured ? (state.pending ? 'Updates queued for dispatch' : 'No updates waiting to sync') : 'Dispatch sync is disconnected in this demo';
  return `<button type="button" class="tracking ${on ? 'on' : active ? 'paused' : ''}" data-go="sync"><i></i><span><strong>${on ? 'Location recording on' : active ? 'Tracking paused' : 'Location recording off'}</strong><small>${sync}</small></span>${state.pending ? `<em>${state.pending} queued</em>` : ''}</button>`;
}
function stopList(trip) {
  const done = doneStops(trip);
  const status = phase(trip.id);
  return `<ol class="stops"><li class="${status !== 'assigned' ? 'done' : ''}"><i>${status !== 'assigned' ? svg('check') : svg('depot')}</i><span><strong>${safe(trip.origin)}</strong><small>Pickup</small></span></li>${trip.stops.map((stop, i) => {
    const complete = i < done;
    const next = i === done && status === 'active';
    return `<li class="${complete ? 'done' : next ? 'next' : ''}"><i>${complete ? svg('check') : i + 1}</i><span><strong>${safe(stop.name)}</strong><small>${safe(stop.area)}</small></span>${complete || next ? `<em>${complete ? 'Delivered' : 'Next stop'}</em>` : ''}</li>`;
  }).join('')}</ol>`;
}
function tripCard(trip) {
  const done = doneStops(trip);
  const status = phase(trip.id);
  return `<li class="trip-card"><button type="button" data-go="trip" data-trip="${safe(trip.id)}">
    <span class="trip-top">${tripChip(trip)}<span class="trip-name"><strong>${safe(trip.id)}</strong><small>${safe(destination(trip))} delivery</small></span>${truckPicture(trip)}</span>
    <span class="trip-info"><strong>${safe(trip.origin)} → ${safe(destination(trip))}</strong><small>${safe(trip.truck)} • ${safe(trip.window)}</small>
      <span class="measure"><span>Delivery progress</span><b>${done} of ${trip.stops.length} stops</b></span>
      <progress class="${phaseTone[status]}" value="${done}" max="${trip.stops.length}"></progress></span></button></li>`;
}

// ---- Screens ----
function welcome() {
  return `<section class="welcome"><div class="welcome-art"><img src="mouka.svg" alt="Mouka"><h1 tabindex="-1">Mouka Driver</h1><p>From the depot to the doorstep.</p></div>
    <div class="welcome-card"><h2>Try the demo</h2><p>This pilot uses sample trips. Real driver sign-in is not connected yet, so no password is needed.</p>
      <button type="button" class="button primary wide" data-sign-in>${svg('user')} Continue with demo account</button></div></section>`;
}

function home() {
  const trips = myTrips();
  const requests = newRequests();
  const trip = activeTrip() || trips.find(item => phase(item.id) === 'assigned') || trips[trips.length - 1];
  const hour = new Date().getHours();
  const count = key => trips.filter(item => phase(item.id) === key).length;
  const confirmed = trips.reduce((sum, item) => sum + doneStops(item), 0);
  const stat = (filter, label, value) => `<button type="button" data-go="trips" data-filter="${filter}"><span>${label}</span><b>${value}</b></button>`;
  return `<div class="greeting"><p>${safe(new Intl.DateTimeFormat('en-NG', {weekday:'long', day:'numeric', month:'long'}).format(new Date()))}</p>
      <h1 tabindex="-1">${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${safe(saved.profile.name.split(' ')[0])}</h1></div>
    ${requests.length ? `<button type="button" class="request-alert" data-go="request" data-trip="${safe(requests[0].id)}"><span>${svg('inbox')}</span><span><strong>${plural(requests.length, 'new trip request')}</strong><small>${safe(requests[0].id)} to ${safe(destination(requests[0]))} · Tap to review</small></span>${svg('arrow')}</button>` : ''}
    <div class="stats">${stat('active', 'In progress', count('active'))}${stat('assigned', 'Upcoming', count('assigned'))}${stat('completed', 'Completed', count('completed'))}<button type="button" data-go="sync"><span>Stops done</span><b>${confirmed}</b></button></div>
    ${trip ? `<section class="stage"><p class="flag ${phase(trip.id)}"><i></i>${phase(trip.id) === 'active' ? 'Trip in progress' : phase(trip.id) === 'completed' ? 'Trip completed' : 'Next assignment'}</p>
        <h2>${safe(trip.origin)} to ${safe(destination(trip))}</h2><small>${safe(trip.id)} · ${safe(trip.truck)} · ${safe(trip.window)}</small>
        ${go('trip', `${svg('route')} ${phase(trip.id) === 'active' ? 'Resume trip' : phase(trip.id) === 'completed' ? 'Review trip' : 'Open trip details'}`, 'purple wide', trip.id)}
        ${tripMap(trip)}</section>` : empty('truck', 'No trips yet', 'Accepted trips appear here.', requests.length ? go('requests', 'View requests', 'primary') : '')}
    ${trackingStatus()}
    ${panel('Quick actions', '', `<ul class="rows">${row('report', 'warning', 'Report an issue', 'Delay, breakdown or address')}${row('help', 'help', 'Help & Support', 'Common questions')}</ul>`)}`;
}

function tripsScreen() {
  const trips = myTrips();
  const filters = [['', 'All'], ['active', 'In progress'], ['assigned', 'Upcoming'], ['completed', 'Completed']];
  const groups = filters.slice(1).filter(([key]) => !tripFilter || key === tripFilter);
  return `<h1 tabindex="-1">My Trips</h1>
    <div class="pills" role="group" aria-label="Filter trips">${filters.map(([key, label]) => `<button type="button" data-filter-only="${key}" aria-pressed="${tripFilter === key}">${label}<em>${key ? trips.filter(trip => phase(trip.id) === key).length : trips.length}</em></button>`).join('')}</div>
    ${groups.map(([key, label]) => {
      const list = trips.filter(trip => phase(trip.id) === key);
      if (!list.length && !tripFilter) return '';
      return `<section class="group ${phaseTone[key]}"><h2><i></i>${label}<em>${list.length}</em></h2>${list.length ? `<ul class="cards">${list.map(tripCard).join('')}</ul>` : '<p class="none">No trips in this section.</p>'}</section>`;
    }).join('') || empty('truck', 'No trips yet', 'Accepted trips appear here.')}`;
}

function tripScreen() {
  const trip = findTrip(selected);
  if (!trip || decision(trip.id) !== 'accepted') return empty('truck', 'Trip not available', 'Choose a trip from My Trips.', go('trips', 'My Trips', 'primary'));
  const done = doneStops(trip);
  const events = [];
  if (phase(trip.id) === 'completed') events.push('Trip ended');
  trip.stops.slice(0, done).reverse().forEach(stop => events.push('Delivery confirmed at ' + stop.name));
  if (phase(trip.id) !== 'assigned') events.push('Trip started');
  events.push('Trip assigned');
  return `${tripMap(trip, 'tall')}
    <section class="panel summary"><p class="eyebrow">Trip ${safe(trip.id)} ${tripChip(trip)}</p><h1 tabindex="-1">${safe(destination(trip))} delivery</h1>
      <dl><div><dt>Vehicle</dt><dd>${safe(trip.truck)}</dd></div><div><dt>Departure</dt><dd>${safe(trip.window)}</dd></div></dl></section>
    ${trackingStatus()}
    ${panel('Delivery stops', `${done} of ${trip.stops.length} confirmed`, stopList(trip))}
    ${panel('Activity', 'Newest first', `<ol class="history">${events.map(text => `<li>${safe(text)}</li>`).join('')}</ol>`, `<button type="button" class="more" data-report="${safe(trip.id)}">Report an issue</button>`)}`;
}

function requestsScreen() {
  const pending = newRequests();
  const answered = state.assignments.filter(trip => requestIds.includes(trip.id) && decision(trip.id) !== 'pending');
  return `<h1 tabindex="-1">Trip Requests</h1>
    <p class="demo-note">${svg('help')} Demo requests. Your answer stays on this phone and is not sent to Dispatch.</p>
    ${pending.length ? `<ul class="request-list">${pending.map(trip => `<li><article class="request"><p class="eyebrow">${safe(trip.id)} ${chip('New request', 'violet')}</p><h2>${safe(trip.origin)} to ${safe(destination(trip))}</h2><small>${plural(trip.stops.length, 'delivery stop')} · ${safe(trip.window)} · ${safe(trip.truck)}</small>${go('request', 'Review request', 'purple wide', trip.id)}</article></li>`).join('')}</ul>` : empty('inbox', 'No new requests', 'New trip requests appear here.')}
    ${answered.length ? panel('Answered', 'Your earlier replies', `<ul class="rows">${answered.map(trip => {
      const reply = saved.requests[trip.id] || {};
      const declined = decision(trip.id) === 'declined';
      return row('request', declined ? 'cross' : 'check', safe(trip.id) + ' to ' + safe(destination(trip)), declined ? 'Reason: ' + safe(reply.reason) : 'Added to My Trips', chip(declined ? 'Declined' : 'Accepted', declined ? 'red' : 'green'), trip.id);
    }).join('')}</ul>`) : ''}`;
}

const declineReasons = ['Vehicle not ready', 'I am not available', 'Departure time does not work', 'Another reason'];
function requestScreen() {
  const trip = findTrip(selected);
  if (!trip || !requestIds.includes(trip.id)) return empty('inbox', 'Request not found', 'Go back to your requests.', go('requests', 'Trip Requests', 'primary'));
  const status = decision(trip.id);
  return `${tripMap(trip, 'tall')}
    <section class="panel summary"><p class="eyebrow">${safe(trip.id)} ${chip(status === 'pending' ? 'New request' : status === 'declined' ? 'Declined' : 'Accepted', status === 'declined' ? 'red' : status === 'accepted' ? 'green' : 'violet')}</p><h1 tabindex="-1">${safe(destination(trip))} delivery</h1>
      <dl><div><dt>Pickup</dt><dd>${safe(trip.origin)}</dd></div><div><dt>Departure</dt><dd>${safe(trip.window)}</dd></div><div><dt>Stops</dt><dd>${trip.stops.length}</dd></div><div><dt>Vehicle</dt><dd>${safe(trip.truck)}</dd></div></dl></section>
    ${panel('Delivery stops', 'In order', stopList(trip))}
    ${declining && status === 'pending' ? panel('Why are you declining?', 'Choose a reason', `<form id="declineForm" class="form">${declineReasons.map((reason, i) => `<label class="choice"><input type="radio" name="reason" value="${reason}" ${i ? '' : 'required'}><span>${reason}</span></label>`).join('')}<button type="submit" class="button danger wide">Decline request</button><button type="button" class="button wide" data-keep>Keep request</button></form>`) : ''}
    ${status === 'accepted' ? go('trip', 'Open trip', 'primary wide', trip.id) : ''}
    ${status === 'declined' ? `<section class="panel"><p>You declined this request: <strong>${safe(saved.requests[trip.id]?.reason || '')}</strong>.</p><button type="button" class="button wide" data-undo="${safe(trip.id)}">Undo for this demo</button></section>` : ''}
    <p class="demo-note">${svg('help')} Demo request. Dispatch is not told your answer.</p>`;
}

function alertsScreen() {
  const items = alerts();
  return `<h1 tabindex="-1">Notifications</h1>
    <div class="list-tools"><span>${plural(unreadCount(), 'unread notification')}</span><button type="button" class="more" data-read-all ${unreadCount() ? '' : 'disabled'}>Mark all as read</button></div>
    ${items.length ? `<ul class="notices">${items.map(item => `<li class="${item.unread ? 'unseen' : ''}"><button type="button" data-go="${item.go}" data-trip="${safe(item.trip)}" data-read="${safe(item.id)}"><span class="solid">${svg(item.icon)}</span><span class="row-copy"><strong>${safe(item.title)}${item.unread ? '<i aria-label="Unread"></i>' : ''}</strong><small>${safe(item.text)}</small></span>${svg('arrow')}</button></li>`).join('')}</ul>` : empty('bell', 'You’re all caught up', 'New updates appear here.')}`;
}

function moreScreen() {
  return `<h1 tabindex="-1">More</h1>
    <button type="button" class="banner" data-go="profile"><span class="avatar">${safe(saved.profile.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase())}</span><span><strong>${safe(saved.profile.name)}</strong><small>${safe(saved.profile.depot)} · Demo driver</small></span>${svg('arrow')}</button>
    ${panel('On the road', '', `<ul class="rows">${row('sync', 'cloud', 'Sync & Tracking', 'Location and queued updates')}${row('report', 'warning', 'Report an Issue', plural(saved.reports.length, 'saved report'))}</ul>`)}
    ${panel('Account', '', `<ul class="rows">${row('profile', 'user', 'Profile', 'Your contact details')}${row('help', 'help', 'Help & Support', 'Common questions')}</ul>`)}
    ${panel('Appearance', '', `<div class="segments" role="group" aria-label="Appearance">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([key, label]) => `<button type="button" data-theme-choice="${key}" aria-pressed="${saved.theme === key}">${label}</button>`).join('')}</div>`)}
    <button type="button" class="button wide" data-sign-out ${activeTrip() ? 'disabled' : ''}>Sign out</button>
    ${activeTrip() ? '<p class="hint">End your active trip before signing out.</p>' : ''}`;
}

const issueTypes = [['Delay', 'time'], ['Vehicle breakdown', 'truck'], ['Wrong address', 'route'], ['Rejected delivery', 'box'], ['Other', 'help']];
function reportScreen() {
  return `<h1 tabindex="-1">Report an Issue</h1>
    <p class="demo-note">${svg('help')} Reports stay on this phone. Contact your dispatcher directly if the problem is urgent.</p>
    <div class="categories" role="group" aria-label="Issue type">${issueTypes.map(([name, icon]) => `<button type="button" data-type="${name}" aria-pressed="${draft.type === name}"><span>${svg(icon)}</span>${name}</button>`).join('')}</div>
    <form id="reportForm" class="panel form"><label for="reportTrip">Trip</label><select id="reportTrip" name="trip"><option value="">General issue</option>${myTrips().map(trip => `<option value="${safe(trip.id)}" ${draft.trip === trip.id ? 'selected' : ''}>${safe(trip.id)} · ${safe(destination(trip))}</option>`).join('')}</select>
      <label for="reportNote">What happened?</label><textarea id="reportNote" name="note" maxlength="500" required placeholder="Include the stop or location if relevant">${safe(draft.note)}</textarea><button type="submit" class="button primary wide">Save report</button></form>
    ${saved.reports.length ? panel('Report history', plural(saved.reports.length, 'report'), `<ul class="reports">${saved.reports.map(report => `<li><strong>${safe(report.type)}${report.trip ? ' · ' + safe(report.trip) : ''}</strong><small>${safe(new Intl.DateTimeFormat('en-NG', {dateStyle:'medium', timeStyle:'short'}).format(new Date(report.time)))}</small><p>${safe(report.note)}</p></li>`).join('')}</ul>`) : ''}`;
}

function syncScreen() {
  const active = activeTrip();
  const health = (tone, icon, label, value, note) => `<article class="health ${tone}"><span>${svg(icon)}</span><div><small>${label}</small><strong>${value}</strong><p>${note}</p></div></article>`;
  return `<h1 tabindex="-1">Sync &amp; Tracking</h1>
    ${health(active && state.tracking ? 'green' : active ? 'amber' : 'gray', 'gps', 'Location recording', active && state.tracking ? 'On' : active ? 'Paused' : 'Off', active ? 'Trip ' + safe(active.id) + ' is active.' : 'Recording starts when you start a trip.')}
    ${health(state.pending ? 'violet' : 'green', 'cloud', 'Updates on this phone', plural(state.pending || 0, 'update') + ' queued', 'Trip steps and location fixes wait here.')}
    ${health(state.syncConfigured ? 'green' : 'amber', 'route', 'Dispatch connection', state.syncConfigured ? 'Upload address set' : 'Not connected', state.syncConfigured ? 'Queued updates upload when the phone allows.' : 'This demo does not send updates to Dispatch.')}
    ${active ? go('trip', 'Open active trip', 'primary wide', active.id) : ''}`;
}

function profileScreen() {
  const field = (key, label, type, required) => `<label>${label}<input name="${key}" type="${type}" maxlength="80" value="${safe(saved.profile[key])}" ${required ? 'required' : ''}></label>`;
  return `<h1 tabindex="-1">Profile</h1><form id="profileForm" class="panel form">${field('name', 'Full name', 'text', true)}${field('phone', 'Phone number', 'tel')}${field('depot', 'Home depot', 'text')}${field('emergency', 'Emergency contact', 'text')}<button type="submit" class="button primary wide">Save profile</button></form>
    <p class="demo-note">${svg('help')} Profile changes stay on this phone. Use sample details.</p>`;
}

const faqs = [
  ['How do I accept a trip request?', 'Open Requests, review the pickup and stops, then tap Accept. In this demo the answer stays on the phone.'],
  ['How do I start or end a trip?', 'Open the trip and tap Start trip. Confirm each stop in order, then tap End trip.'],
  ['Why does tracking say paused?', 'Android can stop tracking after a restart or a permission change. Open the trip and tap Resume tracking.'],
  ['What happens without a connection?', 'Trip updates stay queued on the phone. Dispatch upload is not connected in this demo.'],
  ['What if I cannot complete a delivery?', 'Open Report an Issue and contact your dispatcher directly if you need an immediate answer.']
];
const helpScreen = () => `<h1 tabindex="-1">Help &amp; Support</h1><div class="faq">${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div>`;

const screens = {home, trips:tripsScreen, trip:tripScreen, requests:requestsScreen, request:requestScreen, alerts:alertsScreen, more:moreScreen, report:reportScreen, sync:syncScreen, profile:profileScreen, help:helpScreen};

// ---- The large button at the bottom ----
function dockAction() {
  if (view === 'request' && !declining) {
    const trip = findTrip(selected);
    if (trip && decision(trip.id) === 'pending') return `<div class="bar split"><button type="button" class="button" data-decline>Decline</button><button type="button" class="button accept" data-accept="${safe(trip.id)}">${svg('check')} Accept trip</button></div>`;
  }
  if (view !== 'trip') return '';
  const trip = findTrip(selected);
  if (!trip || decision(trip.id) !== 'accepted') return '';
  const status = phase(trip.id);
  const done = doneStops(trip);
  const active = activeTrip();
  const action = status === 'assigned' ? (active ? 'openActive' : 'start') : status === 'completed' ? '' : done === trip.stops.length ? 'end' : !state.tracking ? 'resume' : 'confirm';
  if (!action) return '';
  const info = {
    start:['Start trip', 'gps', 'Starting records your location until the trip ends.'],
    openActive:['Return to active trip', 'arrow', 'One trip can be active at a time.'],
    resume:['Resume tracking', 'gps', 'Open the app and resume recording location.'],
    confirm:['Confirm stop ' + (done + 1), 'check', done < trip.stops.length ? trip.stops[done].name : ''],
    end:['End trip', 'stop', 'All delivery stops confirmed.']
  }[action];
  return `<div class="bar"><button type="button" class="button primary ${action}" data-action="${action}" data-index="${done}">${svg(info[1])} ${safe(info[0])}</button><p>${safe(info[2])}</p></div>`;
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => { document.documentElement.dataset.theme = saved.theme === 'dark' || (saved.theme === 'system' && darkQuery.matches) ? 'dark' : 'light'; };

function show(focus) {
  applyTheme();
  const signedOut = !saved.signedIn && !activeTrip();
  document.body.classList.toggle('signed-out', signedOut);
  tabs.hidden = signedOut;
  byId('topbar').hidden = signedOut;
  screen.innerHTML = signedOut ? welcome() : screens[view]();
  screen.dataset.view = signedOut ? 'welcome' : view;
  const action = signedOut ? '' : dockAction();
  dock.hidden = !action;
  dock.innerHTML = action;
  document.body.classList.toggle('has-dock', Boolean(action));
  byId('title').textContent = titles[view];
  byId('back').hidden = !parents[view];
  const counts = {requests:newRequests().length, alerts:unreadCount()};
  tabs.innerHTML = [['home', 'Home', 'home'], ['trips', 'Trips', 'truck'], ['requests', 'Requests', 'inbox'], ['alerts', 'Alerts', 'bell'], ['more', 'More', 'menu']]
    .map(([key, label, icon]) => `<button type="button" data-go="${key}" ${tabFor[view] === key ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span>${counts[key] ? `<em>${counts[key]}</em>` : ''}</button>`).join('');
  if (focus) screen.querySelector(focus)?.focus({preventScroll:true});
}
function open(next, trip) {
  view = next;
  if (trip) selected = trip;
  declining = false;
  byId('toast').hidden = true;
  show('h1');
  window.scrollTo(0, 0);
}
let toastTimer;
function toast(text) {
  const box = byId('toast');
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 2800);
}

// The phone calls this after each trip action. It is also checked on a timer.
window.refreshDriver = function () {
  if (!window.Driver) return;
  const snapshot = window.Driver.snapshot();
  if (snapshot === signature) return;
  signature = snapshot;
  state = JSON.parse(snapshot);
  if (state.note !== nativeNote) {
    nativeNote = state.note;
    notice.textContent = nativeNote;
    notice.hidden = !nativeNote;
  }
  // Location fixes arrive while the driver may be typing, so never redraw a form being filled in.
  const editing = view === 'report' || view === 'profile' || (view === 'request' && declining);
  if (!editing || !screen.firstElementChild) show();
};

let pending;
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !state || dialog.contains(button)) return;
  const data = button.dataset;
  if (button.id === 'back') return open(parents[view]);
  if (button.hasAttribute('data-sign-in')) { saved.signedIn = true; persist(); return open('home'); }
  if (button.hasAttribute('data-sign-out')) { if (!activeTrip()) { saved.signedIn = false; persist(); view = 'home'; show('h1'); } return; }
  if (data.read && !saved.read.includes(data.read)) { saved.read.push(data.read); persist(); }
  if (data.filter !== undefined) tripFilter = data.filter;
  if (data.go) { if (tabs.contains(button) && data.go === 'trips') tripFilter = ''; return open(data.go, data.trip); }
  if (data.filterOnly !== undefined) { tripFilter = data.filterOnly; return show(`[data-filter-only="${tripFilter}"]`); }
  if (data.report !== undefined) { draft = {trip:data.report, type:'Delay', note:''}; return open('report'); }
  if (data.type) {
    draft.type = data.type;
    screen.querySelectorAll('[data-type]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.type === data.type)));
    return;
  }
  if (data.themeChoice) { saved.theme = data.themeChoice; persist(); return show(`[data-theme-choice="${data.themeChoice}"]`); }
  if (button.hasAttribute('data-read-all')) { saved.read = [...new Set([...saved.read, ...alerts().map(item => item.id)])]; persist(); return show('h1'); }
  if (button.hasAttribute('data-decline')) { declining = true; show('#declineForm input'); return screen.querySelector('#declineForm').scrollIntoView({block:'center'}); }
  if (button.hasAttribute('data-keep')) { declining = false; return show('h1'); }
  if (data.accept) {
    saved.requests[data.accept] = {status:'accepted', time:Date.now()};
    persist();
    open('trip', data.accept);
    return toast('Trip accepted. It is now in My Trips.');
  }
  if (data.undo) { delete saved.requests[data.undo]; persist(); return show('h1'); }
  const action = data.action;
  if (!action) return;
  if (action === 'openActive') return open('trip', activeTrip().id);
  const index = Number(data.index);
  if (action === 'start' || action === 'resume') window.Driver.act(selected, action, index);
  if (action === 'confirm' || action === 'end') {
    const trip = findTrip(selected);
    pending = {id:selected, action, index};
    const end = action === 'end';
    byId('confirmTitle').textContent = end ? 'End this trip?' : 'Confirm this delivery?';
    byId('confirmText').textContent = end ? 'Location recording will stop. Saved updates will stay in the queue.' : 'Confirm once the delivery at ' + trip.stops[index].name + ' is complete.';
    byId('approve').textContent = end ? 'End trip' : 'Confirm delivery';
    dialog.showModal();
  }
});
byId('cancel').addEventListener('click', () => dialog.close());
byId('approve').addEventListener('click', () => {
  if (pending) window.Driver.act(pending.id, pending.action, pending.index);
  dialog.close();
});
dialog.addEventListener('close', () => { pending = null; });

screen.addEventListener('input', event => {
  if (event.target.id === 'reportNote') draft.note = event.target.value;
  if (event.target.id === 'reportTrip') draft.trip = event.target.value;
});
screen.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  if (form.id === 'declineForm') {
    const reason = values.get('reason');
    if (!reason || decision(selected) !== 'pending') return;
    saved.requests[selected] = {status:'declined', reason, time:Date.now()};
    persist();
    open('requests');
    return toast('Request declined on this phone.');
  }
  if (form.id === 'reportForm') {
    const note = String(values.get('note')).trim();
    if (!note) return;
    saved.reports.unshift({trip:String(values.get('trip')), type:draft.type, note, time:Date.now()});
    const kept = persist();
    draft = {trip:'', type:'Delay', note:''};
    show('h1');
    return toast(kept ? 'Report saved on this phone.' : 'Report kept until you close the app.');
  }
  if (form.id === 'profileForm') {
    const next = {};
    for (const key of Object.keys(defaults.profile)) next[key] = String(values.get(key) || '').trim();
    if (!next.name) return toast('Enter your name.');
    saved.profile = next;
    const kept = persist();
    show('h1');
    return toast(kept ? 'Profile saved on this phone.' : 'Profile kept until you close the app.');
  }
});
darkQuery.addEventListener('change', applyTheme);

window.refreshDriver();
setInterval(window.refreshDriver, 1500);
