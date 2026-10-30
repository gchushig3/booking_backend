import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import {
  InvalidReviewEventError,
  ReviewProjectionService,
} from '../../src/booking/review-projection.service.js';
import { ReviewEventsController } from '../../src/booking/review-events.controller.js';

const event = (data: Record<string, unknown> = {}) => ({
  tipo: 'RESENA_PUBLICADA',
  data: { atr_id: '12', promedio: 4.5, total: 2, version: 3, ...data },
});

function projection(rows: unknown[] = [{ atr_id: '12' }]) {
  const query =
    jest.fn<(sql: string, params: unknown[]) => Promise<unknown[]>>();
  query.mockResolvedValue(rows);
  return { query, service: new ReviewProjectionService({ query } as never) };
}

describe('ReviewProjectionService', () => {
  it('aplica promedio, total y version en una sola sentencia', async () => {
    const { query, service } = projection();
    await expect(service.apply(event())).resolves.toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual(['12', 4.5, 2, 3]);
    expect(query.mock.calls[0]?.[0]).toContain('resena_proyeccion.version <');
  });

  it('ignora versiones viejas o duplicadas', async () => {
    const { service } = projection([]);
    await expect(service.apply(event())).resolves.toBe(false);
  });

  it.each([{ atr_id: 'x' }, { promedio: 6 }, { total: -1 }, { version: 0 }])(
    'rechaza eventos malformados %j',
    async (patch) => {
      const { service } = projection();
      await expect(service.apply(event(patch))).rejects.toBeInstanceOf(
        InvalidReviewEventError,
      );
    },
  );

  it('atraccion inexistente es permanente', async () => {
    const { query, service } = projection();
    query.mockRejectedValue({ driverError: { code: '23503' } });
    await expect(service.apply(event())).rejects.toBeInstanceOf(
      InvalidReviewEventError,
    );
  });
});

describe('ReviewEventsController', () => {
  const context = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const message = {};
    return {
      channel,
      message,
      ctx: {
        getChannelRef: () => channel,
        getMessage: () => message,
      } as never,
    };
  };

  it('ack al aplicar', async () => {
    const { channel, message, ctx } = context();
    const apply = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
    await new ReviewEventsController({ apply } as never).onReviewPublished(
      event(),
      ctx,
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nack sin requeue si es invalido y con requeue si es transitorio', async () => {
    const bad = context();
    await new ReviewEventsController({
      apply: jest
        .fn<() => Promise<boolean>>()
        .mockRejectedValue(new InvalidReviewEventError('x')),
    } as never).onReviewPublished({}, bad.ctx);
    expect(bad.channel.nack).toHaveBeenCalledWith(bad.message, false, false);

    const transient = context();
    await new ReviewEventsController({
      apply: jest
        .fn<() => Promise<boolean>>()
        .mockRejectedValue(new Error('db down')),
    } as never).onReviewPublished(event(), transient.ctx);
    expect(transient.channel.nack).toHaveBeenCalledWith(
      transient.message,
      false,
      true,
    );
  });
});
