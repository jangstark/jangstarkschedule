// 카카오 로컬(주소/키워드 → 좌표) 프록시
import { json, passthrough, requireAccess } from '../lib/common.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const denied = requireAccess(req);
  if (denied) return denied;

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

  const params = new URL(req.url).searchParams;
  const kind = params.get('kind');
  const query = (params.get('query') || '').trim();
  if (!['address', 'keyword'].includes(kind) || !query || query.length > 200) {
    return json({ error: 'BAD_REQUEST' }, 400);
  }

  try {
    const r = await fetch(
      `https://dapi.kakao.com/v2/local/search/${kind}.json?size=1&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    );
    if (r.status === 401 || r.status === 403) return json({ error: 'UPSTREAM_AUTH' }, 424);
    return await passthrough(r);
  } catch (e) {
    return json({ error: 'UPSTREAM_ERROR' }, 502);
  }
};

export const config = { path: '/api/kakao-local' };
