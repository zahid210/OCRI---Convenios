// Prueba E2E del flujo completo OCRI contra el servidor de desarrollo.
// Uso: node scripts/e2e-flow.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?"([^"]*)"?"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}
const ENV = loadEnv();
const EMAIL = ENV.SEED_ADMIN_EMAIL ?? 'ocri@uncp.edu.pe';
const PASSWORD = ENV.SEED_ADMIN_PASSWORD;

const results = [];
let token = null;

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function api(method, path, { form, json, expect } = {}) {
  const t0 = Date.now();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body });
  } catch (e) {
    return { status: 0, json: null, ms: Date.now() - t0, error: String(e) };
  }
  const ms = Date.now() - t0;
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text.slice(0, 200);
  }
  if (ms > 1500) {
    console.log(`SLOW  ${method} ${path} -> ${ms} ms`);
  }
  if (expect && res.status !== expect) {
    console.log(
      `  [${method} ${path}] esperado ${expect}, recibido ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return { status: res.status, json: data, ms };
}

function pdfBlob(name) {
  const bytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3,
    0xcf, 0xd3, 0x0a,
  ]);
  return new File([bytes], name, { type: 'application/pdf' });
}

async function main() {
  console.log(`=== E2E OCRI contra ${BASE} ===`);

  // 0. Login
  const login = await api('POST', '/auth/login', {
    json: { email: EMAIL, password: PASSWORD },
    expect: 200,
  });
  check('login admin', login.status === 200 && login.json?.access_token);
  token = login.json?.access_token;
  if (!token) return finish();

  // 1. Institución + tipo de convenio
  let inst = await api('POST', '/institutions', {
    json: { name: `Entidad E2E ${Date.now()}`, country: 'Perú', type: 'UNIVERSIDAD' },
  });
  if (inst.status !== 201 && inst.status !== 200) {
    const list = await api('GET', '/institutions?per_page=100');
    inst = { json: list.json?.data?.[0] ?? list.json?.[0] };
  }
  const institutionId = inst.json?.id ?? inst.json?.data?.id;
  check('institución disponible', !!institutionId, JSON.stringify(inst.json).slice(0, 120));

  const lookups = await api('GET', '/agreements/lookups/types');
  const typeId =
    lookups.json?.find?.((t) => t.name === 'Convenio Específico')?.id ??
    lookups.json?.data?.find?.((t) => t.name === 'Convenio Específico')?.id ??
    lookups.json?.[0]?.id;
  check('tipo de convenio disponible', !!typeId);

  // 2. Validación: crear sin archivos debe fallar con 400
  const noFiles = await api('POST', '/agreements', {
    json: { title: 'X', institution_id: institutionId, agreement_type_id: typeId },
    expect: 400,
  });
  check('crear sin archivos rechazado (400)', noFiles.status === 400);

  // 3. Crear trámite A (flujo feliz completo)
  let f1 = new FormData();
  f1.append('title', 'Convenio Marco UNCP - Entidad E2E');
  f1.append('name', 'Convenio de Cooperación Interinstitucional');
  f1.append('institution_id', String(institutionId));
  f1.append('agreement_type_id', String(typeId));
  f1.append('applicant_unit', 'Facultad de Ingeniería');
  f1.append('rectorate_oficio_number', `OF-R-${Date.now()}`);
  f1.append('oficio_solicitud', pdfBlob('oficio.pdf'));
  f1.append('propuesta', pdfBlob('propuesta.pdf'));
  const created = await api('POST', '/agreements', { form: f1, expect: 201 });
  const agrA = created.json?.id ?? created.json?.agreement?.id;
  check('crear trámite A (201 RECEPCIONADA)', created.status === 201 && !!agrA, `id=${agrA} status=${created.json?.process_status}`);

  // 4. Transición inválida temprana
  const early = await api('POST', `/process/${agrA}/finalize-expediente`, { expect: 400 });
  check('finalize-expediente prematuro rechazado (400)', early.status === 400);

  // 5. Dependencias y solicitudes de opinión
  const deps = await api('GET', '/dependencias');
  const depList = deps.json?.data ?? deps.json ?? [];
  const targets = depList.filter((d) => d.is_default_opinion).slice(0, 2);
  check('dependencias con opinión por defecto >=2', targets.length === 2, `${targets.length}`);

  const gen1 = await api('POST', `/process/${agrA}/opinion-requests`, {
    json: {
      dependencia_ids: targets.map((d) => d.id),
      oficio_number: `OF-MULT-001-${Date.now()}`,
      directed_to: 'Jefatura',
    },
    expect: 201,
  });
  check(
    'generar solicitudes de opinión (OPINIONES_EN_CURSO)',
    gen1.status === 201 || gen1.status === 200,
    JSON.stringify(gen1.json).slice(0, 150),
  );

  const dup = await api('POST', `/process/${agrA}/opinion-requests`, {
    json: { dependencia_ids: [targets[0].id] },
    expect: 400,
  });
  check('solicitud duplicada rechazada (400)', dup.status === 400);

  const statusAfterGen = await api('GET', `/process/${agrA}/status`);
  const reqIds = (statusAfterGen.json?.opinion_requests ?? []).map((r) => r.id);
  check('status expone 2 solicitudes', reqIds.length === 2, `${reqIds.length}`);

  // 6. Enviar ambas
  for (const rid of reqIds) {
    const s = await api('POST', `/process/opinion-requests/${rid}/send`, {
      json: { sent_via: 'EMAIL', adesa_number: `AD-${rid}` },
    });
    check(`enviar solicitud #${rid}`, s.status < 300);
  }

  // 7. Responder la última primero (la transición a OPINIONES_COMPLETAS solo al final)
  const respond = async (rid, fname) => {
    const f = new FormData();
    f.append('response_date', new Date().toISOString().slice(0, 10));
    f.append('observations', 'Sin observaciones relevantes.');
    f.append('file', pdfBlob(fname));
    return api('POST', `/process/opinion-requests/${rid}/respond`, { form: f });
  };
  const rLast = await respond(reqIds[1], 'opinion-b.pdf');
  check('registrar respuesta solicitud B', rLast.status < 300);
  const stMid = await api('GET', `/process/${agrA}/status`);
  check('aún OPINIONES_EN_CURSO tras 1 respuesta', stMid.json?.agreement?.process_status === 'OPINIONES_EN_CURSO', stMid.json?.agreement?.process_status);

  const rFirst = await respond(reqIds[0], 'opinion-a.pdf');
  check('registrar respuesta solicitud A', rFirst.status < 300);
  const stDone = await api('GET', `/process/${agrA}/status`);
  check('auto-transición a OPINIONES_COMPLETAS', stDone.json?.agreement?.process_status === 'OPINIONES_COMPLETAS', stDone.json?.agreement?.process_status);

  // 8. Validar opiniones (una observada y luego revalidada)
  const vBad = await api('POST', `/process/opinion-requests/${reqIds[0]}/validate`, {
    json: { valid: false },
    expect: 400,
  });
  check('observar sin observaciones rechazado (400)', vBad.status === 400);

  await api('POST', `/process/opinion-requests/${reqIds[0]}/validate`, {
    json: { valid: true },
  });
  await api('POST', `/process/opinion-requests/${reqIds[1]}/validate`, {
    json: { valid: false, observations: 'Falta sello de la dependencia.' },
  });
  const vRe = await api('POST', `/process/opinion-requests/${reqIds[1]}/validate`, {
    json: { valid: true },
  });
  check('revalidar opinión observada', vRe.status < 300);

  // 9. Generar expediente técnico (auto-merge de opiniones) y documento OCRI
  const genExp = await api('POST', `/process/${agrA}/generate-expediente`, { expect: 201 });
  check('generate-expediente (merge automático)', genExp.status < 300);

  const fInform = new FormData();
  fInform.append('document_type_code', 'INFORME_TECNICO_OCRI');
  fInform.append('file', pdfBlob('informe_tecnico_ocri.pdf'));
  const upInform = await api('POST', `/process/${agrA}/documents`, { form: fInform });
  check('subir INFORME_TECNICO_OCRI', upInform.status < 300);

  const fOficioResp = new FormData();
  fOficioResp.append('document_type_code', 'OFICIO_RESPUESTA_RECTORADO');
  fOficioResp.append('file', pdfBlob('oficio_respuesta_rectorado.pdf'));
  const upOficioResp = await api('POST', `/process/${agrA}/documents`, { form: fOficioResp });
  check('subir OFICIO_RESPUESTA_RECTORADO', upOficioResp.status < 300);

  const fin = await api('POST', `/process/${agrA}/finalize-expediente`, { expect: 201 });
  const stFin = await api('GET', `/process/${agrA}/status`);
  check(
    'finalize-expediente -> EXPEDIENTE_TECNICO_LISTO',
    fin.status < 300 && stFin.json?.agreement?.process_status === 'EXPEDIENTE_TECNICO_LISTO',
    stFin.json?.agreement?.process_status,
  );

  const sendRec = await api('POST', `/process/${agrA}/send-to-rectorado`);
  const stRec = await api('GET', `/process/${agrA}/status`);
  check(
    'envío a Rectorado -> ENVIADO_A_RECTORADO',
    sendRec.status < 300 && stRec.json?.agreement?.process_status === 'ENVIADO_A_RECTORADO',
    stRec.json?.agreement?.process_status,
  );

  // 10. Decisión de Rectorado: SUSCRITO
  const dec = async (extra) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return api('POST', `/process/${agrA}/rectorate-decision`, { form: f });
  };
  const decOk = await dec({
    decision: 'APPROVED',
    rectorate_oficio_number: `OF-REC-${Date.now()}`,
    file: pdfBlob('convenio-firmado.pdf'),
  });
  const stSus = await api('GET', `/process/${agrA}/status`);
  check(
    'Rectorado suscribe -> SUSCRITO',
    decOk.status < 300 && stSus.json?.agreement?.process_status === 'SUSCRITO',
    JSON.stringify(decOk.json).slice(0, 160),
  );

  // 11. Publicación y registro
  const pub = await api('POST', `/process/${agrA}/publish`, {
    form: (() => {
      const f = new FormData();
      f.append('file', pdfBlob('publicacion.pdf'));
      return f;
    })(),
  });
  const stPub = await api('GET', `/process/${agrA}/status`);
  check('publicación -> PUBLICADO', pub.status < 300 && stPub.json?.agreement?.process_status === 'PUBLICADO');

  const regNoFile = await api('POST', `/process/${agrA}/register-agreement`, {
    form: (() => {
      const f = new FormData();
      f.append('resolution_number', 'R-0001-E2E');
      f.append('start_date', '2026-08-24');
      f.append('end_date', '2028-08-23');
      f.append('responsables', JSON.stringify([{ name: 'Resp 1' }]));
      return f;
    })(),
    expect: 400,
  });
  check('registro sin convenio escaneado rechazado (400)', regNoFile.status === 400);

  const resolution = `R-E2E-${Date.now()}`;
  let regForm = new FormData();
  regForm.append('resolution_number', resolution);
  regForm.append('start_date', '2026-08-24');
  regForm.append('end_date', '2028-08-23');
  regForm.append('drive_link', 'https://drive.example.com/convenio-e2e');
  regForm.append('responsables', JSON.stringify([
    { name: 'Dra. María Quispe', role: 'Decana', side: 'UNCP', email: 'mq@uncp.edu.pe' },
    { name: 'Ing. Juan Torres', role: 'Director', side: 'CONTRAPARTE' },
  ]));
  regForm.append('file', pdfBlob('convenio-registrado.pdf'));
  const reg = await api('POST', `/process/${agrA}/register-agreement`, { form: regForm });
  const stReg = await api('GET', `/process/${agrA}/status`);
  check(
    'registro -> REGISTRADO/VIGENTE',
    reg.status < 300 &&
      stReg.json?.agreement?.process_status === 'REGISTRADO' &&
      stReg.json?.agreement?.validity_status === 'VIGENTE',
    `http=${reg.status} estado=${stReg.json?.agreement?.process_status}/${stReg.json?.agreement?.validity_status} resp=${JSON.stringify(reg.json).slice(0, 200)}`,
  );
  const detailA = await api('GET', `/agreements/${agrA}`);
  const respCount = detailA.json?.responsables?.length ?? detailA.json?.agreement?.responsables?.length ?? -1;
  check('responsables registrados (2)', respCount === 2, `${respCount} -> ${JSON.stringify(detailA.json).slice(0, 200)}`);

  // 12. E3: seguimiento con ciclo de correcciones
  const wpReq = await api('POST', `/agreements/${agrA}/request-workplan`);
  const stSeg = await api('GET', `/process/${agrA}/status`);
  check(
    'solicitar plan de trabajo -> EN_SEGUIMIENTO',
    wpReq.status < 300 && stSeg.json?.agreement?.process_status === 'EN_SEGUIMIENTO',
    stSeg.json?.agreement?.process_status,
  );

  const wpList = await api('GET', `/agreements/${agrA}/deliverables`);
  const wpDeliverable = (wpList.json?.data ?? wpList.json ?? []).find((d) => d.type === 'PLAN_DE_TRABAJO');
  check('plan de trabajo SOLICITADO visible', wpDeliverable?.status === 'SOLICITADO', wpDeliverable?.status);

  const submitWp = await api('POST', `/agreements/${agrA}/submit-workplan`, {
    form: (() => {
      const f = new FormData();
      f.append('file', pdfBlob('plan-v1.pdf'));
      return f;
    })(),
  });
  check('remisión plan de trabajo v1', submitWp.status < 300, JSON.stringify(submitWp.json).slice(0, 150));

  const obsWp = await api('POST', `/agreements/deliverables/${wpDeliverable.id}/evaluate`, {
    json: { decision: 'OBSERVED', observations: 'Rehacer cronograma con fechas.' },
  });
  check('observación del plan (corrección)', obsWp.status < 300);

  const submitWp2 = await api('POST', `/agreements/${agrA}/submit-workplan`, {
    form: (() => {
      const f = new FormData();
      f.append('file', pdfBlob('plan-v2.pdf'));
      return f;
    })(),
  });
  const wpAfterFix = await api('GET', `/agreements/${agrA}/deliverables`);
  const wpV2 = (wpAfterFix.json?.data ?? wpAfterFix.json ?? []).find((d) => d.type === 'PLAN_DE_TRABAJO');
  check(
    'corrección remitida (v2 RECIBIDO)',
    submitWp2.status < 300 && wpV2?.version === 2 && wpV2?.status === 'RECIBIDO',
    `v=${wpV2?.version} estado=${wpV2?.status}`,
  );

  const apprWp = await api('POST', `/agreements/deliverables/${wpDeliverable.id}/evaluate`, {
    json: { decision: 'APPROVED' },
  });
  check('registro del plan corregido', apprWp.status < 300);

  const flowReport = async (type, period, fname) => {
    const reqRep = await api('POST', `/agreements/${agrA}/request-report`, {
      json: type === 'INFORME_SEMESTRAL' ? { type, period } : { type },
    });
    if (!(reqRep.status < 300)) return { reqRep, del: null };
    const list = await api('GET', `/agreements/${agrA}/deliverables`);
    const del = (list.json?.data ?? list.json ?? []).find(
      (d) => d.type === type && (!period || d.period === period),
    );
    if (!del) return { reqRep, del: null };
    const sub = await api('POST', `/agreements/deliverables/${del.id}/submit`, {
      form: (() => {
        const f = new FormData();
        f.append('file', pdfBlob(fname));
        return f;
      })(),
    });
    const ev = await api('POST', `/agreements/deliverables/${del.id}/evaluate`, {
      json: { decision: 'APPROVED' },
    });
    return { reqRep, sub, ev, del };
  };

  const periods = ['2026-I', '2026-II', '2027-I', '2027-II'];
  let allSemOk = true;
  for (let i = 0; i < periods.length; i++) {
    const s = await flowReport('INFORME_SEMESTRAL', periods[i], `semestral-${periods[i].toLowerCase().replace('-', '')}.pdf`);
    if (s.ev?.status >= 300) allSemOk = false;
  }
  check('todos los semestrales registrados', allSemOk);

  const stMid3 = await api('GET', `/process/${agrA}/status`);
  check('sigue EN_SEGUIMIENTO antes del informe final', stMid3.json?.agreement?.process_status === 'EN_SEGUIMIENTO', stMid3.json?.agreement?.process_status);

  const finRep = await flowReport('INFORME_FINAL', null, 'informe-final.pdf');
  const stEnd = await api('GET', `/process/${agrA}/status`);
  check(
    'informe final concluye seguimiento automáticamente',
    finRep.ev?.status < 300 && stEnd.json?.agreement?.process_status === 'SEGUIMIENTO_CONCLUIDO',
    stEnd.json?.agreement?.process_status,
  );

  // 13. Trámite B: rama NO_SUSCRITO (abreviada)
  let fB = new FormData();
  fB.append('title', 'Convenio NO suscrito E2E');
  fB.append('institution_id', String(institutionId));
  fB.append('agreement_type_id', String(typeId));
  fB.append('rectorate_oficio_number', `OF-R-B-${Date.now()}`);
  fB.append('oficio_solicitud', pdfBlob('b-oficio.pdf'));
  fB.append('propuesta', pdfBlob('b-propuesta.pdf'));
  const createdB = await api('POST', '/agreements', { form: fB });
  const agrB = createdB.json?.id ?? createdB.json?.agreement?.id;
  check('crear trámite B', createdB.status === 201 && !!agrB, `id=${agrB}`);

  const depB = targets.map((d) => d.id);
  await api('POST', `/process/${agrB}/opinion-requests`, { json: { dependencia_ids: [depB[0]] } });
  const stB = await api('GET', `/process/${agrB}/status`);
  const ridB = stB.json?.opinion_requests?.[0]?.id;
  await api('POST', `/process/opinion-requests/${ridB}/send`, { json: { sent_via: 'EMAIL' } });
  await respond(ridB, 'b-opinion.pdf');
  await api('POST', `/process/opinion-requests/${ridB}/validate`, { json: { valid: true } });

  await api('POST', `/process/${agrB}/generate-expediente`);
  const fDocB2 = new FormData();
  fDocB2.append('document_type_code', 'INFORME_TECNICO_OCRI');
  fDocB2.append('file', pdfBlob('b-informe.pdf'));
  await api('POST', `/process/${agrB}/documents`, { form: fDocB2 });

  const fOficioRespB = new FormData();
  fOficioRespB.append('document_type_code', 'OFICIO_RESPUESTA_RECTORADO');
  fOficioRespB.append('file', pdfBlob('b-oficio_respuesta.pdf'));
  await api('POST', `/process/${agrB}/documents`, { form: fOficioRespB });

  await api('POST', `/process/${agrB}/finalize-expediente`);
  await api('POST', `/process/${agrB}/send-to-rectorado`);

  const rejNoMsg = await api('POST', `/process/${agrB}/rectorate-decision`, {
    form: (() => {
      const f = new FormData();
      f.append('decision', 'REJECTED');
      return f;
    })(),
    expect: 400,
  });
  check('rechazo sin notificación rechazado (400)', rejNoMsg.status === 400);

  const rej = await api('POST', `/process/${agrB}/rectorate-decision`, {
    form: (() => {
      const f = new FormData();
      f.append('decision', 'REJECTED');
      f.append('notification_message', 'La entidad no cumplió los requisitos mínimos.');
      f.append('file', pdfBlob('notificacion-rechazo.pdf'));
      return f;
    })(),
  });
  const stBEnd = await api('GET', `/process/${agrB}/status`);
  check(
    'Rectorado rechaza -> NO_SUSCRITO',
    rej.status < 300 && stBEnd.json?.agreement?.process_status === 'NO_SUSCRITO',
    stBEnd.json?.agreement?.process_status,
  );

  // 14. Resolución duplicada en otro registro
  const dupRes = await api('POST', `/process/${agrB}/register-agreement`, {
    form: (() => {
      const f = new FormData();
      f.append('resolution_number', resolution);
      f.append('start_date', '2026-08-24');
      f.append('end_date', '2028-08-23');
      f.append('responsables', JSON.stringify([{ name: 'X' }]));
      f.append('file', pdfBlob('dup.pdf'));
      return f;
    })(),
    expect: 400,
  });
  check(
    'resolución duplicada rechazada (400)',
    dupRes.status === 400 || dupRes.status === 409,
    `estado=${stBEnd.json?.agreement?.process_status} http=${dupRes.status}`,
  );

  // 15. Paneles y descarga protegida
  const seg = await api('GET', '/seguimiento');
  check('panel seguimiento', seg.status === 200);
  const rep = await api('GET', '/reports/summary');
  check('reportes summary', rep.status === 200);
  const notif = await api('GET', '/notifications');
  check('notificaciones', notif.status === 200);
  const exp = await api('GET', '/agreements/expiration-tracking');
  check('expiración tracking', exp.status === 200);

  const detailForFile = await api('GET', `/agreements/${agrA}`);
  const docsA = await api('GET', `/process/${agrA}/documents`);
  const docList = docsA.json ?? [];
  const someFile = Array.isArray(docList)
    ? docList.find((d) => d.file_path)?.file_path
    : docList.data?.find?.((d) => d.file_path)?.file_path;
  if (someFile) {
    const dl = await api('GET', `/resoluciones/${someFile}?token=${encodeURIComponent(token)}`);
    check('descarga protegida con ?token=', dl.status === 200);
  } else {
    check('descarga protegida con ?token=', false, 'sin documentos para descargar');
  }

  // 16. Historial de eventos
  const events = await api('GET', `/process/${agrA}/events`);
  const evCount = Array.isArray(events.json) ? events.json.length : events.json?.data?.length ?? 0;
  check('historial de eventos poblado (>15)', evCount > 15, `${evCount} eventos`);

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n──────── RESUMEN ────────');
  console.log(`Total: ${results.length} · OK: ${results.length - failed.length} · FALLIDOS: ${failed.length}`);
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(2);
});
