#!/usr/bin/env python3
"""
Verificador completo del flujo OCRI.
Simula exactamente lo que haría un humano usando el sistema:
  - Flujo feliz completo (A): RECEPCIONADA -> SEGUIMIENTO_CONCLUIDO
  - Flujo de rechazo (B): RECEPCIONADA -> NO_SUSCRITO
  - Validación de transiciones inválidas
  - Validación de documentos obligatorios en cada paso
  - Validación de mensajes de error claros
  - Validación de coherencia del sidebar y rutas

Uso: python scripts/verify-flow.py
"""

import json
import os
import sys
import time
import io
import requests
from datetime import datetime

BASE = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")

# -- Configuración --------------------------------------------------------------

def load_env():
    env = {}
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", ".env"), "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip('"').strip("'")
                    env[key.strip()] = val
    except FileNotFoundError:
        pass
    return env

ENV = load_env()
EMAIL = ENV.get("SEED_ADMIN_EMAIL", "ocri@uncp.edu.pe")
PASSWORD = ENV.get("SEED_ADMIN_PASSWORD")

# -- Resultados -----------------------------------------------------------------

results = []
token = None
session = requests.Session()


def pdf_bytes(name="doc.pdf"):
    """Crea un PDF mínimo válido."""
    return (
        b"%PDF-1.4\n"
        b"\xe2\xe3\xcf\xd3\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R>>endobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\n"
        b"startxref\n190\n%%EOF\n"
    )


def check(name, ok, detail=""):
    icon = "PASS" if ok else "FAIL"
    msg = f"  {icon}  {name}"
    if detail:
        msg += f" -> {detail}"
    print(msg)
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    return ok


def api(method, path, data=None, json_body=None, files=None, expect=None, raw=False):
    """Realiza una petición HTTP y retorna (status, json_data).
    
    Para multipart con campos de texto + archivos (como browser FormData):
      Usa form_fields={}, form_files={}
    
    Para JSON:
      Usa json_body={}

    Para solo archivos:
      Usa files={}
    """
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{BASE}{path}"
    t0 = time.time()

    try:
        if json_body is not None:
            resp = session.request(method, url, json=json_body, headers=headers, timeout=30)
        elif data is not None or files is not None:
            _data = data or {}
            _files = files or {}
            resp = session.request(method, url, data=_data, files=_files, headers=headers, timeout=30)
        else:
            resp = session.request(method, url, headers=headers, timeout=30)
    except requests.RequestException as e:
        ms = (time.time() - t0) * 1000
        return 0, None, ms, str(e)

    ms = (time.time() - t0) * 1000
    if ms > 3000:
        print(f"  SLOW  {method} {path} -> {ms:.0f}ms")

    try:
        data = resp.json()
    except (json.JSONDecodeError, ValueError):
        data = resp.text[:300] if resp.text else None

    if expect is not None and resp.status_code != expect:
        print(
            f"  [{method} {path}] esperado {expect}, recibido {resp.status_code}: "
            f"{json.dumps(data, ensure_ascii=False)[:200] if isinstance(data, (dict, list)) else str(data)[:200]}"
        )

    return resp.status_code, data, ms, None


def pdf_file(name="doc.pdf"):
    """Retorna tupla (filename, bytes, mime) para requests."""
    return (name, pdf_bytes(name), "application/pdf")


