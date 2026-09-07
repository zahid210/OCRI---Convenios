import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { join } from 'path';
import { renderPdfFromHtml } from 'html-pdf-lite';
import { PNG } from 'pngjs';
import {
  absUploadPath,
  agreementDir,
  opinionDir,
  ensureDir,
} from './uploads.config';

/**
 * Normaliza el número de oficio al formato estándar `045-2026-OCRI-UNCP`.
 * - Elimina prefijos comunes ("OFICIO ", "Nº", "N°", "N.").
 * - Elimina sufijos institucionales ya presentes ("-OCRI-UNCP", "-OCRI", "-UNCP")
 *   para evitar duplicados.
 * - Agrega el año actual (ej. "-2026") si el número no lo incluye.
 * - Garantiza el sufijo "-OCRI-UNCP" al final.
 * Retorna el número normalizado completo (sin "OFICIO Nº" ni ".pdf").
 */
export function normalizeOficioNumber(raw?: string): string {
  const noPrefix = (raw ?? '')
    .trim()
    .replace(/^OFICIO\s+/i, '')
    .replace(/^[Nn]\s*[º°]?\s*[-.:]?\s*/, '')
    .trim();
  const noSuffix = noPrefix
    .replace(/-OCRI-UNCP$/i, '')
    .replace(/-OCRI$/i, '')
    .replace(/-UNCP$/i, '')
    .replace(/[^\w.-]/g, '_');

  const year = new Date().getFullYear();
  let number = noSuffix || '000';
  if (!/-\d{4}$/.test(number)) {
    number = `${number}-${year}`;
  }
  if (!/OCRI-UNCP$/i.test(number)) {
    number = `${number}-OCRI-UNCP`;
  }
  return number;
}

/**
 * Redimensiona un PNG (RGBA) a un ancho máximo dado usando interpolación
 * bilineal con premultiplicación alfa (evita halos oscuros en bordes).
 * El documento muestra los logos a ~75px, así que 320px cubren impresión a
 * 300dpi sin necesidad de enviar los PNG originales (que pesan ~1.5MB en
 * base64 y causaban "413 Request Entity Too Large").
 */
function resizePng(png: PNG, maxWidth: number): PNG {
  const sw = png.width;
  const sh = png.height;
  const outW = Math.max(1, Math.round((png.width * maxWidth) / png.width));
  const outH = Math.max(1, Math.round((png.height * maxWidth) / png.width));
  const out = new PNG({ width: outW, height: outH });
  if (outW * outH === 0) return out;

  const src = png.data;
  const scaleX = sw / outW;
  const scaleY = sh / outH;

  const sample = (px: number, py: number): [number, number, number, number] => {
    const x0 = Math.max(0, Math.floor(px));
    const y0 = Math.max(0, Math.floor(py));
    const x1 = Math.min(sw - 1, x0 + 1);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fx = px - x0;
    const fy = py - y0;
    const i = (yy: number, xx: number) => (yy * sw + xx) * 4;

    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    const add = (idx: number, w: number) => {
      const al = src[idx + 3];
      r += src[idx] * al * w;
      g += src[idx + 1] * al * w;
      b += src[idx + 2] * al * w;
      a += al * w;
    };
    add(i(y0, x0), (1 - fx) * (1 - fy));
    add(i(y0, x1), fx * (1 - fy));
    add(i(y1, x0), (1 - fx) * fy);
    add(i(y1, x1), fx * fy);

    return a > 0
      ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a)]
      : [0, 0, 0, 0];
  };

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const px = (x + 0.5) * scaleX - 0.5;
      const py = (y + 0.5) * scaleY - 0.5;
      const [r, g, b, a] = sample(px, py);
      const o = (y * outW + x) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = a;
    }
  }
  return out;
}

