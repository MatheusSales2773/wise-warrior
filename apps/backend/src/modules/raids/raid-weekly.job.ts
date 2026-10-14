import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RAID_TIME_ZONE } from './domain/raid-week';
import { RaidsService } from './raids.service';

/**
 * Virada semanal das Raids (#116): toda segunda 00:00 em São Paulo fecha as Raids vencidas e abre as da nova
 * semana. Também roda ao subir a aplicação, para recuperar semanas perdidas com a VM fora do ar.
 */
@Injectable()
export class RaidWeeklyJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(RaidWeeklyJob.name);

  constructor(private readonly raids: RaidsService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  @Cron('0 0 * * 1', { name: 'raid-weekly-rollover', timeZone: RAID_TIME_ZONE })
  async handleWeekStart(): Promise<void> {
    await this.run();
  }

  /** Nunca derruba o bootstrap nem o agendador: a próxima execução tenta de novo. */
  private async run(): Promise<void> {
    try {
      const { closed, opened } = await this.raids.runWeeklyRollover();
      if (closed.length > 0 || opened > 0) {
        this.logger.log(`Virada semanal: ${closed.length} Raid(s) fechada(s), ${opened} aberta(s)`);
      }
    } catch (error) {
      this.logger.error('Falha na virada semanal das Raids', error instanceof Error ? error.stack : String(error));
    }
  }
}