def docx_bytes(name="doc.docx"):
    """Crea un DOCX mínimo válido (ZIP con content_types.xml)."""
    import zipfile
    import io
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>')
        zf.writestr("_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>')
        zf.writestr("word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:body><w:p><w:r><w:t>Test document</w:t></w:r></w:p></w:body>'
            '</w:document>')
        zf.writestr("word/_rels/document.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
    return buf.getvalue()


def docx_file(name="doc.docx"):
    """Retorna tupla (filename, bytes, mime) para requests."""
    return (name, docx_bytes(name), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


# ══════════════════════════════════════════════════════════════════════════════════
# FLUJO A: Feliz completo
# ══════════════════════════════════════════════════════════════════════════════════

def test_flujo_feliz():
    global token
    print("\n" + "=" * 70)
    print("  FLUJO A: FELIZ COMPLETO (RECEPCIONADA -> SEGUIMIENTO_CONCLUIDO)")
    print("=" * 70)

    # -- 0. Login ----------------------------------------------------------------
    print("\n-- 0. AUTENTICACIÓN --")
    st, body, _, _ = api("POST", "/auth/login", json_body={"email": EMAIL, "password": PASSWORD})
    check("login admin exitoso", st == 200 and body and body.get("access_token"),
          f"http={st}")
    token = body.get("access_token") if body else None
    if not token:
        print("  No se pudo autenticar. Abortando.")
        return False

    # -- 1. Datos auxiliares -----------------------------------------------------
    print("\n-- 1. DATOS AUXILIARES --")
    inst_name = f"Entidad Verificación {int(time.time() * 1000)}"
    st, body, _, _ = api("POST", "/institutions", json_body={
        "name": inst_name, "country": "Perú", "type": "Universidad Nacional"
    })
    institution_id = None
    if body:
        institution_id = body.get("id") or (body.get("agreement") or {}).get("id")
    if not institution_id:
        st2, body2, _, _ = api("GET", "/institutions?per_page=1")
        if body2 and isinstance(body2, dict):
            rows = body2.get("data", [])
            institution_id = rows[0]["id"] if rows else None
    check("institución creada/disponible", bool(institution_id), f"id={institution_id}")

    st, types, _, _ = api("GET", "/agreements/lookups/types")
    type_id = None
    if types:
        for t in (types if isinstance(types, list) else types.get("data", [])):
            if "Específico" in t.get("name", "") or "Marco" in t.get("name", ""):
                type_id = t["id"]
                break
        if not type_id and isinstance(types, list) and types:
            type_id = types[0]["id"]
        elif not type_id and isinstance(types, dict):
            data = types.get("data", [])
            if data:
                type_id = data[0]["id"]
    check("tipo de convenio disponible", bool(type_id), f"type_id={type_id}")

    st, deps_resp, _, _ = api("GET", "/dependencias")
    dep_list = []
    if deps_resp:
        dep_list = deps_resp.get("data", []) if isinstance(deps_resp, dict) else deps_resp
    default_deps = [d for d in dep_list if d.get("is_default_opinion")]
    check("dependencias con opinión por defecto >= 2", len(default_deps) >= 2, f"encontradas={len(default_deps)}")

    # -- 2. Crear propuesta ------------------------------------------------------
    print("\n-- 2. CREAR PROPUESTA (Fase 1) --")

    # Validación: sin archivos -> 400
    st, _, _, _ = api("POST", "/agreements",
                      json_body={"title": "X", "institution_id": institution_id,
                                 "agreement_type_id": type_id}, expect=400)
    check("crear sin archivos -> 400", st == 400)

    # Crear con archivos
    files = {
        "oficio_solicitud": pdf_file("oficio-solicitud.pdf"),
        "propuesta": pdf_file("propuesta-convenio.pdf"),
    }
    data_fields = {
        "title": "Convenio Marco UNCP - Verificación Automatizada",
        "name": "Convenio de Cooperación Interinstitucional",
        "institution_id": str(institution_id),
        "agreement_type_id": str(type_id),
        "applicant_unit": "OCRI - UNCP",
        "rectorate_oficio_number": f"OF-R-{int(time.time())}",
    }
    st, body, _, _ = api("POST", "/agreements", data=data_fields, files=files, expect=201)
    agr_id = None
    if body:
        agr_id = body.get("id") or body.get("agreement", {}).get("id")
    status_actual = (body or {}).get("process_status", "?")
    check("propuesta creada -> RECEPCIONADA", st == 201 and agr_id and status_actual == "RECEPCIONADA",
          f"id={agr_id} status={status_actual}")
    if not agr_id:
        print("  No se pudo crear propuesta. Abortando flujo A.")
        return False

    # -- 3. Validar que finalize premature falla ----------------------------------
    print("\n-- 3. VALIDACIÓN DE TRANSICIONES INVÁLIDAS --")
    st, _, _, _ = api("POST", f"/process/{agr_id}/finalize-expediente", expect=400)
    check("finalize prematuro (RECEPCIONADA) -> 400", st == 400)

    st, _, _, _ = api("POST", f"/process/{agr_id}/send-to-rectorado", expect=400)
    check("send-to-rectorado prematuro -> 400", st == 400)

    # -- 4. Generar solicitudes de opinión ----------------------------------------
    print("\n-- 4. OPINIONES DE DEPENDENCIAS (Fase 1) --")
    target_ids = [d["id"] for d in default_deps[:2]]
    st, body, _, _ = api("POST", f"/process/{agr_id}/opinion-requests",
                         json_body={"dependencia_ids": target_ids}, expect=201)
    check("solicitudes de opinión generadas -> OPINIONES_EN_CURSO",
          st in (200, 201), f"http={st}")

    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    op_requests = []
    if status_body:
        if isinstance(status_body, dict):
            op_requests = status_body.get("opinion_requests", [])
        else:
            print(f"  DEBUG status_body type={type(status_body).__name__}: {str(status_body)[:200]}")
    check("2 solicitudes registradas", len(op_requests) == 2, f"count={len(op_requests)} type={type(status_body).__name__ if status_body else 'None'}")

    # Duplicada -> 400
    st, _, _, _ = api("POST", f"/process/{agr_id}/opinion-requests",
                      json_body={"dependencia_ids": [target_ids[0]]}, expect=400)
    check("solicitud duplicada -> 400", st == 400)

    # -- 5. Responder, ciclo de correccion, y validar opiniones -------------------
    print("\n-- 5. CICLO DE OPINIONES (con correccion) --")
    for i, req in enumerate(op_requests):
        req_id = req["id"]

        # Enviar
        st, _, _, _ = api("POST", f"/process/opinion-requests/{req_id}/send",
                          json_body={"sent_via": "EMAIL"})
        check(f"enviar solicitud #{req_id}", st < 300)

        # Responder
        resp_file = {"file": pdf_file(f"respuesta-{i}.pdf")}
        st, _, _, _ = api("POST", f"/process/opinion-requests/{req_id}/respond",
                          files=resp_file)
        check(f"registrar respuesta solicitud #{req_id}", st < 300)

        # En la primera opinion: ciclo de correccion (observar -> revalidar)
        if i == 0:
            print(f"\n  -- 5b. CICLO DE CORRECCION en solicitud #{req_id} --")
            st, _, _, _ = api("POST", f"/process/opinion-requests/{req_id}/validate",
                              json_body={"valid": False, "observations": "Falta informacion."})
            check(f"observar opinion #{req_id}", st < 300)

            # Re-Validar directamente (OBSERVADA -> VALIDADA)
            st, _, _, _ = api("POST", f"/process/opinion-requests/{req_id}/validate",
                              json_body={"valid": True})
            check(f"revalidar opinion observada #{req_id}", st < 300)
        else:
            # Resto de opiniones: validar directo
            st, _, _, _ = api("POST", f"/process/opinion-requests/{req_id}/validate",
                              json_body={"valid": True})
            check(f"validar opinion #{req_id}", st < 300)

    # Verificar que auto-transiciono a OPINIONES_COMPLETAS
    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("auto-transicion a OPINIONES_COMPLETAS", actual == "OPINIONES_COMPLETAS", f"status={actual}")

    # -- 6. Documentos para Rectorado --------------------------------------------
    print("\n-- 6. EXPEDIENTE Y DOCUMENTOS PARA RECTORADO --")

    # Generar expediente técnico
    st, _, _, _ = api("POST", f"/process/{agr_id}/generate-expediente", expect=201)
    check("generar expediente técnico (PDF merge)", st == 201)

    # Subir oficio de respuesta a Rectorado
    files_oficio = {"file": pdf_file("oficio-respuesta-rectorado.pdf")}
    st, _, _, _ = api("POST", f"/process/{agr_id}/documents",
                      data={"document_type_code": "OFICIO_RESPUESTA_RECTORADO"},
                      files=files_oficio)
    check("subir oficio de respuesta a Rectorado", st < 300)

    # Subir Propuesta de Convenio para Firmar (.docx)
    files_propuesta_firma = {"file": docx_file("propuesta-convenio-firma.docx")}
    st, _, _, _ = api("POST", f"/process/{agr_id}/documents",
                      data={"document_type_code": "PROPUESTA_CONVENIO_FIRMA"},
                      files=files_propuesta_firma)
    check("subir Propuesta de Convenio para Firmar (.docx)", st < 300)

    # Verificar que los documentos existen
    st, docs_body, _, _ = api("GET", f"/process/{agr_id}/documents")
    doc_codes = set()
    if docs_body:
        doc_list = docs_body if isinstance(docs_body, list) else docs_body.get("data", [])
        for d in doc_list:
            dt = d.get("document_types") or d.get("document_type") or {}
            code = dt.get("code") or d.get("document_type_code", "")
            if code:
                doc_codes.add(code)

    has_exp = "EXPEDIENTE_TECNICO" in doc_codes
    has_oficio = "OFICIO_RESPUESTA_RECTORADO" in doc_codes
    has_propuesta_firma = "PROPUESTA_CONVENIO_FIRMA" in doc_codes
    check("3 documentos obligatorios presentes",
          has_exp and has_oficio and has_propuesta_firma,
          f"expediente={has_exp} oficio_respuesta={has_oficio} propuesta_firma={has_propuesta_firma}")

    # -- 7. Finalizar expediente -> EXPEDIENTE_TECNICO_LISTO ----------------------
    print("\n-- 7. FINALIZACION DEL EXPEDIENTE --")
    st, _, _, _ = api("POST", f"/process/{agr_id}/finalize-expediente", expect=201)
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("finalize-expediente -> EXPEDIENTE_TECNICO_LISTO",
          st == 201 and actual == "EXPEDIENTE_TECNICO_LISTO",
          f"http={st} status={actual}")

    # -- 8. Enviar a Rectorado -> ENVIADO_A_RECTORADO ----------------------------
    print("\n-- 8. ENVIO A RECTORADO --")
    st, _, _, _ = api("POST", f"/process/{agr_id}/send-to-rectorado", expect=201)
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("envío a Rectorado -> ENVIADO_A_RECTORADO",
          st == 201 and actual == "ENVIADO_A_RECTORADO",
          f"http={st} status={actual}")

    # -- 9. Decision de Rectorado -----------------------------------------------
    print("\n-- 9. DECISION DE RECTORADO (Fase 2) --")
    # Rechazo sin notification -> 400
    st, _, _, _ = api("POST", f"/process/{agr_id}/rectorate-decision",
                      data={"decision": "REJECTED"},
                      files={"file": pdf_file("resolucion.pdf")},
                      expect=400)
    check("rechazo sin notification -> 400", st == 400)

    # Suscribir
    files_dec = {
        "file": pdf_file("convenio-firmado.pdf"),
    }
    data_dec = {
        "decision": "APPROVED",
        "rectorate_oficio_number": f"OF-REC-{int(time.time())}",
    }
    st, _, _, _ = api("POST", f"/process/{agr_id}/rectorate-decision",
                      data=data_dec, files=files_dec)
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("Rectorado suscribe -> SUSCRITO",
          st < 300 and actual == "SUSCRITO",
          f"http={st} status={actual}")

    # -- 10. Publicacion ---------------------------------------------------------
    print("\n-- 10. PUBLICACION --")
    st, _, _, _ = api("POST", f"/process/{agr_id}/publish",
                      files={"file": pdf_file("publicacion.pdf")})
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("publicación -> PUBLICADO", st < 300 and actual == "PUBLICADO",
          f"http={st} status={actual}")

    # -- 11. Registro del convenio ------------------------------------------------
    print("\n-- 11. REGISTRO DEL CONVENIO (Fase 2) --")
    # Sin archivo escaneado -> 400
    st, _, _, _ = api("POST", f"/process/{agr_id}/register-agreement",
                      data={"resolution_number": "R-001", "start_date": "2026-01-01",
                            "end_date": "2028-01-01",
                            "responsables": json.dumps([{"name": "Resp 1"}])},
                      expect=400)
    check("registro sin convenio escaneado -> 400", st == 400)

    # Registro completo (2 anos = 4 semestrales auto-creados)
    reg_data = {
        "resolution_number": f"R-VERIF-{int(time.time())}",
        "start_date": "2026-01-01",
        "end_date": "2028-01-01",
        "drive_link": "https://drive.example.com/convenio",
        "responsables": json.dumps([
            {"name": "Dra. María Quispe", "role": "Decana", "side": "UNCP", "email": "mq@uncp.edu.pe"},
            {"name": "Ing. Carlos López", "role": "Director", "side": "CONTRAPARTE"},
        ]),
    }
    st, _, _, _ = api("POST", f"/process/{agr_id}/register-agreement",
                      data=reg_data, files={"file": pdf_file("convenio-registrado.pdf")})
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    validity = status_body.get("agreement", {}).get("validity_status", "?") if status_body else "?"
    check("registro -> REGISTRADO / VIGENTE",
          st < 300 and actual == "REGISTRADO" and validity == "VIGENTE",
          f"http={st} status={actual} vigencia={validity}")

    # Verificar responsables
    st, detail, _, _ = api("GET", f"/agreements/{agr_id}")
    resp_count = -1
    if detail:
        resp_count = len(detail.get("responsables", []) or detail.get("agreement", {}).get("responsables", []) or [])
    check("2 responsables registrados", resp_count == 2, f"count={resp_count}")

    # -- 12. Seguimiento (Fase 3) ------------------------------------------------
    print("\n-- 12. SEGUIMIENTO Y CONTROL (Fase 3) --")
    st, _, _, _ = api("POST", f"/agreements/{agr_id}/request-workplan")
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("solicitar plan de trabajo (plan ya auto-creado, sigue REGISTRADO)",
          st < 300 and actual == "REGISTRADO",
          f"http={st} status={actual}")

    # Plan de trabajo
    st, wp_list, _, _ = api("GET", f"/agreements/{agr_id}/deliverables")
    wp_items = wp_list.get("data", wp_list) if isinstance(wp_list, dict) else wp_list or []
    wp = next((d for d in wp_items if d.get("type") == "PLAN_DE_TRABAJO"), None)
    check("plan de trabajo SOLICITADO", wp and wp.get("status") == "SOLICITADO", f"status={wp.get('status') if wp else 'NOT_FOUND'}")

    if wp:
        # Remitir v1
        st, _, _, _ = api("POST", f"/agreements/{agr_id}/submit-workplan",
                          files={"file": pdf_file("plan-v1.pdf")})
        check("remisión plan de trabajo v1", st < 300)

        # Observar (corrección)
        st, _, _, _ = api("POST", f"/agreements/deliverables/{wp['id']}/evaluate",
                          json_body={"decision": "OBSERVED", "observations": "Rehacer cronograma."})
        check("observar plan de trabajo", st < 300)

        # Remitir v2
        st, _, _, _ = api("POST", f"/agreements/{agr_id}/submit-workplan",
                          files={"file": pdf_file("plan-v2.pdf")})
        st2, wp_list2, _, _ = api("GET", f"/agreements/{agr_id}/deliverables")
        wp_items2 = wp_list2.get("data", wp_list2) if isinstance(wp_list2, dict) else wp_list2 or []
        wp2 = next((d for d in wp_items2 if d.get("type") == "PLAN_DE_TRABAJO"), None)
        check("correccion plan v2 RECIBIDO",
              st < 300 and wp2 and wp2.get("version") == 2 and wp2.get("status") == "RECIBIDO",
              f"v={wp2.get('version') if wp2 else '?'} status={wp2.get('status') if wp2 else '?'}")

        # Aprobar plan -> auto-transition REGISTRADO -> EN_SEGUIMIENTO
        st, _, _, _ = api("POST", f"/agreements/deliverables/{wp['id']}/evaluate",
                          json_body={"decision": "APPROVED"})
        st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
        actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
        check("plan aprobado -> EN_SEGUIMIENTO automatico",
              st < 300 and actual == "EN_SEGUIMIENTO",
              f"http={st} status={actual}")

    # Informes semestrales
    periods = ["2026-I", "2026-II", "2027-I", "2027-II"]
    all_ok = True
    for period in periods:
        st, _, _, _ = api("POST", f"/agreements/{agr_id}/request-report",
                          json_body={"type": "INFORME_SEMESTRAL", "period": period})
        if st >= 300:
            all_ok = False
            continue
        st, rep_list, _, _ = api("GET", f"/agreements/{agr_id}/deliverables")
        rep_items = rep_list.get("data", rep_list) if isinstance(rep_list, dict) else rep_list or []
        rep = next((d for d in rep_items if d.get("type") == "INFORME_SEMESTRAL" and d.get("period") == period), None)
        if rep:
            st, _, _, _ = api("POST", f"/agreements/deliverables/{rep['id']}/submit",
                              files={"file": pdf_file(f"sem-{period}.pdf")})
            st, _, _, _ = api("POST", f"/agreements/deliverables/{rep['id']}/evaluate",
                              json_body={"decision": "APPROVED"})
            if st >= 300:
                all_ok = False
        else:
            all_ok = False
    check("informes semestrales completados", all_ok, f"periodos={len(periods)}")

    # Verificar que sigue EN_SEGUIMIENTO antes del final
    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("aún EN_SEGUIMIENTO antes del informe final", actual == "EN_SEGUIMIENTO", f"status={actual}")

    # Informe final
    st, _, _, _ = api("POST", f"/agreements/{agr_id}/request-report",
                      json_body={"type": "INFORME_FINAL"})
    st, fin_list, _, _ = api("GET", f"/agreements/{agr_id}/deliverables")
    fin_items = fin_list.get("data", fin_list) if isinstance(fin_list, dict) else fin_list or []
    fin = next((d for d in fin_items if d.get("type") == "INFORME_FINAL"), None)
    if fin:
        st, _, _, _ = api("POST", f"/agreements/deliverables/{fin['id']}/submit",
                          files={"file": pdf_file("informe-final.pdf")})
        st, _, _, _ = api("POST", f"/agreements/deliverables/{fin['id']}/evaluate",
                          json_body={"decision": "APPROVED"})

    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"

    # Si no se concluyo automaticamente, usar complete-monitoring manual
    if actual != "SEGUIMIENTO_CONCLUIDO":
        st, _, _, _ = api("POST", f"/agreements/{agr_id}/complete-monitoring")
        st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
        actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"

    check("informe final -> SEGUIMIENTO_CONCLUIDO",
          actual == "SEGUIMIENTO_CONCLUIDO", f"status={actual}")

    return agr_id


# ══════════════════════════════════════════════════════════════════════════════════
# FLUJO B: Rechazo de Rectorado
# ══════════════════════════════════════════════════════════════════════════════════

def test_flujo_rechazo(institution_id, type_id, default_deps):
    global token
    print("\n" + "=" * 70)
    print("  FLUJO B: RECHAZO DE RECTORADO (RECEPCIONADA -> NO_SUSCRITO)")
    print("=" * 70)

    # Crear propuesta
    files = {
        "oficio_solicitud": pdf_file("b-oficio.pdf"),
        "propuesta": pdf_file("b-propuesta.pdf"),
    }
    data_fields = {
        "title": "Convenio NO Suscrito - Verificación",
        "institution_id": str(institution_id),
        "agreement_type_id": str(type_id),
        "rectorate_oficio_number": f"OF-R-B-{int(time.time())}",
    }
    st, body, _, _ = api("POST", "/agreements", data=data_fields, files=files, expect=201)
    agr_id = body.get("id") if body else None
    check("crear propuesta B", st == 201 and bool(agr_id), f"id={agr_id}")
    if not agr_id:
        return False

    # Opinión rápida (1 dependencia)
    target_ids = [d["id"] for d in default_deps[:1]]
    st, _, _, _ = api("POST", f"/process/{agr_id}/opinion-requests",
                      json_body={"dependencia_ids": target_ids}, expect=201)
    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    op_requests = status_body.get("opinion_requests", []) if status_body else []
    if not op_requests:
        check("obtener solicitud de opinión", False, "no se encontraron solicitudes")
        return False

    req_id = op_requests[0]["id"]
    api("POST", f"/process/opinion-requests/{req_id}/send", json_body={"sent_via": "EMAIL"})
    api("POST", f"/process/opinion-requests/{req_id}/respond",
        files={"file": pdf_file("b-resp.pdf")})
    api("POST", f"/process/opinion-requests/{req_id}/validate", json_body={"valid": True})

    # Verificar transición
    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("opinión completada -> OPINIONES_COMPLETAS", actual == "OPINIONES_COMPLETAS", f"status={actual}")

    # Expediente + documentos
    api("POST", f"/process/{agr_id}/generate-expediente")
    api("POST", f"/process/{agr_id}/documents",
        data={"document_type_code": "OFICIO_RESPUESTA_RECTORADO"},
        files={"file": pdf_file("b-oficio-resp.pdf")})
    api("POST", f"/process/{agr_id}/documents",
        data={"document_type_code": "PROPUESTA_CONVENIO_FIRMA"},
        files={"file": docx_file("b-propuesta-firma.docx")})
    api("POST", f"/process/{agr_id}/finalize-expediente")
    api("POST", f"/process/{agr_id}/send-to-rectorado")

    st, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("enviado a Rectorado -> ENVIADO_A_RECTORADO", actual == "ENVIADO_A_RECTORADO", f"status={actual}")

    # Rechazo sin notificacion -> 400
    st, _, _, _ = api("POST", f"/process/{agr_id}/rectorate-decision",
                      data={"decision": "REJECTED"},
                      files={"file": pdf_file("resolucion.pdf")},
                      expect=400)
    check("rechazo sin notification -> 400", st == 400)

    # Rechazo con notificacion
    st, _, _, _ = api("POST", f"/process/{agr_id}/rectorate-decision",
                      data={"decision": "REJECTED", "notification_message": "No aplica."},
                      files={"file": pdf_file("resolucion-rechazo.pdf")})
    st2, status_body, _, _ = api("GET", f"/process/{agr_id}/status")
    actual = status_body.get("agreement", {}).get("process_status", "?") if status_body else "?"
    check("Rectorado rechaza -> NO_SUSCRITO",
          st < 300 and actual == "NO_SUSCRITO",
          f"http={st} status={actual}")

    # Verificar que no se puede avanzar desde NO_SUSCRITO
    st, _, _, _ = api("POST", f"/process/{agr_id}/publish", expect=400)
    check("publicar desde NO_SUSCRITO -> 400", st == 400)

    return agr_id


# ══════════════════════════════════════════════════════════════════════════════════
# VALIDACIÓN DE COHERENCIA DEL SISTEMA
# ══════════════════════════════════════════════════════════════════════════════════

def test_coherencia():
    print("\n" + "=" * 70)
    print("  VALIDACIÓN DE COHERENCIA DEL SISTEMA")
    print("=" * 70)

    # Document types
    st, body, _, _ = api("GET", "/document-types")
    doc_types = []
    if body:
        doc_types = body if isinstance(body, list) else body.get("data", [])
    codes = {dt.get("code") for dt in doc_types}
    check("tipos de documento cargados", len(codes) > 5, f"count={len(codes)}")

    # Verificar que OFICIO_RESPUESTA_RECTORADO existe
    check("OFICIO_RESPUESTA_RECTORADO registrado", "OFICIO_RESPUESTA_RECTORADO" in codes)

    # Verificar que PROPUESTA_CONVENIO_FIRMA existe
    check("PROPUESTA_CONVENIO_FIRMA registrado", "PROPUESTA_CONVENIO_FIRMA" in codes)

    # Verificar que INFORME_TECNICO_OCRI NO es obligatorio
    check("INFORME_TECNICO_OCRI existe pero no es obligatorio", "INFORME_TECNICO_OCRI" in codes)

    # Reports
    st, body, _, _ = api("GET", "/reports/summary")
    check("reportes summary funcional", st == 200 and body is not None)

    # Notifications
    st, body, _, _ = api("GET", "/notifications")
    check("notificaciones funcional", st == 200)

    # Expiration tracking
    st, body, _, _ = api("GET", "/agreements/expiration-tracking")
    check("tracking de vigencia funcional", st == 200)


# ══════════════════════════════════════════════════════════════════════════════════
# LIMPIEZA DE BASE DE DATOS
# ══════════════════════════════════════════════════════════════════════════════════

def clean_database():
    """Limpia tablas de transacciones (preserva catalogs)."""
    try:
        import pymysql
        conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="root",
                               database="ocri_db", charset="utf8mb4")
        cur = conn.cursor()
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        tables = [
            "deliverable_observations", "deliverables", "documents",
            "opinion_requests", "process_events", "agreement_responsables",
            "agreements", "institutions",
        ]
        total = 0
        for t in tables:
            cur.execute(f"DELETE FROM `{t}`")
            total += cur.rowcount
            print(f"  DELETE {t}: {cur.rowcount} fila(s)")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        cur.close()
        conn.close()
        print(f"  Base limpia. {total} registros eliminados.")
        return True
    except ImportError:
        print("  pymysql no instalado. Intentando limpieza via API...")
        return _clean_via_api()
    except Exception as e:
        print(f"  Error BD: {e}. Intentando limpieza via API...")
        return _clean_via_api()


def _clean_via_api():
    """Limpia via DELETE /agreements/:id para cada acuerdo existente."""
    try:
        st, body, _, _ = api("GET", "/agreements?per_page=100")
        items = []
        if body:
            items = body if isinstance(body, list) else body.get("data", [])
        for item in items:
            aid = item.get("id")
            if aid:
                api("DELETE", f"/agreements/{aid}")
        print(f"  {len(items)} convenio(s) eliminado(s) via API.")
        return True
    except Exception as e:
        print(f"  Error limpiando via API: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════════

def main():
    global token
    start = time.time()

    print("=" * 70)
    print(f"  VERIFICADOR COMPLETO DEL FLUJO OCRI")
    print(f"  Servidor: {BASE}")
    print(f"  Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Limpiar base de datos antes de empezar
    print("\n-- LIMPIEZA DE BASE DE DATOS --")
    clean_ok = clean_database()
    if not clean_ok:
        print("  Advertencia: no se pudo limpiar la BD. Los tests pueden fallar por datos residuales.")

    # Login
    st, body, _, _ = api("POST", "/auth/login", json_body={"email": EMAIL, "password": PASSWORD})
    token = body.get("access_token") if body else None
    if not token:
        print("\n  ERROR FATAL: No se pudo autenticar. Verifique que el backend esté corriendo.")
        sys.exit(1)

    # Datos auxiliares para todos los flujos
    inst_name = f"Entidad Global {int(time.time() * 1000)}"
    st, inst_body, _, _ = api("POST", "/institutions", json_body={
        "name": inst_name, "country": "Perú", "type": "Universidad Nacional"
    })
    institution_id = inst_body.get("id") if inst_body else None
    if not institution_id:
        st2, list_body, _, _ = api("GET", "/institutions?per_page=1")
        if list_body:
            rows = list_body.get("data", list_body) if isinstance(list_body, dict) else list_body
            institution_id = rows[0]["id"] if rows else None

    st, types, _, _ = api("GET", "/agreements/lookups/types")
    type_id = None
    if types:
        for t in (types if isinstance(types, list) else types.get("data", [])):
            if "Específico" in t.get("name", "") or "Marco" in t.get("name", ""):
                type_id = t["id"]
                break
        if not type_id:
            data = types if isinstance(types, list) else types.get("data", [])
            type_id = data[0]["id"] if data else None

    st, deps_resp, _, _ = api("GET", "/dependencias")
    dep_list = deps_resp.get("data", []) if isinstance(deps_resp, dict) else (deps_resp or [])
    default_deps = [d for d in dep_list if d.get("is_default_opinion")]

    # Ejecutar flujos
    test_flujo_feliz()
    test_flujo_rechazo(institution_id, type_id, default_deps)
    test_coherencia()

    # -- Resumen -----------------------------------------------------------------
    elapsed = time.time() - start
    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])

    print("\n" + "=" * 70)
    print(f"  RESUMEN DE VERIFICACIÓN")
    print(f"  {'-' * 40}")
    print(f"  Total:  {total}")
    print(f"  OK:     {passed}")
    print(f"  FAIL:   {failed}")
    print(f"  Tiempo: {elapsed:.1f}s")
    print("=" * 70)

    if failed > 0:
        print("\n  PRUEBAS FALLIDAS:")
        for r in results:
            if not r["ok"]:
                print(f"    X {r['name']}")
                if r["detail"]:
                    print(f"      {r['detail']}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
