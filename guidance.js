export const legalItems = {
  terms: ['Terms of Use', 'document', [
    ['Scope of this draft', 'Mouka Dispatch is a TerraCode Analytics Limited workspace for coordinating vehicle availability, depot loading, trip tracking and delivery confirmation. This draft covers the sample workspace and describes intended production use. Production access, service commitments and commercial terms are governed by the signed agreement between Mouka and TerraCode.'],
    ['Access and account responsibility', 'Use an account issued or approved for your role. Keep credentials private and report suspected misuse promptly. Administrators should review access when staff change roles or leave. The demo uses sample accounts and browser-local records.'],
    ['Dispatch and delivery decisions', 'Check vehicle availability, loading status and the destination before acting. Map pins show the last reported position. GPS, routing and ETAs can be delayed or incomplete. Confirm exceptions with the dispatch team or operator before changing assignments or making commitments. Record delivery outcomes accurately and correct mistakes through the approved process.'],
    ['Service changes and support', 'Features can change during the pilot. Follow Mouka’s approved fallback procedure during outages. Report errors with the trip or vehicle reference and the time of the incident. Contact TerraCode at contact@terracodeanalytics.com for support.']
  ]],
  privacy: ['Privacy Policy', 'shield', [
    ['What the demo uses', 'The sample workspace keeps demo accounts, preferences and dispatch changes in your browser. ChatGPT controls access to the hosted preview under its own terms. Use fictional staff, vehicle and destination information.'],
    ['What production may process', 'Depending on enabled features, the service may process work contact details and roles, driver and vehicle records, depot and stop details, active-trip location and timestamps, operational activity, and approved delivery evidence. These records support dispatch, tracking, access management, troubleshooting and delivery reconciliation.'],
    ['Location and access', 'The intended driver workflow shares location during an assigned active trip. Ending the trip is intended to stop sharing. Dispatch should use last-known positions and timestamps when reporting is delayed. Access should be limited to staff and operators with a work need.'],
    ['Recipients and transfers', 'Relevant records may be available to authorised Mouka personnel, assigned transport partners, TerraCode support, and contracted hosting, mapping, messaging or AI providers where enabled. Before production, confirm which parties receive which data and what safeguards apply to any international transfers.'],
    ['Retention and privacy requests', 'Before production use, Mouka and TerraCode should confirm the controller’s identity and contact details, the lawful basis for each purpose, and retention periods for accounts, GPS records, delivery evidence and logs. Contact contact@terracodeanalytics.com for privacy enquiries. Depending on the circumstances, applicable rights may include access, correction, deletion, restriction, objection and a complaint to the Nigeria Data Protection Commission.']
  ]],
  acceptable: ['Acceptable Use Policy', 'check', [
    ['Use the workspace for authorised work', 'Access records needed for your role. Use approved depots, drivers and operators. Keep vehicle documents and delivery confirmations accurate. Follow Mouka’s process for corrections and escalation.'],
    ['Protect people and records', 'Do not track a driver outside authorised work, look up locations for personal reasons, share delivery records publicly, or enter data you are not authorised to handle. Use fictional information throughout the demo.'],
    ['Protect accounts and the service', 'Do not share credentials, bypass permissions, impersonate a user, falsify GPS or delivery records, upload malicious content or interfere with the service. Report suspected misuse to your administrator and TerraCode support.']
  ]],
  ai: ['AI and Third-Party Processing Disclosure', 'message', [
    ['Aurora in the demo', 'Aurora answers from sample workspace records. On supported browsers, some questions may use an on-device model. Check the underlying record before relying on a response.'],
    ['Planned production processing', 'When hosted AI is enabled, questions and relevant workspace context may be sent to a contracted AI service provider to generate replies. Context may include trip references, loading stages, statuses and GPS freshness. The production privacy notice should describe the data actually shared, recipients, locations and retention terms.'],
    ['What to keep out of chat', 'Avoid names, credentials, personal phone numbers, customer addresses and signatures. Where possible, use a trip reference or vehicle ID instead of copying a record into the chat.'],
    ['Human review', 'Aurora can summarise and point you to records. It may be wrong or incomplete. Confirm details with the responsible team before changing a trip, releasing a vehicle or confirming a delivery. Keep decisions about drivers and staff under human review.']
  ]]
};

