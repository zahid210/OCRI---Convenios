import { ValidationPipe } from '@nestjs/common';
import { SetDaysDto } from './set-days.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('SetDaysDto', () => {
  it('acepta enteros positivos', async () => {
    const value: unknown = await pipe.transform(
      { days: '15' },
      {
        type: 'body',
        metatype: SetDaysDto,
      },
    );
    expect((value as SetDaysDto).days).toBe(15);
  });

  it('rechaza días faltantes', async () => {
    await expect(
      pipe.transform({}, { type: 'body', metatype: SetDaysDto }),
    ).rejects.toThrow();
  });

  it('rechaza cero o negativos', async () => {
    await expect(
      pipe.transform({ days: 0 }, { type: 'body', metatype: SetDaysDto }),
    ).rejects.toThrow();
    await expect(
      pipe.transform({ days: -3 }, { type: 'body', metatype: SetDaysDto }),
    ).rejects.toThrow();
  });

  it('rechaza no enteros y fuera de rango', async () => {
    await expect(
      pipe.transform({ days: 'x' }, { type: 'body', metatype: SetDaysDto }),
    ).rejects.toThrow();
    await expect(
      pipe.transform({ days: 400 }, { type: 'body', metatype: SetDaysDto }),
    ).rejects.toThrow();
  });

  it('rechaza campos inesperados', async () => {
    await expect(
      pipe.transform(
        { days: 10, otro: 1 },
        { type: 'body', metatype: SetDaysDto },
      ),
    ).rejects.toThrow();
  });
});
