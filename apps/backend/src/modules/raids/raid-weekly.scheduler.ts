import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RAID_TIME_ZONE } from './domain/raid-week';
import { RAID_CLOCK, type RaidClock } from './raid-clock';
import { RaidsService } from './raids.service';

/**
 * Fechamento semanal (#116). Runs every minute and once at startup, so a week missed while the application
 * was down is closed as soon as it comes back. Every step is idempotent in the database; this class only keeps
 * one run at a time inside the process.
 */
@Injectable()
export class RaidWeeklyScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RaidWeeklyScheduler.name);
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly raids: RaidsService,
    @Inject(RAID_CLOCK) private readonly clock: RaidClock,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: the HTTP server must not wait on the catch-up.
    void this.run();
  }

  @Cron('0 * * * * *', { name: 'raid-weekly-close', timeZone: RAID_TIME_ZONE })
  async handleCron(): Promise<void> {
    await this.run();
  }

  run(): Promise<void> {
    if (!this.inFlight) {
      this.inFlight = this.raids
        .runWeeklyClose(this.clock())
        .then(({ closed, opened }) => {
          if (closed + opened > 0) this.logger.log(`Fechamento semanal: ${closed} Raid(s) fechada(s), ${opened} aberta(s)`);
        })
        .catch((error: unknown) => {
          this.logger.error('Fechamento semanal falhou; nova tentativa no próximo minuto', error instanceof Error ? error.stack : String(error));
        })
        .finally(() => {
          this.inFlight = null;
        });
    }
    return this.inFlight;
  }
}