export const helpTopics = [
  ['Dispatch and vehicle availability', 'truck', [
    ['Where do I start a shift?', 'Open Dispatch and check available trucks, loading bay activity and in-transit deliveries. Open Review affected trips to see GPS exceptions. Check Dispatch activity for the latest workspace events.'],
    ['How do I find a truck?', 'Open Available. Use a summary card or open Filters to select a numbered vehicle, operator, type or readiness. Type a plate, driver or operator and press Enter. Select a row to open the full vehicle record.'],
    ['What does pickup ETA mean?', 'The sample estimate is the time to Demo Depot A from the truck’s last usable position. It is separate from the ETA to the delivery destination. If GPS is stale, confirm the vehicle location with the operator.'],
    ['Where do I see an existing operator response?', 'Open the assignment from Dispatch. The demo can simulate an operator accepting or declining an existing request. Accepted trips move to Loading Bay. A decline should include a reason.']
  ]],
  ['Loading bay and delivery', 'bay', [
    ['How do I record arrival and release?', 'In Loading Bay, open an accepted trip, record arrival and choose an open bay. Start loading when the truck is positioned. Use Confirm loaded and release after the depot has completed its checks.'],
    ['Why can’t I select a bay?', 'A bay already assigned to an active loading trip is unavailable. Confirm the previous truck has cleared the bay. If no bay is open, wait for release or check capacity with the depot team.'],
    ['How do I confirm multiple stops?', 'Open the delivery and check the stop order. Use Confirm next stop only after the team verifies delivery. Repeat for each stop. The final confirmation closes the trip as Delivered.'],
    ['Where do I find completed trips?', 'In Deliveries, select Delivered or filter by vehicle and pickup depot. Open a row to see the stop list, progress and trip history.']
  ]],
  ['Live tracking and GPS', 'pin', [
    ['What does Stale GPS mean?', 'Dispatch has not received a usable recent update. Check the last reported position and time. The position may no longer match the truck’s actual location, and destination ETAs may be withheld.'],
    ['What if the map looks wrong?', 'Match the vehicle plate and trip ID, check the update age, then confirm with the operator or driver through approved channels. Include the trip ID, last reported time and expected location when reporting a mismatch.'],
    ['What if the driver loses coverage?', 'In the planned driver app, position updates can queue locally during a coverage gap and sync after reconnecting. The dispatcher should use the last reported location until a fresh update arrives. The web demo uses sample locations.'],
    ['When should location sharing stop?', 'In the planned driver workflow, the driver ends the active trip once the assigned stops are complete. Escalate tracking that appears to continue beyond the trip.']
  ]],
  ['Fleet and verification', 'shield', [
    ['Where do I review a truck?', 'Open Verification and select a row. Review the registration, insurance and roadworthiness documents before recording a decision. Existing verified vehicles appear in Fleet Directory.'],
    ['What if documents are missing?', 'Record Needs corrections and specify the missing or invalid item in the review note. Only approve a vehicle once the required documents are complete and verified.']
  ]],
  ['Accounts, permissions and depots', 'users', [
    ['How do I edit a staff account?', 'In Users & permissions, select a staff row to open its editor. Update the name, demo email, role or status and save. Choose the role that matches the person’s work.'],
    ['How do demo invitations and password recovery work?', 'Use an example.com address. Invitations and recovery links run in the browser preview. Google sign-in and email delivery are not connected.'],
    ['Where do I change a depot or its bay count?', 'Open Depot Settings to add or edit a depot. Check active loading assignments before lowering the bay count.'],
    ['How do I change the display?', 'Open Administration and select Light, Dark or System. Font size is under Appearance or Account settings. Your browser remembers these preferences.']
  ]],
  ['Aurora and technical support', 'message', [
    ['What can I ask Aurora?', 'Ask for a dispatch summary, trucks with stale GPS or the next stop for a trip ID. Use the link in the answer to verify the record. Avoid putting personal information into chat.'],
    ['What should I include in a support request?', 'Include the page, trip or vehicle reference, time in WAT, what you expected and what happened. Add a screenshot with private details removed when it helps explain the problem.'],
    ['What if a change fails to save?', 'Check your connection and keep the form open while you retry. In the demo, changes stay in the browser. Check the record before repeating a previously submitted update.']
  ]]
];
