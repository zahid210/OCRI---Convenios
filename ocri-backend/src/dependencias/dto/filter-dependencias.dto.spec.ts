import { ValidationPipe } from '@nestjs/common';
import { FilterDependenciasDto } from './filter-dependencias.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const transform = (value: unknown): Promise<unknown> =>
  pipe.transform(value, { type: 'query', metatype: FilterDependenciasDto });

describe('FilterDependenciasDto', () => {
  it('acepta kind, is_active y search válidos', async () => {
    const value = (await transform({
      kind: 'OCRI',
      is_active: 'true',
      search: 'VRI',
    })) as FilterDependenciasDto;

    expect(value).toMatchObject({
      kind: 'OCRI',
      is_active: 'true',
      search: 'VRI',
    });
  });

  it('trata las cadenas vacías como "sin filtro"', async () => {
    const value = (await transform({
      kind: '',
      is_active: '',
      search: '',
    })) as FilterDependenciasDto;

    expect(value.kind).toBeUndefined();
    expect(value.is_active).toBeUndefined();
    expect(value.search).toBeUndefined();
  });

  it('rechaza un kind fuera del enum (antes llegaba al servicio)', async () => {
    await expect(transform({ kind: 'NO_EXISTE' })).rejects.toThrow();
  });

  it('rechaza un is_active que no sea true/false', async () => {
    await expect(transform({ is_active: 'si' })).rejects.toThrow();
  });

  it('rechaza un search fuera de cota', async () => {
    await expect(transform({ search: 'a'.repeat(101) })).rejects.toThrow();
  });

  it('rechaza parámetros inesperados', async () => {
    await expect(transform({ page: '1' })).rejects.toThrow();
  });
});
