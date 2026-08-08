import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {
  log(message: string, context?: string): void {
    super.log(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    super.error(message, trace, context);
  }

  warn(message: string, context?: string): void {
    super.warn(message, context);
  }
}
