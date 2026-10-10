import {
  VIEWER_VISIBLE_STATUSES,
  isRestrictedRole,
  isVisibleToRestricted,
  restrictStatusList,
} from './visibility';

describe('visibility · confinamiento del rol viewer (Fase 2 · H2.1)', () => {
  it('solo el rol viewer está restringido; el resto ve todo', () => {
    expect(isRestrictedRole('viewer')).toBe(true);
    expect(isRestrictedRole('admin')).toBe(false);
    expect(isRestrictedRole('procesador')).toBe(false);
    expect(isRestrictedRole('asistente')).toBe(false);
    expect(isRestrictedRole(undefined)).toBe(false);
    expect(isRestrictedRole(null)).toBe(false);
  });

  it('un convenio solo es visible si está formalizado', () => {
    for (const status of VIEWER_VISIBLE_STATUSES) {
      expect(isVisibleToRestricted(status)).toBe(true);
    }
    for (const status of [
      'RECEPCIONADA',
      'OPINIONES_EN_CURSO',
      'ENVIADO_A_RECTORADO',
      'SUSCRITO',
      'NO_SUSCRITO',
    ]) {
      expect(isVisibleToRestricted(status)).toBe(false);
    }
    expect(isVisibleToRestricted(undefined)).toBe(false);
  });

  it('sin filtro previo devuelve todos los estados visibles', () => {
    expect(restrictStatusList(undefined).sort()).toEqual(
      [...VIEWER_VISIBLE_STATUSES].sort(),
    );
  });

  it('intersecta { in } con los visibles y descarta el resto', () => {
    expect(
      restrictStatusList({
        in: ['RECEPCIONADA', 'REGISTRADO', 'EN_SEGUIMIENTO'],
      }),
    ).toEqual(['REGISTRADO', 'EN_SEGUIMIENTO']);
  });

  it('un estado suelto se conserva solo si es visible (si no, lista vacía)', () => {
    expect(restrictStatusList('PUBLICADO')).toEqual(['PUBLICADO']);
    expect(restrictStatusList('RECEPCIONADA')).toEqual([]);
  });

  it('intersección vacía deja al viewer sin resultados, nunca lo amplía', () => {
    expect(restrictStatusList({ in: ['RECEPCIONADA', 'SUSCRITO'] })).toEqual(
      [],
    );
  });
});
