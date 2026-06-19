// services/platform/apps/chat/src/ingest/ingest-queue.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface IngestJobPayload {
  documentId: string;
  storagePath: string;
  title: string;
  mimeType: string;
  securityLevel: string;
  scopeType: string;
  accessRoleCodes: string[];
  accessDepartmentCodes: string[];
  accessUserIds: string[];
  uploadedById: string;
}

@Injectable()
export class IngestQueueService implements OnModuleInit {
  private readonly logger = new Logger(IngestQueueService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName: string;
  private readonly dlqName: string;
  private readonly rabbitmqUrl: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get('RABBITMQ_HOST', 'localhost');
    const port = this.config.get('RABBITMQ_PORT', '5672');
    const user = this.config.get('RABBITMQ_USER', 'pm2_user');
    const pass = this.config.get('RABBITMQ_PASSWORD', 'pm2pass');
    this.queueName = this.config.get('INGEST_QUEUE', 'ingest.jobs');
    this.dlqName = this.config.get('INGEST_DLQ', `${this.queueName}.dlq`);
    this.rabbitmqUrl = `amqp://${user}:${pass}@${host}:${port}`;
  }

  async onModuleInit() {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': this.dlqName,
        }
      });
      this.logger.log(`Connected to RabbitMQ, queue=${this.queueName}`);
    } catch (err) {
      this.logger.error('RabbitMQ connection failed:', err);
    }
  }

  async enqueue(job: IngestJobPayload): Promise<void> {
    if (!this.channel) {
      this.logger.warn('Channel not ready, falling back to HTTP');
      // Optional: Fallback to HTTP if RabbitMQ is down
      return this.enqueueHttp(job);
    }

    this.logger.log(`Publishing to queue=${this.queueName}, doc=${job.documentId}`);
    
    this.channel.sendToQueue(
      this.queueName,
      Buffer.from(JSON.stringify(job)),
      { persistent: true }
    );
    
    this.logger.log(`Published job documentId=${job.documentId}`);
  }

  // Keep HTTP fallback
  private async enqueueHttp(job: IngestJobPayload): Promise<void> {
    const url = this.config.get('DOCUMENT_PROCESSOR_URL', 'http://localhost:8003');
    const res = await fetch(`${url}/v1/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    });
    if (!res.ok) {
      throw new Error(`Document processor error: ${res.status}`);
    }
    this.logger.log(`HTTP fallback: submitted job documentId=${job.documentId}`);
  }
}