// Test script to debug code completion prompts
async function testCodeCompletion() {
  const testCases = [
    {
      name: "Navbar completion",
      fileContent: `function App() {
  return (
    <>
      // Add a simple navbar using tailwindCSS
    </>
  )
}

export default App`,
      cursorLine: 3,
      cursorColumn: 6,
      suggestionType: "completion",
      fileName: "App.jsx"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n=== Testing: ${testCase.name} ===`);
    
    try {
      const response = await fetch("http://localhost:3000/api/code-suggestion/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testCase),
      });

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        continue;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error("No reader available");
        continue;
      }

      let suggestion = "";
      let decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                suggestion += data.chunk;
                process.stdout.write(data.chunk); // Real-time output
              }
              if (data.done) {
                console.log(`\n\n--- Final suggestion ---`);
                console.log(suggestion);
                console.log(`--- End suggestion ---\n`);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error testing ${testCase.name}:`, error);
    }
  }
}

// Run the test
testCodeCompletion().catch(console.error);
