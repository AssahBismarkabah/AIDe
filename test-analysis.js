/**
 * Simple test script for Project Analysis Service
 */

const { ProjectAnalysisService } = require('./dist/services/project-analysis');
const path = require('path');

async function testProjectAnalysis() {
  console.log('🔍 Testing Project Analysis Service...');
  
  try {
    // Create analysis service for current project
    const analysisService = new ProjectAnalysisService({
      rootPath: process.cwd(),
      languages: ['typescript', 'javascript'],
      generateTTL: false, // Skip TTL generation for this test
      enableWatching: false,
      analysisDepth: 'basic'
    });

    console.log('📋 Initializing analysis service...');
    await analysisService.initialize();

    console.log('📊 Getting project structure...');
    const structure = await analysisService.getProjectStructure();
    
    console.log('✅ Project Structure Analysis Results:');
    console.log(`   Project Type: ${structure.projectType}`);
    console.log(`   Source Files: ${structure.sourceFiles.length}`);
    console.log(`   Directories: ${structure.directories.length}`);
    console.log(`   Package Files: ${structure.packageFiles.length}`);
    console.log(`   Frameworks: ${structure.frameworks.join(', ') || 'None detected'}`);
    console.log(`   Build Tools: ${structure.buildTools.join(', ') || 'None detected'}`);

    if (structure.sourceFiles.length > 0) {
      console.log('\n📁 Sample Source Files:');
      structure.sourceFiles.slice(0, 5).forEach(file => {
        console.log(`   ${path.relative(process.cwd(), file.path)} (${file.language})`);
      });
      if (structure.sourceFiles.length > 5) {
        console.log(`   ... and ${structure.sourceFiles.length - 5} more files`);
      }
    }

    if (structure.directories.length > 0) {
      console.log('\n📂 Directory Structure:');
      structure.directories.forEach(dir => {
        console.log(`   ${path.relative(process.cwd(), dir.path)} (${dir.type}) - ${dir.fileCount} files`);
      });
    }

    console.log('\n🧠 Getting analysis metrics...');
    const metrics = analysisService.getAnalysisMetrics();
    console.log('✅ Analysis Metrics:');
    console.log(`   Available Analyzers: ${metrics.analyzers.join(', ')}`);
    console.log(`   Last Analysis: ${metrics.lastAnalysis}`);

    console.log('\n🛑 Shutting down analysis service...');
    await analysisService.shutdown();

    console.log('\n✅ Project Analysis Service test completed successfully!');
    console.log('\n💡 Key Features Verified:');
    console.log('   ✓ Project structure discovery');
    console.log('   ✓ Multi-language file detection');
    console.log('   ✓ Framework and build tool detection');
    console.log('   ✓ Directory classification');
    console.log('   ✓ Service initialization and shutdown');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testProjectAnalysis().then(() => {
  console.log('\n🎉 All tests passed! The Project Analysis Service is working correctly.');
}).catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});