import {findDriver, normalizePhone, signedInDriver, endDriverSession} from './access.js';

window.findDriver = (value, allowId) => findDriver(value, allowId, id => getDriverData(id).profile);
window.normalizePhone = normalizePhone;
window.loadTrucks = () => import('../truck3d.js');

const driver = signedInDriver();
if (!driver) {
  location.replace('/mouka-track-delivery/#/driver-sign-in');
} else {
  window.enterDriverWorkspace(driver);
  window.refreshDriver();
  document.getElementById('driverWorkspace').hidden = false;
}

document.getElementById('signOut').addEventListener('click', () => {
  endDriverSession();
  window.closeDriverNavigation();
  location.assign('/mouka-track-delivery/#/driver-sign-in');
});
