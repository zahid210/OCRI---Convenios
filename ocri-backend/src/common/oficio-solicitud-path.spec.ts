import {
  oficioSolicitudFilename,
  oficioSolicitudPath,
  opinionDir,
} from './uploads.config';

describe('oficio de solicitud de opinión · ruta compartida', () => {
  it('genera el mismo nombre para generado y subido a mano', () => {
    expect(oficioSolicitudFilename('Vicerrectorado de Investigación')).toBe(
      'oficio-solicitud-Vicerrectorado_de_Investigaci_n.pdf',
    );
  });

  it('usa "Dependencia" cuando no hay nombre', () => {
    expect(oficioSolicitudFilename('')).toBe(
      'oficio-solicitud-Dependencia.pdf',
    );
  });

  it('compone carpeta + nombre en una ruta única', () => {
    const path = oficioSolicitudPath(
      '013-2021',
      new Date('2021-05-01'),
      'Rectorado',
    );
    expect(path).toBe(
      '2021/013-2021/opiniones/Rectorado/oficio-solicitud-Rectorado.pdf',
    );
    expect(path.startsWith(opinionDir('013-2021', null, 'Rectorado'))).toBe(
      true,
    );
  });

  it('rechaza un nombre de dependencia inválido', () => {
    expect(() =>
      oficioSolicitudPath('013-2021', null, '../etc/passwd'),
    ).toThrow();
  });
});
