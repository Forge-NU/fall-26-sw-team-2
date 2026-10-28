import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  const mockSearchService = { search: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSearchService }],
    }).compile();
    controller = module.get(SearchController);
  });

  it('searches as the viewer', async () => {
    const page = { type: 'people', items: [], nextCursor: null };
    mockSearchService.search.mockResolvedValue(page);

    await expect(
      controller.search('user_viewer', { type: 'people', q: 'maya' }),
    ).resolves.toEqual(page);
    expect(mockSearchService.search).toHaveBeenCalledWith('user_viewer', {
      type: 'people',
      q: 'maya',
    });
  });
});
