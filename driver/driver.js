'use strict';

// Shared helpers, trip state and the Trip Details screen (laid out like Dispatch's Tracking screen).
const shapes = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
  truck: '<path d="M3 5h12v12H3zM15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  gps: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m10 7h-3m-7 10v-3M2 12h3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  box: '<path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9"/>',
  depot: '<path d="M3 21V8l9-5 9 5v13M3 21h18M7 21V11h10v10M7 15h10"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
};
const svg = name => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (shapes[name] || shapes.info) + '</svg>';
const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const screen = document.querySelector('#screen');
const dock = document.querySelector('#dock');
const dialog = document.querySelector('#confirm');
const notice = document.querySelector('#notice');
let selected;
let state;
let signature;
let message = '';

const phase = id => (state.trips[id] || {}).phase || 'assigned';
const phaseText = {assigned:'Upcoming', active:'In progress', completed:'Completed'};
const phaseTone = {assigned:'amber', active:'violet', completed:'green'};
const doneStops = trip => state.trips[trip.id]?.done || 0;
const destination = trip => trip.stops[trip.stops.length-1].area.split(',')[0];
const plural = (count, one, many = one + 's') => `${count} ${count === 1 ? one : many}`;
const chip = id => `<span class="chip ${phaseTone[phase(id)]}">${phaseText[phase(id)]}</span>`;
const vehicleType = plate => plate === 'DEMO-VEHICLE-06' ? 'Trailer' : 'Box truck';
const clockTime = stamp => stamp ? new Intl.DateTimeFormat('en-GB',{hour:'2-digit', minute:'2-digit', timeZone:'Africa/Lagos'}).format(new Date(stamp)) + ' WAT' : '';

// What has happened on a trip, newest first. Older saved progress has no times.
function tripHistory(trip) {
  const record = state.trips[trip.id] || {phase:'assigned', done:0};
  if (record.log?.length) {
    return [...record.log].reverse().map(([action, index, stamp]) => ({
      title: action === 'start' ? 'Trip started' : action === 'end' ? 'Trip ended' : 'Delivery confirmed at ' + trip.stops[index].name,
      time: clockTime(stamp)
    })).concat({title:'Trip assigned', time:trip.window});
  }
  const events = [{title:'Trip assigned', time:trip.window}];
  if (record.phase !== 'assigned') events.unshift({title:'Trip started', time:''});
  trip.stops.slice(0, record.done).forEach(stop => events.unshift({title:'Delivery confirmed at ' + stop.name, time:''}));
  if (record.phase === 'completed') events.unshift({title:'Trip ended', time:''});
  return events;
}

function routeDirections(places) {
  const query = new URLSearchParams({api:'1', origin:places[0], destination:places[places.length-1], travelmode:'driving'});
  if (places.length > 2) query.set('waypoints', places.slice(1,-1).join('|'));
  return 'https://www.google.com/maps/dir/?' + query.toString();
}

// An illustrative city drawn in SVG, so the screen works offline.
const cityBackground = (() => {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const steps = (from, to) => { const list = [from]; while (list[list.length-1] < to) list.push(Math.round(list[list.length-1] + 28 + random() * 30)); return list; };
  const columns = steps(-520, 1120);
  const rows = steps(-420, 900);
  let blocks = '';
  for (let i = 0; i < columns.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const width = columns[i+1] - columns[i] - 8;
      const height = rows[j+1] - rows[j] - 8;
      for (let x = 0; x < width - 6;) {
        const size = Math.min(width - x, Math.round(8 + random() * 18));
        if (random() > .3) blocks += `M${columns[i]+4+x} ${rows[j]+4}h${size-3}v${Math.round(height * (.5 + random() * .5))}h${3-size}z`;
        x += size;
      }
    }
  }
  const streets = columns.map(x => 'M' + x + ' -480V960').join('') + rows.map(y => 'M-560 ' + y + 'H1180').join('');
  return `<rect class="land" x="-600" y="-500" width="1800" height="1500"/><g transform="rotate(-12 300 230)"><path class="building" d="${blocks}"/><path class="street" d="${streets}"/></g>
    <path class="water" d="M-300 330C-60 270 90 420 250 372S430 190 610 215S880 150 980 80"/>
    <path class="highway" d="M-300 90C20 150 220 40 380 130S700 330 960 300M60 -300C90 20 300 180 330 340S420 620 520 760"/>`;
})();

