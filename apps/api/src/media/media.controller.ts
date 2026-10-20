import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateUploadDto } from './dto/create-upload.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(ClerkAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('uploads')
  createUpload(@CurrentUser() userId: string, @Body() dto: CreateUploadDto) {
    return this.mediaService.createUpload(userId, dto);
  }
}
