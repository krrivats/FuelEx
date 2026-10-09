import { useState, useEffect, useCallback } from 'react';
import { ITER, SALT, HASH } from './creds.js';
import Icon from '../components/ui/Icon.jsx';
import MadeBy from '../components/ui/MadeBy.jsx';

const SESSION_KEY = 'fx-session';
const LOCK_KEY = 'fx-lock';
const DAYS = 30;

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

async function derive(id, pw) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${id.trim().toLowerCase()}\n${pw}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(SALT), iterations: ITER }, key, 256);
  return hex(bits);
}
async function stamp(exp) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`${HASH}:${exp}`)));
}
const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const wr = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

async function sessionValid() {
  const s = rd(SESSION_KEY);
  if (!s || !s.exp || s.exp < Date.now()) return false;
  try { return (await stamp(s.exp)) === s.k; } catch { return false; }
}

export function lockApp() {
  wr(SESSION_KEY, null);
  window.location.reload();
}

/** Asks for ID + password before the app opens. */
export default function Gate({ children }) {
  const [state, setState] = useState('checking'); // checking | locked | open
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!window.crypto?.subtle) { setState('locked'); setMsg('This browser cannot open the app here. Use the https link.'); return; }
    sessionValid().then(ok => { if (alive) setState(ok ? 'open' : 'locked'); });
    return () => { alive = false; };
  }, []);

  // countdown for the wrong-try lock
  useEffect(() => {
    const tick = () => {
      const l = rd(LOCK_KEY);
      const left = l?.until ? Math.max(0, Math.ceil((l.until - Date.now()) / 1000)) : 0;
      setWait(left);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (busy || wait > 0) return;
    setBusy(true); setMsg('');
    try {
      const got = await derive(id, pw);
      if (got === HASH) {
        const exp = Date.now() + DAYS * 86400000;
        wr(SESSION_KEY, { exp, k: await stamp(exp) });
        wr(LOCK_KEY, null);
        setState('open');
      } else {
        const l = rd(LOCK_KEY) || { fails: 0 };
        const fails = (l.fails || 0) + 1;
        const until = fails >= 5 ? Date.now() + Math.min(900, 30 * 2 ** (fails - 5)) * 1000 : 0;
        wr(LOCK_KEY, { fails, until });
        setMsg(fails >= 5 ? 'Too many wrong tries. Please wait.' : 'Wrong ID or password.');
        setPw('');
      }
    } catch {
      setMsg('Could not check. Try again.');
    }
    setBusy(false);
  }, [id, pw, busy, wait]);

  if (state === 'open') return children;
  if (state === 'checking') return <div className="gate" aria-busy="true" />;

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit} autoComplete="on">
        <div className="gate-logo"><Icon name="bolt" /></div>
        <h1 className="gate-title">FuelEx</h1>
        <p className="gate-sub">Sign in to continue</p>

        <label className="gate-label" htmlFor="gate-id">ID</label>
        <input id="gate-id" className="input-field" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false"
          value={id} onChange={e => setId(e.target.value)} autoFocus />

        <label className="gate-label" htmlFor="gate-pw">Password</label>
        <div className="gate-pw">
          <input id="gate-pw" className="input-field" name="password" type={show ? 'text' : 'password'} autoComplete="current-password"
            value={pw} onChange={e => setPw(e.target.value)} />
          <button type="button" className="gate-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? '🙈' : '👁️'}</button>
        </div>

        {msg && <div className="gate-msg" role="alert">{msg}</div>}
        {wait > 0 && <div className="gate-msg" role="status">Try again in {wait}s</div>}

        <button className="btn btn-primary gate-btn" type="submit" disabled={busy || wait > 0 || !id || !pw}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <div className="gate-foot"><MadeBy /></div>
      </form>
    </div>
  );
}
