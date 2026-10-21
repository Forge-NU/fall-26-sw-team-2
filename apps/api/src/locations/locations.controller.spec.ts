import { Test, TestingModule } from '@nestjs/testing';
import { ResolveLocationDto } from './dto/resolve-location.dto';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;

  const mockLocationsService = {
    resolve: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: mockLocationsService,
        },
      ],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('resolve', () => {
    it('returns the resolved location from the service', async () => {
      const dto = {
        kind: 'custom',
        name: "Tia Rosa's kitchen",
      } as ResolveLocationDto;
      const result = { kind: 'custom', name: "Tia Rosa's kitchen" };
      mockLocationsService.resolve.mockResolvedValue(result);

      await expect(controller.resolve(dto)).resolves.toEqual(result);

      expect(mockLocationsService.resolve).toHaveBeenCalledWith(dto);
    });

    it('propagates errors from the service', async () => {
      mockLocationsService.resolve.mockRejectedValue(new Error('boom'));

      await expect(
        controller.resolve({ kind: 'custom', name: 'x' }),
      ).rejects.toThrow('boom');
    });
  });
});
