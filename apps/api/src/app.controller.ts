import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // The load balancer's health check. It only says the server is up, so a
  // database blip doesn't make ECS replace healthy tasks.
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
