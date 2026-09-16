import { ValidationPipe } from '@nestjs/common';
import { AcknowledgeNotificationsDto } from './acknowledge-notifications.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateWithPipe(
  metatype: unknown,
  data: unknown,
): Promise<{ ok: boolean; messages?: string[] }> {
  try {
    await pipe.transform(data, { type: 'body', metatype });
    return { ok: true };
  } catch (err) {
    const response = (err as { response?: { message?: unknown } }).response;
    const messages = Array.isArray(response?.message)
      ? (response.message as string[])
      : [];
    return { ok: false, messages };
  }
}

describe('AcknowledgeNotificationsDto', () => {
  it('acepta un arreglo de strings', async () => {
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {
      keys: ['n-1', 'n-2'],
    });
    expect(ok).toBe(true);
  });

  it('rechaza keys con números', async () => {
    const { ok, messages } = await validateWithPipe(
      AcknowledgeNotificationsDto,
      {
        keys: [1, 2],
      },
    );
    expect(ok).toBe(false);
    expect(messages.join()).toContain('key');
  });

  it('rechaza keys faltante', async () => {
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {});
    expect(ok).toBe(false);
  });
});
