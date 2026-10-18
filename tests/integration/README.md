# MSSQL integration tests

Future real-MSSQL `*.test.ts` checks belong here. `npm run test:integration` requires `DAAS_ENV=test` and `DAAS_MSSQL_TEST_CONNECTION_STRING`; missing configuration is BLOCKED. The foundation does not connect to SQL or create a passing placeholder test. Configuration alone cannot make this empty suite pass.
