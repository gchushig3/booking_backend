import { AttractionLocationService } from './attraction-location.service.js';

describe('AttractionLocationService', () => {
  it('stores decimal coordinates with the attraction and city ids', async () => {
    const entity = { atr_id: '88', ciu_id: 4 };
    const repository = {
      create: vi.fn((value) => value),
      upsert: vi.fn().mockResolvedValue(undefined),
      findOneByOrFail: vi.fn().mockResolvedValue(entity),
    };
    const dataSource = {
      query: vi.fn().mockResolvedValue([{ ciu_id: 4 }]),
    };
    const service = new AttractionLocationService(
      repository as never,
      dataSource as never,
    );
    await expect(
      service.upsert('88', {
        ciu_id: 4,
        geo_latitud: -0.1807,
        geo_longitud: -78.4678,
      }),
    ).resolves.toBe(entity);
    expect(repository.create).toHaveBeenCalledWith({
      atr_id: '88',
      ciu_id: 4,
      geo_latitud: '-0.180700',
      geo_longitud: '-78.467800',
      geo_direccion: null,
    });
  });
});
