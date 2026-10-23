import { forwardRef, Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ObjectivesController } from './objectives.controller';
import { OBJECTIVES_CLOCK, ObjectivesService } from './objectives.service';

/** Objetivos de Crônicas (ADR-014). `SessionsModule` termina a Study Session e chama este módulo; ele lê as sessões de volta. */
@Module({
  imports: [EconomyModule, forwardRef(() => SessionsModule)],
  controllers: [ObjectivesController],
  providers: [ObjectivesService, { provide: OBJECTIVES_CLOCK, useValue: { now: () => new Date() } }],
  exports: [ObjectivesService],
})
export class ObjectivesModule {}
