'use strict';

const assignments = [
  {
    "id": "MD-0042",
    "truck": "DEMO-VEHICLE-06",
    "origin": "Demo Depot A",
    "window": "Today, 9:00 WAT",
    "stops": [
      {
        "name": "Sample Stop A",
        "area": "Demo Zone A"
      },
      {
        "name": "Sample Stop B",
        "area": "Demo Zone B"
      }
    ]
  },
  {
    "id": "MD-0045",
    "truck": "DEMO-VEHICLE-06",
    "origin": "Demo Depot A",
    "window": "Next assignment",
    "stops": [
      {
        "name": "Sample Stop C",
        "area": "Demo Zone C"
      }
    ]
  }
];

const baseProgressKey = 'mouka-driver:browser-demo:v1';
const progressByDriver = new Map();
let progressKey;
let progress = {trips: {}, pending: 0};

window.Driver = {
  useDriver(driverId) {
    progressKey = driverId === 'DEMO-DRIVER-1' ? baseProgressKey : baseProgressKey + ':' + driverId;
    progress = progressByDriver.get(progressKey) || {trips: {}, pending: 0};
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey));
      if (saved && saved.trips && Number.isInteger(saved.pending)) progress = saved;
    } catch {
      // The demo remains usable in a browser that blocks local storage.
    }
    progressByDriver.set(progressKey, progress);
  },

  snapshot() {
    const tracking = Object.values(progress.trips).some(trip => trip.phase === 'active');
    return JSON.stringify({...progress, assignments, tracking, note: '', syncConfigured: false});
  },

  act(id, action, index) {
    const assignment = assignments.find(trip => trip.id === id);
    if (!assignment || !progressKey) return;
    const trip = progress.trips[id] || {phase: 'assigned', done: 0};
    if (action === 'start') {
      if (trip.phase !== 'assigned' || Object.values(progress.trips).some(item => item.phase === 'active')) return;
      trip.phase = 'active';
    } else if (action === 'confirm') {
      if (trip.phase !== 'active' || trip.done !== index || index >= assignment.stops.length) return;
      trip.done++;
    } else if (action === 'end') {
      if (trip.phase !== 'active' || trip.done !== assignment.stops.length) return;
      trip.phase = 'completed';
    } else {
      return;
    }

    trip.log = [...(trip.log || []), [action, action === 'confirm' ? index : null, new Date().toISOString()]];
    progress.trips[id] = trip;
    progress.pending++;
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
    } catch {
      // Trip changes stay in memory for this visit.
    }
    window.refreshDriver();
  },

  resetProgress() {
    if (!progressKey) return;
    progress = {trips: {}, pending: 0};
    progressByDriver.set(progressKey, progress);
    try {
      localStorage.removeItem(progressKey);
    } catch {
      // The in-memory trip progress has already been reset.
    }
    window.refreshDriver();
  }
};
