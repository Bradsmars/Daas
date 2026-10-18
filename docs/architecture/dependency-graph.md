# Micro-specification dependency graph

Version 0.1. Status: proposed for G0 review. An arrow means **prerequisite must be verified before dependent implementation is merged**. Source-specific decisions are separate readiness gates, not graph nodes and not hidden implementation dependencies.

```mermaid
flowchart TD
    S001[001 Repository] --> S002[002 Contracts]
    S002 --> S004[004 URL and context identity]
    S002 --> S005[005 Source adapter]
    S002 --> S007[007 MSSQL schema]
    S002 --> S016[016 Runtime security]
    S004 --> S003[003 Discovery Actor]
    S016 --> S003
    S016 --> S010[010 Apify transport]
    S002 --> S010
    S010 --> S017[017 Evidence retention and replay]
    S016 --> S017
    S002 --> S017
    S004 --> S006[006 Extraction Actor]
    S005 --> S006
    S016 --> S006
    S017 --> S006
    S007 --> S009[009 Claims and fencing]
    S016 --> S009
    S009 --> S011[011 Durable dispatch]
    S010 --> S011
    S007 --> S012[012 Dataset reader and quarantine]
    S010 --> S012
    S004 --> S008[008 Discovery ingestion]
    S007 --> S008
    S012 --> S008
    S007 --> S013[013 Atomic Bronze ingestion]
    S012 --> S013
    S017 --> S013
    S011 --> S014[014 Reconciliation and retries]
    S013 --> S014
    S003 --> S015[015 First end-to-end pipeline]
    S006 --> S015
    S008 --> S015
    S011 --> S015
    S013 --> S015
    S014 --> S015
    S015 --> S018[018 Operational handover]
```

## Direct predecessor list

This table is normative for dependency auditing; the Mermaid graph must match it. Transitive dependencies are not repeated unless useful at a public boundary.

| Spec | Direct prerequisites |
|---|---|
| 001 | none; G0 and D-01 still apply |
| 002 | 001 |
| 003 | 004, 016 |
| 004 | 002 |
| 005 | 002 |
| 006 | 004, 005, 016, 017 |
| 007 | 002 |
| 008 | 004, 007, 012 |
| 009 | 007, 016 |
| 010 | 002, 016 |
| 011 | 009, 010 |
| 012 | 007, 010 |
| 013 | 007, 012, 017 |
| 014 | 011, 013 |
| 015 | 003, 006, 008, 011, 013, 014 |
| 016 | 002 |
| 017 | 002, 010, 016 |
| 018 | 015 |

One valid topological order is: **001, 002, 004, 005, 007, 016, 003, 009, 010, 011, 012, 017, 006, 008, 013, 014, 015, 018**.

## Parallel opportunities and checkpoints

After contracts are verified, 004/005/007/016 can run in parallel with separate file ownership. Then discovery, claiming and Apify transport can progress independently as their predecessors finish. After transport, 011/012/017 are parallel candidates; after those boundaries, 006/008/013 can progress independently. Reconciliation is integrated before 015; operational handover follows the first pipeline.

Mocks and fixture design may be drafted earlier against approved contracts, but no dependent merge can rely on an unverified or incompatible prerequisite. Database migration ownership remains serial even when its consuming modules are parallel. [The execution plan](implementation-plan.md) specifies integration checkpoints and review evidence.