const stopPoints = count => {
  const layouts = {2:[[150,90],[440,370]], 3:[[140,80],[420,210],[250,390]]};
  return layouts[count] || Array.from({length:count}, (_, i) => [140 + (i % 2) * 280, 70 + i * 320 / Math.max(1, count-1)]);
};
function routeShape(points) {
  // Street-like turns between each pair of places.
  return points.slice(1).reduce((path, [x,y], i) => {
    const [fromX, fromY] = points[i];
    const middle = Math.round((fromY + y) / 2);
    return path.concat([[fromX, middle - 24], [fromX + (x - fromX) * .45, middle], [x, middle + 26], [x, y]]);
  }, [points[0]]);
}

function tripMap(trip) {
  const places = [{name:trip.origin, label:'Pickup', address:trip.originAddress, coordinates:trip.originCoordinates},
    ...trip.stops.map((stop, i) => ({...stop, label:trip.stops.length === 1 ? 'Dropoff' : 'Stop ' + (i+1)}))];
  const points = stopPoints(places.length);
  const path = routeShape(points);
  const status = phase(trip.id);
  const done = doneStops(trip);
  // The truck sits at the last confirmed place, or part way to the next one while driving.
  const reached = status === 'completed' ? path.length - 1 : status === 'assigned' ? 0 : Math.min(path.length - 1, done * 4 + (done < trip.stops.length ? 2 : 0));
  const line = list => list.map(point => point.join(',')).join(' ');
  const [truckX, truckY] = path[reached];
  const known = places.every(point => Array.isArray(point.coordinates) && point.coordinates.length === 2 && point.coordinates.every(Number.isFinite));
  const addresses = places.map(point => point.address);
  const bounds = known ? [Math.min(...places.map(p => p.coordinates[1])) - .12, Math.min(...places.map(p => p.coordinates[0])) - .12,
    Math.max(...places.map(p => p.coordinates[1])) + .12, Math.max(...places.map(p => p.coordinates[0])) + .12].join(',') : '';
  const streetMap = bounds && 'https://www.openstreetmap.org/export/embed.html?' + new URLSearchParams({bbox:bounds, layer:'mapnik', marker:places[places.length-1].coordinates.join(',')});
  return {
    map: `<svg class="trip-map" viewBox="0 0 600 460" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${safe('Illustrative map from ' + trip.origin + ' through ' + trip.stops.map(s => s.name).join(', '))}">
      ${cityBackground}
      <polyline class="route-ahead" points="${line(path.slice(reached))}"/><polyline class="route-done" points="${line(path.slice(0, reached+1))}"/>
      ${points.map(([x,y], i) => {
        const width = Math.max(84, places[i].name.length * 7.6 + 26);
        return `<g class="marker ${i === 0 ? 'pickup' : i <= done ? 'done' : ''}"><circle cx="${x}" cy="${y}" r="10"/><rect x="${x-width/2}" y="${y-62}" width="${width}" height="43" rx="10"/><text class="kind" x="${x}" y="${y-46}">${places[i].label.toUpperCase()}</text><text x="${x}" y="${y-29}">${safe(places[i].name)}</text></g>`;
      }).join('')}
      <g class="vehicle" transform="translate(${truckX} ${truckY})"><circle class="halo" r="32"/><circle class="body" r="17"/><g transform="translate(-10 -10) scale(.83)" class="glyph"><path d="M3 5h12v12H3zM15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></g></g>
    </svg>`,
    street: streetMap ? `<details class="trip-street-map" data-map-url="${safe(streetMap)}"><summary>Show interactive street map</summary></details>` : '',
    directions: addresses.every(Boolean) ? `<a class="button" href="${safe(routeDirections(addresses))}" target="_blank" rel="noopener noreferrer">Full trip directions</a>` : '',
    legs: places.map((point, i) => i && addresses[i] && addresses[i-1] ? `<a class="more" href="${safe(routeDirections(addresses.slice(i-1, i+1)))}" target="_blank" rel="noopener noreferrer">Directions</a>` : '')
  };
}

