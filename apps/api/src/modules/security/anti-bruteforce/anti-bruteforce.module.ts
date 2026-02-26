import { Module } from '@nestjs/common';
import { AntiBruteForceService } from './anti-bruteforce.service';

@Module({
  providers: [AntiBruteForceService],
  exports: [AntiBruteForceService],
})
export class AntiBruteForceModule {}
