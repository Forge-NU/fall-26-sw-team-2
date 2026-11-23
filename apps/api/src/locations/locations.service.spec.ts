import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolveLocationRequest } from 'shared-types';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;

  const mockPrismaService = {
    location: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
  };

  const userId = 'user_dropper';

  const mapboxDto: ResolveLocationRequest = {
    kind: 'mapbox',
    mapboxId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
    name: 'Pastéis de Belém',
    latitude: 38.697464,
    longitude: -9.203213,
    address: 'R. de Belém 84-92, 1300-085 Lisboa',
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
  };

  const mockRow = {
    id: '00000000-0000-4000-a000-000000000002',
    provider: 'mapbox',
    providerPlaceId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
    name: 'Pastéis de Belém',
    address: 'R. de Belém 84-92, 1300-085 Lisboa',
    latitude: new Prisma.Decimal('38.697464'),
    longitude: new Prisma.Decimal('-9.203213'),
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
    ratingCount: 3,
    ratingSum: 13,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const expectedLocation = {
    id: '00000000-0000-4000-a000-000000000002',
    provider: 'mapbox',
    providerPlaceId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
    name: 'Pastéis de Belém',
    address: 'R. de Belém 84-92, 1300-085 Lisboa',
    latitude: 38.697464,
    longitude: -9.203213,
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
    rating: { average: 4.3, count: 3 },
  };

  const where = {
    provider_providerPlaceId: {
      provider: 'mapbox',
      providerPlaceId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new LocationsService(
      mockPrismaService as unknown as PrismaService,
    );
  });

  describe('resolve a Mapbox place', () => {
    it('creates the row if needed and never overwrites an existing one', async () => {
      mockPrismaService.location.upsert.mockResolvedValue(mockRow);

      await expect(service.resolve(userId, mapboxDto)).resolves.toEqual({
        kind: 'mapbox',
        location: expectedLocation,
      });

      expect(mockPrismaService.location.upsert).toHaveBeenCalledWith({
        where,
        create: {
          provider: 'mapbox',
          providerPlaceId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
          name: 'Pastéis de Belém',
          latitude: 38.697464,
          longitude: -9.203213,
          address: 'R. de Belém 84-92, 1300-085 Lisboa',
          city: 'Lisbon',
          region: 'Lisbon',
          countryCode: 'PT',
        },
        update: {},
      });
    });

    it('reuses one row when the same place is selected twice', async () => {
      mockPrismaService.location.upsert.mockResolvedValue(mockRow);

      const first = await service.resolve(userId, mapboxDto);
      const second = await service.resolve(userId, {
        ...mapboxDto,
        name: 'Pasteis de Belem (different spelling)',
      });

      expect(first).toEqual(second);
      expect(mockPrismaService.location.upsert).toHaveBeenCalledTimes(2);
      for (const [args] of mockPrismaService.location.upsert.mock.calls) {
        expect(args).toMatchObject({ where, update: {} });
      }
    });

    it('returns the existing row when a concurrent resolve wins the race', async () => {
      mockPrismaService.location.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      mockPrismaService.location.findUniqueOrThrow.mockResolvedValue(mockRow);

      await expect(service.resolve(userId, mapboxDto)).resolves.toEqual({
        kind: 'mapbox',
        location: expectedLocation,
      });

      expect(mockPrismaService.location.findUniqueOrThrow).toHaveBeenCalledWith(
        { where },
      );
    });

    it('rethrows unexpected database errors', async () => {
      const error = new Error('Database unavailable');
      mockPrismaService.location.upsert.mockRejectedValue(error);

      await expect(service.resolve(userId, mapboxDto)).rejects.toThrow(error);
      expect(
        mockPrismaService.location.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });

  describe('resolve a custom location', () => {
    it('returns the name without a Mapbox ID or a database write', async () => {
      await expect(
        service.resolve(userId, {
          kind: 'custom',
          name: "Tia Rosa's kitchen",
        }),
      ).resolves.toEqual({ kind: 'custom', name: "Tia Rosa's kitchen" });

      expect(mockPrismaService.location.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.location.create).not.toHaveBeenCalled();
      expect(
        mockPrismaService.location.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });

  describe('resolve a dropped pin', () => {
    const pin: ResolveLocationRequest = {
      kind: 'pin',
      name: 'Secret beach',
      latitude: 38.68,
      longitude: -9.32,
    };
    const pinRow = (providerPlaceId: string) => ({
      ...mockRow,
      id: `pin-${providerPlaceId}`,
      provider: 'custom',
      providerPlaceId,
      name: 'Secret beach',
      address: null,
      latitude: new Prisma.Decimal('38.68'),
      longitude: new Prisma.Decimal('-9.32'),
      city: null,
      region: null,
      countryCode: null,
      ratingCount: 0,
      ratingSum: 0,
      createdBy: userId,
    });

    beforeEach(() => {
      mockPrismaService.location.create.mockImplementation(
        ({ data }: { data: { providerPlaceId: string } }) =>
          Promise.resolve(pinRow(data.providerPlaceId)),
      );
    });

    it('creates a custom row owned by the user, with a generated id', async () => {
      const result = await service.resolve(userId, pin);

      const [[{ data }]] = mockPrismaService.location.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(data).toEqual({
        provider: 'custom',
        providerPlaceId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ) as unknown,
        name: 'Secret beach',
        latitude: 38.68,
        longitude: -9.32,
        createdBy: userId,
      });
      expect(result).toEqual({
        kind: 'pin',
        location: {
          id: `pin-${data.providerPlaceId as string}`,
          provider: 'custom',
          providerPlaceId: data.providerPlaceId,
          name: 'Secret beach',
          address: null,
          latitude: 38.68,
          longitude: -9.32,
          city: null,
          region: null,
          countryCode: null,
          rating: null,
        },
      });
      // created_by isn't part of the response
      expect(result).not.toHaveProperty('location.createdBy');
      expect(mockPrismaService.location.upsert).not.toHaveBeenCalled();
    });

    it('never reuses a row: the same pin twice makes two rows', async () => {
      const first = await service.resolve(userId, pin);
      const second = await service.resolve(userId, pin);

      expect(mockPrismaService.location.create).toHaveBeenCalledTimes(2);
      expect(first.kind === 'pin' && first.location.id).not.toBe(
        second.kind === 'pin' && second.location.id,
      );
    });
  });
});
