/**
 * Flujo completo manual — simula un usuario real paso a paso.
 * Detecta errores, issues y inconsistencias en cada paso.
 * POSTs que crean recursos pueden devolver 200 o 201.
 */

const BASE = 'http://127.0.0.1:3000';
let TOKEN = '';
let INSTITUTION_ID;
let AGREEMENT_ID;

// ── Helpers ────────────────────────────────────────────────────────────────

async function api(method, path, body, isForm = false) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

function assert(label, condition, detail) {
  if (!condition) {
    console.log(`  ❌ FAIL: ${label}`);
    if (detail) console.log(`     → ${detail}`);
    ISSUES.push({ step: STEP, label, detail });
  } else {
    console.log(`  ✅ ${label}`);
  }
}

function ok2xx(label, r) {
  assert(label, r.status >= 200 && r.status < 300, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
}

function createDummyFile(name, content = 'test-content') {
  return new Blob([content], { type: 'application/pdf' });
}

const ISSUES = [];
let STEP = 0;

// ── Flujo ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== FLUJO COMPLETO PASO A PASO ===\n');

  // STEP 1: Login
  STEP = 1;
  console.log('[1] Login admin');
  {
    const r = await api('POST', '/auth/login', { email: 'ocri@uncp.edu.pe', password: 'Cooperacion@2025' });
    ok2xx('Login exitoso', r);
    TOKEN = r.json?.access_token;
    assert('Token obtenido', !!TOKEN);
  }

  // STEP 2: Create institution
  STEP = 2;
  console.log('\n[2] Crear institución de prueba');
  {
    const r = await api('POST', '/institutions', {
      name: 'UNIVERSIDAD DE PRUEBA E2E',
      country: 'Perú',
      type: 'Universidad Privada',
    });
    ok2xx('Institución creada', r);
    INSTITUTION_ID = r.json?.id;
    assert('ID de institución', !!INSTITUTION_ID);
  }

  // STEP 3: Get agreement types
  STEP = 3;
  console.log('\n[3] Obtener tipos de convenio');
  let agreementTypeId;
  {
    const r = await api('GET', '/agreements/lookups/types');
    ok2xx('Tipos cargados', r);
    assert('Al menos 1 tipo', Array.isArray(r.json) && r.json.length > 0);
    agreementTypeId = r.json?.[0]?.id;
  }

  // STEP 4: Create agreement (with files via FormData)
  STEP = 4;
  console.log('\n[4] Crear convenio (con archivos)');
  {
    const fd = new FormData();
    fd.append('title', 'CONVENIO MARCO UNCP - UNIVERSIDAD DE PRUEBA');
    fd.append('name', 'Convenio de Cooperación Interinstitucional para Pruebas');
    fd.append('institution_id', String(INSTITUTION_ID));
    fd.append('agreement_type_id', String(agreementTypeId));
    fd.append('applicant_name', 'Dr. Juan Pérez');
    fd.append('applicant_email', 'juan.perez@prueba.edu.pe');
    fd.append('applicant_unit', 'Vicerrectorado Académico');

    fd.append('oficio_solicitud', createDummyFile('oficio.pdf'), 'oficio.pdf');
    fd.append('propuesta', createDummyFile('propuesta.pdf'), 'propuesta.pdf');

    const r = await api('POST', '/agreements', fd, true);
    ok2xx('Convenio creado', r);
    AGREEMENT_ID = r.json?.id;
    assert('ID de convenio', !!AGREEMENT_ID);
    if (AGREEMENT_ID) {
      assert('Estado inicial RECEPCIONADA', r.json?.process_status === 'RECEPCIONADA', `status=${r.json?.process_status}`);
    }
  }

  if (!AGREEMENT_ID) {
    console.log('\n❌ No se pudo crear el convenio. Abortando.');
    return;
  }

  // STEP 5: Check process status
  STEP = 5;
  console.log('\n[5] Verificar estado del proceso');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = RECEPCIONADA', r.json?.agreement?.process_status === 'RECEPCIONADA');
    assert('Documents array existe', Array.isArray(r.json?.documents));
    assert('Events array existe', Array.isArray(r.json?.events));
    const docCodes = (r.json?.documents || []).map(d => d.document_types?.code).filter(Boolean);
    assert('Oficio subido', docCodes.includes('OFICIO_SOLICITUD'));
    assert('Propuesta subida', docCodes.includes('PROPUESTA_CONVENIO'));
  }

  // STEP 6: Get default opinion targets
  STEP = 6;
  console.log('\n[6] Obtener dependencias por defecto');
  let defaultDeps = [];
  {
    const r = await api('GET', '/dependencias/default-opinions');
    ok2xx('Dependencias cargadas', r);
    defaultDeps = Array.isArray(r.json) ? r.json : [];
    assert('Al menos 2 dependencias', defaultDeps.length >= 2, `count=${defaultDeps.length}`);
  }

  // STEP 7: Generate opinion requests
  STEP = 7;
  console.log('\n[7] Generar solicitudes de opinión');
  {
    const depIds = defaultDeps.map(d => d.id);
    const r = await api('POST', `/process/${AGREEMENT_ID}/opinion-requests`, { dependencia_ids: depIds });
    ok2xx('Solicitudes generadas', r);
    assert('Array de solicitudes', Array.isArray(r.json));
    assert(`Solicitudes数量 >= 2`, r.json?.length >= 2, `count=${r.json?.length}`);
  }

  // STEP 8: Check status after generating
  STEP = 8;
  console.log('\n[8] Verificar estado después de generar solicitudes');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = OPINIONES_EN_CURSO', r.json?.agreement?.process_status === 'OPINIONES_EN_CURSO');
    assert('Total solicitudes > 0', r.json?.counts?.total > 0, `total=${r.json?.counts?.total}`);
    assert('Pendientes > 0', r.json?.counts?.pendientes > 0, `pendientes=${r.json?.counts?.pendientes}`);
  }

  // STEP 9: Send each opinion request
  STEP = 9;
  console.log('\n[9] Enviar solicitudes de opinión');
  {
    const statusR = await api('GET', `/process/${AGREEMENT_ID}/status`);
    const requests = statusR.json?.opinion_requests || [];
    let sentCount = 0;
    for (const req of requests) {
      if (req.status === 'GENERADA') {
        const r = await api('POST', `/process/opinion-requests/${req.id}/send`, {
          sent_via: 'ADESA',
          adesa_number: `ADESA-${Date.now()}-${req.id}`,
        });
        assert(`Solicitud #${req.id} enviada`, r.status >= 200 && r.status < 300, `status=${r.status}`);
        sentCount++;
      }
    }
    assert('Al menos 1 enviada', sentCount > 0, `sent=${sentCount}`);
  }

  // STEP 10: Register responses
  STEP = 10;
  console.log('\n[10] Registrar respuestas de opiniones');
  {
    const statusR = await api('GET', `/process/${AGREEMENT_ID}/status`);
    const requests = statusR.json?.opinion_requests || [];
    let respondCount = 0;
    for (const req of requests) {
      if (req.status === 'ENVIADA') {
        const r = await api('POST', `/process/opinion-requests/${req.id}/respond`, {
          response_date: new Date().toISOString().split('T')[0],
          observations: 'Opinión favorable al convenio.',
        });
        assert(`Respuesta #${req.id}`, r.status >= 200 && r.status < 300, `status=${r.status}`);
        respondCount++;
      }
    }
    assert('Al menos 1 respondida', respondCount > 0, `responded=${respondCount}`);
  }

  // STEP 11: Check status after responses
  STEP = 11;
  console.log('\n[11] Verificar estado después de respuestas');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    const ps = r.json?.agreement?.process_status;
    assert('No sigue en RECEPCIONADA', ps !== 'RECEPCIONADA', `status=${ps}`);
  }

  // STEP 12: Validate each opinion
  STEP = 12;
  console.log('\n[12] Validar opiniones');
  {
    const statusR = await api('GET', `/process/${AGREEMENT_ID}/status`);
    const requests = statusR.json?.opinion_requests || [];
    let validatedCount = 0;
    for (const req of requests) {
      if (req.status === 'RESPONDIDA' || req.status === 'OBSERVADA') {
        const r = await api('POST', `/process/opinion-requests/${req.id}/validate`, { valid: true });
        assert(`Opinión #${req.id} validada`, r.status >= 200 && r.status < 300, `status=${r.status}`);
        validatedCount++;
      }
    }
    assert('Al menos 1 validada', validatedCount > 0, `validated=${validatedCount}`);
  }

  // STEP 13: Check status after validation
  STEP = 13;
  console.log('\n[13] Verificar estado después de validación');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = OPINIONES_COMPLETAS', r.json?.agreement?.process_status === 'OPINIONES_COMPLETAS',
      `status=${r.json?.agreement?.process_status}`);
  }

  // STEP 14: Try to finalize expediente WITHOUT required documents
  STEP = 14;
  console.log('\n[14] Intentar finalizar expediente SIN documentos requeridos');
  {
    const r = await api('POST', `/process/${AGREEMENT_ID}/finalize-expediente`);
    console.log(`     Resultado: status=${r.status}`);
    if (r.status >= 200 && r.status < 300) {
      assert('BUG: Backend permitió finalizar sin documentos requeridos', false,
        'Debería haber rechazado con los documentos faltantes');
      // If it succeeded without docs, we need to go back - this shouldn't happen
    } else {
      assert('Backend rechazó correctamente sin documentos', true);
      assert('Error mentiona documentos faltantes', JSON.stringify(r.json).includes('Faltan'),
        `msg=${JSON.stringify(r.json).slice(0, 200)}`);
    }
  }

  // STEP 15: Upload required documents
  STEP = 15;
  console.log('\n[15] Subir documentos requeridos');
  {
    const docs = [
      { code: 'EXPEDIENTE_TECNICO', name: 'expediente.pdf' },
      { code: 'INFORME_TECNICO_OCRI', name: 'informe.pdf' },
    ];
    for (const doc of docs) {
      const fd = new FormData();
      fd.append('file', createDummyFile(doc.name, `${doc.code}-content`), doc.name);
      fd.append('document_type_code', doc.code);
      const r = await api('POST', `/process/${AGREEMENT_ID}/documents`, fd, true);
      ok2xx(`${doc.code} subido`, r);
    }
  }

  // STEP 16: Verify documents in status
  STEP = 16;
  console.log('\n[16] Verificar documentos en status del proceso');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    const docCodes = (r.json?.documents || []).map(d => d.document_types?.code).filter(Boolean);
    console.log(`     Documentos: [${docCodes.join(', ')}]`);
    assert('EXPEDIENTE_TECNICO presente', docCodes.includes('EXPEDIENTE_TECNICO'));
    assert('INFORME_TECNICO_OCRI presente', docCodes.includes('INFORME_TECNICO_OCRI'));
    assert('PROPUESTA_CONVENIO presente', docCodes.includes('PROPUESTA_CONVENIO'));
  }

  // STEP 17: Finalize expediente (should work now)
  STEP = 17;
  console.log('\n[17] Finalizar expediente (debería funcionar ahora)');
  {
    const r = await api('POST', `/process/${AGREEMENT_ID}/finalize-expediente`);
    ok2xx('Finalizar expediente', r);
    assert('Estado = EXPEDIENTE_TECNICO_LISTO', r.json?.process_status === 'EXPEDIENTE_TECNICO_LISTO',
      `status=${r.json?.process_status}`);
  }

  // STEP 18: Send to Rectorado
  STEP = 18;
  console.log('\n[18] Enviar a Rectorado');
  {
    const r = await api('POST', `/process/${AGREEMENT_ID}/send-to-rectorado`);
    ok2xx('Enviado a Rectorado', r);
    assert('Estado = ENVIADO_A_RECTORADO', r.json?.process_status === 'ENVIADO_A_RECTORADO',
      `status=${r.json?.process_status}`);
  }

  // STEP 19: Rectorado suscribe
  STEP = 19;
  console.log('\n[19] Rectorado suscribe el convenio');
  {
    const r = await api('POST', `/process/${AGREEMENT_ID}/rectorate-decision`, { decision: 'APPROVED' });
    ok2xx('Rectorado suscribe', r);
    assert('process_status = SUSCRITO', r.json?.process_status === 'SUSCRITO',
      `status=${r.json?.process_status}`);
  }

  // STEP 20: Publish
  STEP = 20;
  console.log('\n[20] Publicar convenio');
  {
    const r = await api('POST', `/process/${AGREEMENT_ID}/publish`);
    ok2xx('Publicado', r);
    // Verify via status endpoint (publish may not return process_status)
    const s = await api('GET', `/process/${AGREEMENT_ID}/status`);
    assert('Estado = PUBLICADO (via status)', s.json?.agreement?.process_status === 'PUBLICADO',
      `status=${s.json?.agreement?.process_status}`);
  }

  // STEP 21: Register
  STEP = 21;
  console.log('\n[21] Registrar convenio');
  {
    const fd = new FormData();
    fd.append('resolution_number', 'R.R. N° 001-2026-OCRI/UNCP');
    fd.append('start_date', '2026-01-15');
    fd.append('end_date', '2028-01-15');
    fd.append('responsables', JSON.stringify([
      { name: 'Dr. Responsable UNCP', role: 'Coordinador', side: 'UNCP', email: 'resp@uncp.edu.pe' },
      { name: 'Ing. Responsable Entidad', role: 'Enlace', side: 'CONTRAPARTE', email: 'resp@prueba.edu.pe' },
    ]));
    fd.append('observations', 'Convenio de prueba E2E');
    fd.append('file', createDummyFile('convenio_firmado.pdf'), 'convenio_firmado.pdf');

    const r = await api('POST', `/process/${AGREEMENT_ID}/register-agreement`, fd, true);
    ok2xx('Convenio registrado', r);
    assert('Estado = REGISTRADO', r.json?.process_status === 'REGISTRADO', `status=${r.json?.process_status}`);
    assert('Vigencia = VIGENTE', r.json?.validity_status === 'VIGENTE', `validity=${r.json?.validity_status}`);
  }

  // STEP 22: Check status E2 complete
  STEP = 22;
  console.log('\n[22] Verificar estado completo E2');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = REGISTRADO', r.json?.agreement?.process_status === 'REGISTRADO');
    assert('Etapa = ETAPA_2_REGISTRO', r.json?.agreement?.stage === 'ETAPA_2_REGISTRO');
    assert('Vigencia = VIGENTE', r.json?.agreement?.validity_status === 'VIGENTE');
  }

  // STEP 23: Request work plan (starts E3)
  STEP = 23;
  console.log('\n[23] Solicitar Plan de Trabajo (inicia E3)');
  {
    const r = await api('POST', `/agreements/${AGREEMENT_ID}/request-workplan`);
    ok2xx('Plan de trabajo solicitado', r);
  }

  // STEP 24: Verify E3 status
  STEP = 24;
  console.log('\n[24] Verificar estado E3 después de solicitar plan');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = EN_SEGUIMIENTO', r.json?.agreement?.process_status === 'EN_SEGUIMIENTO');
    assert('Etapa = ETAPA_3_SEGUIMIENTO', r.json?.agreement?.stage === 'ETAPA_3_SEGUIMIENTO');
  }

  // STEP 25: Get deliverables
  STEP = 25;
  console.log('\n[25] Verificar entregables');
  {
    const r = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    ok2xx('Deliverables cargados', r);
    assert('Al menos 1 entregable', Array.isArray(r.json) && r.json.length > 0);
    const workPlan = (r.json || []).find(d => d.type === 'PLAN_DE_TRABAJO');
    assert('Plan de Trabajo existe', !!workPlan);
    if (workPlan) assert('Plan status = SOLICITADO', workPlan.status === 'SOLICITADO');
  }

  // STEP 26: Submit work plan
  STEP = 26;
  console.log('\n[26] Remitir Plan de Trabajo');
  {
    const fd = new FormData();
    fd.append('file', createDummyFile('plan_trabajo.pdf'), 'plan_trabajo.pdf');
    const r = await api('POST', `/agreements/${AGREEMENT_ID}/submit-workplan`, fd, true);
    ok2xx('Plan de Trabajo remitido', r);
    assert('Status = RECIBIDO', r.json?.status === 'RECIBIDO');
  }

  // STEP 27: Approve work plan
  STEP = 27;
  console.log('\n[27] Aprobar Plan de Trabajo');
  {
    const delR = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    const workPlan = (delR.json || []).find(d => d.type === 'PLAN_DE_TRABAJO');
    if (workPlan) {
      const r = await api('POST', `/agreements/deliverables/${workPlan.id}/evaluate`, { decision: 'APPROVED' });
      ok2xx('Plan de Trabajo aprobado', r);
      assert('Status = REGISTRADO', r.json?.status === 'REGISTRADO');
    } else {
      assert('Plan de Trabajo encontrado para aprobar', false);
    }
  }

  // STEP 28: Request informe semestral
  STEP = 28;
  console.log('\n[28] Solicitar Informe Semestral');
  {
    const r = await api('POST', `/agreements/${AGREEMENT_ID}/request-report`, {
      type: 'INFORME_SEMESTRAL', period: '2026-I',
    });
    ok2xx('Informe Semestral solicitado', r);
  }

  // STEP 29: Submit informe semestral
  STEP = 29;
  console.log('\n[29] Remitir Informe Semestral');
  {
    const delR = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    const semi = (delR.json || []).find(d => d.type === 'INFORME_SEMESTRAL' && d.status === 'SOLICITADO');
    if (semi) {
      const fd = new FormData();
      fd.append('file', createDummyFile('informe_semestral.pdf'), 'informe_semestral.pdf');
      const r = await api('POST', `/agreements/deliverables/${semi.id}/submit`, fd, true);
      ok2xx('Informe Semestral remitido', r);
    } else {
      assert('Informe Semestral pendiente encontrado', false);
    }
  }

  // STEP 30: Approve informe semestral
  STEP = 30;
  console.log('\n[30] Aprobar Informe Semestral');
  {
    const delR = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    const semi = (delR.json || []).find(d => d.type === 'INFORME_SEMESTRAL' && d.status === 'RECIBIDO');
    if (semi) {
      const r = await api('POST', `/agreements/deliverables/${semi.id}/evaluate`, { decision: 'APPROVED' });
      ok2xx('Informe Semestral aprobado', r);
      assert('Status = REGISTRADO', r.json?.status === 'REGISTRADO');
    } else {
      assert('Informe Semestral recibido encontrado', false);
    }
  }

  // STEP 31: Request informe final
  STEP = 31;
  console.log('\n[31] Solicitar Informe Final');
  {
    const r = await api('POST', `/agreements/${AGREEMENT_ID}/request-report`, { type: 'INFORME_FINAL' });
    ok2xx('Informe Final solicitado', r);
  }

  // STEP 32: Submit informe final
  STEP = 32;
  console.log('\n[32] Remitir Informe Final');
  {
    const delR = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    const final = (delR.json || []).find(d => d.type === 'INFORME_FINAL' && d.status === 'SOLICITADO');
    if (final) {
      const fd = new FormData();
      fd.append('file', createDummyFile('informe_final.pdf'), 'informe_final.pdf');
      const r = await api('POST', `/agreements/deliverables/${final.id}/submit`, fd, true);
      ok2xx('Informe Final remitido', r);
    } else {
      assert('Informe Final pendiente encontrado', false);
    }
  }

  // STEP 33: Approve informe final — should auto-complete E3
  STEP = 33;
  console.log('\n[33] Aprobar Informe Final (debería concluir seguimiento)');
  {
    const delR = await api('GET', `/agreements/${AGREEMENT_ID}/deliverables`);
    const final = (delR.json || []).find(d => d.type === 'INFORME_FINAL' && d.status === 'RECIBIDO');
    if (final) {
      const r = await api('POST', `/agreements/deliverables/${final.id}/evaluate`, { decision: 'APPROVED' });
      ok2xx('Informe Final aprobado', r);
    } else {
      assert('Informe Final recibido encontrado', false);
    }
  }

  // STEP 34: Verify final state
  STEP = 34;
  console.log('\n[34] Verificar estado final del convenio');
  {
    const r = await api('GET', `/process/${AGREEMENT_ID}/status`);
    ok2xx('Status cargado', r);
    assert('Estado = SEGUIMIENTO_CONCLUIDO', r.json?.agreement?.process_status === 'SEGUIMIENTO_CONCLUIDO',
      `status=${r.json?.agreement?.process_status}`);
    assert('Etapa = ETAPA_3_SEGUIMIENTO', r.json?.agreement?.stage === 'ETAPA_3_SEGUIMIENTO');
  }

  // STEP 35: Check reports
  STEP = 35;
  console.log('\n[35] Verificar reportes después del ciclo completo');
  {
    const r = await api('GET', '/reports/summary');
    ok2xx('Reportes cargados', r);
    console.log(`     Total: ${r.json?.total} | En trámite: ${r.json?.en_tramite} | Vigentes: ${r.json?.vigentes} | Concluidos: ${r.json?.concluidos}`);
    assert('Total = 1', r.json?.total === 1);
    assert('Vigentes = 1', r.json?.vigentes === 1);
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${ISSUES.length === 0 ? '✅ TODOS LOS PASOS OK' : `❌ ${ISSUES.length} ISSUE(S) ENCONTRADO(S)`}`);
  if (ISSUES.length > 0) {
    console.log('\nISSUES DETECTADOS:');
    for (const issue of ISSUES) {
      console.log(`  Step ${issue.step}: ${issue.label}`);
      if (issue.detail) console.log(`    → ${issue.detail}`);
    }
  }
  console.log('═'.repeat(60));
}

run().catch(err => {
  console.error('\n💥 ERROR FATAL:', err.message);
  console.error(err.stack);
});
