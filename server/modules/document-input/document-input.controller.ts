import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { DocumentInputError } from './document-input.errors';
import { DocumentInputExceptionFilter } from './document-input.exception-filter';
import { DocumentInputService, MAX_DOCUMENT_INPUT_SIZE_BYTES } from './document-input.service';
import type { UploadedDocument } from './document-input.storage';
import type { DocumentInputDescriptor } from '@shared/document-input.interface';

@Controller('api/document-inputs')
export class DocumentInputController {
  constructor(private readonly documentInputService: DocumentInputService) {}

  @NeedLogin()
  @Post()
  @UseFilters(DocumentInputExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: MAX_DOCUMENT_INPUT_SIZE_BYTES,
      files: 1,
    },
  }))
  async upload(
    @Req() req: Request,
    @UploadedFile() file?: UploadedDocument,
  ): Promise<DocumentInputDescriptor> {
    const userId = req.userContext?.userId;
    if (!userId || !file) {
      throw new DocumentInputError('INVALID_DOCUMENT_UPLOAD', 'A document file is required.');
    }
    return this.documentInputService.upload(userId, file);
  }
}
