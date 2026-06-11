import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminConfigService {
  getHello(): string {
    return 'Hello World!';
  }
}
