// 검사 동선 지도 - 서버 함수 (키는 Netlify 환경 변수에만 보관)
//   /api/ping     접속 암호 확인
//   /api/data     일정 데이터 읽기(GET) / 저장(PUT)   → JSONBin
//   /api/geocode  주소 → 좌표                          → 카카오 로컬
//   /api/route    이동시간·거리                         → 카카오모빌리티
// 모든 요청은 x-app-passcode 헤더의 접속 암호가 맞아야 처리합니다.
import { timingSafeEqual } from 'node:crypto';

const JSONBIN = 'https://api.jsonbin.io/v3/b/';
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Netlify 전역 객체는 핸들러 안에서 호출해야 안전합니다.
const env = (k) => (typeof Netlify !== 'undefined' ? Netlify.env.get(k) : undefined) ?? process.env[k];

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
}
function readPasscode(req) {
  const raw = req.headers.get('x-app-passcode') || '';
  try { return decodeURIComponent(raw); } catch { return ''; }
}
const notConfigured = (names) => json({ error: 'server_not_configured', message: `${names} 환경 변수가 없습니다.` }, 500);

async function handleData(req) {
  const binId = env('JSONBIN_BIN_ID');
  const key = env('JSONBIN_MASTER_KEY');
  if (!binId || !key) return notConfigured('JSONBIN_BIN_ID / JSONBIN_MASTER_KEY');

  if (req.method === 'GET') {
    const r = await fetch(`${JSONBIN}${binId}/latest`, { headers: { 'X-Master-Key': key } });
    if (!r.ok) return json({ error: 'jsonbin_failed', status: r.status }, 502);
    return new Response(await r.text(), { status: 200, headers: HEADERS });
  }

  if (req.method === 'PUT') {
    const text = await req.text();
    if (text.length > 2_000_000) return json({ error: 'too_large' }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
    if (!Array.isArray(data) || data.length > 5000 || data.some((i) => !i || typeof i !== 'object' || Array.isArray(i))) {
      return json({ error: 'bad_payload' }, 400);
    }
    // 메모는 각자 기기에만 보관: 혹시 들어와도 서버에는 저장하지 않음
    const cleaned = data.map(({ memo, ...rest }) => rest);
    const r = await fetch(`${JSONBIN}${binId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify(cleaned),
    });
    if (!r.ok) return json({ error: 'jsonbin_failed', status: r.status }, 502);
    return json({ ok: true });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

async function kakaoGet(url) {
  const key = env('KAKAO_REST_API_KEY');
  if (!key) return notConfigured('KAKAO_REST_API_KEY');
  const r = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
  const text = await r.text();
  if (r.status === 401 || r.status === 403) return json({ error: 'kakao_auth', status: r.status, detail: text.slice(0, 300) }, 502);
  if (!r.ok) return json({ error: 'kakao_failed', status: r.status }, 502);
  return new Response(text, { status: 200, headers: HEADERS });
}

async function handleGeocode(url) {
  const kind = url.searchParams.get('kind');
  const query = (url.searchParams.get('query') || '').trim();
  if (!['address', 'keyword'].includes(kind) || !query || query.length > 200) return json({ error: 'bad_request' }, 400);
  return kakaoGet(`https://dapi.kakao.com/v2/local/search/${kind}.json?size=1&query=${encodeURIComponent(query)}`);
}

async function handleRoute(url) {
  const origin = url.searchParams.get('origin') || '';
  const destination = url.searchParams.get('destination') || '';
  const coord = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
  if (!coord.test(origin) || !coord.test(destination)) return json({ error: 'bad_request' }, 400);
  return kakaoGet(`https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}`);
}

export default async (req) => {
  const pass = env('APP_PASSCODE');
  if (!pass) return notConfigured('APP_PASSCODE');
  if (!safeEqual(readPasscode(req), pass)) {
    await sleep(500); // 무작위 대입 속도 늦추기
    return json({ error: 'unauthorized' }, 401);
  }

  const url = new URL(req.url);
  try {
    switch (url.pathname) {
      case '/api/ping': return json({ ok: true });
      case '/api/data': return await handleData(req);
      case '/api/geocode': return await handleGeocode(url);
      case '/api/route': return await handleRoute(url);
      default: return json({ error: 'not_found' }, 404);
    }
  } catch (err) {
    return json({ error: 'upstream_failed', message: String((err && err.message) || err) }, 502);
  }
};

export const config = { path: ['/api/ping', '/api/data', '/api/geocode', '/api/route'] };
