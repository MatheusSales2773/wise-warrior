import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { StudySessionSnapshot } from './study-session-snapshot';

/** Estado grosso que o cliente precisa para saber se a sessão ainda ocupa o slot ativo. */
export type StudySessionChangedState = 'running' | 'paused' | 'ended';

/** Payload de `studySession:changed` (docs/api/asyncapi.yaml). */
export type StudySessionChangedEvent = {
  studySessionId: string;
  version: number;
  state: StudySessionChangedState;
};

/**
 * D-005/D-006: todos os dispositivos autenticados recebem o sinal de que a Study Session ativa mudou.
 * Só publica estados já commitados; o REST continua sendo a fonte canônica que o cliente reconsulta.
 */
@Injectable()
export class StudySessionEventsService {
  constructor(
    @Inject(forwardRef(() => RealtimeGateway)) private readonly realtime: RealtimeGateway,
  ) {}

  publishChanged(
    userId: string,
    snapshot: Pick<StudySessionSnapshot, 'id' | 'version' | 'state'>,
  ): void {
    this.realtime.emitToUser(userId, 'studySession:changed', {
      studySessionId: snapshot.id,
      version: snapshot.version,
      state: changedState(snapshot.state),
    });
  }
}

/** `ended` cobre conclusão, encerramento antecipado, cancelamento e sessão descartada. */
function changedState(state: StudySessionSnapshot['state']): StudySessionChangedState {
  return state === 'running' || state === 'paused' ? state : 'ended';
}
