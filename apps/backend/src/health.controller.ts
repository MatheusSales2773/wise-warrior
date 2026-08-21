import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint de health check (devops-engineer: toda imagem de container deve
 * expor um jeito barato de checar liveness — usado pelo HEALTHCHECK do
 * Dockerfile e pelo healthcheck do docker-compose, seção 11/12 do PRD).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
