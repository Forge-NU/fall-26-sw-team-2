
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UserResponse, PaginatedResponse } from 'shared-types';
import { PaginationDto } from '../common/decorators/pagination.dto';
import { mapUserToResponse } from './utils/user.mapper';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('api')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@Req() request: AuthedRequest): Promise<UserResponse> {
    const user = await this.usersService.findById(request.user.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return mapUserToResponse(user);
  }

  @Post('me/profile')
  @UseGuards(ClerkAuthGuard)
  async createProfile(
    @Req() request: AuthedRequest,
    @Body() dto: CreateProfileDto,
  ): Promise<UserResponse> {
    const user = await this.usersService.createProfile(
      request.user.userId,
      dto,
    );

    return mapUserToResponse(user);
  }

  @Patch('me')
  @UseGuards(ClerkAuthGuard)
  async updateMe(
    @Req() request: AuthedRequest,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponse> {
    const user = await this.usersService.update(request.user.userId, dto);

    return mapUserToResponse(user);
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(ClerkAuthGuard)
  async deleteMe(@Req() request: AuthedRequest): Promise<void> {
    await this.usersService.deleteAccount(request.user.userId);
  }

  @Get('users/:id')
  @UseGuards(ClerkAuthGuard)
  async findById(@Param('id') id: string): Promise<UserResponse> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return mapUserToResponse(user);
  }

  @Get('users')
  @UseGuards(ClerkAuthGuard)
  async listUsers(
    @Req() _request: AuthedRequest,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<UserResponse>> {
    const result = await this.usersService.listUsers(pagination);

    return {
      items: result.items.map(mapUserToResponse),
      nextCursor: result.nextCursor,
    };
  }
}
