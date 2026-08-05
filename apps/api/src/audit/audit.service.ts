import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuditLog, PaginatedResponse } from '@epay/types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const log = await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        changes: (params.changes ?? null) as any,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });

    this.logger.log(`Audit: ${params.action} on ${params.resource} by user ${params.userId ?? 'anonymous'}`);
    return this.sanitizeLog(log);
  }

  async list(params: {
    userId?: string;
    action?: string;
    resource?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<AuditLog>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => this.sanitizeLog(l)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async getById(id: string): Promise<AuditLog | null> {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    return log ? this.sanitizeLog(log) : null;
  }

  private sanitizeLog(log: any): AuditLog {
    return {
      ...log,
      changes: log.changes ?? null,
    };
  }
}
