#!/usr/bin/env node
/**
 * AASWE Postinstall Script
 * 
 * Automatically triggers project analysis after npm package installation.
 * This script is executed as part of the npm postinstall lifecycle.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const ANALYSIS_DELAY = 2000; // 2 seconds delay
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds between retries

/**
 * Check if AASWE is available in the project
 */
function isAASWEAvailable() {
  try {
    // Check if AASWE is installed locally
    const localAASWE = path.join(process.cwd(), 'node_modules', '.bin', 'aaswe');
    if (fs.existsSync(localAASWE)) {
      return { available: true, command: localAASWE };
    }

    // Check if AASWE is available globally
    return { available: true, command: 'aaswe' };
  } catch (error) {
    return { available: false, command: null };
  }
}

/**
 * Check if we're in a valid project directory
 */
function isValidProject() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    return fs.existsSync(packageJsonPath);
  } catch (error) {
    return false;
  }
}

/**
 * Check if analysis should be skipped
 */
function shouldSkipAnalysis() {
  // Skip in CI environments
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
    return { skip: true, reason: 'CI environment detected' };
  }

  // Skip if explicitly disabled
  if (process.env.AASWE_SKIP_POSTINSTALL === 'true') {
    return { skip: true, reason: 'AASWE_SKIP_POSTINSTALL is set' };
  }

  // Skip if we're installing AASWE itself
  if (process.env.npm_package_name === '@aaswe/codebase-ai') {
    return { skip: true, reason: 'Installing AASWE package itself' };
  }

  // Skip if not in a valid project
  if (!isValidProject()) {
    return { skip: true, reason: 'Not in a valid Node.js project' };
  }

  return { skip: false, reason: null };
}

/**
 * Execute AASWE analysis with retry logic
 */
async function executeAnalysis(command, retryCount = 0) {
  return new Promise((resolve, reject) => {
    console.log('🔍 AASWE: Starting automatic project analysis...');
    
    const analysisProcess = spawn(command, ['analyze', '--auto', '--quiet'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      shell: true
    });

    let stdout = '';
    let stderr = '';

    analysisProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    analysisProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    analysisProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ AASWE: Project analysis completed successfully');
        if (stdout.trim()) {
          console.log(stdout.trim());
        }
        resolve({ success: true, output: stdout });
      } else {
        const error = new Error(`Analysis failed with exit code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    analysisProcess.on('error', (error) => {
      reject(error);
    });

    // Set timeout for analysis
    setTimeout(() => {
      analysisProcess.kill('SIGTERM');
      reject(new Error('Analysis timeout'));
    }, 120000); // 2 minute timeout
  });
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Check if analysis should be skipped
    const skipCheck = shouldSkipAnalysis();
    if (skipCheck.skip) {
      console.log(`ℹ️  AASWE: Skipping analysis - ${skipCheck.reason}`);
      return;
    }

    // Check if AASWE is available
    const aasweCheck = isAASWEAvailable();
    if (!aasweCheck.available) {
      console.log('ℹ️  AASWE: Analysis will be available after installation completes');
      console.log('   Run "npx aaswe analyze" manually to generate knowledge files');
      return;
    }

    // Add delay to ensure npm has finished
    console.log('⏳ AASWE: Waiting for npm to complete...');
    await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));

    // Execute analysis with retry logic
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await executeAnalysis(aasweCheck.command, attempt);
        return; // Success, exit
      } catch (error) {
        lastError = error;
        
        if (attempt < MAX_RETRIES - 1) {
          console.log(`⚠️  AASWE: Analysis attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    // All retries failed
    console.log('⚠️  AASWE: Automatic analysis failed after multiple attempts');
    console.log('   Run "npx aaswe analyze" manually to generate knowledge files');
    
    if (lastError && process.env.AASWE_DEBUG === 'true') {
      console.log('   Debug info:', lastError.message);
      if (lastError.stderr) {
        console.log('   Error output:', lastError.stderr);
      }
    }

  } catch (error) {
    console.log('ℹ️  AASWE: Manual analysis available with "npx aaswe analyze"');
    
    if (process.env.AASWE_DEBUG === 'true') {
      console.log('   Debug info:', error.message);
    }
  }
}

// Execute main function
main().catch((error) => {
  if (process.env.AASWE_DEBUG === 'true') {
    console.error('AASWE postinstall error:', error);
  }
  // Don't exit with error code to avoid breaking npm install
  process.exit(0);
});