const tripCard = trip => {
  const total = trip.stops.length;
  return `<li class="tr-card ${trip.id === selected ? 'selected' : ''}">
    <button type="button" data-trip="${safe(trip.id)}" aria-pressed="${trip.id === selected}">
      <span class="tr-card-top"><span class="tr-box">${svg('box')}</span><strong>#${safe(trip.id)}</strong>${chip(trip.id)}</span>
      <progress class="meter ${phaseTone[phase(trip.id)]}" value="${phase(trip.id) === 'completed' ? total : doneStops(trip)}" max="${total}" aria-label="${doneStops(trip)} of ${total} stops confirmed"></progress>
      <span class="tr-ends"><span>${safe(trip.origin)}<br>${safe(trip.window)}</span><span>${safe(destination(trip))}<br>${doneStops(trip)} of ${total} stops done</span></span>
    </button></li>`;
};

function render() {
  const active = state.assignments.find(item => phase(item.id) === 'active');
  if (!selected) selected = (active || state.assignments[0]).id;
  const trip = state.assignments.find(item => item.id === selected);
  const status = phase(trip.id);
  const done = doneStops(trip);
  const total = trip.stops.length;
  const tracking = status === 'active' && Boolean(state.tracking);
  const action = status === 'assigned' ? (active ? 'openActive' : 'start') : status === 'completed' ? '' : done === total ? 'end' : !state.tracking ? 'resume' : 'confirm';
  const actionInfo = {
    start: ['Start trip', 'gps', 'Try the trip using simulated location tracking.'],
    openActive: ['Return to active trip', 'arrow', 'One trip can be active at a time.'],
    resume: ['Resume tracking', 'gps', 'Open the app and resume recording location.'],
    confirm: ['Confirm stop ' + (done + 1), 'check', done < total ? trip.stops[done].name : ''],
    end: ['End trip', 'stop', 'All delivery stops confirmed.']
  };
  const shape = tripMap(trip);
  const stops = [{name:trip.origin, area:'Pickup depot', complete:status !== 'assigned', current:false, icon:'depot'},
    ...trip.stops.map((stop, i) => ({name:stop.name, area:stop.area, complete:i < done, current:i === done && status === 'active', index:i}))];

  const focusedTrip = document.activeElement?.dataset?.trip;
  screen.innerHTML = `<div class="tr-board">
    <section class="tr-list" aria-label="Your trips">
      <header><h1 tabindex="-1">Trip Details</h1><button type="button" class="round" data-page="trips" aria-label="Back to My Trips" title="Back to My Trips">${svg('grid')}</button></header>
      <ul>${state.assignments.map(tripCard).join('')}</ul>
    </section>
    <div class="tr-view">
      <section class="tr-map" aria-label="Trip map">${shape.map}<p class="tr-note">Illustrative map</p></section>
      <div class="tr-side">
        <section class="tr-float tr-summary">
          <p class="eyebrow">Trip ${safe(trip.id)} ${chip(trip.id)}</p>
          <h2>${safe(destination(trip))} delivery</h2>
          <dl><div><dt>Vehicle</dt><dd>${safe(trip.truck)}</dd></div><div><dt>Departure</dt><dd>${safe(trip.window)}</dd></div></dl>
          <p class="tr-gps ${tracking ? 'on' : ''}"><i></i><span><b>${tracking ? 'Simulated tracking on' : status === 'active' ? 'Tracking paused' : 'Simulated tracking off'}</b><small>${state.pending ? plural(state.pending, 'update') + ' queued · ' : ''}GPS and Dispatch updates are simulated</small></span></p>
        </section>
        <section class="tr-float" aria-labelledby="tr-stops-title">
          <header><h2 id="tr-stops-title">Delivery stops</h2><small>${done} of ${total} confirmed</small></header>
          <ol class="stops">${stops.map((stop, i) => `<li class="${stop.complete ? 'done' : stop.current ? 'next' : ''}"><i>${stop.complete ? svg('check') : stop.icon ? svg(stop.icon) : stop.index + 1}</i><span><strong>${safe(stop.name)}</strong><small>${safe(stop.area)}${stop.current ? ' · Next stop' : ''}</small></span>${shape.legs[i] || ''}</li>`).join('')}</ol>
          ${shape.directions}
        </section>
        <section class="tr-float" aria-labelledby="tr-activity-title">
          <header><h2 id="tr-activity-title">Activity</h2><button type="button" class="more" data-report="${safe(trip.id)}">Report an issue</button></header>
          <ol class="history">${tripHistory(trip).map(event => `<li><strong>${safe(event.title)}</strong>${event.time ? `<small>${safe(event.time)}</small>` : ''}</li>`).join('')}</ol>
        </section>
      </div>
    </div></div>${shape.street}`;

  if (focusedTrip) Array.from(screen.querySelectorAll('[data-trip]')).find(button => button.dataset.trip === focusedTrip)?.focus({preventScroll:true});
  dock.hidden = !action;
  const currentButton = dock.querySelector('button');
  if (action) {
    const [label, icon, help] = actionInfo[action];
    if (!currentButton || currentButton.dataset.action !== action || currentButton.dataset.index !== String(done)) {
      dock.innerHTML = '<div class="bar"><button class="primary" data-action="' + action + '" data-index="' + done + '">' + svg(icon) + safe(label) + '</button><p>' + safe(help) + '</p></div>';
      if (currentButton === document.activeElement) dock.querySelector('button').focus();
    }
  } else {
    dock.innerHTML = '';
  }
  if (state.note !== message) {
    message = state.note;
    notice.textContent = message;
    notice.hidden = !message;
  }
}

