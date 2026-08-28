import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderPdfFromHtml } from 'html-pdf-lite';
import { PNG } from 'pngjs';

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

    let r = 0, g = 0, b = 0, a = 0;
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
    directedTo?: string,
  ): Promise<string> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([612, 792]);
    const { width } = page.getSize();

    let y = 720;

    page.drawText('UNIVERSIDAD NACIONAL DEL CALLAO', {
      x: width / 2 - fontBold.widthOfTextAtSize('UNIVERSIDAD NACIONAL DEL CALLAO', 14) / 2,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.11, 0.35, 0.25),
    });
    y -= 20;
    page.drawText('Oficina de Coordinación de Relaciones Interinstitucionales - OCRI', {
      x: width / 2 - font.widthOfTextAtSize('Oficina de Coordinación de Relaciones Interinstitucionales - OCRI', 10) / 2,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
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
    page.drawText(`Lima, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
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
      `(OCRI) de la Universidad Nacional del Callao solicita a usted emitir su opinión`,
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
    const filename = `oficio-solicitud-${oficioNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const outputPath = path.resolve('uploads', filename);
    await fs.writeFile(outputPath, mergedBytes);

    this.logger.log(`Oficio de solicitud generado: ${filename}`);

    return filename;
  }

  /**
   * Fusiona todos los archivos PDF del convenio en un solo PDF (Expediente Técnico),
   * ordenados cronológicamente (del más antiguo al más reciente) según su fecha de
   * creación/emisión. Incluye los documentos de origen, dictamen, oficios, respuestas
   * de opinión de dependencias y cualquier otro documento del proceso.
   * Retorna la ruta relativa del archivo generado.
   */
  async mergeOpinionResponses(agreementId: number): Promise<string> {
    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        document_types: { select: { code: true } },
        opinion_requests: { select: { response_date: true } },
      },
    });

    const pdfDocs = documents
      .filter((d) => d.extension === 'pdf')
      .filter((d) => d.document_types?.code !== 'EXPEDIENTE_TECNICO');

    if (pdfDocs.length === 0) {
      throw new Error(
        'No hay documentos PDF para fusionar en el expediente técnico.',
      );
    }

    pdfDocs.sort((a, b) => {
      const dateA = a.opinion_requests?.response_date
        ? new Date(a.opinion_requests.response_date).getTime()
        : a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.opinion_requests?.response_date
        ? new Date(b.opinion_requests.response_date).getTime()
        : b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    const mergedPdf = await PDFDocument.create();

    for (const doc of pdfDocs) {
      const filePath = path.resolve('uploads', doc.file_path);
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
    const filename = 'Expediente-tecnico.pdf';
    const outputPath = path.resolve('uploads', filename);
    await fs.writeFile(outputPath, mergedBytes);

    this.logger.log(
      `Expediente técnico generado: ${filename} (${pdfDocs.length} documentos PDF fusionados, ordenados cronológicamente)`,
    );

    return filename;
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
   * Genera el PDF del oficio de solicitud de opinión combinando la plantilla
   * (estilos + contenedor A4) con el HTML editable recibido del frontend.
   * Los márgenes de página se dejan en 0 para que la vista previa del editor
   * y el PDF resultante sean idénticos (el espaciado lo aporta `.document`).
   * Usa `html-pdf-lite` (sin Chromium) y escribe el archivo en `uploads/`.
   * Retorna el nombre de archivo generado.
   */
  async renderOficioOpinionPdf(bodyHtml: string): Promise<string> {
    const template = await this.readOficioOpinionTemplate();
    const fullHtml = template.replace('{{CUERPO}}', bodyHtml);

    const pdfBuffer = await renderPdfFromHtml(fullHtml, {
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const filename =
      'oficio-solicitud-' +
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      '.pdf';
    const outputPath = path.resolve('uploads', filename);
    await fs.writeFile(outputPath, pdfBuffer);

    this.logger.log(`Oficio de solicitud de opinión generado: ${filename}`);

    return filename;
  }
}
