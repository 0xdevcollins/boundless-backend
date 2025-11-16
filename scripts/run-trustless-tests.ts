#!/usr/bin/env ts-node

import { execSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";

interface TestResult {
  testFile: string;
  passed: boolean;
  output: string;
  duration: number;
}

class TrustlessWorkTestRunner {
  private testFiles = [
    "src/tests/trustless-work.test.ts",
    "src/tests/trustless-work-integration.test.ts",
    "src/tests/trustless-work-service.test.ts",
    "src/tests/migration.test.ts",
  ];

  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log(" Running Trustless Work Integration Tests");
    console.log("==========================================\n");

    for (const testFile of this.testFiles) {
      await this.runTest(testFile);
    }

    this.printSummary();
  }

  private async runTest(testFile: string): Promise<void> {
    console.log(` Running: ${testFile}`);

    const startTime = Date.now();

    try {
      const output = execSync(`npm test -- ${testFile}`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      const duration = Date.now() - startTime;

      this.results.push({
        testFile,
        passed: true,
        output,
        duration,
      });

      console.log(` PASSED (${duration}ms)\n`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        testFile,
        passed: false,
        output: error.stdout || error.stderr || error.message,
        duration,
      });

      console.log(` FAILED (${duration}ms)\n`);
    }
  }

  private printSummary(): void {
    console.log(" Test Summary");
    console.log("===============\n");

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const failed = total - passed;

    console.log(`Total Tests: ${total}`);
    console.log(` Passed: ${passed}`);
    console.log(` Failed: ${failed}`);
    console.log(` Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log("🔍 Failed Tests:");
      console.log("================\n");

      this.results
        .filter((r) => !r.passed)
        .forEach((result) => {
          console.log(` ${result.testFile}`);
          console.log(`   Duration: ${result.duration}ms`);
          console.log(`   Output: ${result.output.substring(0, 200)}...\n`);
        });
    }

    if (passed === total) {
      console.log(" All Trustless Work tests passed!");
      console.log(" The integration is ready for deployment.");
    } else {
      console.log("  Some tests failed. Please review the output above.");
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runner = new TrustlessWorkTestRunner();
  runner.runAllTests().catch(console.error);
}

export default TrustlessWorkTestRunner;
