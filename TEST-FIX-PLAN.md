# TEST-FIX-PLAN.md - Comprehensive Test Suite Remediation

## Problem Summary
Our test suite violates CLAUDE.md protocols, causing random failures and 30+ second execution times. This plan systematically fixes all violations and performance issues.

## Current State Analysis
- **Test files**: 27 files, many prohibited by CLAUDE.md
- **Execution time**: 30+ seconds (should be <5 seconds)
- **Reliability**: 70-80% success rate (random failures)
- **Protocol compliance**: Major violations of CLAUDE.md guidelines

## Target State
- **Test files**: 10-15 focused behavior tests
- **Execution time**: 3-5 seconds
- **Reliability**: 95-100% success rate
- **Protocol compliance**: Fully compliant with CLAUDE.md

---

## PHASE 1: PLAN CREATION & ANALYSIS
### ✅ Planning & Documentation
- [x] Create TEST-FIX-PLAN.md with detailed checkboxes
- [x] Analyze current test violations against CLAUDE.md
- [x] Document prohibited files and patterns
- [x] Identify working patterns (schema.test.ts)

---

## PHASE 2: REMOVE PROHIBITED TESTS (CRITICAL)
### 🚫 Delete Prohibited Service Tests
**Rule Violated**: CLAUDE.md Lines 464-467 - "NO unit tests for implementation details"

- [x] Delete `app/db/sessions.service.test.ts` (16 tests) - PROHIBITED
- [x] Delete `app/db/event-session.service.test.ts` (Multiple tests) - PROHIBITED
- [x] Verify no other `*.service.test.ts` files exist
- [x] Remove service test imports from other files

### 🚫 Delete Implementation Detail Tests
**Rule Violated**: CLAUDE.md Lines 469-477 - "Test through public APIs only"

- [x] Review remaining tests for implementation details
- [x] Remove tests that test internal service methods
- [x] Keep only behavior tests through public APIs

### ✅ Validation Step
- [x] Run `npm test` to verify deleted tests don't break others
- [x] Confirm test count reduction (170 → 147 tests, 27 → 25 files)
- [x] Measure initial performance improvement (30+ seconds → ~9 seconds)

---

## PHASE 3: FIX DATABASE TESTING PATTERN
### 🔄 Convert to In-Memory SQLite Pattern
**Working Pattern**: Follow `app/db/schema.test.ts` (uses `:memory:`, never fails)

#### Database Test Files to Convert:
- [x] `app/db/database.test.ts` → Convert to in-memory pattern
- [x] `app/db/sessions.test.ts` → Convert to in-memory pattern
- [x] Any other database tests → Convert to in-memory pattern

#### Conversion Steps for Each File:
- [x] Replace shared database with per-test in-memory database
- [x] Update `beforeEach` to create fresh database instance
- [x] Update `afterEach` to close database connection
- [x] Remove database file cleanup code
- [x] Test the conversion with isolated test runs

### 🔄 Update Database Integration Tests
**Rule**: CLAUDE.md Lines 456, 472 - Update to use in-memory SQLite

- [x] Identify tests that should remain as database integration tests
- [x] Convert to in-memory SQLite pattern
- [x] Ensure proper test isolation
- [x] Remove shared database dependencies

### ✅ Validation Step
- [x] Run database tests in isolation
- [x] Verify no shared state between tests
- [x] Confirm elimination of timeout issues
- [x] Measure performance improvement

---

## PHASE 4: REORGANIZE TEST STRUCTURE
### 📁 Follow CLAUDE.md Structure (Lines 447-460)

#### Target Structure:
```
app/
├── __tests__/              # Behavior tests for components and API routes
│   ├── *.test.tsx          # React component behavior tests
│   ├── *.test.ts           # API route and integration tests
├── db/
│   └── *.test.ts           # Database integration tests using in-memory SQLite
└── services/               # NO test files here (implementation details)
```

