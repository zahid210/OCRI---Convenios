import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

// noinspection HttpUrlsUsage
const ooxmlNs = 'http://schemas.openxmlformats.org';

export type CellValue = string | number | boolean | null | undefined;

export type CellTone =
  | 'default'
  | 'center'
  | 'right'
  | 'bold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export interface StyledCell {
  value: CellValue;
  tone?: CellTone;
}

export type RowCellInput = CellValue | StyledCell;

interface SheetCell {
  value: CellValue;
  styleIndex: number;
}

interface SheetRow {
  cells: SheetCell[];
  height?: number;
}

export interface SimpleWorksheet {
  readonly name: string;
  addTitleRow(title: string, subtitle?: string): void;
  addHeaderRow(headers: string[]): void;
  addDataRow(cells: RowCellInput[]): void;
  addDataRows(rows: RowCellInput[][]): void;
  addTotalRow(cells: RowCellInput[]): void;
  setColumnWidth(colIndex1Based: number, width: number): void;
}

/**
 * Índices de estilo en `xl/styles.xml` (`cellXfs`):
 *  0: Base general
 *  1: Banner de título institucional (fondo verde UNCP #094D37, texto blanco bold 13pt)
 *  2: Encabezado de tabla (fondo dorado institucional #C59B27, texto blanco bold 10.5pt, centrado vertical)
 *  3: Celda de datos par (fondo blanco, borde fino, texto izquierdo)
 *  4: Celda de datos impar / zebra (fondo #F8FAFC, borde fino, texto izquierdo)
 *  5: Celda de datos par centrada (fechas / códigos)
 *  6: Celda de datos impar centrada (fechas / códigos)
 *  7: Celda de datos par derecha (números / porcentajes, bold)
 *  8: Celda de datos impar derecha (números / porcentajes, bold)
 *  9: Fila de TOTAL (fondo #EDF7F3, borde superior/inferior verde #094D37, texto verde bold 11pt)
 * 10: Fila de TOTAL derecha (fondo #EDF7F3, borde superior/inferior verde #094D37, número bold 11pt)
 * 11: Badge Vigente / Éxito (fondo #DCFCE7, texto verde #166534 bold centrado)
 * 12: Badge Por Vencer / Alerta (fondo #FEF3C7, texto ámbar #92400E bold centrado)
 * 13: Badge Vencido / Peligro (fondo #FEE2E2, texto rojo #991B1B bold centrado)
 * 14: Badge Neutro / En Trámite (fondo #F1F5F9, texto gris #334155 bold centrado)
 * 15: Celda de datos par en negrita (expediente / métrica)
 * 16: Celda de datos impar en negrita (expediente / métrica)
 */
