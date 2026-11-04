const apiBaseUrl = (process.env.AURA_API_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const response = await fetch(`${apiBaseUrl}/api/v1/chat/rag-index`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});

if (!response.ok) {
  const details = await response.text();
  throw new Error(`RAG indexing failed (${response.status}): ${details}`);
}

const result = await response.json();
if (!result.success) {
  throw new Error(result.message || 'RAG indexing failed.');
}

console.log(result.message || 'AURA COFFEE chatbot knowledge indexed successfully.');
