import type { ManuscriptProjectionV1, PaperExportMode } from '@shared/manuscript.interface';

export interface DocxRenderOptions {
  exportId: string;
  createdAt: string;
  mode: PaperExportMode;
  templateKey: 'generic-academic-v1';
}

export interface ManuscriptRenderer<TOptions = unknown> {
  readonly format: 'DOCX';
  readonly rendererVersion: '1';
  render(projection: ManuscriptProjectionV1, options: TOptions): Promise<{
    buffer: Buffer;
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    extension: 'docx';
  }>;
}