#### Reorganization Tasks:
- [x] Move component tests to `app/__tests__/` if not already there
- [x] Move API route tests to `app/__tests__/` if not already there
- [x] Keep only schema/database structure tests in `app/db/`
- [x] Ensure `services/` directory has no test files
- [x] Update import paths in moved tests

#### Specific File Actions:
- [x] Review all test files for proper placement
- [x] Move misplaced files to correct directories
- [x] Update any relative imports affected by moves
- [x] Ensure tests focus on behavior, not implementation

### ✅ Validation Step
- [x] Verify directory structure matches CLAUDE.md
- [x] Run tests to ensure imports work correctly
- [x] Confirm no implementation detail tests remain

---

## PHASE 5: UPDATE CONFIGURATION
### ⚙️ Remove Sequential Execution Bottleneck
**Issue**: `singleFork: true` makes ALL tests sequential (should be database tests only)

#### Vitest Configuration Updates:
- [x] Remove `singleFork: true` from `vitest.config.ts`
- [x] Enable parallel execution for behavior tests
- [x] Keep database tests sequential if needed (separate config)
- [x] Update test timeout settings if needed

#### MSW Optimization:
- [x] Review MSW setup in `app/test-utils/msw-server.ts`
- [x] Ensure MSW only loads for tests that need it
- [x] Optimize mock patterns for performance

### ✅ Validation Step
- [x] Run tests in parallel mode
- [x] Verify no race conditions
- [x] Measure performance improvement from parallelization

---

## PHASE 6: UPDATE CLAUDE.MD DOCUMENTATION
### 📝 Fix Contradictory Rules
**Issue**: CLAUDE.md says "real SQLite" but working pattern uses `:memory:`

#### CLAUDE.md Updates:
- [x] Update database testing rule to specify in-memory SQLite
- [x] Remove "real SQLite" requirement (Line 456, 472)
- [x] Document the working pattern from `schema.test.ts`
- [x] Add performance rationale for in-memory approach
- [x] Update examples to show in-memory pattern

#### Additional Documentation:
- [x] Document test isolation principles
- [x] Add guidance on when to use database tests vs. behavior tests
- [x] Include performance expectations for different test types

### ✅ Validation Step
- [x] Review CLAUDE.md for consistency
- [x] Ensure all examples match actual working patterns
- [x] Verify documentation supports fast, reliable testing

---

## PHASE 7: FINAL VALIDATION & OPTIMIZATION
### 🧪 Comprehensive Testing
- [ ] Run full test suite multiple times
- [ ] Measure execution time (target: <5 seconds)
- [ ] Verify 100% test reliability (no random failures)
- [ ] Test parallel execution stability

### 📊 Performance Metrics
- [ ] Before/after execution time comparison
- [ ] Before/after test count comparison
- [ ] Before/after reliability comparison
- [ ] Document improvements achieved

### 🔍 Final Compliance Check
- [ ] Verify all CLAUDE.md protocols are followed
- [ ] Confirm no prohibited test patterns remain
- [ ] Ensure test organization matches guidelines
- [ ] Validate behavior-focused testing approach

---

## SUCCESS CRITERIA
- [ ] **Performance**: Test suite runs in <5 seconds
- [ ] **Reliability**: 100% success rate across multiple runs
- [ ] **Compliance**: All CLAUDE.md protocols followed
- [ ] **Organization**: Clean, focused test structure
- [ ] **Maintainability**: Easy to understand and extend

---

## ROLLBACK PLAN
If issues arise during implementation:
1. Commit after each phase for safe rollback points
2. Keep deleted test files in git history for reference
3. Document any unexpected issues or deviations
4. Prioritize working state over perfect compliance

---

## COMPLETION CHECKLIST
- [ ] All phases completed successfully
- [ ] Test suite runs fast and reliably
- [ ] CLAUDE.md protocols fully followed
- [ ] Documentation updated and accurate
- [ ] Team can confidently run tests during development

**Final Status**: ⏳ IN PROGRESS