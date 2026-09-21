import { Injectable } from '@nestjs/common';
import { PaperProjectError } from '../paper-project.errors';

@Injectable()
export class AcademicIntegrityValidator {
  validateModelOnly(content: string): void {
    const prohibitedCitation = /\bdoi\b|https?:\/\/doi\.org\/|10\.\d{4,9}\/[\w.()/:;-]+|\[[0-9]{1,3}\]|(?:according to|as reported by)\s+[\p{L}'-]+(?:\s+et al\.)?\s*\(\d{4}[a-z]?\)|[\[(（][\p{L}'-]+(?:\s+et al\.)?,?\s*\d{4}[a-z]?[\])）]/iu;
    const prospectiveThreshold = /\bp\s*[<=>]\s*0?\.\d+\s+(?:will|would|shall)\s+(?:be\s+used|serve)\s+as\s+(?:the\s+)?(?:significance\s+)?(?:threshold|criterion)/giu;
    const resultCandidate = content.replace(prospectiveThreshold, '');
    const fabricatedResult = /(?:p\s*[<=>]\s*0?\.\d+|\bn\s*=\s*\d+|(?:sample size|样本量)\s*(?:was|is|of|为|=)\s*\d+|\b\d+\s+(?:participants?|respondents?|subjects?|samples?)\b|\b(?:surveyed|interviewed|recruited|enrolled|tested)\s+\d+\b|\bobserved\s+(?:an?\s+)?\d+(?:\.\d+)?%|(?:regression\s+)?coefficients?\s*(?:was|were|=|of)\s*-?\d|(?:回归)?系数\s*(?:为|是|=)\s*-?\d+(?:\.\d+)?|(?:\d+(?:\.\d+)?%\s*)?(?:confidence interval|CI)\s*(?:was|is|=|of)?\s*[\[(]?\s*-?\d+(?:\.\d+)?|置信区间\s*(?:为|是|=)\s*[\[(（]?\s*-?\d+(?:\.\d+)?|(?:提高|增加|下降|降低|改善)(?:了)?\s*\d+(?:\.\d+)?%|(?:results?|findings?)\s+(?:showed|indicated|demonstrated|revealed)|(?:研究|实验)?结果(?:显示|表明)|experiment (?:found|showed)|实验结果表明)/i;
    if (prohibitedCitation.test(content) || fabricatedResult.test(resultCandidate)) {
      throw new PaperProjectError('PAPER_INTEGRITY_VALIDATION_FAILED', 'Model-only output contains unsupported citation or empirical-result claims.');
    }
  }
}
