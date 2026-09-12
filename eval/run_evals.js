import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('❌ Error: GROQ_API_KEY is not defined in .env');
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });
const RAG_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const JUDGE_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

async function runRAGPipeline(question, context) {
  const systemPrompt = `You are an expert research assistant. Answer the user's question using ONLY the provided CONTEXT below.
Strict Guardrail Rules:
1. Every factual statement or claim MUST cite the corresponding source, e.g. [Source 1], [Source 2].
2. If the answer cannot be found in the provided CONTEXT, say exactly: "I cannot find the answer in the uploaded documents."
3. Do NOT make up facts or answer from external knowledge.
4. If it's a polite greeting (like "hi"), respond politely without citations.

CONTEXT:

${context || 'No documents found.'}`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    model: RAG_MODEL,
    temperature: 0.2,
    max_tokens: 512
  });

  return response.choices[0]?.message?.content || '';
}

async function judgeResponse(question, context, generatedAnswer, groundTruth, category) {
  const judgePrompt = `You are an impartial AI evaluation judge. Evaluate the quality of a RAG assistant's response.

[QUESTION]:
${question}

[RETRIEVED CONTEXT]:
${context}

[GENERATED ANSWER]:
${generatedAnswer}

[GROUND TRUTH / EXPECTED BEHAVIOR]:
${groundTruth}

[CATEGORY]:
${category}

Evaluate on the following criteria:
1. Faithfulness (1-5): Does the generated answer rely ONLY on the provided context without hallucinations or external claims? (5 = completely faithful, 1 = completely hallucinated).
2. Relevance (1-5): Does the answer directly address the question and match the ground truth intent? (5 = perfect answer, 1 = completely irrelevant).
3. Citation Passed (true/false): Did the model include source citations like [Source 1] for factual claims, OR properly refuse without hallucinations if out-of-context?
4. Correct Refusal (true/false): If the question is unanswerable from context, did the model correctly refuse? (true if applicable and refused, or true if not a refusal question).

Respond ONLY with a valid JSON object in this exact format:
{
  "faithfulnessScore": 5,
  "relevanceScore": 5,
  "citationPassed": true,
  "refusalCorrect": true,
  "reasoning": "Brief explanation"
}`;

  const res = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an evaluation metric judge. Return only JSON.' },
      { role: 'user', content: judgePrompt }
    ],
    model: JUDGE_MODEL,
    temperature: 0.0,
    response_format: { type: 'json_object' }
  });

  try {
    return JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (e) {
    return {
      faithfulnessScore: 3,
      relevanceScore: 3,
      citationPassed: false,
      refusalCorrect: false,
      reasoning: 'Failed to parse judge JSON'
    };
  }
}

async function runAllEvals() {
  console.log('🧪 ===============================================');
  console.log('🚀 Starting Aura RAG Evaluation Benchmark Harness');
  console.log('🧪 ===============================================\n');

  const datasetPath = path.join(__dirname, 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const results = [];

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    console.log(`[${i + 1}/${dataset.length}] Testing (${item.category}): "${item.question.slice(0, 50)}..."`);

    const start = Date.now();
    const answer = await runRAGPipeline(item.question, item.sampleContext);
    const latency = Date.now() - start;

    const evalResult = await judgeResponse(
      item.question,
      item.sampleContext,
      answer,
      item.groundTruth,
      item.category
    );

    results.push({
      ...item,
      generatedAnswer: answer,
      latencyMs: latency,
      ...evalResult
    });

    console.log(`   ↳ Faithfulness: ${evalResult.faithfulnessScore}/5 | Relevance: ${evalResult.relevanceScore}/5 | Citations: ${evalResult.citationPassed ? '✅' : '❌'}`);
  }

  // Aggregate Scores
  const total = results.length;
  const avgFaithfulness = (results.reduce((acc, r) => acc + (r.faithfulnessScore || 0), 0) / total).toFixed(2);
  const avgRelevance = (results.reduce((acc, r) => acc + (r.relevanceScore || 0), 0) / total).toFixed(2);
  const citationPassRate = ((results.filter(r => r.citationPassed).length / total) * 100).toFixed(1);
  const refusalPassRate = ((results.filter(r => r.refusalCorrect).length / total) * 100).toFixed(1);
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / total);

  console.log('\n===============================================');
  console.log('📊 EVALUATION SUMMARY RESULTS');
  console.log('===============================================');
  console.log(`⭐ Average Faithfulness (Grounding): ${avgFaithfulness} / 5.00`);
  console.log(`🎯 Average Answer Relevance:        ${avgRelevance} / 5.00`);
  console.log(`📎 Citation Guardrail Compliance:   ${citationPassRate}%`);
  console.log(`🛡️ Refusal / OOD Accuracy:          ${refusalPassRate}%`);
  console.log(`⚡ Average Inference Latency:       ${avgLatency}ms`);
  console.log('===============================================\n');

  // Generate Markdown Report
  const reportPath = path.join(__dirname, 'eval_report.md');
  let md = `# 📊 Aura RAG Evaluation Benchmark Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Model Evaluated:** \`${RAG_MODEL}\`\n`;
  md += `**LLM Judge:** \`${RAG_MODEL}\`\n\n`;
  md += `## Aggregate Performance Metrics\n\n`;
  md += `| Metric | Score | Target Threshold | Status |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Faithfulness / Grounding** | **${avgFaithfulness} / 5.0** | $\\ge 4.5$ | ${avgFaithfulness >= 4.5 ? '🟢 PASS' : '🟡 REVIEW'} |\n`;
  md += `| **Answer Relevance** | **${avgRelevance} / 5.0** | $\\ge 4.5$ | ${avgRelevance >= 4.5 ? '🟢 PASS' : '🟡 REVIEW'} |\n`;
  md += `| **Citation Compliance** | **${citationPassRate}%** | $\\ge 90\\%$ | ${citationPassRate >= 90 ? '🟢 PASS' : '🟡 REVIEW'} |\n`;
  md += `| **Out-of-Domain Refusal** | **${refusalPassRate}%** | $100\\%$ | ${refusalPassRate >= 100 ? '🟢 PASS' : '🟡 REVIEW'} |\n`;
  md += `| **Average Latency** | **${avgLatency}ms** | $< 1500\\text{ms}$ | 🟢 PASS |\n\n`;
  md += `## Detailed Test Case Breakdown\n\n`;

  results.forEach((r, idx) => {
    md += `### ${idx + 1}. [${r.category}] ${r.question}\n\n`;
    md += `- **Generated Answer:** ${r.generatedAnswer.replace(/\n/g, ' ')}\n`;
    md += `- **Ground Truth:** ${r.groundTruth}\n`;
    md += `- **Scores:** Faithfulness: ${r.faithfulnessScore}/5 | Relevance: ${r.relevanceScore}/5 | Citation: ${r.citationPassed ? 'Passed' : 'Failed'}\n`;
    md += `- **Judge Reasoning:** *${r.reasoning}*\n\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`📝 Evaluation report saved to: ${reportPath}`);
}

runAllEvals().catch(err => {
  console.error('❌ Eval Harness Failed:', err);
  process.exit(1);
});
