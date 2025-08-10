#!/usr/bin/env node

// Test script to verify the new prompting approach
async function testPrompting() {
  console.log('🧪 Testing new prompting approach...\n');

  // Test case 1: React useState completion
  const testCase1 = {
    prompt: `import React, { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
  const [isVisible, setIsVisible] = useState(`,
    expected: "false) or true)"
  };

  // Test case 3: JSX completion (your specific case)
  const testCase3 = {
    prompt: `import React from 'react';

function Navbar() {
  return (
    <>
      // Create a simple navbar using tailwind css and it should not have more than 3 fields
      `,
    expected: "<nav> or <div>"
  };

  // Test case 2: Function completion
  const testCase2 = {
    prompt: `function calculateSum(a, b) {
  return a + b;
}

function calculateProduct(x, y) {
  return `,
    expected: "x * y"
  };

  const testCases = [testCase1, testCase2, testCase3];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 Test Case ${i + 1}:`);
    console.log('Prompt:', testCase.prompt.slice(-50) + '...');
    console.log('Expected:', testCase.expected);
    
    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "codellama:latest",
          prompt: testCase.prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 30,
            num_ctx: 4096,
            repeat_penalty: 1.0,
            stop: ["\n\n", "```", "import React", "import {", "function ", "export "],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Actual:', data.response);
      console.log('---\n');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('---\n');
    }
  }
}

// Run the test
testPrompting().catch(console.error);