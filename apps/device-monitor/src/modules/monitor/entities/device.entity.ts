import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeviceState } from '@app/device-client';

@Entity({ name: 'devices' })
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Index({ unique: true })
  @Column()
  mac: string;

  @Column()
  name: string;

  @Column()
  model: string;

  @Column()
  shortname: string;

  @Column()
  ip: string;

  @Column()
  productLine: string;

  @Column({
    type: 'enum',
    enum: DeviceState,
    enumName: 'device_state',
  })
  state: DeviceState;

  @Column()
  version: string;

  @Column()
  firmwareStatus: string;

  @Column({ type: 'boolean' })
  isConsole: boolean;

  @Column({ type: 'boolean' })
  isManaged: boolean;

  @Column({ type: 'timestamptz' })
  startupTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  adoptionTime: Date | null;

  @Column()
  checksum: string;

  @Column()
  host: string;

  @Column({ type: 'timestamptz' })
  lastSeenAt: Date;
}
