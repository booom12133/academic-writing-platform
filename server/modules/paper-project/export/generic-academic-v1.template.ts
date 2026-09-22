import type { IFontAttributesProperties, IStylesOptions } from 'docx';

export const GENERIC_ACADEMIC_TEMPLATE = { key: 'generic-academic-v1' as const, version: '1' as const };

export function genericAcademicFonts(language: 'zh-CN' | 'en'): { body: IFontAttributesProperties; heading: IFontAttributesProperties } {
  if (language === 'zh-CN') {
    return {
      body: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体', cs: 'Times New Roman' },
      heading: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '黑体', cs: 'Times New Roman' },
    };
  }
  const allTimes = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'Times New Roman', cs: 'Times New Roman' };
  return { body: allTimes, heading: allTimes };
}

export function genericAcademicStyles(language: 'zh-CN' | 'en'): IStylesOptions {
  const fonts = genericAcademicFonts(language);
  const heading = (size: number) => ({ run: { font: fonts.heading, bold: true, size }, paragraph: { spacing: { before: 240, after: 120 } } });
  return {
    default: {
      document: { run: { font: fonts.body, size: 24 }, paragraph: { spacing: { line: 360, after: 120 } } },
      title: { run: { font: fonts.heading, bold: true, size: 36 }, paragraph: { spacing: { after: 360 } } },
      heading1: heading(32), heading2: heading(30), heading3: heading(28),
      heading4: heading(26), heading5: heading(24), heading6: heading(24),
    },
    paragraphStyles: [7, 8, 9].map((level) => ({
      id: `ManuscriptHeading${level}`, name: `Manuscript Heading ${level}`, basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: fonts.heading, bold: true, size: 24 },
      paragraph: { outlineLevel: level - 1, spacing: { before: 200, after: 100 } },
    })),
  };
}
