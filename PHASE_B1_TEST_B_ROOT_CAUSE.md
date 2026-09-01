# Phase B1 Test B Root Cause

## 1. Reproduction

PASS with discrepancy.

The exact Test B input was executed once against the compiled runtime and real DeepSeek. The prior report recorded 4 invariant errors, but that response was not persisted. The current identical reproduction produced 1 invariant ERROR and therefore cannot provide evidence for three additional violations.

## 2. Raw DeepSeek Output

```json
{
  "revisedContent": "Our model achieves 92.4% mAP on DvXray, but this result should be interpreted with caution. The current evaluation is limited to a single dataset, and the model's generalizability to other domains or data distributions remains unverified. While the performance on DvXray suggests potential, the absence of external dataset validation means that the robustness of the method across diverse scenarios is still an open question. Additionally, the model's limitations, such as its sensitivity to specific image conditions or its computational overhead, have not been thoroughly analyzed. Future work should include validation on external datasets and a deeper investigation of these limitations to better assess the method's practical applicability.",
  "changeSummary": [
    "Reduced repetition of the result by focusing on interpretation rather than restating the mAP value.",
    "Added discussion of model limitations, including generalizability and unverified robustness.",
    "Emphasized the need for external dataset validation without fabricating any specific metrics or experiments.",
    "Reframed the conclusion to highlight open questions and future directions instead of asserting strong applicability."
  ],
  "unresolvedIssues": [
    "No external dataset experimental results were provided; therefore, no specific metrics or comparisons are mentioned."
  ],
  "authorInputNeeded": true,
  "warnings": [
    "The revised discussion does not include any fabricated external validation metrics; the need for such validation is noted as an unresolved issue."
  ]
}
```

## 3. authorInputNeeded

- Value: `true`
- `unresolvedIssues`: `No external dataset experimental results were provided; therefore, no specific metrics or comparisons are mentioned.`
- Schema parse: PASS

The model correctly identified that external validation results are missing.

## 4. Extracted Invariants

Extractor output is shown as `value` and `normalizedValue`. They are identical for all current tokens.

### Original

```text
numbers: []
percentages: [92.4%]
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers: [mAP, DvXray]
formulaFragments: []
```

### User Requirements

```text
numbers: []
percentages: []
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers: []
formulaFragments: []
```

### Revised Content

```text
numbers: []
percentages: [92.4%]
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers: [mAP, DvXray, DvXray]
formulaFragments: []
```

The repeated `DvXray` is genuinely present twice in `revisedContent`; it is not an extractor duplication.

### Allowed Set

The runtime constructed `allowed facts = original + user requirements` as the following multiset:

```text
percentage: 92.4%                  count=1
technical-identifier: mAP          count=1
technical-identifier: DvXray       count=1
```

The user requirements contributed no invariants.

## 5. Four Violations

The current reproduction contains only one violation. The previous three cannot be reconstructed without the previous raw DeepSeek response and are intentionally not guessed.

### Violation 1

- Type: `technical-identifier`
- Severity: `ERROR`
- Value: `DvXray`
- Normalized value: `DvXray`
- Source: `revisedContent`
- Reason: `UNSUPPORTED_NEW_VALUE: DvXray is not supported by the source or user requirements`
- Classification: `FALSE_POSITIVE_VALIDATOR`

`DvXray` is already in the allowed facts. The ERROR is caused only by its revised-content count being 2 while the allowed multiset count is 1. This is repetition of an allowed fact, not a new dataset or new fact.

### Violation 2

- Not present in the current reproduction.
- Classification: UNCLASSIFIED — previous raw response unavailable.

### Violation 3

- Not present in the current reproduction.
- Classification: UNCLASSIFIED — previous raw response unavailable.

### Violation 4

- Not present in the current reproduction.
- Classification: UNCLASSIFIED — previous raw response unavailable.

## 6. Validator Input Scope

The generator validates only the parsed `revisedContent` string:

```text
original: originalContent
revised: parsed.revisedContent
userRequirements: input.requirements
```

`changeSummary`, `unresolvedIssues`, `warnings`, `authorInputNeeded`, and the stringified full JSON are not passed to the extractor or validator. The validator input scope is correct.

## 7. Why Unit Tests Missed It

Current unit tests pass because they cover removal of `92.4%` and introduction of a genuinely new `94.7%`, but do not cover a realistic English revision that repeats an existing technical identifier. The generator fixture also uses text without protected technical identifiers. The missing coverage is specifically:

- allowed-set repetition semantics;
- realistic English revision with repeated `DvXray`/`mAP`;
- distinction between set membership and multiset frequency in `revision-conservative`.

No evidence indicates a validator-field-selection problem or an extractor false positive for this violation.

## 8. Root Cause

The confirmed root cause is `revision-conservative` multiset comparison. It treats a repeated occurrence of an already allowed invariant as an unsupported new value. The extractor correctly found the actual two occurrences of `DvXray`, and the generator correctly supplied only `revisedContent` for revised-text validation.

The previous run's additional three errors remain unclassified because its raw structured output was not persisted and the model output is nondeterministic.

## 9. Minimal Fix Recommendation

For revision validation only, compare whether an invariant value is present in `original + user requirements`, without rejecting additional occurrences of that already allowed value. Keep strict count comparison for `polish-strict`. Add a regression test for repeated existing technical identifiers in a later change. Do not modify this round.

## 10. Files That Would Need Modification

- `D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.validator.ts`
- `D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.validator.spec.ts`
