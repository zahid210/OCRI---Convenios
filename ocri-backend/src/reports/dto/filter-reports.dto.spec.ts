import { ValidationPipe } from '@nestjs/common';
import { FilterReportsDto, REPORT_STATUSES } from './filter-reports.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function aceptaQuery(datos: Record<string, unknown>): Promise<boolean> {
  try {
    await pipe.transform(datos, { type: 'query', metatype: FilterReportsDto });
    return true;
  } catch {
    return false;
  }
}

/**
 * Regresión de la auditoría de /reports: con este DTO cualquier valor recién
 * llegado por query es validado antes de llegar al motor. Sin la validación,
 * `agreement_type_id=1.5` estallaba en `BigInt(1.5)` (500) y `status=Inventado`
 * se ignoraba en silencio devolviendo datos sin filtrar.
 */
describe('FilterReportsDto (validación de filtros de reportes)', () => {
  it('expone exactamente los seis estados del reporte', () => {
    expect(REPORT_STATUSES).toEqual([
      'En Trámite',
      'Vigente',
      'Por Vencer',
      'Vencido',
      'No Suscrito',
      'Sin Fecha',
    ]);
  });

  describe('status', () => {
    it('acepta todos los estados válidos', async () => {
      for (const status of REPORT_STATUSES) {
        await expect(aceptaQuery({ status })).resolves.toBe(true);
      }
    });

    it('recorta espacios alrededor del valor', async () => {
      await expect(aceptaQuery({ status: '  En Trámite  ' })).resolves.toBe(
        true,
      );
    });

    it('trata un string vacío como "sin filtro"', async () => {
      await expect(aceptaQuery({ status: '' })).resolves.toBe(true);
    });

    it('rechaza un estado inexistente (antes se ignoraba en silencio)', async () => {
      await expect(aceptaQuery({ status: 'Inventado' })).resolves.toBe(false);
      await expect(aceptaQuery({ status: 'En Tramite' })).resolves.toBe(false);
    });
  });

  describe('agreement_type_id / institution_id', () => {
    it('acepta números enteros (en string o number)', async () => {
      await expect(aceptaQuery({ agreement_type_id: '7' })).resolves.toBe(true);
      await expect(aceptaQuery({ institution_id: 9 })).resolves.toBe(true);
    });

    it('rechaza flotantes que hacían explotar BigInt (500)', async () => {
      await expect(aceptaQuery({ agreement_type_id: '1.5' })).resolves.toBe(
        false,
      );
      await expect(aceptaQuery({ institution_id: '2.5' })).resolves.toBe(false);
    });

    it('rechaza NaN, Infinity, cero y negativos', async () => {
      await expect(aceptaQuery({ agreement_type_id: 'abc' })).resolves.toBe(
        false,
      );
      await expect(aceptaQuery({ agreement_type_id: '1e400' })).resolves.toBe(
        false,
      );
      await expect(aceptaQuery({ agreement_type_id: '0' })).resolves.toBe(
        false,
      );
      await expect(aceptaQuery({ agreement_type_id: '-3' })).resolves.toBe(
        false,
      );
    });
  });

  describe('top', () => {
    it('acepta valores enteros dentro del rango 1..100', async () => {
      await expect(aceptaQuery({ top: '10' })).resolves.toBe(true);
      await expect(aceptaQuery({ top: 1 })).resolves.toBe(true);
      await expect(aceptaQuery({ top: 100 })).resolves.toBe(true);
    });

    it('rechaza cero, negativos, flotantes y fuera de rango', async () => {
      await expect(aceptaQuery({ top: '0' })).resolves.toBe(false);
      await expect(aceptaQuery({ top: '-1' })).resolves.toBe(false);
      await expect(aceptaQuery({ top: '2.5' })).resolves.toBe(false);
      await expect(aceptaQuery({ top: '101' })).resolves.toBe(false);
    });
  });

  describe('country / parámetros desconocidos', () => {
    it('acepta país válido y rechaza cadenas demasiado largas', async () => {
      await expect(aceptaQuery({ country: 'Perú' })).resolves.toBe(true);
      await expect(aceptaQuery({ country: 'x'.repeat(256) })).resolves.toBe(
        false,
      );
    });

    it('trata un string vacío como "sin filtro"', async () => {
      await expect(aceptaQuery({ country: '' })).resolves.toBe(true);
    });

    it('rechaza parámetros no declarados en el DTO', async () => {
      await expect(aceptaQuery({ page: '2' })).resolves.toBe(false);
    });
  });
});