const STYLE_IDX = {
  TITLE: 1,
  HEADER: 2,
  EVEN_LEFT: 3,
  ODD_LEFT: 4,
  EVEN_CENTER: 5,
  ODD_CENTER: 6,
  EVEN_RIGHT: 7,
  ODD_RIGHT: 8,
  TOTAL_LEFT: 9,
  TOTAL_RIGHT: 10,
  BADGE_SUCCESS: 11,
  BADGE_WARNING: 12,
  BADGE_DANGER: 13,
  BADGE_NEUTRAL: 14,
  EVEN_BOLD: 15,
  ODD_BOLD: 16,
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(col1Based: number): string {
  let n = col1Based;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function isStyledCell(input: RowCellInput): input is StyledCell {
  return typeof input === 'object' && input !== null && 'value' in input;
}

function resolveDataStyle(
  tone: CellTone | undefined,
  isOdd: boolean,
  value: CellValue,
): number {
  if (tone === 'success') return STYLE_IDX.BADGE_SUCCESS;
  if (tone === 'warning') return STYLE_IDX.BADGE_WARNING;
  if (tone === 'danger') return STYLE_IDX.BADGE_DANGER;
  if (tone === 'neutral') return STYLE_IDX.BADGE_NEUTRAL;
  if (tone === 'bold') return isOdd ? STYLE_IDX.ODD_BOLD : STYLE_IDX.EVEN_BOLD;
  if (tone === 'center')
    return isOdd ? STYLE_IDX.ODD_CENTER : STYLE_IDX.EVEN_CENTER;
  if (tone === 'right' || typeof value === 'number') {
    return isOdd ? STYLE_IDX.ODD_RIGHT : STYLE_IDX.EVEN_RIGHT;
  }
  return isOdd ? STYLE_IDX.ODD_LEFT : STYLE_IDX.EVEN_LEFT;
}

class WorksheetBuilder implements SimpleWorksheet {
  readonly name: string;
  private readonly rows: SheetRow[] = [];
  private readonly colWidths = new Map<number, number>();
  private readonly autoColWidths = new Map<number, number>();
  private readonly titleRowIndices: number[] = [];
  private maxColumns = 1;
  private dataRowCounter = 0;

  constructor(name: string) {
    this.name = name;
  }

  private trackCellWidth(col1Based: number, value: CellValue): void {
    if (value === null || value === undefined) return;
    const len = String(value).length;
    const prev = this.autoColWidths.get(col1Based) ?? 12;
    if (len + 5 > prev) {
      this.autoColWidths.set(col1Based, Math.min(58, len + 5));
    }
  }

  addTitleRow(title: string, subtitle?: string): void {
    const fullTitle = subtitle ? `${title} — ${subtitle}` : title;
    this.rows.push({
      cells: [{ value: fullTitle, styleIndex: STYLE_IDX.TITLE }],
      height: 30,
    });
    this.titleRowIndices.push(this.rows.length);
  }

  addHeaderRow(headers: string[]): void {
    this.maxColumns = Math.max(this.maxColumns, headers.length);
    headers.forEach((h, idx) => this.trackCellWidth(idx + 1, h));
    this.rows.push({
      cells: headers.map((h) => ({ value: h, styleIndex: STYLE_IDX.HEADER })),
      height: 24,
    });
  }

  addDataRow(inputs: RowCellInput[]): void {
    const isOdd = this.dataRowCounter % 2 === 1;
    this.dataRowCounter += 1;
    this.maxColumns = Math.max(this.maxColumns, inputs.length);

    const cells: SheetCell[] = inputs.map((input, idx) => {
      const value = isStyledCell(input) ? input.value : input;
      const tone = isStyledCell(input) ? input.tone : undefined;
      this.trackCellWidth(idx + 1, value);
      return {
        value,
        styleIndex: resolveDataStyle(tone, isOdd, value),
      };
    });

    this.rows.push({
      cells,
      height: 20,
    });
  }

  addDataRows(rows: RowCellInput[][]): void {
    for (const r of rows) {
      this.addDataRow(r);
    }
  }

  addTotalRow(inputs: RowCellInput[]): void {
    this.maxColumns = Math.max(this.maxColumns, inputs.length);
    const cells: SheetCell[] = inputs.map((input, idx) => {
      const value = isStyledCell(input) ? input.value : input;
      const tone = isStyledCell(input) ? input.tone : undefined;
      this.trackCellWidth(idx + 1, value);
      const isRight =
        tone === 'right' ||
        typeof value === 'number' ||
        (typeof value === 'string' && value.endsWith('%'));
      return {
        value,
        styleIndex: isRight ? STYLE_IDX.TOTAL_RIGHT : STYLE_IDX.TOTAL_LEFT,
      };
    });

    this.rows.push({
      cells,
      height: 24,
    });
  }

  setColumnWidth(colIndex1Based: number, width: number): void {
    this.colWidths.set(colIndex1Based, width);
  }

  toXml(): string {
    const totalCols = Math.max(
      this.maxColumns,
      ...Array.from(this.colWidths.keys()),
      ...Array.from(this.autoColWidths.keys()),
    );

    const colsXmlParts: string[] = [];
    for (let c = 1; c <= totalCols; c += 1) {
      const w = this.colWidths.get(c) ?? this.autoColWidths.get(c) ?? 18;
      colsXmlParts.push(
        `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`,
      );
    }
    const colsXml =
      colsXmlParts.length > 0 ? `<cols>${colsXmlParts.join('')}</cols>` : '';

    // Rellenar celdas vacías en la fila de título para que el fondo se pinte en todo el rango combinado
    for (const titleRowIdx of this.titleRowIndices) {
      const row = this.rows[titleRowIdx - 1];
      if (row && row.cells.length < totalCols) {
        while (row.cells.length < totalCols) {
          row.cells.push({ value: '', styleIndex: STYLE_IDX.TITLE });
        }
      }
    }

    const rowsXml = this.rows
      .map((row, idx) => {
        const rNum = idx + 1;
        const htAttr =
          row.height !== undefined
            ? ` ht="${row.height}" customHeight="1"`
            : '';
        const cellsXml = row.cells
          .map((cellObj, cIdx) => {
            const ref = `${columnLetter(cIdx + 1)}${rNum}`;
            const sAttr =
              cellObj.styleIndex > 0 ? ` s="${cellObj.styleIndex}"` : '';
            const val = cellObj.value;
            if (val === null || val === undefined || val === '') {
              return `<c r="${ref}"${sAttr} t="inlineStr"><is><t></t></is></c>`;
            }
            if (typeof val === 'number' && Number.isFinite(val)) {
              return `<c r="${ref}"${sAttr}><v>${val}</v></c>`;
            }
            const text = typeof val === 'boolean' ? String(val) : String(val);
            return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rNum}"${htAttr}>${cellsXml}</row>`;
      })
      .join('');

    const lastColLetter = columnLetter(Math.max(2, totalCols));
    const merges = this.titleRowIndices.map(
      (rIdx) => `A${rIdx}:${lastColLetter}${rIdx}`,
    );
    const mergeXml =
      merges.length > 0
        ? `<mergeCells count="${merges.length}">${merges
            .map((ref) => `<mergeCell ref="${ref}"/>`)
            .join('')}</mergeCells>`
        : '';

    const sheetViewsXml =
      this.rows.length >= 2
        ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        : '';

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<worksheet xmlns="${ooxmlNs}/spreadsheetml/2006/main">`,
      sheetViewsXml,
      colsXml,
      `<sheetData>${rowsXml}</sheetData>`,
      mergeXml,
      '</worksheet>',
    ].join('');
  }
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZipArchive(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed = entry.data;
    const compressed = deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

export class SimpleWorkbook {
  private readonly sheets: WorksheetBuilder[] = [];

  addWorksheet(name: string): SimpleWorksheet {
    const sheet = new WorksheetBuilder(name);
    this.sheets.push(sheet);
    return sheet;
  }

  toBuffer(): Buffer {
    const contentTypes = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<Types xmlns="${ooxmlNs}/package/2006/content-types">`,
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      ...this.sheets.map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      ),
      '</Types>',
    ].join('');

    const rootRels = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<Relationships xmlns="${ooxmlNs}/package/2006/relationships">`,
      `<Relationship Id="rId1" Type="${ooxmlNs}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`,
      '</Relationships>',
    ].join('');

    const workbookXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<workbook xmlns="${ooxmlNs}/spreadsheetml/2006/main" xmlns:r="${ooxmlNs}/officeDocument/2006/relationships">`,
      '<sheets>',
      ...this.sheets.map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      ),
      '</sheets>',
      '</workbook>',
    ].join('');

    const workbookRels = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<Relationships xmlns="${ooxmlNs}/package/2006/relationships">`,
      ...this.sheets.map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${ooxmlNs}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      ),
      `<Relationship Id="rId${this.sheets.length + 1}" Type="${ooxmlNs}/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
      '</Relationships>',
    ].join('');

    const stylesXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<styleSheet xmlns="${ooxmlNs}/spreadsheetml/2006/main">`,
      // Fuentes (0..8)
      '<fonts count="9">',
      '<font><sz val="10"/><color rgb="FF1F2937"/><name val="Calibri"/></font>', // 0: datos normal
      '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>', // 1: título banner blanco
      '<font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>', // 2: header blanco
      '<font><b/><sz val="10"/><color rgb="FF1F2937"/><name val="Calibri"/></font>', // 3: datos bold
      '<font><b/><sz val="10.5"/><color rgb="FF094D37"/><name val="Calibri"/></font>', // 4: total verde institucional
      '<font><b/><sz val="10"/><color rgb="FF166534"/><name val="Calibri"/></font>', // 5: badge success (verde)
      '<font><b/><sz val="10"/><color rgb="FF92400E"/><name val="Calibri"/></font>', // 6: badge warning (ámbar)
      '<font><b/><sz val="10"/><color rgb="FF991B1B"/><name val="Calibri"/></font>', // 7: badge danger (rojo)
      '<font><b/><sz val="10"/><color rgb="FF334155"/><name val="Calibri"/></font>', // 8: badge neutral (gris)
      '</fonts>',
      // Rellenos (0..9) — 0 y 1 son obligatorios por estándar OpenXML
      '<fills count="10">',
      '<fill><patternFill patternType="none"/></fill>', // 0
      '<fill><patternFill patternType="gray125"/></fill>', // 1
      '<fill><patternFill patternType="solid"><fgColor rgb="FF094D37"/></patternFill></fill>', // 2: verde institucional UNCP (título)
      '<fill><patternFill patternType="solid"><fgColor rgb="FFC59B27"/></patternFill></fill>', // 3: dorado institucional UNCP (header)
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>', // 4: fila impar zebra
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEDF7F3"/></patternFill></fill>', // 5: fila total verde suave
      '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>', // 6: badge success
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>', // 7: badge warning
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>', // 8: badge danger
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>', // 9: badge neutral
      '</fills>',
      // Bordes (0..3)
      '<borders count="4">',
      '<border><left/><right/><top/><bottom/><diagonal/></border>', // 0: sin borde
      '<border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>', // 1: grilla fina de datos
      '<border><left style="thin"><color rgb="FFB0891E"/></left><right style="thin"><color rgb="FFB0891E"/></right><top style="medium"><color rgb="FF094D37"/></top><bottom style="medium"><color rgb="FF094D37"/></bottom><diagonal/></border>', // 2: header
      '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="medium"><color rgb="FF094D37"/></top><bottom style="double"><color rgb="FF094D37"/></bottom><diagonal/></border>', // 3: fila total
      '</borders>',
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      // Estilos de celda (0..16)
      '<cellXfs count="17">',
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', // 0: base
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>', // 1: TITLE
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 2: HEADER
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>', // 3: EVEN_LEFT
      '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>', // 4: ODD_LEFT
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 5: EVEN_CENTER
      '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 6: ODD_CENTER
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>', // 7: EVEN_RIGHT
      '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>', // 8: ODD_RIGHT
      '<xf numFmtId="0" fontId="4" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>', // 9: TOTAL_LEFT
      '<xf numFmtId="0" fontId="4" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>', // 10: TOTAL_RIGHT
      '<xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 11: BADGE_SUCCESS
      '<xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 12: BADGE_WARNING
      '<xf numFmtId="0" fontId="7" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 13: BADGE_DANGER
      '<xf numFmtId="0" fontId="8" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>', // 14: BADGE_NEUTRAL
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>', // 15: EVEN_BOLD
      '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>', // 16: ODD_BOLD
      '</cellXfs>',
      '</styleSheet>',
    ].join('');

    const entries: ZipEntry[] = [
      { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
      { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: Buffer.from(workbookRels, 'utf8'),
      },
      { name: 'xl/styles.xml', data: Buffer.from(stylesXml, 'utf8') },
      ...this.sheets.map((s, i) => ({
        name: `xl/worksheets/sheet${i + 1}.xml`,
        data: Buffer.from(s.toXml(), 'utf8'),
      })),
    ];

    return buildZipArchive(entries);
  }
}

