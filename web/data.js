// Synthetic fixtures for the starter repository.
export const depots = ['Demo Depot A', 'Demo Depot B', 'Demo Depot C'];
export const stages = ['Awaiting response', 'Accepted', 'Declined', 'At bay', 'Loading', 'In transit', 'Delivered'];
export const seed = {
  fleet: [
    {id:'TRK-941',plate:'DEMO-VEHICLE-01',operator:'Demo Operator 1',driver:'Sample Driver 01',type:'Box truck',location:'Demo Zone 01',demoPosition:[300, 340],eta:12,fresh:1,status:'Available',review:'Verified'},
    {id:'TRK-928',plate:'DEMO-VEHICLE-02',operator:'Demo Operator 2',driver:'Sample Driver 02',type:'Box truck',location:'Demo Zone 02',demoPosition:[410, 320],eta:19,fresh:2,status:'Available',review:'Verified'},
    {id:'TRK-965',plate:'DEMO-VEHICLE-03',operator:'Demo Operator 3',driver:'Sample Driver 03',type:'Trailer',location:'Demo Zone 03',demoPosition:[482, 250],eta:27,fresh:3,status:'Available',review:'Verified'},
    {id:'TRK-919',plate:'DEMO-VEHICLE-04',operator:'Demo Operator 1',driver:'Sample Driver 04',type:'Box truck',location:'Demo Zone 04',demoPosition:[166, 301],eta:35,fresh:2,status:'Available',review:'Verified'},
    {id:'TRK-952',plate:'DEMO-VEHICLE-05',operator:'Demo Operator 3',driver:'Sample Driver 05',type:'Box truck',location:'Demo Zone 05',demoPosition:[580, 148],eta:52,fresh:38,status:'Available',review:'Verified'},
    {id:'TRK-936',plate:'DEMO-VEHICLE-06',operator:'Demo Operator 2',driver:'Sample Driver 06',type:'Trailer',location:'Demo Zone 06',demoPosition:[539, 233],fresh:2,status:'Assigned',review:'Verified'},
    {id:'TRK-918',plate:'DEMO-VEHICLE-07',operator:'Demo Operator 4',driver:'Sample Driver 07',type:'Box truck',location:'Demo Zone 07',demoPosition:[671, 311],fresh:22,status:'Assigned',review:'Verified'},
    {id:'TRK-926',plate:'DEMO-VEHICLE-08',operator:'Demo Operator 1',driver:'Sample Driver 08',type:'Box truck',location:'Demo Zone 08',demoPosition:[443, 367],fresh:2,status:'Assigned',review:'Verified'},
    {id:'TRK-944',plate:'DEMO-VEHICLE-09',operator:'Demo Operator 4',driver:'Sample Driver 09',type:'Box truck',location:'Demo Zone 09',demoPosition:[180, 401],fresh:5,status:'Assigned',review:'Verified'},
    {id:'TRK-973',plate:'DEMO-VEHICLE-10',operator:'Demo Operator 5',driver:'Sample Driver 10',type:'Trailer',location:'Demo Zone 10',status:'Unavailable',review:'Pending review',docs:['Vehicle registration','Insurance certificate','Roadworthiness certificate']},
    {id:'TRK-974',plate:'DEMO-VEHICLE-11',operator:'Demo Operator 5',driver:'Sample Driver 11',type:'Box truck',location:'Demo Zone 08',status:'Unavailable',review:'Pending review',docs:['Vehicle registration','Insurance certificate']},
  ],
  trips: [
    {id:'MD-0042',truck:'TRK-936',depot:'Demo Depot A',stops:['Sample Stop A','Sample Stop B'],status:'In transit',eta:'1 hr 18 min',done:0,events:[['Truck released by loading staff','09:11'],['Loading started','08:42'],['Request accepted','08:06']]},
    {id:'MD-0041',truck:'TRK-918',depot:'Demo Depot A',stops:['Sample Stop D'],status:'In transit',eta:'26 min',done:0,events:[['Truck released by loading staff','09:23'],['Truck arrived at bay','08:54']]},
    {id:'MD-0040',truck:'TRK-926',depot:'Demo Depot A',stops:['Sample Stop C'],status:'Loading',done:0,bay:'Bay 02',arrived:18,events:[['Loading started','10:06'],['Truck arrived at bay','09:54']]},
    {id:'MD-0039',truck:'TRK-944',depot:'Demo Depot A',stops:['Sample Stop E'],status:'Delivered',done:1,events:[['Delivery confirmed','09:47'],['Truck released by loading staff','08:11']]},
    {id:'MD-0038',truck:'TRK-965',depot:'Demo Depot A',stops:['Sample Stop F'],status:'Declined',reason:'Vehicle maintenance in progress.',done:0,events:[['Operator declined the request','09:31']]},
    {id:'MD-0043',truck:'TRK-919',depot:'Demo Depot A',stops:['Sample Stop G'],status:'Awaiting response',done:0,events:[['Dispatch requested the truck','10:02']]},
  ],
  activity:[
    ['GPS update overdue','MD-0041 · Last seen 22 min ago','10:10','warning'],
    ['Loading started','MD-0040 · Demo Depot A, Bay 02','10:06','bay'],
    ['Truck request sent','MD-0043 · Demo Operator 1','10:02','send'],
    ['Delivery confirmed','MD-0039 · Sample Stop E','09:47','check'],
    ['Truck request declined','MD-0038 · Demo Operator 3','09:31','close']
  ],
  users:[
    {name:'Sample Admin',email:'sample-admin@example.com',role:'Administrator',status:'Active'},
    {name:'Sample Dispatcher',email:'sample-dispatcher@example.com',role:'Dispatch',status:'Active'},
    {name:'Sample Loading Staff',email:'sample-loading-staff@example.com',role:'Loading',status:'Active'},
    {name:'Sample Fleet Reviewer',email:'sample-fleet-reviewer@example.com',role:'Fleet verification',status:'Invited'}
  ],
  locations: [
    {name:'Demo Depot A',area:'Demo Region A',bays:3},
    {name:'Demo Depot B',area:'Demo Region B',bays:2},
    {name:'Demo Depot C',area:'Demo Region C',bays:2}
  ],
  next:50
};
export const iconPaths = {
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8m0-4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16m0 4v-4h-4"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  more:'<path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/>',
  filter:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--paper)"/><circle cx="15" cy="17" r="2" fill="var(--paper)"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  'log-out':'<path d="M10 17l5-5-5-5m5 5H3m12-9h5v18h-5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
  moon:'<path d="M20.9 14.2A9 9 0 0 1 9.8 3.1 9 9 0 1 0 20.9 14.2Z"/>',
  monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  document:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.8-4.2A8.5 8.5 0 1 1 21 11.5Z"/>',
  google:'<path fill="#4285f4" stroke="none" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.5c1.9-1.7 2.7-4.3 2.7-7.5Z"/><path fill="#34a853" stroke="none" d="M12 22c2.7 0 5-.9 6.9-2.3l-3.5-2.6a6 6 0 0 1-9-3.2H2.9v2.7A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" stroke="none" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H2.9a10 10 0 0 0 0 9.2Z"/><path fill="#ea4335" stroke="none" d="M12 6a5.6 5.6 0 0 1 3.9 1.5l3-3A9.5 9.5 0 0 0 12 2a10 10 0 0 0-9.1 5.4l3.5 2.7A6 6 0 0 1 12 6Z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  truck:'<path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/><circle cx="6" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="18" r="2" fill="currentColor" stroke="none"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  bay:'<path d="M3 21V8l9-5 9 5v13M3 21h18M7 21V11h10v10M7 15h10M7 18h10"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
  box:'<path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.25l9 4.5"/>',
  shield:'<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>',
  users:'<circle cx="9" cy="7" r="3"/><path d="M2 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 4a3 3 0 0 1 0 6m5 10v-2a4 4 0 0 0-3-4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 4 2 2v3l3 3 3-1 2 3 4-2 1-3 3-1v-4l-3-1-1-4-4-2-2 2Z"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',
  warning:'<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
};
