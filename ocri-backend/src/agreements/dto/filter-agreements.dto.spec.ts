import { ValidationPipe } from '@nestjs/common';
import { FilterAgreementsDto } from './filter-agreements.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const transform = (value: unknown): Promise<unknown> =>
  pipe.transform(value, { type: 'query', metatype: FilterAgreementsDto });

describe('FilterAgreementsDto', () => {
  it('acepta un process_status del catálogo', async () => {
    const value = (await transform({
      process_status: 'OPINIONES_EN_CURSO',
    })) as FilterAgreementsDto;
    expect(value.process_status).toBe('OPINIONES_EN_CURSO');
  });

  it('rechaza un process_status fuera del catálogo (B6-2)', async () => {
    await expect(transform({ process_status: 'NO_EXISTE' })).rejects.toThrow();
  });

  it('valida scope contra el enum', async () => {
    await expect(transform({ scope: 'otro' })).rejects.toThrow();
  });

  it('rechaza parámetros inesperados', async () => {
    await expect(transform({ bogus: '1' })).rejects.toThrow();
  });
});
