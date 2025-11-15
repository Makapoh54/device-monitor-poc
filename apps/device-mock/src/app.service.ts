import { Injectable } from '@nestjs/common';
import { AppLogger } from '@app/common';

@Injectable()
export class AppService {
  constructor(private readonly logger: AppLogger) {}

  ping(): string {
    this.logger.debug('Ping endpoint called', AppService.name);
    return 'pong';
  }
}
