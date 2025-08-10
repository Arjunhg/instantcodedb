#!/usr/bin/env node

// Script to clear Redis cache for fresh testing
const { createClient } = require('redis');

async function clearCache() {
  console.log('🧹 Clearing Redis cache...');
  
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await client.connect();
    
    // Get all cache keys
    const keys = await client.keys('code_suggestion:*');
    console.log(`Found ${keys.length} cache entries`);
    
    if (keys.length > 0) {
      // Delete all cache entries
      await client.del(keys);
      console.log(`✅ Deleted ${keys.length} cache entries`);
    } else {
      console.log('✅ Cache was already empty');
    }
    
    await client.quit();
    console.log('🎉 Cache cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    process.exit(1);
  }
}

clearCache();