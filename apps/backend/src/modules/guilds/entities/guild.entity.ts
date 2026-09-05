import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('guilds')
@Unique('UQ_guilds_name', ['name'])
@Index('IDX_guilds_created_by', ['createdBy'])
export class Guild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 1 })
  level: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_guilds_created_by_users' })
  createdByUser: User;

  @Column({ name: 'created_by', type: 'varchar', length: '36' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
