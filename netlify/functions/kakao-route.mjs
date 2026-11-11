// 카카오모빌리티 길찾기(소요시간/거리) 프록시
import { json, passthrough, requireAccess } from '../lib/common.mjs';

const COORD = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;   // "경도,위도"

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const denied = requireAccess(req);
  if (denied) return denied;

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

  const params = new URL(req.url).searchParams;
  const origin = params.get('origin') || '';
  const destination = params.get('destination') || '';
  if (!COORD.test(origin) || !COORD.test(destination)) return json({ error: 'BAD_REQUEST' }, 400);

  try {
    const r = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    );
    if (r.status === 401 || r.status === 403) return json({ error: 'UPSTREAM_AUTH' }, 424);
    return await passthrough(r);
  } catch (e) {
    return json({ error: 'UPSTREAM_ERROR' }, 502);
  }
};

export const config = { path: '/api/kakao-route' };
