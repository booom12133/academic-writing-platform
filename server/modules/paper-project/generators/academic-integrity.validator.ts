import { Injectable } from '@nestjs/common';
import { PaperProjectError } from '../paper-project.errors';

@Injectable()
export class AcademicIntegrityValidator {
  validateModelOnly(content: string): void {
    const prohibitedCitation = /\bdoi\b|https?:\/\/doi\.org\/|10\.\d{4,9}\/[\w.()/:;-]+|\[[0-9]{1,3}\]|(?:according to|as reported by)\s+[\p{L}'-]+(?:\s+et al\.)?\s*\(\d{4}[a-z]?\)|[\[(（][\p{L}'-]+(?:\s+et al\.)?,?\s*\d{4}[a-z]?[\])）]/iu;
    const fabricatedResult = /(?:p\s*[<=>]\s*0?\.\d+|confidence interval|置信区间|回归系数|sample size|样本量\s*(?:为|=)\s*\d+|\bn\s*=\s*\d+|\b\d+\s+(?:participants?|respondents?|subjects?|samples?)\b|\b(?:surveyed|interviewed|recruited|enrolled|tested)\s+\d+\b|\bobserved\s+(?:an?\s+)?\d+(?:\.\d+)?%|(?:regression\s+)?coefficient\s*(?:was|=|of)\s*-?\d|(?:results?|findings?)\s+(?:showed|indicated|demonstrated|revealed)|(?:研究|实验)?结果(?:显示|表明)|experiment (?:found|showed)|实验结果表明)/i;
    if (prohibitedCitation.test(content) || fabricatedResult.test(content)) {
      throw new PaperProjectError('PAPER_INTEGRITY_VALIDATION_FAILED', 'Model-only output contains unsupported citation or empirical-result claims.');
    }
  }
}
