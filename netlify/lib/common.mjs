import { createHash, timingSafeEqual } from 'node:crypto';

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// 프록시 응답: 상태코드와 본문을 그대로 전달 (캐시 금지)
export async function passthrough(upstream) {
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

const sha = s => createHash('sha256').update(String(s)).digest();

// 접속 코드 확인. 서버에 APP_ACCESS_CODE가 없으면 "닫힌 상태"(fail closed)로 동작
// 통과하면 null, 막히면 Response를 반환
export function requireAccess(req) {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);
  const given = req.headers.get('x-app-code') || '';
  if (!timingSafeEqual(sha(given), sha(expected))) return json({ error: 'ACCESS_DENIED' }, 401);
  return null;
}
