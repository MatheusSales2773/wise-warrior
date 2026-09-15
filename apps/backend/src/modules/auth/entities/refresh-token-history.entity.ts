import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Session } from './session.entity';

/**
 * Relação entre um refresh hash consumido e a família da sessão durante a
 * janela em que a reutilização ainda pode ser detectada.
 *
 * O segredo nunca é persistido: `tokenHash` contém apenas SHA-256 do segredo.
 */
@Entity('session_refresh_token_history')
@Index('IDX_session_refresh_token_history_session_id_retain_until', [
  'sessionId',
  'retainUntil',
])
export class RefreshTokenHistory {
  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'FK_session_refresh_token_history_session_id_sessions',
  })
  session: Session;

  @PrimaryColumn({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @PrimaryColumn({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ name: 'consumed_at', type: 'datetime', precision: 6 })
  consumedAt: Date;

  @Column({ name: 'retain_until', type: 'datetime' })
  retainUntil: Date;
}
