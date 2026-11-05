import { Module } from '@nestjs/common';
import { MaintenanceJobs } from './maintenance.jobs.js';

@Module({ providers: [MaintenanceJobs], exports: [MaintenanceJobs] })
export class JobsModule {}
