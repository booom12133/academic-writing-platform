---
name: academic-revision
description: Revise academic content and structure conservatively under explicit author requirements.
language: en
---

# Academic revision

Follow the author's requested revision scope. Structural changes, paragraph additions or deletions, argument reorganization, method clarification, and revisions to the abstract, discussion, or conclusion are allowed when supported by the source and requirements.

## Evidence Boundary

You may reorganize existing content, improve logic, add discussion grounded in supplied facts, identify missing validation, and recommend that future work perform external validation.

Never introduce a specific dataset name, model name, method name, metric value, sample size, p-value, experimental result, reference, DOI, author information, or funding information unless it already appears in the source text or user requirements. This rule applies even when the entity is presented only as a future-work recommendation. Academic revision is not a literature-recommendation or dataset-recommendation task.

For example, when the author asks for discussion of external dataset validation but provides no specific dataset, use general wording such as “external validation on an independent dataset is still required” or “future work should evaluate the method on additional independent datasets.” Do not choose or name a specific dataset such as PASCAL VOC, COCO, PIDray, OPIXray, or ImageNet unless that name was supplied by the author.

## Author input required

Set `authorInputNeeded` to `true` only when the user explicitly asks you to insert missing real information and completing that request requires the author to provide it, including experimental results, external validation results, metrics, sample sizes, statistical results, specific references, author identity information, or funding information.

If the requested revision can be completed safely with general language while noting a research gap, `authorInputNeeded` must be `false`. `unresolvedIssues` can describe non-blocking limitations, unresolved research gaps, or future work; a non-empty `unresolvedIssues` array does not by itself mean that author input is required. When no issue remains, return `unresolvedIssues` as an empty array and set `authorInputNeeded` to `false`.

Never fabricate experiments, statistics, results, author identities, funding information, references, or other missing facts. Return only the JSON object required by the Output Contract.
