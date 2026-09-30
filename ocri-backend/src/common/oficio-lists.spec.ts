import { renderListMarkersForPdf } from './oficio-lists';

describe('renderListMarkersForPdf', () => {
  it('devuelve el HTML intacto si no hay listas', () => {
    const html = '<p>Sin listas</p>';
    expect(renderListMarkersForPdf(html)).toBe(html);
  });

  it('escribe el número en negrita y apaga el marcador del motor', () => {
    const out = renderListMarkersForPdf(
      '<ol><li>Primero</li><li>Segundo</li></ol>',
    );
    expect(out).toContain('<ol style="list-style:none">');
    expect(out).toContain('<b>1. </b>Primero');
    expect(out).toContain('<b>2. </b>Segundo');
  });

  it('escribe la viñeta sin negrita', () => {
    const out = renderListMarkersForPdf('<ul><li>Punto</li></ul>');
    expect(out).toContain(
      '<span style="font-weight:normal">\u2022 </span>Punto',
    );
  });

  it('baja la sangría y el espaciado a padding del <li>', () => {
    const out = renderListMarkersForPdf('<ol><li>Uno</li><li>Dos</li></ol>');
    // Sangría de la lista (28px de la plantilla) en el padding del ítem.
    expect(out).toContain('padding-left:28px');
    // Separación entre ítems; el último suma además el margen de la lista
    // (4px + 10px -> 10.5pt).
    expect(out).toContain('padding-bottom:4px');
    expect(out).toContain('padding-bottom:10.5pt');
  });

  it('respeta el padding-left y el margin-bottom inline del <li>', () => {
    const out = renderListMarkersForPdf(
      '<ol><li style="padding-left:60px;margin-bottom:8px">Uno</li></ol>',
    );
    expect(out).toContain('padding-left:60px');
    // 8px del ítem + 10px de la lista (único ítem -> es el último).
    expect(out).toContain('padding-bottom:13.5pt');
  });

  it('no duplica declaraciones de style existentes', () => {
    const out = renderListMarkersForPdf(
      '<ol style="list-style-type:decimal"><li style="color:#123456">Uno</li></ol>',
    );
    expect(out).toContain('color:#123456');
    expect(out).toContain('list-style:none');
    expect(out.match(/list-style-type/g)).toHaveLength(1);
  });

  it('conserva el formato inline del contenido del ítem', () => {
    const out = renderListMarkersForPdf(
      '<ol><li>Texto <strong>en negrita</strong> y <em>cursiva</em></li></ol>',
    );
    expect(out).toContain('<strong>en negrita</strong>');
    expect(out).toContain('<em>cursiva</em>');
  });

  it('deja intactos los párrafos y el resto del documento', () => {
    const out = renderListMarkersForPdf(
      '<p>Antes</p><ol><li>Uno</li></ol><p>Despues</p>',
    );
    expect(out).toContain('<p>Antes</p>');
    expect(out).toContain('<p>Despues</p>');
  });
});
