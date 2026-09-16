import { BadRequestException } from '@nestjs/common';
import {
  MAX_OFICIO_HTML_LENGTH,
  sanitizeOficioHtml,
} from './sanitize-oficio-html';

describe('sanitizeOficioHtml', () => {
  it('devuelve string vacío si no hay entrada', () => {
    expect(sanitizeOficioHtml('')).toBe('');
  });

  it('preserva párrafos y texto plano', () => {
    const out = sanitizeOficioHtml('<p>Hola <strong>mundo</strong></p>');
    expect(out).toBe('<p>Hola <strong>mundo</strong></p>');
  });

  it('elimina <script> enteros con su contenido', () => {
    expect(sanitizeOficioHtml('<p>a</p><script>alert(1)</script>')).toBe(
      '<p>a</p>',
    );
  });

  it('expande etiquetas desconocidas conservando los hijos', () => {
    expect(sanitizeOficioHtml('<foo>texto<b>negrita</b></foo>')).toBe(
      'texto<b>negrita</b>',
    );
  });

  it('elimina atributos de eventos', () => {
    const out = sanitizeOficioHtml(
      '<img src="data:image/png;base64,AAAA" onerror="alert(1)"><a href="#x" onclick="hack()">link</a>',
    );
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onclick');
  });

  it('elimina estilos peligrosos (url, expression, javascript)', () => {
    expect(
      sanitizeOficioHtml('<p style="background:url(https://x/e)">a</p>'),
    ).toBe('<p>a</p>');
    expect(
      sanitizeOficioHtml('<p style="color:expression(alert(1))">a</p>'),
    ).toBe('<p>a</p>');
    expect(
      sanitizeOficioHtml('<p style="background:javascript:alert(1)">a</p>'),
    ).toBe('<p>a</p>');
  });

  it('conserva estilos de impresión seguros', () => {
    const out = sanitizeOficioHtml('<p style="text-align:center">a</p>');
    expect(out).toBe('<p style="text-align:center">a</p>');
  });

  it('elimina recursos externos en <img>', () => {
    expect(sanitizeOficioHtml('<img src="https://evil.com/x.png">')).toBe(
      '<img>',
    );
  });

  it('conserva data:image válido en <img>', () => {
    const out = sanitizeOficioHtml(
      '<img src="data:image/png;base64,aGVsbG8=">',
    );
    expect(out).toBe('<img src="data:image/png;base64,aGVsbG8=">');
  });

  it('elimina href no seguros en <a>', () => {
    expect(sanitizeOficioHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a>x</a>',
    );
  });

  it('conserva mailto: y anclas en <a>', () => {
    expect(sanitizeOficioHtml('<a href="mailto:a@b.c">x</a>')).toBe(
      '<a href="mailto:a@b.c">x</a>',
    );
    expect(sanitizeOficioHtml('<a href="#sec">x</a>')).toBe(
      '<a href="#sec">x</a>',
    );
  });

  it('elimina comentarios HTML', () => {
    expect(sanitizeOficioHtml('<p>a</p><!-- secreto -->')).toBe('<p>a</p>');
  });

  it('descarta etiquetas peligrosas anidadas conservando el texto', () => {
    expect(sanitizeOficioHtml('<div>ok<iframe src="x"></iframe></div>')).toBe(
      '<div>ok</div>',
    );
  });

  it('rechaza entradas sobredimensionadas', () => {
    expect(() =>
      sanitizeOficioHtml(`${'x'.repeat(MAX_OFICIO_HTML_LENGTH + 1)}`),
    ).toThrow(BadRequestException);
  });
});
