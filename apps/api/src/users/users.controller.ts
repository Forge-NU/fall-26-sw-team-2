import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { FollowsService } from '../follows/follows.service';
import { UserResponse, PaginatedResponse } from 'shared-types';
import { PaginationDto } from '../common/decorators/pagination.dto';
import { mapUserToResponse } from './utils/user.mapper';
import { StorageService } from '../storage/storage.service';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
    private readonly storage: StorageService,
  ) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@CurrentUser() userId: string): Promise<UserResponse> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...(await this.followsService.getCounts(user.id)),
      ...(await mapUserToResponse(this.storage, user)),
    };
  }

  @Post('me/profile')
  @UseGuards(ClerkAuthGuard)
  async createProfile(
    @CurrentUser() userId: string,
    @Body() dto: CreateProfileDto,
  ): Promise<UserResponse> {
    const user = await this.usersService.createProfile(userId, dto);

    return {
      ...(await this.followsService.getCounts(user.id)),
      ...(await mapUserToResponse(this.storage, user)),
    };
  }

  @Patch('me')
  @UseGuards(ClerkAuthGuard)
  async updateMe(
    @CurrentUser() userId: string,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponse> {
    const user = await this.usersService.update(userId, dto);

    return {
      ...(await this.followsService.getCounts(user.id)),
      ...(await mapUserToResponse(this.storage, user)),
    };
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(ClerkAuthGuard)
  async deleteMe(@CurrentUser() userId: string): Promise<void> {
    await this.usersService.deleteAccount(userId);
  }

  @Get('users/:id')
  @UseGuards(ClerkAuthGuard)
  async findById(@Param('id') id: string): Promise<UserResponse> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...(await this.followsService.getCounts(user.id)),
      ...(await mapUserToResponse(this.storage, user)),
    };
  }

  @Get('users')
  @UseGuards(ClerkAuthGuard)
  async listUsers(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<UserResponse>> {
    const result = await this.usersService.listUsers(pagination);

    return {
      items: await Promise.all(
        result.items.map((user) => mapUserToResponse(this.storage, user)),
      ),
      nextCursor: result.nextCursor,
    };
  }
}
