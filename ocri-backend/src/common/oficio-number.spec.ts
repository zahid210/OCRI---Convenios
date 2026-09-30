import {
  applyOficioNumberToBody,
  normalizeOficioNumber,
} from './pdf-merger.service';

describe('applyOficioNumberToBody', () => {
  const body =
    '<div class="doc-number">OFICIO N&deg; 001-2026-OCRI-UNCP</div><p>texto</p>';

  it('reemplaza el número respetando el espacio tras el símbolo', () => {
    const out = applyOficioNumberToBody(body, '045-2026-OCRI-UNCP');
    expect(out).toContain(
      '<div class="doc-number">OFICIO N&deg; 045-2026-OCRI-UNCP</div>',
    );
    expect(out).toContain('<p>texto</p>');
  });

  it('funciona con atributos extra o en distinto orden (HTML serializado por el navegador)', () => {
    const html =
      '<div contenteditable="false" class="doc-number">OFICIO N&deg; 001-2026-OCRI-UNCP</div>';
    const out = applyOficioNumberToBody(html, '045-2026-OCRI-UNCP');
    expect(out).toBe(
      '<div contenteditable="false" class="doc-number">OFICIO N&deg; 045-2026-OCRI-UNCP</div>',
    );
  });

  it('acepta class con más clases y comillas dobles o simples', () => {
    const html = "<div class='oficio doc-number'>N&deg; 1</div>";
    expect(applyOficioNumberToBody(html, '045-2026-OCRI-UNCP')).toBe(
      "<div class='oficio doc-number'>OFICIO N&deg; 045-2026-OCRI-UNCP</div>",
    );
  });

  it('no toca el HTML si no hay bloque doc-number', () => {
    const html = '<p>sin numero</p>';
    expect(applyOficioNumberToBody(html, '045-2026-OCRI-UNCP')).toBe(html);
  });

  it('no hace nada sin número o sin cuerpo', () => {
    expect(applyOficioNumberToBody(body, '')).toBe(body);
    expect(applyOficioNumberToBody('', '045')).toBe('');
  });

  it('es idempotente: el mismo número aplicado dos veces no duplica nada', () => {
    const once = applyOficioNumberToBody(body, '045-2026-OCRI-UNCP');
    expect(applyOficioNumberToBody(once, '045-2026-OCRI-UNCP')).toBe(once);
  });

  it('el número normalizado es el que acaba en el cuerpo', () => {
    const out = applyOficioNumberToBody(body, normalizeOficioNumber('045'));
    expect(out).toContain(`OFICIO N&deg; ${normalizeOficioNumber('045')}`);
  });
});
