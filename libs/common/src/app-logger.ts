import { Injectable, Logger, LoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context = 'AppLogger';

  setContext(context: string): void {
    this.context = context;
  }

  log(message: any, context?: string): void {
    Logger.log(message, context ?? this.context);
  }

  error(message: any, trace?: string, context?: string): void {
    if (trace) {
      Logger.error(message, trace, context ?? this.context);
    } else {
      Logger.error(message, context ?? this.context);
    }
  }

  warn(message: any, context?: string): void {
    Logger.warn(message, context ?? this.context);
  }

  debug(message: any, context?: string): void {
    Logger.debug(message, context ?? this.context);
  }

  verbose(message: any, context?: string): void {
    Logger.verbose(message, context ?? this.context);
  }
}
