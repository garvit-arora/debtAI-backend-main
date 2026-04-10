import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AzureOpenAI } from "openai";

dotenv.config();

const app = express();

// CRITICAL FIX: Use Azure's assigned port, or 8080 for local testing
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const endpoint = "https://garvi-mjhusphu-eastus2.cognitiveservices.azure.com/";
const deployment = "debt-ai-openai";
const apiVersion = "2024-02-15-preview";
const apiKey = process.env.AZURE_OPENAI_API_KEY;

const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion });

app.post("/chat", async (req, res) => {
  try {
    const { prompt, userData, messages } = req.body;
    
    console.log("Received User Prompt:", prompt);

    const monthlyIncome = parseFloat(userData?.income || 0);
    const monthlyExpenses = parseFloat(userData?.expenses || 0);
    const disposableIncome = monthlyIncome - monthlyExpenses;

    const systemContent = `
    ### SYSTEM IDENTITY: "DEBT_AI"
    You are Debt AI, a highly professional financial strategist.
    
    USER CONTEXT:
    - Name: ${userData?.name || "Client"}
    - Net Cash Flow: ₹${disposableIncome}
    
    PROTOCOLS:
    - ALWAYS provide concise, professional answers.
    - Use proper sentence case and punctuation.
    - NEVER use all-caps or all-lowercase.
    - Use markdown bullet points and clear headings.
    - Focus on immediate, actionable mathematical steps.
    
    TONE: Institutional, Direct, Empathetic.
    `;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: systemContent },
        ...(messages || []),
        { role: "user", content: prompt } 
      ],
      max_completion_tokens: 1500,
      stream: true,
    });

    for await (const chunk of stream) {
        if (chunk.choices[0]?.finish_reason === "content_filter") {
            res.write("\n[Response blocked by safety filters]");
            break;
        }
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(content);
    }
    res.end();
  } catch (error) {
    console.error("Route Error:", error.message);
    if (!res.headersSent) res.status(500).json({ error: "Failed to connect to AI" });
    else res.end();
  }
});

app.post("/wealth-chat", async (req, res) => {
  try {
    const { prompt, userData, messages } = req.body;
    
    console.log("Received Wealth Hub Prompt:", prompt);

    const systemContent = `
    ### SYSTEM IDENTITY: "WEALTH_NEXUS"
    You are Wealth Nexus, an elite institutional investment strategist and wealth architect.
    
    USER CONTEXT:
    - Name: ${userData?.name || "Client"}
    - Portfolio Context: Focused on wealth acceleration, compound growth, and strategic asset allocation.
    
    MISSION:
    Provide institutional-grade investment insights, risk analysis, and financial strategy. 
    You are an expert in global markets, portfolio theory, and alternative assets.

    PROTOCOLS:
    - Provide deep, concise intelligence.
    - Focus on risk-adjusted returns (Alpha).
    - Use sophisticated, professional language with proper punctuation.
    - No fluff. No generic advice.
    - Use markdown for structured analysis.
    
    OUTPUT STRUCTURE:
    1. Intelligence Brief (What is happening)
    2. Strategic Position (The way forward)
    3. Alpha Drivers (Specific areas of growth)
    4. Guardrails (Risk management)
    `;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: systemContent },
        ...(messages || []),
        { role: "user", content: prompt } 
      ],
      max_completion_tokens: 2000,
      stream: true,
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(content);
    }
    res.end();
  } catch (error) {
    console.error("Wealth Route Error:", error.message);
    if (!res.headersSent) res.status(500).json({ error: "Failed to connect to AI" });
    else res.end();
  }
});

// CRITICAL FIX: Only listen ONCE, and bind to 0.0.0.0 for Azure Linux
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
