import {demoId} from './demo-id.js';

const sessionKey = 'mouka-driver:demo-driver';
const accountKey = 'mouka-driver:demo-activations';
const driverWorkspaceUrl = '/mouka-track-delivery/driver/index.html';

// Generate a browser-only example roster. The repository supplies no driver records.
function sampleRoster() {
  const storageName = 'mouka:generated-samples';
  try {
    const existing = JSON.parse(localStorage.getItem(storageName));
    if (Array.isArray(existing) && existing.length === 2) return existing;
  } catch {}
  const samples = [true,false].map((enrolled,index) => {
    const id = 'DEMO-' + demoId(4).toUpperCase();
    return {id, name:'Demo account ' + (index + 1), email:id.toLowerCase() + '@example.com', phone:'', depot:'Demo Depot A', enrolled};
  });
  try { localStorage.setItem(storageName, JSON.stringify(samples)); } catch {}
  return samples;
}
const roster = sampleRoster();

function storedProfile(id) {
  try { return JSON.parse(localStorage.getItem('mouka-driver:workspace:' + id))?.profile || {}; }
  catch { return {}; }
}

export function signedInDriver() {
  try { return roster.find(driver => driver.id === sessionStorage.getItem(sessionKey)); }
  catch { return undefined; }
}

export function endDriverSession() {
  try { sessionStorage.removeItem(sessionKey); } catch {}
}

export function normalizePhone(value) {
  const phone = /^[+0-9(). -]+$/.test(value) ? value.replace(/[^0-9]/g,'') : '';
  return /^0[789][0-9]{9}$/.test(phone) ? '234' + phone.slice(1) : phone;
}

export function findDriver(value, allowId, profileFor = storedProfile) {
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  const phone = normalizePhone(key);
  return roster.find(item => {
    const driver = allowId ? {...item,...profileFor(item.id),id:item.id} : item;
    return driver.email === key || (phone && driver.phone === phone) || (allowId && driver.id.toLowerCase() === key);
  });
}

// This verifier is for sample accounts kept in this browser.
async function pinVerifier(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:new Uint8Array(salt), iterations:100000}, key, 256);
  return Array.from(new Uint8Array(bits)).join('.');
}


export function driverAccessMarkup(policyChoices) {
  return `<section class="driver-access" id="driver-entry">${signedInDriver() ? '<div class="signed-driver"><h1 tabindex="-1">Driver workspace</h1><p>Continue with your current demo session.</p><a class="btn primary" href="/mouka-track-delivery/driver/index.html">Open Driver workspace</a><button type="button" class="inline-link" id="switchDriverAccount">Use another driver account</button></div>' : ''}<div id="driver-entry-forms" ${signedInDriver() ? 'hidden' : ''}><nav class="access-tabs" aria-label="Driver account">
        <button type="button" id="signInTab" aria-current="true">Sign in</button>
        <button type="button" id="activateTab">Create account</button>
      </nav>
      <div id="signInView">
        <h1 id="accessTitle" tabindex="-1">Sign in</h1>
        <p class="access-copy">Use your Driver ID, email, or phone number and six-digit PIN.</p>
        <div class="access-demo-card"><div><strong>Try the Driver demo</strong><p>Fill the sample ID and PIN, then confirm the acknowledgments.</p></div><button type="button" class="btn light" id="fillDemo">Use demo details</button></div>
        <form class="access-form" id="accessForm" autocomplete="off">
          <label for="driverIdentifier">Driver ID, email or phone number</label>
          <input id="driverIdentifier" name="identifier" placeholder="Driver ID, email, or phone" required maxlength="120" autocomplete="username" spellcheck="false">
          <fieldset class="pin-field"><legend>Six-digit PIN</legend><div class="pin-boxes" id="loginPin"></div></fieldset>
          <p id="accessError" class="access-error" role="alert" hidden></p>
          ${policyChoices('driver-login')}
          <button type="submit" class="btn primary">Sign in</button>
        </form>
        <div class="access-links">
          <button type="button" id="forgotPin" aria-expanded="false" aria-controls="pinHelp">Forgot PIN?</button>
        </div>
        <p id="pinHelp" class="access-help" role="status" hidden>For a company-issued account, contact your dispatcher for PIN help.</p>
      </div>
      <div id="activateView" hidden>
        <h1 id="activateTitle" tabindex="-1">Create account</h1>
        <p class="access-copy">Enter the email address or phone number Dispatch registered for you.</p>
        <form class="access-form" id="lookupForm" autocomplete="off">
          <label for="contact">Email or phone number</label>
          <input id="contact" name="contact" placeholder="Registered email or phone" required maxlength="120" spellcheck="false">
          <p id="lookupError" class="access-error" role="alert" hidden></p>
          <button type="submit" class="btn primary">Verify details</button>
        </form>
        <div class="access-links"><button type="button" id="fillInvite">Use sample invite</button></div>
      </div>
      <div id="pinView" hidden>
        <h1 id="pinTitle" tabindex="-1">Set your PIN</h1>
        <p class="access-copy" id="matchedDriver"></p>
        <form class="access-form" id="pinForm" autocomplete="off">
          <fieldset class="pin-field"><legend>Choose a six-digit PIN</legend><div class="pin-boxes" id="setupPin"></div></fieldset>
          <p id="pinError" class="access-error" role="alert" hidden></p>
          ${policyChoices('driver-activate')}
          <button type="submit" class="btn primary">Set PIN</button>
        </form>
        <div class="access-links"><button type="button" id="changeContact">Use a different email or phone</button></div>
      </div>
      <div id="readyView" hidden>
        <h1 id="readyTitle" tabindex="-1">Account created</h1>
        <p class="access-copy">Use your Driver ID, email or phone number the next time you sign in.</p>
        <div class="driver-code">
          <label for="issuedId">Your Driver ID</label>
          <input readonly id="issuedId">
        </div>
        <div class="account-actions">
          <button type="button" id="copyId" class="btn secondary">Copy Driver ID</button>
          <button type="button" id="continueLogin" class="btn primary">Go to sign-in</button>
        </div>
        <p id="copyStatus" class="access-copy" role="status"></p>
      </div></div></section>`;
}

