import {
  sanitizeDownloadName,
  stripDocumentFilePath,
  stripDocumentFilePaths,
} from './document-view';

describe('document-view · vistas de documentos', () => {
  describe('stripDocumentFilePath(s) · no exponer file_path (H2.2)', () => {
    it('elimina file_path conservando el resto de campos', () => {
      const doc = {
        id: 1n,
        name: 'Dictamen',
        file_path: '2021/001-2021/001-2021.pdf',
        original_name: '001-2021.pdf',
      };
      const clean = stripDocumentFilePath(doc);
      expect(clean).not.toHaveProperty('file_path');
      expect(clean).toEqual({
        id: 1n,
        name: 'Dictamen',
        original_name: '001-2021.pdf',
      });
    });

    it('no muta la fila original', () => {
      const doc = { file_path: 'a/b.pdf', name: 'x' };
      stripDocumentFilePath(doc);
      expect(doc.file_path).toBe('a/b.pdf');
    });

    it('stripDocumentFilePaths limpia un arreglo completo', () => {
      const rows = [
        { id: 1n, file_path: 'a.pdf' },
        { id: 2n, file_path: 'b.pdf' },
      ];
      const clean = stripDocumentFilePaths(rows);
      expect(clean).toEqual([{ id: 1n }, { id: 2n }]);
      for (const row of clean) {
        expect(row).not.toHaveProperty('file_path');
      }
    });
  });

  describe('sanitizeDownloadName · Content-Disposition seguro (F3-3)', () => {
    it('neutraliza CR/LF (inyección de cabeceras)', () => {
      const result = sanitizeDownloadName('evil\r\nX-Injected: 1.pdf');
      expect(result).not.toMatch(/[\r\n]/);
      expect(result).toBe('evilX-Injected_ 1.pdf');
    });

    it('quita comillas y backslashes', () => {
      expect(sanitizeDownloadName('a"b\\c.pdf')).toBe('a_b_c.pdf');
    });

    it('quita separadores de ruta (no queda traversal con / o \\)', () => {
      const forward = sanitizeDownloadName('../../etc/passwd');
      expect(forward).not.toContain('/');
      const back = sanitizeDownloadName('C:\\Windows\\x.pdf');
      expect(back).not.toContain('\\');
      expect(back).toBe('C_Windows_x.pdf');
    });

    it('quita acentos y convierte a ASCII imprimible', () => {
      const result = sanitizeDownloadName('Dictamen Nº 5.pdf');
      expect(result).toBe('Dictamen No 5.pdf');
      expect(result).toMatch(/^[\x20-\x7e]*$/);
    });

    it('elimina puntos iniciales y recorta espacios', () => {
      expect(sanitizeDownloadName('  ...oculto.pdf ')).toBe('oculto.pdf');
    });

    it('nunca devuelve vacío', () => {
      expect(sanitizeDownloadName('')).toBe('documento');
      expect(sanitizeDownloadName('\r\n')).toBe('documento');
      expect(sanitizeDownloadName('///').length).toBeGreaterThan(0);
    });

    it('acota la longitud a 120 caracteres', () => {
      const long = 'a'.repeat(300) + '.pdf';
      expect(sanitizeDownloadName(long).length).toBe(120);
    });
  });
});
