import {
  EXPIRATION_WARNING_DAYS,
  deriveTemporalStatus,
  serializeBigInt,
  validateTransition,
} from './process.constants';
import { BadRequestException } from '@nestjs/common';

describe('process.constants', () => {
  describe('validateTransition', () => {
    it('permite transiciones declaradas', () => {
      expect(() => validateTransition('SUSCRITO', 'REGISTRADO')).not.toThrow();
      expect(() =>
        validateTransition('PUBLICADO', 'EN_SEGUIMIENTO'),
      ).not.toThrow();
    });

    it('rechaza transiciones inválidas', () => {
      expect(() => validateTransition('RECEPCIONADA', 'REGISTRADO')).toThrow(
        BadRequestException,
      );
    });

    it('rechaza transiciones desde estados finales', () => {
      expect(() =>
        validateTransition('SEGUIMIENTO_CONCLUIDO', 'PUBLICADO'),
      ).toThrow(BadRequestException);
    });

    it('rechaza estados desconocidos', () => {
      expect(() => validateTransition('NO_EXISTE', 'REGISTRADO')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('serializeBigInt', () => {
    it('convierte BigInt anidados a number', () => {
      const out = serializeBigInt({
        id: 1n,
        nested: { x: 2n },
        arr: [3n, 4n],
        texto: 'a',
      });
      expect(out).toEqual({ id: 1, nested: { x: 2 }, arr: [3, 4], texto: 'a' });
    });

    it('devuelve escalares intactos', () => {
      expect(serializeBigInt(42)).toBe(42);
      expect(serializeBigInt('x')).toBe('x');
      expect(serializeBigInt(null)).toBeNull();
    });
  });

  describe('deriveTemporalStatus', () => {
    const relative = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d;
    };

    it('sin fecha → SIN_FECHA sin días restantes', () => {
      expect(deriveTemporalStatus(null)).toEqual({
        temporal_status: 'SIN_FECHA',
        days_remaining: null,
      });
      expect(deriveTemporalStatus(undefined)).toEqual({
        temporal_status: 'SIN_FECHA',
        days_remaining: null,
      });
    });

    it('fecha pasada → VENCIDO', () => {
      const { temporal_status, days_remaining } = deriveTemporalStatus(
        relative(-1),
      );
      expect(temporal_status).toBe('VENCIDO');
      expect(days_remaining).toBeLessThan(0);
    });

    it('hoy → POR_VENCER (0 días)', () => {
      expect(deriveTemporalStatus(relative(0)).temporal_status).toBe(
        'POR_VENCER',
      );
    });

    it('dentro del umbral → POR_VENCER', () => {
      expect(
        deriveTemporalStatus(relative(EXPIRATION_WARNING_DAYS)).temporal_status,
      ).toBe('POR_VENCER');
    });

    it('más allá del umbral → VIGENTE', () => {
      expect(
        deriveTemporalStatus(relative(EXPIRATION_WARNING_DAYS + 1))
          .temporal_status,
      ).toBe('VIGENTE');
    });
  });
});