export function mountDriverAccess(root) {
  const get = id => root.querySelector('#' + id);
  const driverIdentifier = get('driverIdentifier');
  const contact = get('contact');
  let demonstrationCode;
  const acknowledged = (form, errorId) => {
    const unchecked = form.querySelector('[name="policy"]:not(:checked)');
    if (!unchecked) return true;
    form.querySelector('.access-legal').setAttribute('aria-invalid','true');
    report(errorId,'Confirm all acknowledgments to continue.');
    unchecked.focus();
    return false;
  };

  const views = {
    signIn: ['signInView','accessTitle'],
    activate: ['activateView','activateTitle'],
    pin: ['pinView','pinTitle'],
    ready: ['readyView','readyTitle']
  };
  let activation;
  let copyTimer;
  let activeView;
  let savedAccounts = {};
  try {
    savedAccounts = JSON.parse(localStorage.getItem(accountKey) || '{}') || {};
  } catch {
    // Demo activation remains available in memory.
  }

  function pinGroup(id) {
    const group = get(id);
    const boxes = Array.from({length:6}, (_, index) => {
      const input = document.createElement('input');
      input.type = 'password';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'PIN digit ' + (index + 1) + ' of 6');
      group.append(input);
      return input;
    });

    function fillFrom(start, digits) {
      const first = digits.length === boxes.length ? 0 : start;
      digits.slice(0, boxes.length - first).split('').forEach((digit, index) => {
        boxes[first + index].value = digit;
      });
      boxes[Math.min(first + digits.length, boxes.length - 1)]?.focus();
    }

    group.addEventListener('input', event => {
      const index = boxes.indexOf(event.target);
      if (index < 0) return;
      const digits = event.target.value.replace(/[^0-9]/g,'');
      event.target.value = '';
      if (digits) fillFrom(index, digits);
    });
    group.addEventListener('focusin', event => event.target.select());
    group.addEventListener('paste', event => {
      const digits = event.clipboardData.getData('text').replace(/[^0-9]/g,'');
      event.preventDefault();
      if (digits) fillFrom(boxes.indexOf(event.target), digits);
      group.dispatchEvent(new Event('input', {bubbles:true}));
    });
    group.addEventListener('keydown', event => {
      const index = boxes.indexOf(event.target);
      if (event.key === 'Backspace' && !event.target.value && index > 0) {
        event.preventDefault();
        boxes[index - 1].value = '';
        boxes[index - 1].focus();
      }
      if (event.key === 'ArrowLeft') boxes[index - 1]?.focus();
      if (event.key === 'ArrowRight') boxes[index + 1]?.focus();
    });
    return {
      read: () => boxes.map(box => box.value).join(''),
      fill: pin => boxes.forEach((box,index) => { box.value = pin[index] || ''; })
    };
  }

  const loginPin = pinGroup('loginPin');
  const setupPin = pinGroup('setupPin');

  function report(id, text = '') {
    const node = get(id);
    node.textContent = text;
    node.hidden = !text;
  }

  function show(view, moveFocus = true) {
    clearTimeout(copyTimer);
    activeView = view;
    for (const [key, [panel]] of Object.entries(views)) get(panel).hidden = key !== view;
    get('signInTab').setAttribute('aria-current', String(view === 'signIn'));
    get('activateTab').setAttribute('aria-current', String(view !== 'signIn'));
    if (moveFocus) get(views[view][1]).focus();
  }

  get('accessForm').addEventListener('input', () => report('accessError'));
  get('accessForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!acknowledged(event.currentTarget, 'accessError')) return;
    const pin = loginPin.read();
    const driver = findDriver(driverIdentifier.value, true);
    const saved = driver && savedAccounts[driver.id];
    if (driver && !driver.enrolled && saved && !crypto.subtle) return report('accessError','Saved demo PINs need HTTPS. Use demo details to try the workspace here.');
    if (!/^[0-9]{6}$/.test(pin)) return report('accessError','Enter all six digits of your PIN.');
    const submit = event.currentTarget.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const valid = driver && (driver.enrolled ? pin === demonstrationCode : saved && saved.verifier === await pinVerifier(pin,saved.salt));
      if (activeView !== 'signIn' || !root.isConnected) return;
      if (!valid) return report('accessError','Those details don’t match an active account. Check them or create your account.');
      sessionStorage.setItem(sessionKey, driver.id);
      location.assign(driverWorkspaceUrl);
    } catch {
      report('accessError','The preview could not check the PIN. Try again.');
    } finally {
      submit.disabled = false;
    }
  });

  get('lookupForm').addEventListener('input', () => report('lookupError'));
  get('lookupForm').addEventListener('submit', event => {
    event.preventDefault();
    const driver = findDriver(contact.value, false);
    if (!driver) return report('lookupError','No invitation matches these details. Ask Dispatch to check your email or phone number.');
    if (driver.enrolled || savedAccounts[driver.id]) {
      return report('lookupError','This account is already active. Sign in or contact Dispatch for PIN help.');
    }
    activation = driver;
    get('matchedDriver').textContent = driver.name + ', your details match the driver roster.';
    setupPin.fill('');
    report('pinError');
    show('pin');
  });

  get('pinForm').addEventListener('input', () => report('pinError'));
  get('pinForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!acknowledged(event.currentTarget, 'pinError')) return;
    const pin = setupPin.read();
    const driver = activation;
    if (!driver || savedAccounts[driver.id]) return;
    if (!crypto.subtle) return report('pinError','Setting a demo PIN needs HTTPS. Use demo details to try the workspace here.');
    if (!/^[0-9]{6}$/.test(pin)) return report('pinError','Choose a PIN with six digits.');
    const submit = event.currentTarget.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      const verifier = await pinVerifier(pin, salt);
      if (activation !== driver || activeView !== 'pin' || !root.isConnected) return;
      savedAccounts[driver.id] = {salt,verifier};
      try { localStorage.setItem(accountKey, JSON.stringify(savedAccounts)); } catch {}
      setupPin.fill('');
      get('issuedId').value = driver.id;
      get('copyStatus').textContent = '';
      show('ready');
    } catch {
      report('pinError','The preview could not save your PIN. Try again.');
    } finally {
      submit.disabled = false;
    }
  });

  function returnToSignIn(useIssuedId = false) {
    if (useIssuedId) driverIdentifier.value = get('issuedId').value;
    loginPin.fill('');
    report('accessError');
    show('signIn');
  }

  get('signInTab').addEventListener('click', () => returnToSignIn(activeView === 'ready'));
  get('activateTab').addEventListener('click', () => {
    if (activeView === 'ready') return;
    activation = null;
    report('lookupError');
    show('activate');
  });
  get('changeContact').addEventListener('click', () => {
    activation = null;
    show('activate');
  });
  get('continueLogin').addEventListener('click', () => returnToSignIn(true));
  get('copyId').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(get('issuedId').value);
      if (activeView !== 'ready') return;
      get('copyStatus').textContent = 'Driver ID copied. Opening sign-in…';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => returnToSignIn(true), 1200);
    } catch {
      get('issuedId').focus();
      get('issuedId').select();
      get('copyStatus').textContent = 'Your Driver ID is selected. Use your device’s Copy action, then go to sign-in.';
    }
  });
  get('fillDemo').addEventListener('click', () => {
    driverIdentifier.value = roster[0].id;
    demonstrationCode = Array.from(crypto.getRandomValues(new Uint8Array(6)), value => value % 10).join('');
    loginPin.fill(demonstrationCode);
    report('accessError');
    get('accessForm').querySelector('[type=submit]').focus();
  });
  get('fillInvite').addEventListener('click', () => {
    contact.value = roster[1].email;
    report('lookupError');
    get('lookupForm').querySelector('[type=submit]').focus();
  });
  get('forgotPin').addEventListener('click', event => {
    const help = get('pinHelp');
    help.hidden = !help.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
  });

  get('switchDriverAccount')?.addEventListener('click', event => {
    endDriverSession();
    event.target.closest('.signed-driver').hidden = true;
    get('driver-entry-forms').hidden = false;
    show('signIn');
  });
  show('signIn', false);
}
