import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveLocationRequest } from './location.types';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;

  const mockPrismaService = {
    location: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

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

      await expect(service.resolve(mapboxDto)).resolves.toEqual({
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

      const first = await service.resolve(mapboxDto);
      const second = await service.resolve({
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

      await expect(service.resolve(mapboxDto)).resolves.toEqual({
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

      await expect(service.resolve(mapboxDto)).rejects.toThrow(error);
      expect(
        mockPrismaService.location.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });

  describe('resolve a custom location', () => {
    it('returns the name without a Mapbox ID or a database write', async () => {
      await expect(
        service.resolve({
          kind: 'custom',
          name: "Tia Rosa's kitchen",
        }),
      ).resolves.toEqual({ kind: 'custom', name: "Tia Rosa's kitchen" });

      expect(mockPrismaService.location.upsert).not.toHaveBeenCalled();
      expect(
        mockPrismaService.location.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });
});
