import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

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
}
