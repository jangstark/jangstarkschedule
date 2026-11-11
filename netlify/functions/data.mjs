// JSONBin 프록시: GET(불러오기) / PUT(저장)
import { json, passthrough, requireAccess } from '../lib/common.mjs';

const MAX_BODY = 500 * 1024;   // 500KB

export default async (req) => {
  const denied = requireAccess(req);
  if (denied) return denied;

  const binId = process.env.JSONBIN_BIN_ID;
  const accessKey = process.env.JSONBIN_ACCESS_KEY;     // 권장: 이 빈만 읽기/수정 가능한 Access Key
  const masterKey = process.env.JSONBIN_MASTER_KEY;     // 대안: Master Key
  if (!binId || (!accessKey && !masterKey)) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

  const auth = accessKey ? { 'X-Access-Key': accessKey } : { 'X-Master-Key': masterKey };
  const base = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}`;

  try {
    if (req.method === 'GET') {
      return await passthrough(await fetch(`${base}/latest`, { headers: auth }));
    }
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: 'TOO_LARGE' }, 413);
      let parsed;
      try { parsed = JSON.parse(text); } catch { return json({ error: 'BAD_JSON' }, 400); }
      if (!Array.isArray(parsed)) return json({ error: 'BAD_REQUEST' }, 400);   // 앱 데이터는 항상 배열
      return await passthrough(await fetch(base, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: text
      }));
    }
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  } catch (e) {
    return json({ error: 'UPSTREAM_ERROR' }, 502);
  }
};

export const config = { path: '/api/data' };
