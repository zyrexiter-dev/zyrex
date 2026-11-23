'use strict';
/**
 * MusifyRik — sumber audio YouTube (pengganti Savetube).
 * ------------------------------------------------------------------
 * Modul ini menggantikan rantai `cdn40x.savetube.vip/v2/info` + `/download`
 * yang sejak akhir 2026 hanya mengembalikan URL 302 ke halaman promo
 * (https://ytshortdown.com/) sehingga <audio> gagal memutar lagu.
 *
 * Strategi:
 *  1. Minta player API YouTube (InnerTube) memakai klien yang tidak
 *     memerlukan PO token — saat ini `VISIONOS` (id 101).
 *  2. visitorData diambil sekali dari halaman YouTube lalu dipakai ulang;
 *     tanpa visitorData YouTube membalas LOGIN_REQUIRED ("Sign in to
 *     confirm you're not a bot").
 *  3. Format audio dipilih dari yang paling kompatibel:
 *     itag 140 (m4a/aac 128k) → 251/250/249 (webm/opus) → 139.
 *  4. URL hasil ekstraksi terikat pada IP server, jadi pemutaran memakai
 *     proxy same-origin /api/audio? v=<id> yang mengekstrak dan mengalirkan
 *     byte audio pada invocation yang sama.
 *
 * CATATAN PENTING (IP datacenter):
 *  YouTube menolak permintaan dari IP datacenter (Vercel/Netlify/AWS) dengan
 *  LOGIN_REQUIRED — "Sign in to confirm you're not a bot". Dua jalur resmi:
 *   a. Setel env YOUTUBE_COOKIES (cookie akun Google) → permintaan dikirim
 *      dengan Cookie + SAPISIDHASH sehingga dianggap sesi pengguna.
 *   b. Setel env AUDIO_EXTRACTOR_URL ke layanan ekstraksi milik sendiri
 *      (mis. yt-dlp di VPS) → dipakai sebagai sumber utama/cadangan.
 *  Tanpa salah satu, ekstraksi hanya berhasil bila IP server tidak diblokir
 *  (mis. saat `npm run dev` di jaringan rumah atau VPS lokal).
 */

const https = require('node:https');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const HOME_URL = 'https://www.youtube.com/?hl=en&gl=US';
const VISITOR_TTL = 6 * 60 * 60 * 1000;
const URL_TTL_FALLBACK = 60 * 60 * 1000;
const MAX_RELAY_BYTES = 32 * 1024 * 1024;
const YT_ORIGIN = 'https://www.youtube.com';

// Cookie akun Google (opsional). Format: "SID=...; HSID=...; SSID=...; APISID=...; SAPISID=..."
const COOKIE_RAW = String(process.env.YOUTUBE_COOKIES || process.env.YT_COOKIE || '').trim();
// Dibaca saat dipakai (bukan saat modul dimuat) supaya perubahan env —
// termasuk pada pengujian dan pada runtime serverless — selalu terpakai.
function extractorConfig() {
  return {
    url: String(process.env.AUDIO_EXTRACTOR_URL || '').trim(),
    token: String(process.env.AUDIO_EXTRACTOR_TOKEN || '').trim(),
    // Hanya untuk pengujian lokal (extractor di 127.0.0.1 tanpa TLS).
    insecure: String(process.env.AUDIO_EXTRACTOR_INSECURE || '').toLowerCase() === '1'
  };
}

const VISIONOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Urutan klien: yang pertama paling stabil & tanpa PO token.
const CLIENTS = [
  {
    name: 'VISIONOS',
    id: '101',
    ua: VISIONOS_UA,
    context: {
      clientName: 'VISIONOS', clientVersion: '1.02',
      deviceMake: 'Apple', deviceModel: 'RealityDevice17,1',
      osName: 'visionOS', osVersion: '26.5.23O471',
      userAgent: VISIONOS_UA, hl: 'en', gl: 'US'
    }
  },
  {
    name: 'IOS',
    id: '5',
    ua: 'com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    context: {
      clientName: 'IOS', clientVersion: '21.26.4',
      deviceMake: 'Apple', deviceModel: 'iPhone16,2',
      osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en', gl: 'US'
    }
  },
  {
    name: 'MWEB',
    id: '2',
    ua: 'Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    context: { clientName: 'MWEB', clientVersion: '2.20260708.05.00', hl: 'en', gl: 'US' }
  }
];

const AUDIO_PREFERENCE = [140, 251, 250, 249, 139, 252, 149];

class AudioSourceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

let visitorCache = { value: '', at: 0 };
const urlCache = new Map(); // videoId -> { url, mime, itag, expiresAt, durationLabel, contentLength }
let homeRequest = null;

function httpRequest(url, { method = 'GET', headers = {}, body, timeout = 12000, signal, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try { target = new URL(url); } catch (e) { reject(new AudioSourceError('BAD_URL')); return; }
    if (target.protocol !== 'https:') { reject(new AudioSourceError('BAD_URL')); return; }

    const req = https.request({
      method,
      host: target.host,
      path: target.pathname + target.search,
      headers,
      signal
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects <= 0) { reject(new AudioSourceError('UPSTREAM_ERROR', 'Too many redirects')); return; }
        const next = new URL(res.headers.location, target).href;
        resolve(httpRequest(next, { method, headers, body, timeout, signal, redirects: redirects - 1 }));
        return;
      }
      resolve({ status: res.statusCode || 502, headers: res.headers, stream: res });
    });

    req.setTimeout(timeout, () => req.destroy(new AudioSourceError('UPSTREAM_TIMEOUT')));
    req.on('error', (error) => {
      if (error && error.name === 'AbortError') reject(new AudioSourceError('ABORTED'));
      else if (error instanceof AudioSourceError) reject(error);
      else reject(new AudioSourceError('UPSTREAM_ERROR', error.message));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function readBody(response, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.stream) {
    size += chunk.length;
    if (size > limit) { response.stream.destroy(); break; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function cookieHeader() {
  if (!COOKIE_RAW) return '';
  // Terima format "a=1; b=2" maupun format Netscape (baris tab) — ambil pasangan k=v.
  if (COOKIE_RAW.includes('\t')) {
    const pairs = COOKIE_RAW.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('\t'))
      .filter((cols) => cols.length >= 7 && cols[5])
      .map((cols) => cols[5] + '=' + cols[6]);
    return pairs.join('; ');
  }
  return COOKIE_RAW.replace(/\s+/g, ' ');
}

function cookieValue(name) {
  const header = cookieHeader();
  if (!header) return '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : '';
}

// Header Authorization yang dipakai YouTube untuk sesi cookie (sama seperti yt-dlp).
function sapisidAuthHeader() {
  const sapisid = cookieValue('SAPISID') || cookieValue('__Secure-3PAPISID');
  if (!sapisid) return '';
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(ts + ' ' + sapisid + ' ' + YT_ORIGIN).digest('hex');
  return 'SAPISIDHASH ' + ts + '_' + hash;
}

function authHeaders() {
  const cookie = cookieHeader();
  if (!cookie) return {};
  const headers = { cookie, 'x-goog-authuser': '0' };
  const auth = sapisidAuthHeader();
  if (auth) headers.authorization = auth;
  return headers;
}

function hasCookies() {
  return !!cookieHeader();
}

function isValidVideoId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

function videoIdFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isValidVideoId(raw)) return raw;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return '';
}

async function getVisitorData({ force = false } = {}) {
  if (!force && visitorCache.value && Date.now() - visitorCache.at < VISITOR_TTL) return visitorCache.value;
  if (homeRequest) return homeRequest;

  homeRequest = (async () => {
    try {
      const response = await httpRequest(HOME_URL, {
        headers: Object.assign({
          'user-agent': DESKTOP_UA,
          'accept': 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9'
        }, authHeaders()),
        timeout: 12000
      });
      const html = await readBody(response, 3 * 1024 * 1024);
      const match = html.match(/"visitorData":"([^"]+)"/) || html.match(/"VISITOR_DATA":"([^"]+)"/);
      if (!match) throw new AudioSourceError('VISITOR_UNAVAILABLE');
      const value = match[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      visitorCache = { value, at: Date.now() };
      return value;
    } finally {
      homeRequest = null;
    }
  })();

  return homeRequest;
}

function playabilityError(status) {
  const reason = String((status && status.reason) || '');
  const code = String((status && status.status) || '');
  if (code === 'OK') return null;
  if (/age/i.test(reason) || code === 'AGE_VERIFICATION_REQUIRED' || code === 'AGE_CHECK_REQUIRED') {
    return new AudioSourceError('AGE_RESTRICTED', 'Lagu ini dibatasi usia dan tidak bisa diputar.');
  }
  if (/bot|sign in|login/i.test(reason) || code === 'LOGIN_REQUIRED') {
    return new AudioSourceError('PROVIDER_LIMITED', hasCookies()
      ? 'YouTube tetap menolak permintaan walau YOUTUBE_COOKIES disetel. Perbarui cookie-nya.'
      : 'YouTube memblokir IP server ini. Setel YOUTUBE_COOKIES atau AUDIO_EXTRACTOR_URL.');
  }
  if (code === 'LIVE_STREAM_OFFLINE' || /live/i.test(reason)) {
    return new AudioSourceError('LIVE_UNAVAILABLE', 'Siaran langsung ini tidak tersedia untuk diputar.');
  }
  if (/private/i.test(reason)) {
    return new AudioSourceError('PRIVATE_VIDEO', 'Video ini bersifat privat.');
  }
  return new AudioSourceError('UNPLAYABLE', reason || 'Lagu ini tidak dapat diputar.');
}

function pickAudioFormat(formats) {
  const audio = (formats || []).filter((format) => /^audio\//.test(String(format && format.mimeType)) && format.url);
  if (!audio.length) return null;
  for (const itag of AUDIO_PREFERENCE) {
    const match = audio.find((format) => Number(format.itag) === itag);
    if (match) return match;
  }
  return audio[0];
}

function expiryFromUrl(url) {
  try {
    const expire = Number(new URL(url).searchParams.get('expire'));
    if (Number.isFinite(expire) && expire > 0) return expire * 1000;
  } catch (e) {}
  return Date.now() + URL_TTL_FALLBACK;
}

async function requestPlayer(videoId, client, visitorData, { signal } = {}) {
  const context = {
    client: Object.assign({}, client.context, visitorData ? { visitorData } : {}),
    user: { lockedSafetyMode: false },
    request: { useSsl: true }
  };
  const payload = JSON.stringify({ context, videoId, contentCheckOk: true, racyCheckOk: true });
  const headers = Object.assign({
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    'user-agent': client.ua,
    'x-youtube-client-name': client.id,
    'x-youtube-client-version': client.context.clientVersion,
    'origin': YT_ORIGIN,
    'accept': 'application/json'
  }, authHeaders());
  if (visitorData) headers['x-goog-visitor-id'] = visitorData;

  const response = await httpRequest(PLAYER_URL, { method: 'POST', headers, body: payload, timeout: 15000, signal });
  const body = await readBody(response, 6 * 1024 * 1024);
  let json;
  try { json = JSON.parse(body); } catch (e) { throw new AudioSourceError('PARSE_ERROR', 'Balasan player tidak dikenali.'); }
  return json;
}

/**
 * URL endpoint /stream milik extractor: browser memutar langsung dari VPS,
 * sehingga URL googlevideo yang terikat IP VPS tidak perlu dibaca Vercel
 * (hemat bandwidth function dan bebas masalah 403).
 * @returns {string} URL absolut, atau '' bila extractor tidak dikonfigurasi.
 */
function externalStreamUrl(videoId) {
  const { url, token, insecure } = extractorConfig();
  if (!url || !isValidVideoId(videoId)) return '';
  let target;
  try { target = new URL(url); } catch (e) { return ''; }
  if (target.protocol !== 'https:' && !(insecure && target.protocol === 'http:')) return '';
  if (!/\/stream\/?$/.test(target.pathname)) target.pathname = target.pathname.replace(/\/?$/, '/') + 'stream';
  target.searchParams.set('v', videoId);
  if (token) target.searchParams.set('token', token);
  return target.href;
}

/**
 * Ambil URL dari layanan ekstraksi eksternal milik sendiri
 * (AUDIO_EXTRACTOR_URL, mis. yt-dlp di VPS). Kontrak: GET ?v=<id> → JSON
 * dengan salah satu bentuk: {url} | {audio} | {link} | {result:{download:{audio}}}.
 */
async function fromExternalExtractor(videoId, { signal } = {}) {
  const { url: extractorUrl, token, insecure } = extractorConfig();
  if (!extractorUrl) return null;
  let target;
  try {
    target = new URL(extractorUrl);
  } catch (e) {
    throw new AudioSourceError('EXTRACTOR_CONFIG', 'AUDIO_EXTRACTOR_URL tidak valid.');
  }
  if (target.protocol !== 'https:' && !(insecure && target.protocol === 'http:')) {
    throw new AudioSourceError('EXTRACTOR_CONFIG', 'AUDIO_EXTRACTOR_URL harus https (atau set AUDIO_EXTRACTOR_INSECURE=1 untuk lokal).');
  }
  target.searchParams.set('v', videoId);
  target.searchParams.set('id', videoId);
  if (token) target.searchParams.set('token', token);

  const response = await httpRequest(target.href, {
    headers: { 'user-agent': 'MusifyRik/3.5 (+extractor)', 'accept': 'application/json' },
    timeout: 20000,
    signal
  });
  if (response.status !== 200) {
    response.stream.resume();
    throw new AudioSourceError('EXTRACTOR_UNAVAILABLE', 'Layanan ekstraksi eksternal menolak permintaan (HTTP ' + response.status + ').');
  }
  const body = await readBody(response, 256 * 1024);
  let data;
  try { data = JSON.parse(body); } catch (e) {
    throw new AudioSourceError('EXTRACTOR_BAD_JSON', 'Balasan layanan ekstraksi eksternal tidak dikenali.');
  }
  const candidate =
    (typeof data === 'string' && data) ||
    data.url || data.audio || data.link ||
    (data.result && data.result.url) ||
    (data.result && data.result.download && data.result.download.audio) ||
    (data.data && data.data.url) || '';
  let parsed;
  try { parsed = new URL(String(candidate)); } catch (e) { parsed = null; }
  if (!parsed || parsed.protocol !== 'https:') {
    throw new AudioSourceError('EXTRACTOR_NO_URL', 'Layanan ekstraksi eksternal tidak memberi URL audio.');
  }
  return {
    videoId,
    url: parsed.href,
    mime: parsed.href.includes('.webm') ? 'audio/webm' : 'audio/mp4',
    itag: 0,
    expiresAt: expiryFromUrl(parsed.href),
    durationLabel: data.duration || null,
    contentLength: 0,
    viaExternalExtractor: true
  };
}

/**
 * Ekstrak URL audio langsung (googlevideo) untuk sebuah videoId.
 * @returns {Promise<{videoId:string,url:string,mime:string,itag:number,expiresAt:number,durationLabel:string,contentLength:number}>}
 */
async function extract(videoId, { signal, force = false } = {}) {
  if (!isValidVideoId(videoId)) throw new AudioSourceError('BAD_VIDEO_ID', 'ID lagu tidak valid.');
  if (!force) {
    const cached = urlCache.get(videoId);
    if (cached && cached.expiresAt - 120000 > Date.now()) return cached;
  }

  let externalError = null;
  if (extractorConfig().url) {
    try {
      const external = await fromExternalExtractor(videoId, { signal });
      if (external) {
        urlCache.set(videoId, external);
        return external;
      }
    } catch (error) {
      if (error && error.code === 'ABORTED') throw error;
      externalError = error;
    }
  }

  let visitorData = '';
  try { visitorData = await getVisitorData({ force }); } catch (e) { visitorData = ''; }

  let lastError = null;
  let refreshedVisitor = false;

  for (const client of CLIENTS) {
    try {
      let json = await requestPlayer(videoId, client, visitorData, { signal });
      let status = json && json.playabilityStatus;

      // YouTube kadang menolak visitorData lama; ambil ulang sekali.
      if (status && status.status === 'LOGIN_REQUIRED' && !refreshedVisitor) {
        refreshedVisitor = true;
        try {
          visitorData = await getVisitorData({ force: true });
          json = await requestPlayer(videoId, client, visitorData, { signal });
          status = json && json.playabilityStatus;
        } catch (e) {}
      }

      const failure = playabilityError(status);
      if (failure) { lastError = failure; continue; }

      const streaming = json.streamingData || {};
      const formats = [].concat(streaming.formats || [], streaming.adaptiveFormats || []);
      const format = pickAudioFormat(formats);
      if (!format) {
        lastError = new AudioSourceError('NO_AUDIO_FORMAT', 'Format audio tidak tersedia untuk lagu ini.');
        continue;
      }

      const result = {
        videoId,
        url: format.url,
        mime: String(format.mimeType || 'audio/mp4').split(';')[0].trim(),
        itag: Number(format.itag) || 0,
        expiresAt: expiryFromUrl(format.url),
        durationLabel: secondsToLabel(Number(json.videoDetails && json.videoDetails.lengthSeconds)),
        contentLength: Number(format.contentLength) || 0
      };
      urlCache.set(videoId, result);
      if (urlCache.size > 200) urlCache.delete(urlCache.keys().next().value);
      return result;
    } catch (error) {
      if (error && error.code === 'ABORTED') throw error;
      lastError = error instanceof AudioSourceError ? error : new AudioSourceError('UPSTREAM_ERROR', error.message);
    }
  }

  if (externalError) throw externalError;
  throw lastError || new AudioSourceError('UNPLAYABLE', 'Lagu ini tidak dapat diputar.');
}

function secondsToLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return minutes + '.' + String(rest).padStart(2, '0');
}

/**
 * HEAD ke sumber audio: dipakai untuk memastikan URL masih hidup dan
 * mengetahui panjang berkas sebelum streaming dimulai.
 */
async function head(sourceUrl, { signal } = {}) {
  const response = await httpRequest(sourceUrl, {
    method: 'HEAD',
    headers: { 'user-agent': VISIONOS_UA, 'accept': '*/*' },
    timeout: 15000,
    signal
  });
  const status = response.status;
  response.stream.resume();
  if (status === 403 || status === 401 || status === 410) {
    throw new AudioSourceError('SOURCE_FORBIDDEN', 'Sumber audio kedaluwarsa.');
  }
  if (status !== 200 && status !== 206) {
    throw new AudioSourceError('SOURCE_UNAVAILABLE', 'Sumber audio tidak merespons.');
  }
  const type = String(response.headers['content-type'] || '');
  if (!/^(audio\/|video\/|application\/octet-stream)/.test(type)) {
    throw new AudioSourceError('SOURCE_NOT_AUDIO', 'Sumber bukan berkas audio.');
  }
  return {
    status,
    type,
    total: Number(response.headers['content-length']) || 0,
    acceptRanges: String(response.headers['accept-ranges'] || '').toLowerCase() === 'bytes'
  };
}

/**
 * Buka potongan audio (byte range) dari googlevideo.
 * Catatan penting: permintaan tanpa Range ke googlevideo di-throttle
 * (~30 KB/s), sedangkan permintaan Range berjalan penuh (~20 MB/s).
 * Karena itu relay selalu memakai Range per potongan.
 */
async function openRange(sourceUrl, { start = 0, end = null, method = 'GET', signal } = {}) {
  const headers = {
    'user-agent': VISIONOS_UA,
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9'
  };
  if (Number.isFinite(start)) headers.range = 'bytes=' + start + '-' + (Number.isFinite(end) ? end : '');

  const response = await httpRequest(sourceUrl, { method, headers, timeout: 20000, signal });
  const status = response.status;
  if (status === 403 || status === 401 || status === 410) {
    response.stream.resume();
    throw new AudioSourceError('SOURCE_FORBIDDEN', 'Sumber audio kedaluwarsa.');
  }
  if (status === 416) {
    response.stream.resume();
    return { status: 416, headers: {
      'content-type': 'text/plain; charset=utf-8',
      'accept-ranges': 'bytes',
      'content-range': response.headers['content-range'] || 'bytes */*'
    }, stream: null, total: 0 };
  }
  if (![200, 206].includes(status)) {
    response.stream.resume();
    throw new AudioSourceError('SOURCE_UNAVAILABLE', 'Sumber audio tidak merespons.');
  }

  const type = String(response.headers['content-type'] || '');
  if (!/^(audio\/|video\/|application\/octet-stream)/.test(type)) {
    response.stream.resume();
    throw new AudioSourceError('SOURCE_NOT_AUDIO', 'Sumber bukan berkas audio.');
  }

  const contentRange = String(response.headers['content-range'] || '');
  let total = Number(response.headers['content-length']) || 0;
  const rangeMatch = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/);
  if (rangeMatch) total = Number(rangeMatch[3]) || total;

  const out = {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff'
  };
  if (response.headers['content-range']) out['content-range'] = response.headers['content-range'];
  if (method === 'HEAD') { response.stream.resume(); return { status, headers: out, stream: null, total }; }
  return { status, headers: out, stream: response.stream, total };
}

/** Bungkus openRange agar tetap kompatibel dengan pemakaian lama. */
async function openStream(sourceUrl, options = {}) {
  const range = String(options.range || '');
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  const start = match && match[1] ? Number(match[1]) : 0;
  const end = match && match[2] ? Number(match[2]) : null;
  return openRange(sourceUrl, { start, end: Number.isFinite(end) ? end : null, method: options.method, signal: options.signal });
}

module.exports = {
  extract,
  head,
  openRange,
  openStream,
  isValidVideoId,
  videoIdFromInput,
  AudioSourceError,
  MAX_RELAY_BYTES,
  hasCookies,
  hasExternalExtractor: () => !!extractorConfig().url,
  externalStreamUrl,
  _cache: urlCache
};
