import { escapeHtml } from '../process/oficio-html';

export interface SolicitudAssets {
  logoIzq: string;
  logoDer: string;
  firmaSello: string;
}

export type SolicitudType =
  | 'PLAN_DE_TRABAJO'
  | 'INFORME_SEMESTRAL'
  | 'INFORME_FINAL';

/**
 * Construye el cuerpo HTML del oficio de solicitud de un entregable de la
 * Etapa 3 (Plan de Trabajo o Informe) para el renderizado automático con el
 * mismo motor (html-pdf-lite) y la misma plantilla que los oficios de opinión.
 * El documento nace autogenerado: número de oficio, destinatario (responsable
 * de la contraparte o institución) y cuerpo se completan con los datos del
 * convenio sin intervención manual.
 */
export function buildSolicitudHtml(params: {
  assets: SolicitudAssets;
  title: string;
  institutionName: string;
  responsableName?: string;
  responsableRole?: string;
  tramiteCode: string;
  type: SolicitudType;
  period?: string;
  oficioNumber: string;
}): string {
  const {
    assets,
    title,
    institutionName,
    responsableName,
    responsableRole,
    tramiteCode,
    type,
    period,
    oficioNumber,
  } = params;

  const fecha = new Date().toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const label =
    type === 'PLAN_DE_TRABAJO'
      ? 'Plan de Trabajo'
      : type === 'INFORME_SEMESTRAL'
        ? 'Informe Semestral'
        : 'Informe Final';

  const asunto =
    type === 'PLAN_DE_TRABAJO'
      ? 'SOLICITUD DE PLAN DE TRABAJO'
      : type === 'INFORME_SEMESTRAL'
        ? `SOLICITUD DE INFORME SEMESTRAL${period ? ` (${period})` : ''}`
        : 'SOLICITUD DE INFORME FINAL';

  const solicitud =
    type === 'PLAN_DE_TRABAJO'
      ? `la elaboraci&oacute;n y remisi&oacute;n del <strong>Plan de Trabajo</strong> a ejecutarse durante el periodo de vigencia del convenio <strong>${escapeHtml(title)}</strong>`
      : type === 'INFORME_SEMESTRAL'
        ? `la elaboraci&oacute;n y remisi&oacute;n del <strong>Informe Semestral</strong>${period ? ` correspondiente al periodo <strong>${escapeHtml(period)}</strong>` : ''} que reporte el avance de la ejecuci&oacute;n del convenio <strong>${escapeHtml(title)}</strong>`
        : `la elaboraci&oacute;n y remisi&oacute;n del <strong>Informe Final</strong> de la ejecuci&oacute;n del convenio <strong>${escapeHtml(title)}</strong>`;

  const destinatarioNombre =
    responsableName || institutionName || 'Responsable(s) del convenio';
  const destinatarioRol =
    responsableRole || institutionName || 'Instituci&oacute;n contraparte';

  const img = (uri: string, alt: string) =>
    uri ? `<img src="${uri}" alt="${alt}"/>` : '';

  return `
    <div contenteditable="false">
      <div class="header-table">
        <div class="header-logo-left">${img(assets.logoIzq, 'Logo UNCP')}</div>
        <div class="header-text">
          <p class="univ-name">UNIVERSIDAD NACIONAL DEL CENTRO DEL PERU</p>
          <p class="office-name">OFICINA DE COOPERACION Y RELACIONES INTERNACIONALES</p>
        </div>
        <div class="header-logo-right">${img(assets.logoDer, 'Logo OCRI')}</div>
      </div>
      <div class="epigraph">
        "A&ntilde;o de la Recuperaci&oacute;n y Consolidaci&oacute;n de la Econom&iacute;a Peruana"
      </div>
    </div>
    <div class="doc-date">Huancayo, ${fecha}</div>
    <div class="doc-number">OFICIO N&deg; ${escapeHtml(oficioNumber)}</div>
    <div class="addressee">
      <p><strong>${escapeHtml(destinatarioNombre)}</strong></p>
      <p class="role">${escapeHtml(destinatarioRol)}</p>
      <p><br><u>Presente</u>.</p>
    </div>
    <div class="subject-line">
      <div class="subject-label">ASUNTO:</div>
      <div class="subject-content">${asunto}</div>
    </div>
    <div class="subject-line">
      <div class="subject-label">Referencia:</div>
      <div class="subject-content">Tr&aacute;mite ${escapeHtml(tramiteCode)} - ${label}</div>
    </div>
    <div class="body-text">
      <p>Luego de un atento y cordial saludo me dirijo a usted, a fin de solicitarle ${solicitud}, en el marco de la fase de seguimiento del convenio.</p>
      <p>Se adjunta la documentaci&oacute;n pertinente para su revisi&oacute;n. Agradeceremos remitir el documento a trav&eacute;s de los canales de coordinaci&oacute;n institucional dentro del plazo establecido.</p>
    </div>
    <div class="closing">
      Sin otro particular, propicio la ocasi&oacute;n para expresarle las muestras de mi consideraci&oacute;n y estima personal.
    </div>
    <div class="signature-atentamente">Atentamente,</div>
    <div class="signature-section" contenteditable="false">
      <div class="signature-box">
        ${assets.firmaSello ? `<div class="signature-img">${img(assets.firmaSello, 'Firma y sello')}</div>` : ''}
        <div class="signature-line">
          <p class="signature-name">ANA MARIA HUACAYCHUCO RUIZ</p>
          <p class="signature-title">Jefe de Cooperaci&oacute;n y Relaciones Internacionales</p>
        </div>
      </div>
    </div>
    <div class="footer" contenteditable="false">
      c.c. Archivo
    </div>
  `;
}