import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('api')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@Req() request: AuthedRequest) {
    const user = await this.usersService.findById(request.user.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }

  @Patch('me')
  @UseGuards(ClerkAuthGuard)
  async updateMe(@Req() request: AuthedRequest, @Body() dto: UpdateMeDto) {
    const user = await this.usersService.update(request.user.userId, dto);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(ClerkAuthGuard)
  async deleteMe(@Req() request: AuthedRequest) {
    await this.usersService.deleteAccount(request.user.userId);
  }

  @Get('users/:id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