export interface ParsedWorksheet {
  name: string;
  getCellText(row1Based: number, col1Based: number): string;
}

export function readXlsxBuffer(zipBuffer: Buffer): {
  sheetNames: string[];
  getWorksheet(name: string): ParsedWorksheet | undefined;
} {
  const files = new Map<string, string>();
  let pos = 0;
  while (pos + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(pos);
    if (sig !== 0x04034b50) break;
    const method = zipBuffer.readUInt16LE(pos + 8);
    const compSize = zipBuffer.readUInt32LE(pos + 18);
    const nameLen = zipBuffer.readUInt16LE(pos + 26);
    const extraLen = zipBuffer.readUInt16LE(pos + 28);
    const nameStart = pos + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const entryName = zipBuffer
      .subarray(nameStart, nameStart + nameLen)
      .toString('utf8');
    const compData = zipBuffer.subarray(dataStart, dataStart + compSize);
    const raw = method === 8 ? inflateRawSync(compData) : compData;
    files.set(entryName, raw.toString('utf8'));
    pos = dataStart + compSize;
  }

  const workbookXml = files.get('xl/workbook.xml') ?? '';
  const sheetNames: string[] = [];
  const sheetXmlByName = new Map<string, string>();
  const sheetRegex = /<sheet\s+name="([^"]+)"\s+sheetId="(\d+)"/g;
  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = sheetRegex.exec(workbookXml)) !== null) {
    const decodedName = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    sheetNames.push(decodedName);
    sheetXmlByName.set(
      decodedName,
      files.get(`xl/worksheets/sheet${index}.xml`) ?? '',
    );
    index += 1;
  }

  return {
    sheetNames,
    getWorksheet(name: string): ParsedWorksheet | undefined {
      const xml = sheetXmlByName.get(name);
      if (xml === undefined) return undefined;
      return {
        name,
        getCellText(row1Based: number, col1Based: number): string {
          const ref = `${columnLetter(col1Based)}${row1Based}`;
          const cellPattern = new RegExp(
            `<c r="${ref}"[^>]*>(?:<is><t[^>]*>([\\s\\S]*?)</t></is>|<v>([\\s\\S]*?)</v>)</c>`,
          );
          const m = cellPattern.exec(xml);
          if (!m) return '';
          const rawVal = m[1] ?? m[2] ?? '';
          return rawVal
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
        },
      };
    },
  };
}
