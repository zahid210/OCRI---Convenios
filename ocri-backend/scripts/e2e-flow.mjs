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

function docxBlob(name) {
  // Minimal DOCX: ZIP with content_types.xml, _rels/.rels, word/document.xml
  // We create a small ZIP manually using deflate-compatible bytes.
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Test</w:t></w:r></w:p></w:body></w:document>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

  // Build minimal ZIP with STORED (not deflated) entries for simplicity
  const encoder = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rels) },
    { name: 'word/document.xml', data: encoder.encode(docXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(docRels) },
  ];

  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const localHeader = new Uint8Array(30 + nameBytes.length + file.data.length);
    // Local file header signature
    new DataView(localHeader.buffer).setUint32(0, 0x04034b50, true);
    new DataView(localHeader.buffer).setUint16(4, 20, true); // version needed
    localHeader.set(nameBytes, 30);
    localHeader.set(file.data, 30 + nameBytes.length);
    // CRC32 placeholder (0) + compressed size = uncompressed size (STORED)
    new DataView(localHeader.buffer).setUint32(14, crc32(file.data), true);
    new DataView(localHeader.buffer).setUint32(18, file.data.length, true);
    new DataView(localHeader.buffer).setUint32(22, file.data.length, true);
    new DataView(localHeader.buffer).setUint16(26, nameBytes.length, true);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    new DataView(cdEntry.buffer).setUint32(0, 0x02014b50, true);
    new DataView(cdEntry.buffer).setUint16(4, 20, true);
    cdEntry.set(nameBytes, 46);
    new DataView(cdEntry.buffer).setUint32(16, crc32(file.data), true);
    new DataView(cdEntry.buffer).setUint32(20, file.data.length, true);
    new DataView(cdEntry.buffer).setUint32(24, file.data.length, true);
    new DataView(cdEntry.buffer).setUint16(28, nameBytes.length, true);
    new DataView(cdEntry.buffer).setUint32(42, offset, true);

    parts.push(localHeader);
    centralDir.push(cdEntry);
    offset += localHeader.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) { cdSize += cd.length; parts.push(cd); }

  const endRecord = new Uint8Array(22);
  new DataView(endRecord.buffer).setUint32(0, 0x06054b50, true);
  new DataView(endRecord.buffer).setUint16(8, files.length, true);
  new DataView(endRecord.buffer).setUint16(10, files.length, true);
  new DataView(endRecord.buffer).setUint32(12, cdSize, true);
  new DataView(endRecord.buffer).setUint32(16, cdOffset, true);
  parts.push(endRecord);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const zip = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { zip.set(p, pos); pos += p.length; }

  return new File([zip], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function crc32(data) {
  let table = crc32._table;
  if (!table) {
    table = crc32._table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
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

  // 2. Validación DTO: crear sin título debe fallar con 400
  //    (los adjuntos dictamen/documentos_origen son opcionales en la API actual)
  const noTitle = await api('POST', '/agreements', {
    json: { institution_id: institutionId, agreement_type_id: typeId },
    expect: 400,
  });
  check('crear sin título rechazado (400)', noTitle.status === 400);

  // 3. Crear trámite A (flujo feliz completo)
  let f1 = new FormData();
  f1.append('title', 'Convenio Marco UNCP - Entidad E2E');
  f1.append('name', 'Convenio de Cooperación Interinstitucional');
  f1.append('institution_id', String(institutionId));
  f1.append('agreement_type_id', String(typeId));
  f1.append('applicant_unit', 'Facultad de Ingeniería');
  f1.append('rectorate_oficio_number', `OF-R-${Date.now()}`);
  f1.append('dictamen', pdfBlob('dictamen.pdf'));
  f1.append('documentos_origen', pdfBlob('origen-1.pdf'));
  f1.append('documentos_origen', pdfBlob('origen-2.pdf'));
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

  // 6. Enviar ambas solicitando el oficio: el humano abre el editor de oficio
  //    (plantilla -> genera PDF y adjunta automáticamente). Es el flujo real de la UI.
  for (const rid of reqIds) {
    const tmpl = await api('GET', `/process/opinion-requests/${rid}/oficio/template`);
    check(`plantilla oficio #${rid}`, tmpl.status === 200 && !!tmpl.json?.html, `status=${tmpl.status}`);
    const s = await api('POST', `/process/opinion-requests/${rid}/oficio/generate`, {
      json: {
        bodyHtml: tmpl.json?.html ?? '<div class="doc-number"></div>',
        oficio_number: `OF-${rid}`,
        sent_via: 'ADESA',
        adesa_number: `AD-${rid}`,
      },
    });
    check(`generar oficio y enviar #${rid}`, s.status < 300, JSON.stringify(s.json).slice(0, 120));
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

  // La auto-transición a OPINIONES_COMPLETAS ocurre al validar la última
  // opinión (no al responderla), porque el expediente recién se habilita
  // cuando todas quedan VALIDADA o CANCELADA.
  const stDone = await api('GET', `/process/${agrA}/status`);
  check('auto-transición a OPINIONES_COMPLETAS', stDone.json?.agreement?.process_status === 'OPINIONES_COMPLETAS', stDone.json?.agreement?.process_status);

  // 9. Generar expediente técnico (auto-merge de opiniones) y documentos para Rectorado
  const genExp = await api('POST', `/process/${agrA}/generate-expediente`, { expect: 201 });
  check('generate-expediente (merge automático)', genExp.status < 300);

  const fOficioResp = new FormData();
  fOficioResp.append('document_type_code', 'OFICIO_RESPUESTA_RECTORADO');
  fOficioResp.append('file', pdfBlob('oficio_respuesta_rectorado.pdf'));
  const upOficioResp = await api('POST', `/process/${agrA}/documents`, { form: fOficioResp });
  check('subir OFICIO_RESPUESTA_RECTORADO', upOficioResp.status < 300);

  const fPropuestaFirma = new FormData();
  fPropuestaFirma.append('document_type_code', 'PROPUESTA_CONVENIO_FIRMA');
  fPropuestaFirma.append('file', docxBlob('propuesta-convenio-firma.docx'));
  const upPropuestaFirma = await api('POST', `/process/${agrA}/documents`, { form: fPropuestaFirma });
  check('subir PROPUESTA_CONVENIO_FIRMA (.docx)', upPropuestaFirma.status < 300);

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

  // Coherencia de bandejas por ciclo de vida: un convenio ENVIADO_A_RECTORADO
  // pertenece a la Etapa 2 (Registro), no a la Etapa 1 (Propuestas).
  const scopeReg = await api('GET', '/agreements?scope=en_registro&per_page=100');
  const scopeTra = await api('GET', '/agreements?scope=tramite&per_page=100');
  const regIds = (scopeReg.json?.data ?? []).map((a) => a.id);
  const traIds = (scopeTra.json?.data ?? []).map((a) => a.id);
  check(
    'ENVIADO_A_RECTORADO se lista en Bandeja de Registro (Etapa 2)',
    regIds.includes(agrA),
  );
  check(
    'ENVIADO_A_RECTORADO NO se lista en Bandeja de Propuestas (Etapa 1)',
    !traIds.includes(agrA),
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

  // 11. Registro institucional (SUSCRITO -> REGISTRADO) y publicación (-> PUBLICADO)
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

  // 11.2 Publicación (REGISTRADO -> PUBLICADO) y después E3
  const pub = await api('POST', `/process/${agrA}/publish`, {
    form: (() => {
      const f = new FormData();
      f.append('file', pdfBlob('publicacion.pdf'));
      return f;
    })(),
  });
  const stPub = await api('GET', `/process/${agrA}/status`);
  check('publicación -> PUBLICADO', pub.status < 300 && stPub.json?.agreement?.process_status === 'PUBLICADO', stPub.json?.agreement?.process_status);

  // 12. E3: seguimiento con ciclo de correcciones
  // "Iniciar Seguimiento" = request-workplan: PUBLICADO (fin E2) -> EN_SEGUIMIENTO
  const wpReq = await api('POST', `/agreements/${agrA}/request-workplan`);
  const stSeg = await api('GET', `/process/${agrA}/status`);
  console.log('DBG wpReq', wpReq.status, JSON.stringify(wpReq.json ?? wpReq.error).slice(0, 200));
  check(
    'solicitar plan de trabajo inicia E3 (PUBLICADO -> EN_SEGUIMIENTO)',
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
  const stAfterPlan = await api('GET', `/process/${agrA}/status`);
  check(
    'plan aprobado (ya EN_SEGUIMIENTO desde el inicio)',
    apprWp.status < 300 && stAfterPlan.json?.agreement?.process_status === 'EN_SEGUIMIENTO',
    stAfterPlan.json?.agreement?.process_status,
  );

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
  fB.append('dictamen', pdfBlob('b-dictamen.pdf'));
  fB.append('documentos_origen', pdfBlob('b-origen.pdf'));
  const createdB = await api('POST', '/agreements', { form: fB });
  const agrB = createdB.json?.id ?? createdB.json?.agreement?.id;
  check('crear trámite B', createdB.status === 201 && !!agrB, `id=${agrB}`);

  const depB = targets.map((d) => d.id);
  await api('POST', `/process/${agrB}/opinion-requests`, { json: { dependencia_ids: [depB[0]] } });
  const stB = await api('GET', `/process/${agrB}/status`);
  const ridB = stB.json?.opinion_requests?.[0]?.id;
  const tmplB = await api('GET', `/process/opinion-requests/${ridB}/oficio/template`);
  await api('POST', `/process/opinion-requests/${ridB}/oficio/generate`, {
    json: {
      bodyHtml: tmplB.json?.html ?? '<div class="doc-number"></div>',
      oficio_number: `OF-B-${ridB}`,
      sent_via: 'EMAIL',
    },
  });
  await respond(ridB, 'b-opinion.pdf');
  await api('POST', `/process/opinion-requests/${ridB}/validate`, { json: { valid: true } });

  await api('POST', `/process/${agrB}/generate-expediente`);

  const fOficioRespB = new FormData();
  fOficioRespB.append('document_type_code', 'OFICIO_RESPUESTA_RECTORADO');
  fOficioRespB.append('file', pdfBlob('b-oficio_respuesta.pdf'));
  await api('POST', `/process/${agrB}/documents`, { form: fOficioRespB });

  const fPropuestaFirmaB = new FormData();
  fPropuestaFirmaB.append('document_type_code', 'PROPUESTA_CONVENIO_FIRMA');
  fPropuestaFirmaB.append('file', docxBlob('b-propuesta-firma.docx'));
  await api('POST', `/process/${agrB}/documents`, { form: fPropuestaFirmaB });

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

  // 15. Paneles y descarga protegida (la bandeja de seguimiento es la cola
  //     de la Etapa 3: solo convenios EN_SEGUIMIENTO o CONCLUIDO, jamás
  //     PUBLICADO, que es el cierre de la Etapa 2 · Registro)
  const seg = await api('GET', '/seguimiento');
  const segList = seg.json?.data ?? seg.json ?? [];
  check('panel seguimiento (Etapa 3, sin PUBLICADO)', seg.status === 200 &&
    segList.every((r) => ['EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'].includes(r.process_status)));
  check('panel seguimiento incluye agrA EN_SEGUIMIENTO', (segList.some((r) => r.id === agrA)));
  const rep = await api('GET', '/reports/summary');
  check('reportes summary', rep.status === 200);
  const notif = await api('GET', '/notifications');
  check('notificaciones', notif.status === 200);
  const exp = await api('GET', '/agreements/expiration-tracking');
  check('expiración tracking', exp.status === 200);

  // 15.1 Auditoría "primer uso": catálogos y consultas que un humano real
  //     ejecuta al navegar el sistema por primera vez.
  const docTypes = await api('GET', '/document-types');
  check(
    'catálogo tipos de documento sembrado (>10)',
    (Array.isArray(docTypes.json) ? docTypes.json : docTypes.json?.data ?? []).length > 10,
  );

  const defOp = await api('GET', '/dependencias/default-opinions');
  const defOpList = defOp.json ?? [];
  check('dependencias con opinión por defecto (lookup UI)', defOp.status === 200 && defOpList.length >= 2, `${defOpList.length}`);

  const sDeps = await api('GET', '/dependencias');
  check('catálogo de dependencias sembrado (>=9)', (sDeps.json?.data ?? sDeps.json ?? []).length >= 9);

  const cfg = await api('GET', '/config');
  const cfgList = Array.isArray(cfg.json) ? cfg.json : cfg.json?.data ?? [];
  check('config app (días de opinión/aviso)', cfg.status === 200 && cfgList.some((e) => e.key === 'opinion_deadline_days'), JSON.stringify(cfgList.slice(0, 2)).slice(0, 80));

  const countries = await api('GET', '/institutions/countries');
  check('catálogo de países', countries.status === 200 && Array.isArray(countries.json));

  const lkInst = await api('GET', '/agreements/lookups/institutions');
  check('lookup instituciones (formulario nueva propuesta)', lkInst.status === 200);

  const lkTypes = await api('GET', '/agreements/lookups/types');
  check('lookup tipos de convenio (formulario)', lkTypes.status === 200 && (lkTypes.json?.length ?? lkTypes.json?.data?.length ?? 0) >= 4);

    // Paneles con filtros (las bandejas envían scope + búsqueda real)
  for (const scope of ['tramite', 'en_registro', 'registrados']) {
    const q = await api('GET', `/agreements?scope=${scope}`);
    check(`bandeja scope=${scope}`, q.status === 200 && q.json?.data !== undefined);
  }


  const searchAgr = await api('GET', `/agreements?search=ECONVENIO`);
  check('búsqueda full-text convenios', searchAgr.status === 200 && Array.isArray(searchAgr.json?.data));

  const instList = await api('GET', '/institutions');
  check('panel instituciones', instList.status === 200 && Array.isArray(instList.json?.data ?? instList.json));

  const usersList = await api('GET', '/users');
  check('panel usuarios (admin)', usersList.status === 200 && (usersList.json?.data ?? usersList.json ?? []).length >= 1);

  const reports = await Promise.all([
    api('GET', '/reports/by-status'),
    api('GET', '/reports/by-country'),
    api('GET', '/reports/by-type'),
    api('GET', '/reports/by-institution'),
    api('GET', '/reports/top-institutions'),
    api('GET', '/reports/expiring'),
    api('GET', '/reports/expired'),
  ]);
  check('reportes: 7 gráficas responden 200', reports.every((r) => r.status === 200), reports.map((r) => r.status).join(','));

  const repExp = await api('GET', '/reports/export');
  check('exportación Excel reportes', repExp.status === 200 && repExp.ms < 5000, `status=${repExp.status}`);

  const authMe = await api('GET', '/auth/me');
  check('sesión /auth/me (header del dashboard)', authMe.status === 200 && authMe.json?.email, authMe.json?.email);

  // 15.2 Consultas del detalle universal (lo que carga /convenios/:id)
  const detailB = await api('GET', `/agreements/${agrA}`);
  check('detalle universal: agreements/:id', detailB.status === 200);
  const statusA2 = await api('GET', `/process/${agrA}/status`);
  check('detalle universal: process/:id/status', statusA2.status === 200 && statusA2.json?.agreement, statusA2.json?.seguimiento ? 'con seguimiento' : 'ok');
  const delivA = await api('GET', `/agreements/${agrA}/deliverables`);
  check('detalle universal: deliverables E3', delivA.status === 200 && Array.isArray(delivA.json ?? delivA.json?.data));

  // 15.3 Mantenimiento de vigencia (semáforo manual) y complete-monitoring
  const val = await api('POST', `/process/${agrA}/validity`, {
    json: { validity: 'SUSPENDIDO', reason: 'Auditoría de prueba.' },
  });
  const val2 = await api('POST', `/process/${agrA}/validity`, {
    json: { validity: 'VIGENTE' },
  });
  const stVal = await api('GET', `/process/${agrA}/status`);
  check(
    'vigencia manual SUSPENDIDO->VIGENTE',
    val.status < 300 && val2.status < 300 && stVal.json?.agreement?.validity_status === 'VIGENTE',
    `http=${val.status}/${val2.status} estado=${stVal.json?.agreement?.validity_status}`,
  );

  const completeMon = await api('POST', `/agreements/${agrA}/complete-monitoring`, {});
  const stCm = await api('GET', `/process/${agrA}/status`);
  check(
    'complete-monitoring idempotente (ya concluido)',
    completeMon.status === 200 || completeMon.status === 201 || (completeMon.status === 400 && /conclui|finaliz|Seguimiento/i.test(String(completeMon.json?.message ?? ''))),
    `http=${completeMon.status} estado=${stCm.json?.agreement?.process_status}`,
  );

  // 15.4 Historial de evento de un trámite en etapa temprana (rama B)
  const eventsB = await api('GET', `/process/${agrB}/events`);
  check('historial de eventos rama B poblado', (Array.isArray(eventsB.json) ? eventsB.json.length : eventsB.json?.data?.length ?? 0) > 8);

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
