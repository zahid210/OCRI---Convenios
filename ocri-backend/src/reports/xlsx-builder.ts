import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

export type CellValue = string | number | boolean | null | undefined;

interface SheetRow {
  cells: CellValue[];
  styleIndex: number;
  height?: number;
}

export interface SimpleWorksheet {
  readonly name: string;
  addTitleRow(title: string): void;
  addHeaderRow(headers: string[]): void;
  addDataRow(cells: CellValue[]): void;
  addDataRows(rows: CellValue[][]): void;
  setColumnWidth(colIndex1Based: number, width: number): void;
}

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

class WorksheetBuilder implements SimpleWorksheet {
  readonly name: string;
  private readonly rows: SheetRow[] = [];
  private readonly colWidths = new Map<number, number>();
  private readonly merges: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  addTitleRow(title: string): void {
    this.rows.push({
      cells: [title],
      styleIndex: 1,
      height: 24,
    });
    const rowIdx = this.rows.length;
    this.merges.push(`A${rowIdx}:E${rowIdx}`);
  }

  addHeaderRow(headers: string[]): void {
    this.rows.push({
      cells: headers,
      styleIndex: 2,
    });
  }

  addDataRow(cells: CellValue[]): void {
    this.rows.push({
      cells,
      styleIndex: 0,
    });
  }

  addDataRows(rows: CellValue[][]): void {
    for (const r of rows) {
      this.addDataRow(r);
    }
  }

  setColumnWidth(colIndex1Based: number, width: number): void {
    this.colWidths.set(colIndex1Based, width);
  }

  toXml(): string {
    const colsEntries = Array.from(this.colWidths.entries()).sort(
      (a, b) => a[0] - b[0],
    );
    const colsXml =
      colsEntries.length > 0
        ? `<cols>${colsEntries
            .map(
              ([col, w]) =>
                `<col min="${col}" max="${col}" width="${w}" customWidth="1"/>`,
            )
            .join('')}</cols>`
        : '';

    const rowsXml = this.rows
      .map((row, idx) => {
        const rNum = idx + 1;
        const htAttr =
          row.height !== undefined
            ? ` ht="${row.height}" customHeight="1"`
            : '';
        const cellsXml = row.cells
          .map((cell, cIdx) => {
            const ref = `${columnLetter(cIdx + 1)}${rNum}`;
            const sAttr = row.styleIndex > 0 ? ` s="${row.styleIndex}"` : '';
            if (cell === null || cell === undefined || cell === '') {
              return `<c r="${ref}"${sAttr} t="inlineStr"><is><t></t></is></c>`;
            }
            if (typeof cell === 'number' && Number.isFinite(cell)) {
              return `<c r="${ref}"${sAttr}><v>${cell}</v></c>`;
            }
            const text =
              typeof cell === 'boolean' ? String(cell) : String(cell);
            return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rNum}"${htAttr}>${cellsXml}</row>`;
      })
      .join('');

    const mergeXml =
      this.merges.length > 0
        ? `<mergeCells count="${this.merges.length}">${this.merges
            .map((ref) => `<mergeCell ref="${ref}"/>`)
            .join('')}</mergeCells>`
        : '';

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
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
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
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
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '</Relationships>',
    ].join('');

    const workbookXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
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
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      ...this.sheets.map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      ),
      `<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
      '</Relationships>',
    ].join('');

    const stylesXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<fonts count="3">',
      '<font><sz val="11"/><name val="Calibri"/></font>',
      '<font><b/><sz val="13"/><color rgb="FF094D37"/><name val="Calibri"/></font>',
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
      '</fonts>',
      '<fills count="3">',
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF094D37"/></patternFill></fill>',
      '</fills>',
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      '<cellXfs count="3">',
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
      '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>',
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
