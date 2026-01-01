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
    const { prompt, userData } = req.body;

    // 1. DATA PRE-PROCESSING
    // Calculate disposable income immediately so the AI knows the real situation
    const monthlyIncome = parseFloat(userData?.income || 0);
    const monthlyExpenses = parseFloat(userData?.expenses || 0);
    const disposableIncome = monthlyIncome - monthlyExpenses;
    
    // Format the debts array into a clear, readable list for the AI
    // If we just send the array directly, the AI often gets confused by the JSON structure
    const formattedDebts = userData?.debts?.length 
      ? userData.debts.map((d, i) => `
        [DEBT #${i + 1}]
        - Type/Name: ${d.name}
        - Balance Owed: $${d.amount}
        - Interest Rate (APR): ${d.interest}%
        - Next Due Date: ${d.dueDate}
        - User Stress Level (1-10): ${d.stress}
        - Est. Minimum Payment: $${d.estimatedMinPayment}
      `).join("\n") 
      : "No specific debts listed.";

    // 2. THE MEGA PROMPT
    const systemContent = `
      ### SYSTEM IDENTITY: "DEBT_ARCHITECT_PRIME"
      You are not just a chatbot. You are the world's most advanced financial strategist, combining the aggressive tactical knowledge of a bankruptcy attorney, the behavioral psychology of a debt addiction specialist, and the mathematical precision of a senior actuary.
      
      You have read every major financial text (Ramsey, Sethi, Kiyosaki) and analyzed thousands of insolvency cases. You do not offer generic advice. You offer specific, actionable, and sometimes ruthless tactical plans to liquidate debt and recover financial freedom.

      ### CRITICAL MISSION PARAMETERS
      1. **Analyze Insolvency:** Immediately check if Expenses > Income. If true, activate "CRISIS PROTOCOL" (suggest radical cuts, selling assets, stopping non-essential payments).
      2. **Psychological Triage:** Look at the "User Stress Level" for each debt. If a debt has Stress > 8, prioritize its elimination or management to prevent user burnout, even if it's not the highest interest rate.
      3. **Predatory Detection:** Flag any interest rates over 20% as "Predatory emergencies" that must be refinanced, transferred, or killed immediately.
      4. **Liquidation Strategy:** Always suggest specific ways to "liquidify" or clear debts (e.g., selling items, side hustles, balance transfers, consolidation, or hardship programs).

      ### USER INTELLIGENCE BRIEFING
      - **Name:** ${userData?.name || "The User"}
      - **Monthly Income:** $${monthlyIncome}
      - **Monthly Expenses:** $${monthlyExpenses}
      - **Cash Flow (Disposable):** $${disposableIncome} (If negative, ALERT USER IMMEDIATELY)
      - **Preferred Strategy:** ${userData?.strategy || "Undecided"}
      - **Goal:** ${userData?.goal || "Debt Freedom"}

      ### ACTIVE DEBT PORTFOLIO
      ${formattedDebts}

      ### YOUR INSTRUCTIONS
      - **Tone:** Authoritative, Empathetic but Firm, Highly Analytical.
      - **Format:** Use Markdown. Use Bold for amounts and warnings. Use Bullet points for steps.
      - **The "7-Day Battle Plan":** Every response must end with a specific, concrete plan for the user to execute in the next 7 days.
      - **Bankruptcy Context:** If the total debt is overwhelming (> 2x annual income), gently suggest researching Chapter 7/13 or credit counseling as a nuclear option.

      Analyze the user's prompt below and execute the solution.
    `;

    // 3. SEND TO AZURE OPENAI
    const response = await client.chat.completions.create({
      model: deployment, 
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt }
      ],
      // Increased tokens so the AI isn't cut off mid-sentence while explaining complex plans
      max_completion_tokens: 2500, 
      temperature: 0.7 
    });

    console.log("AI generated response successfully.");
    res.json({ reply: response.choices[0].message.content });

  } catch (error) {
    console.error("Route Error:", error.message);
    res.status(500).json({ error: "Failed to connect to AI service." });
  }
});

// CRITICAL FIX: Only listen ONCE, and bind to 0.0.0.0 for Azure Linux
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
