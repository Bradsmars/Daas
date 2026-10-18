# Live integration checks

Future bounded Apify smoke checks belong here. `npm run test:live` requires `DAAS_ENV=test` and `DAAS_APIFY_TEST_TOKEN`. Each future test must additionally validate its approved Actor IDs, source permissions and numeric budgets; a full-pipeline test will also need an isolated SQL database. The foundation suite remains empty and cannot pass on configuration alone.
