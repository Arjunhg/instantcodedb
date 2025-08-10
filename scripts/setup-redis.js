#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Redis for InstantCodeDB...\n');

// Check if Redis is installed
function checkRedisInstallation() {
  try {
    execSync('redis-server --version', { stdio: 'pipe' });
    console.log('✅ Redis is already installed');
    return true;
  } catch (error) {
    console.log('❌ Redis is not installed');
    return false;
  }
}

// Install Redis based on platform
function installRedis() {
  const platform = process.platform;
  
  console.log(`📦 Installing Redis for ${platform}...`);
  
  try {
    if (platform === 'darwin') {
      // macOS
      console.log('Installing Redis via Homebrew...');
      execSync('brew install redis', { stdio: 'inherit' });
    } else if (platform === 'linux') {
      // Linux
      console.log('Installing Redis via apt...');
      execSync('sudo apt update && sudo apt install redis-server -y', { stdio: 'inherit' });
    } else if (platform === 'win32') {
      // Windows
      console.log('⚠️  For Windows, please install Redis manually:');
      console.log('1. Download Redis from: https://github.com/microsoftarchive/redis/releases');
      console.log('2. Or use WSL2 with Linux installation');
      console.log('3. Or use Docker: docker run -d -p 6379:6379 redis:alpine');
      return false;
    }
    
    console.log('✅ Redis installed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to install Redis:', error.message);
    return false;
  }
}

// Start Redis server
function startRedis() {
  try {
    console.log('🔄 Starting Redis server...');
    
    if (process.platform === 'darwin') {
      execSync('brew services start redis', { stdio: 'inherit' });
    } else {
      execSync('redis-server --daemonize yes', { stdio: 'inherit' });
    }
    
    console.log('✅ Redis server started');
    return true;
  } catch (error) {
    console.error('❌ Failed to start Redis:', error.message);
    return false;
  }
}

// Test Redis connection
function testRedisConnection() {
  try {
    console.log('🧪 Testing Redis connection...');
    execSync('redis-cli ping', { stdio: 'pipe' });
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}

// Main setup function
function main() {
  let redisInstalled = checkRedisInstallation();
  
  if (!redisInstalled) {
    redisInstalled = installRedis();
    if (!redisInstalled) {
      console.log('\n❌ Setup failed. Please install Redis manually.');
      process.exit(1);
    }
  }
  
  const redisStarted = startRedis();
  if (!redisStarted) {
    console.log('\n⚠️  Redis installation complete, but failed to start automatically.');
    console.log('Please start Redis manually: redis-server');
    process.exit(1);
  }
  
  const connectionTest = testRedisConnection();
  if (!connectionTest) {
    console.log('\n❌ Redis is installed but connection failed.');
    console.log('Please check if Redis is running: redis-cli ping');
    process.exit(1);
  }
  
  console.log('\n🎉 Redis setup complete!');
  console.log('📊 You can now run your Next.js app with semantic caching enabled.');
  console.log('\nNext steps:');
  console.log('1. npm run dev');
  console.log('2. Test the cache monitor at /cache-monitor');
  console.log('3. Try code suggestions to see caching in action');
}

main();