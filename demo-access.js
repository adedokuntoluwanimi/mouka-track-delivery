const sessionKey = 'mouka-demo-account';
const rememberedKey = 'mouka-demo-remembered';
const retention = 30 * 24 * 60 * 60 * 1000;
export const demoPassword = 'MoukaDemo2026!';

export function currentSession() {
  try {
    const email = sessionStorage.getItem(sessionKey);
    if (email) return email;
  } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(rememberedKey));
    if (saved?.expires > Date.now() && typeof saved.email === 'string') return saved.email;
    localStorage.removeItem(rememberedKey);
  } catch {}
  return '';
}

export function isRemembered(email) {
  try {
    const saved = JSON.parse(localStorage.getItem(rememberedKey));
    return Boolean(email && saved?.email === email && saved.expires > Date.now());
  } catch {
    return false;
  }
}

export function saveSession(email, remember) {
  try {
    if (email && remember) localStorage.setItem(rememberedKey, JSON.stringify({email, expires: Date.now() + retention}));
    else localStorage.removeItem(rememberedKey);
  } catch {}
  try {
    if (email && !isRemembered(email)) sessionStorage.setItem(sessionKey, email);
    else sessionStorage.removeItem(sessionKey);
  } catch {}
}

async function derive(password, salt) {
  if (!crypto.subtle) throw new Error('Demo password setup and saved passwords need HTTPS. Use the supplied demo account here.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt),iterations:600000},key,256);
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2,'0')).join('');
}
export async function makeDemoCredential(password) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  return {salt, digest:await derive(password,salt)};
}
export async function checkDemoPassword(user,password) {
  if (!user.demoCredential) return password === demoPassword;
  const {salt,digest} = user.demoCredential;
  return await derive(password,salt) === digest;
}
