import { buildOficioRectoradoReferencia, escapeHtml } from './oficio-html';

describe('oficio-html (escapeHtml)', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapa %j -> %j', (raw, expected) => {
    expect(escapeHtml(raw)).toBe(expected);
  });

  it('aplica los cinco reemplazos en una sola pasada', () => {
    const input = `<a href="x" onclick='y'>A & B</a>`;
    expect(escapeHtml(input)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;A &amp; B&lt;/a&gt;',
    );
  });

  it('no altera texto sin caracteres sensibles', () => {
    expect(escapeHtml('Informe Final de Cierre')).toBe(
      'Informe Final de Cierre',
    );
  });
});

describe('oficio-html (buildOficioRectoradoReferencia)', () => {
  it('usa original_name sin extensión', () => {
    const result = buildOficioRectoradoReferencia([
      { original_name: 'Dictamen Legal.doc', file_path: '/x/dictamen.pdf' },
    ]);
    expect(result).toBe('Dictamen Legal');
  });

  it('cae al basename de file_path cuando original_name es null', () => {
    const result = buildOficioRectoradoReferencia([
      { original_name: null, file_path: '/tmp/expediente/OF-123.pdf' },
    ]);
    expect(result).toBe('OF-123');
  });

  it('omite nombres vacíos tras quitar la extensión', () => {
    const result = buildOficioRectoradoReferencia([
      { original_name: '.hidden', file_path: '/x/a' },
      { original_name: 'opinion.pdf', file_path: '/x/b' },
    ]);
    expect(result).toBe('opinion');
  });

  it('une varios documentos con coma y espacio en orden de entrada', () => {
    const result = buildOficioRectoradoReferencia([
      { original_name: 'oficio.docx', file_path: '/x/1' },
      { original_name: null, file_path: '/y/expediente.PDF' },
      { original_name: 'opinion.pdf', file_path: '/z/3' },
    ]);
    expect(result).toBe('oficio, expediente, opinion');
  });

  it('escapa HTML dentro de los nombres (XSS)', () => {
    const result = buildOficioRectoradoReferencia([]);
    const resultXss = buildOficioRectoradoReferencia([
      { original_name: `Dictamen <Rectorado> & "Comité".pdf`, file_path: '/x' },
    ]);
    expect(result).toBe('');
    expect(resultXss).toBe(
      'Dictamen &lt;Rectorado&gt; &amp; &quot;Comité&quot;',
    );
  });

  it('no distingue mayúsculas de extensión al recortarla', () => {
    const result = buildOficioRectoradoReferencia([
      { original_name: 'CONVENIO.PDF', file_path: '/x/1' },
    ]);
    expect(result).toBe('CONVENIO');
  });
});
