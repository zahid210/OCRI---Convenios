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
  it('acepta search válido', async () => {
    const value = (await transform({
      search: 'VRI',
    })) as FilterDependenciasDto;

    expect(value).toMatchObject({
      search: 'VRI',
    });
  });

  it('trata las cadenas vacías como "sin filtro"', async () => {
    const value = (await transform({
      search: '',
    })) as FilterDependenciasDto;

    expect(value.search).toBeUndefined();
  });

  it('rechaza un search fuera de cota', async () => {
    await expect(transform({ search: 'a'.repeat(101) })).rejects.toThrow();
  });

  it('rechaza parámetros desconocidos (forbidNonWhitelisted)', async () => {
    await expect(transform({ parametro_raro: 'x' })).rejects.toThrow();
  });
});
