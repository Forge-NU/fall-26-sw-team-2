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
import {
  UserResponse,
  PaginatedResponse,
  UsernameAvailabilityResponse,
} from 'shared-types';
import { PaginationDto } from '../common/decorators/pagination.dto';
import { mapUserToResponse } from './utils/user.mapper';
import { UsernameAvailabilityDto } from './dto/username-availability.dto';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
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
      ...mapUserToResponse(user),
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
      ...mapUserToResponse(user),
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
      ...mapUserToResponse(user),
    };
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(ClerkAuthGuard)
  async deleteMe(@CurrentUser() userId: string): Promise<void> {
    await this.usersService.deleteAccount(userId);
  }

  @Get('users/username-availability')
  @UseGuards(ClerkAuthGuard)
  async checkUsername(
    @Query() query: UsernameAvailabilityDto,
  ): Promise<UsernameAvailabilityResponse> {
    return {
      available: await this.usersService.isUsernameAvailable(query.username),
    };
  }

  @Get('users/id/:id')
  @UseGuards(ClerkAuthGuard)
  async findById(@Param('id') id: string): Promise<UserResponse> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...(await this.followsService.getCounts(user.id)),
      ...mapUserToResponse(user),
    };
  }

  @Get('users/:username')
  @UseGuards(ClerkAuthGuard)
  async findByUsername(
    @Param('username') username: string,
  ): Promise<UserResponse> {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      ...(await this.followsService.getCounts(user.id)),
      ...mapUserToResponse(user),
    };
  }

  @Get('users')
  @UseGuards(ClerkAuthGuard)
  async listUsers(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<UserResponse>> {
    const result = await this.usersService.listUsers(pagination);

    return {
      items: result.items.map(mapUserToResponse),
      nextCursor: result.nextCursor,
    };
  }
}
