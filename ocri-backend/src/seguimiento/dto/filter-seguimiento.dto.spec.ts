import { ValidationPipe } from '@nestjs/common';
import { FilterSeguimientoDto } from './filter-seguimiento.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const transform = (value: unknown): Promise<unknown> =>
  pipe.transform(value, { type: 'query', metatype: FilterSeguimientoDto });

describe('FilterSeguimientoDto', () => {
  it('acepta pendientes=true/false', async () => {
    const value = (await transform({
      pendientes: 'true',
    })) as FilterSeguimientoDto;
    expect(value.pendientes).toBe('true');
    await expect(transform({ pendientes: 'false' })).resolves.toBeDefined();
  });

  it('rechaza un pendientes que no sea true/false (B6-10)', async () => {
    await expect(transform({ pendientes: '1' })).rejects.toThrow();
    await expect(transform({ pendientes: 'yes' })).rejects.toThrow();
  });

  it('rechaza un process_status fuera del catálogo (B6-2)', async () => {
    await expect(transform({ process_status: 'NO_EXISTE' })).rejects.toThrow();
  });

  it('acepta un process_status del catálogo', async () => {
    const value = (await transform({
      process_status: 'EN_SEGUIMIENTO',
    })) as FilterSeguimientoDto;
    expect(value.process_status).toBe('EN_SEGUIMIENTO');
  });
});