@Injectable()
export class PdfMergerService {
  private readonly logger = new Logger(PdfMergerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un PDF de "Oficio de Solicitud de Opinión" para una dependencia.
   * Retorna la ruta relativa del archivo generado.
   */
  async generateOficioSolicitud(
    agreementId: number,
    dependenciaName: string,
    oficioNumber: string,
    tramiteCode: string,
    directedTo?: string,
    createdAt?: Date | string | null,
  ): Promise<string> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([612, 792]);
    const { width } = page.getSize();

    let y = 720;

    page.drawText('UNIVERSIDAD NACIONAL DEL CENTRO DEL PERU', {
      x:
        width / 2 -
        fontBold.widthOfTextAtSize(
          'UNIVERSIDAD NACIONAL DEL CENTRO DEL PERU',
          14,
        ) /
          2,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.11, 0.35, 0.25),
    });
    y -= 20;
    page.drawText(
      'Oficina de Coordinación de Relaciones Interinstitucionales - OCRI',
      {
        x:
          width / 2 -
          font.widthOfTextAtSize(
            'Oficina de Coordinación de Relaciones Interinstitucionales - OCRI',
            10,
          ) /
            2,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      },
    );
    y -= 10;
    page.drawText('─'.repeat(70), {
      x: 60,
      y,
      size: 8,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 30;

    page.drawText(`Oficio N° ${oficioNumber}`, {
      x: 60,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 18;
    page.drawText(
      `Lima, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      {
        x: 60,
        y,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      },
    );
    y -= 30;

    const destLine = directedTo
      ? `Señor(a) ${directedTo}`
      : `Señor(a) Responsable de ${dependenciaName}`;
    page.drawText(destLine, {
      x: 60,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 15;
    page.drawText(dependenciaName, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 30;

    page.drawText('ASUNTO: Solicitud de Opinión Técnica', {
      x: 60,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 30;

    const bodyLines = [
      `Por medio del presente, la Oficina de Coordinación de Relaciones Interinstitucionales`,
      `(OCRI) de la Universidad Nacional del Centro del Perú solicita a usted emitir su opinión`,
      `técnica respecto al convenio de cooperación interinstitucional que se está`,
      `evaluando.`,
      '',
      `Se adjunta la documentación pertinente para su revisión. Agradeceremos`,
      `remitir su respuesta en el plazo establecido.`,
      '',
      `Sin otro particular, se despide cordialmente.`,
    ];

    for (const line of bodyLines) {
      if (line === '') {
        y -= 12;
        continue;
      }
      page.drawText(line, {
        x: 60,
        y,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 15;
    }

    const mergedBytes = await pdf.save();
    const filename = `oficio-solicitud-${dependenciaName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const dir = absUploadPath(
      opinionDir(tramiteCode, createdAt ?? null, dependenciaName),
    );
    ensureDir(dir);
    const outputPath = join(dir, filename);
    await fs.writeFile(outputPath, mergedBytes);
    const relPath = `${opinionDir(tramiteCode, createdAt ?? null, dependenciaName)}/${filename}`;
    this.logger.log(`Oficio de solicitud generado: ${relPath}`);
    return relPath;
  }

  /**
   * Fusiona todos los archivos PDF del convenio en un solo PDF (Expediente
   * Técnico) con todos los documentos procesados hasta ese punto del trámite.
   * Las opiniones se agrupan en parejas: cada pareja está formada por el
   * Oficio de Solicitud de Opinión y el Oficio de Respuesta de Opinión de una
   * misma dependencia (unidos por `opinion_request_id`); dentro de cada pareja
   * va primero la Respuesta (la última en registrarse) y después su Solicitud,
   * y las parejas se ordenan de la más reciente a la más antigua (descendente,
   * por la fecha de la Respuesta). El PDF abre con estas parejas y cierra con
   * los documentos que no son de opinión (Dictamen, Documentos de Origen y
   * demás), en orden cronológico ascendente.
   * Retorna la ruta relativa del archivo generado.
   */
  async mergeOpinionResponses(
    agreementId: number,
    tramiteCode: string,
    createdAt?: Date | string | null,
  ): Promise<string> {
    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        document_types: { select: { code: true } },
        opinion_requests: { select: { response_date: true } },
      },
    });

    const pdfDocs = documents
      .filter(
        (d) => (d.extension ?? '').replace(/^\./, '').toLowerCase() === 'pdf',
      )
      .filter((d) => d.document_types?.code !== 'EXPEDIENTE_TECNICO');

    if (pdfDocs.length === 0) {
      throw new BadRequestException(
        'No hay documentos PDF para fusionar en el expediente técnico.',
      );
    }

    const timeOf = (d?: (typeof documents)[number] | null) =>
      d?.created_at ? new Date(d.created_at).getTime() : 0;

    // Separamos los documentos de opinión (solicitudes y respuestas, que
    // comparten opinion_request_id) de los que no pertenecen a una opinión.
    const opinionDocs = pdfDocs.filter(
      (d) =>
        d.opinion_request_id != null &&
        (d.document_types?.code === 'OFICIO_SOLICITUD_OPINION' ||
          d.document_types?.code === 'OFICIO_RESPUESTA_OPINION'),
    );
    const nonOpinionDocs = pdfDocs.filter((d) => !opinionDocs.includes(d));

    // Agrupamos en parejas por opinion_request_id.
    const pairs = new Map<
      bigint,
      {
        respuesta?: (typeof opinionDocs)[number];
        solicitud?: (typeof opinionDocs)[number];
      }
    >();
    for (const doc of opinionDocs) {
      const id = doc.opinion_request_id;
      if (id == null) continue;
      const pair = pairs.get(id) ?? {};
      if (doc.document_types?.code === 'OFICIO_RESPUESTA_OPINION') {
        pair.respuesta = doc;
      } else {
        pair.solicitud = doc;
      }
      pairs.set(id, pair);
    }

    // Ordenamos las parejas de la más reciente a la más antigua según la fecha
    // de la Respuesta (la última en registrarse); si no hay respuesta, se usa
    // la Solicitud y, en caso de empate, el created_at más reciente de la pareja.
    const orderedPairs: Array<(typeof opinionDocs)[number]> = [];
    const sortedPairs = [...pairs.values()].sort((pairA, pairB) => {
      const dateA = timeOf(pairA.respuesta) || timeOf(pairA.solicitud);
      const dateB = timeOf(pairB.respuesta) || timeOf(pairB.solicitud);
      if (dateA !== dateB) return dateB - dateA;
      return (
        Math.max(timeOf(pairA.respuesta), timeOf(pairA.solicitud)) -
        Math.max(timeOf(pairB.respuesta), timeOf(pairB.solicitud))
      );
    });
    for (const pair of sortedPairs) {
      if (pair.respuesta) orderedPairs.push(pair.respuesta);
      if (pair.solicitud) orderedPairs.push(pair.solicitud);
    }

    // Los documentos sin opinión (Dictamen, Documentos de Origen y demás
    // documentos del trámite) van al final, en orden cronológico ascendente
    // (aunque se suban primero en el sistema, se colocan al cierre del
    // expediente). El Dictamen se crea antes que los Documentos de Origen.
    nonOpinionDocs.sort((a, b) => {
      const diff = timeOf(a) - timeOf(b);
      if (diff !== 0) return diff;
      return Number(a.id) - Number(b.id);
    });

    // El PDF abre con las parejas de opinión (las más recientes primero) y
    // cierra con el Dictamen y los Documentos de Origen.
    const orderedDocs = [...orderedPairs, ...nonOpinionDocs];

    const mergedPdf = await PDFDocument.create();

    for (const doc of orderedDocs) {
      const filePath = absUploadPath(doc.file_path);
      try {
        const pdfBytes = await fs.readFile(filePath);
        const srcDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(
          srcDoc,
          srcDoc.getPageIndices(),
        );
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo leer el PDF ${filePath} (doc #${doc.id}): ${err}`,
        );
      }
    }

    const mergedBytes = await mergedPdf.save();
    const filename = 'expediente-tecnico.pdf';
    const subdir = agreementDir(tramiteCode, createdAt ?? null);
    const dir = absUploadPath(subdir);
    ensureDir(dir);
    const outputPath = join(dir, filename);
    await fs.writeFile(outputPath, mergedBytes);

    this.logger.log(
      `Expediente técnico generado: ${subdir}/${filename} (${orderedDocs.length} documentos PDF fusionados, en parejas por opinión)`,
    );

    return `${subdir}/${filename}`;
  }

  /**
   * Carpeta donde el usuario copia manualmente los recursos gráficos del
   * oficio: logos institucionales (fondo transparente), firma y sello.
   */
  private readonly assetsDir = path.resolve('uploads/templates/assets');

  /** Nombres de archivo esperados en `assets/` (PNG con fondo transparente). */
  private readonly assets = {
    logoIzq: 'logo-uncp.png',
    logoDer: 'logo-ocri.png',
    firmaSello: 'sello-firma.png',
  };

  /** Ancho máximo (px) al que se redimensionan los recursos antes de incrustarlos. */
  private static readonly ASSET_MAX_WIDTH = 320;

  /** Cache de data URIs optimizadas por archivo (clave: nombre:mtime:size). */
  private readonly assetCache = new Map<string, string>();

  /**
   * Lee un recurso gráfico de `uploads/templates/assets/` y lo devuelve como
   * `data:` URI (base64) redimensionado a `ASSET_MAX_WIDTH` px para no inflar
   * el HTML/PDF (los PNG originales pesan cientos de KB). Si el archivo no
   * existe o no es un PNG válido, devuelve una cadena vacía / el archivo tal
   * cual. Los resultados se cachean en memoria según fecha y tamaño.
   */
  private async readAssetDataUri(filename: string): Promise<string> {
    try {
      const filePath = path.join(this.assetsDir, filename);
      const stat = await fs.stat(filePath);
      if (stat.size === 0) return '';

      const cacheKey = `${filename}:${stat.mtimeMs}:${stat.size}`;
      const cached = this.assetCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const buf = await fs.readFile(filePath);
      const dataUri = this.optimizePngToDataUri(buf);
      this.assetCache.set(cacheKey, dataUri);
      return dataUri;
    } catch {
      return '';
    }
  }

  /** Convierte el buffer de un PNG en data URI, optimizándolo si es grande. */
  private optimizePngToDataUri(buf: Buffer): string {
    const toDataUri = (b: Buffer) =>
      `data:image/png;base64,${b.toString('base64')}`;
    try {
      const png = PNG.sync.read(buf);
      const max = PdfMergerService.ASSET_MAX_WIDTH;
      if (png.width <= max && png.height <= max) {
        return toDataUri(buf);
      }
      const resized = resizePng(png, max);
      return toDataUri(PNG.sync.write(resized));
    } catch {
      // No es un PNG decodificable: se usa el archivo tal cual.
      return toDataUri(buf);
    }
  }

  /**
   * Devuelve los recursos gráficos del oficio (logos, firma y sello) como
   * `data:` URIs base64 para incrustarlos dentro del HTML editable que el
   * frontend previsualiza y edita. Las claves sin archivo quedan vacías.
   */
  async getOficioOpinionAssets(): Promise<{
    logoIzq: string;
    logoDer: string;
  }> {
    const [logoIzq, logoDer] = await Promise.all([
      this.readAssetDataUri(this.assets.logoIzq),
      this.readAssetDataUri(this.assets.logoDer),
    ]);
    return { logoIzq, logoDer };
  }

  /**
   * Devuelve la firma y el sello ya combinados en una única imagen
   * (`sello-firma.png`) como `data:` URI. Se usa una sola imagen porque el motor
   * del PDF no puede superponer dos <img> con CSS (`position`/`float`/`z-index`
   * no están implementados); la combinación visual se hace directamente en el
   * asset. Así la vista previa y el PDF, que comparten el mismo `<img src=...>`,
   * se ven idénticos.
   */
  async getOficioSignatureStamp(): Promise<string> {
    return this.readAssetDataUri(this.assets.firmaSello);
  }

  /**
   * Extrae el contenido CSS de la plantilla del oficio (la sección dentro de
   * `<style>`). El frontend lo inyecta en la vista previa para que el
   * documento editable se vea exactamente igual que el PDF generado.
   */
  async getOficioOpinionTemplateCss(): Promise<string> {
    const template = await this.readOficioOpinionTemplate();
    const match = template.match(/<style>([\s\S]*?)<\/style>/);
    return match ? match[1].trim() : '';
  }

  /**
   * Lee la plantilla HTML del oficio de solicitud de opinión que se encuentra
   * en la carpeta de plantillas del backend (`uploads/templates/`). La
   * plantilla aporta los estilos y el contenedor A4 (`{{CUERPO}}`) donde se
   * inserta el documento editable completo que llega del frontend.
   * Si el archivo no existe se usa una plantilla mínima de respaldo.
   */
  private async readOficioOpinionTemplate(): Promise<string> {
    const templatePath = path.resolve(
      'uploads/templates/plantilla-html-css.html',
    );
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch {
      this.logger.warn(
        'Plantilla de oficio no encontrada, usando plantilla de respaldo.',
      );
      return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
        <style>
          body{font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:12px;line-height:1.5;margin:0}
          .cuerpo p{margin:0 0 12px 0}
        </style></head><body>
        <div class="document">{{CUERPO}}</div>
      </body></html>`;
    }
  }

  /**
   * Vista previa en vivo del oficio: combina plantilla + HTML editable y
   * devuelve el PDF renderizado con el MISMO motor y los mismos márgenes que
   * `renderOficioOpinionPdf`, sin escribir ningún archivo. Así la vista previa
   * del editor es idéntica hoja a hoja al PDF final que se exporta.
   */
  async renderOficioOpinionPreview(bodyHtml: string): Promise<Buffer> {
    const template = await this.readOficioOpinionTemplate();
    const fullHtml = template.replace('{{CUERPO}}', bodyHtml);
    // 1mm = 72/25.4 pt. Los cuatro lados de la plantilla original: 30mm izq.
    const mmToPt = (mm: number) => (mm * 72) / 25.4;
    return renderPdfFromHtml(fullHtml, {
      margins: {
        top: mmToPt(25),
        right: mmToPt(25),
        bottom: mmToPt(25),
        left: mmToPt(30),
      },
    });
  }

  /**
   * Genera el PDF del oficio de solicitud de opinión combinando la plantilla
   * (estilos + contenedor A4) con el HTML editable recibido del frontend.
   * Los márgenes de página se fijan en los mismos valores que usaba el padding
   * del contenedor `.document` (30mm izquierda, 25mm resto) para que la vista
   * previa del editor y el PDF resultante sean idénticos en la primera hoja Y,
   * además, que todas las hojas siguientes repitan el mimso margen. Si los
   * márgenes de página fueran 0 y el padding viviera en `.document`, el motor
   * (html-pdf-lite) reiniciaría el cursor en (0,0) tras cortar la página y todo
   * el contenido que desborda a la hoja 2+ saldría pegado a la esquina sin
   * maquetar. Los valores deben ir en puntos (el motor no convierte mm).
   * Usa `html-pdf-lite` (sin Chromium) y escribe el archivo en `uploads/`.
   * Retorna el nombre de archivo generado.
   */
  async renderOficioOpinionPdf(
    bodyHtml: string,
    oficioNumber?: string,
    tramiteCode?: string,
    createdAt?: Date | string | null,
  ): Promise<string> {
    const template = await this.readOficioOpinionTemplate();
    const fullHtml = template.replace('{{CUERPO}}', bodyHtml);

    // 1mm = 72/25.4 pt. Los cuatro lados de la plantilla original: 30mm izq.
    const mmToPt = (mm: number) => (mm * 72) / 25.4;
    const pdfBuffer = await renderPdfFromHtml(fullHtml, {
      margins: {
        top: mmToPt(25),
        right: mmToPt(25),
        bottom: mmToPt(25),
        left: mmToPt(30),
      },
    });

    const filename = `${normalizeOficioNumber(oficioNumber)}.pdf`;
    const subdir = tramiteCode
      ? agreementDir(tramiteCode, createdAt ?? null)
      : '';
    const dir = subdir ? absUploadPath(subdir) : path.resolve('uploads');
    ensureDir(dir);
    const outputPath = join(dir, filename);
    await fs.writeFile(outputPath, pdfBuffer);

    const relPath = subdir ? `${subdir}/${filename}` : filename;
    this.logger.log(`Oficio de solicitud de opinión generado: ${relPath}`);

    return relPath;
  }
}