window.refreshDriver = function () {
  if (!window.Driver) return;
  const snapshot = Driver.snapshot();
  if (snapshot === signature) return;
  signature = snapshot;
  state = JSON.parse(snapshot);
  if (window.renderWorkspace) window.renderWorkspace();
  else render();
};

document.addEventListener('toggle', event => {
  const section = event.target;
  if (!section.open || !section.dataset?.mapUrl || section.querySelector('iframe')) return;
  const map = document.createElement('iframe');
  map.src = section.dataset.mapUrl;
  map.title = 'Interactive street map of the trip area';
  map.loading = 'lazy';
  section.append(map);
}, true);

let pending;
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !state) return;
  if (button.dataset.trip || button.dataset.action === 'openActive') {
    selected = button.dataset.trip || state.assignments.find(item => phase(item.id) === 'active').id;
    signature = null;
    window.refreshDriver();
    window.scrollTo(0, 0);
    return;
  }
  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  if (action === 'start' || action === 'resume') Driver.act(selected, action, index);
  if (action === 'confirm' || action === 'end') {
    const trip = state.assignments.find(item => item.id === selected);
    pending = {id:selected, action, index};
    const end = action === 'end';
    document.querySelector('#confirmTitle').textContent = end ? 'End this trip?' : 'Confirm this delivery?';
    document.querySelector('#confirmText').textContent = end ? 'Simulated tracking will stop. Demo updates will stay in the queue.'
      : 'Confirm once the delivery at ' + trip.stops[index].name + ' is complete.';
    document.querySelector('#approve').textContent = end ? 'End trip' : 'Confirm delivery';
    dialog.showModal();
  }
});
document.querySelector('#cancel').addEventListener('click', () => dialog.close());
document.querySelector('#approve').addEventListener('click', () => {
  if (pending) Driver.act(pending.id, pending.action, pending.index);
  dialog.close();
});
dialog.addEventListener('close', () => { pending = null; });
window.refreshDriver();
setInterval(window.refreshDriver, 1500);
