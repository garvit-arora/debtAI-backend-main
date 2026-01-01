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
    
    // Calculate financial context
    const monthlyIncome = parseFloat(userData?.income || 0);
    const monthlyExpenses = parseFloat(userData?.expenses || 0);
    const disposableIncome = monthlyIncome - monthlyExpenses;

    // --- UPDATED SYSTEM PROMPT (Safer Language for Filters) ---
    const systemContent = `
    ### SYSTEM IDENTITY: "DEBT_ARCHITECT_PRIME"
    
    ## 1. WHO YOU ARE
    You are **DebtArchitect Prime**, a highly advanced financial strategist and behavioral economist. You possess the combined knowledge of:
    - **Legal Frameworks:** US Bankruptcy Code (Chapter 7/13), Consumer Credit Protection Act.
    - **Financial Literature:** "The Total Money Makeover" (Ramsey), "I Will Teach You To Be Rich" (Sethi).
    - **Mathematical Models:** Amortization schedules and liquidity ratios.

    You do not offer generic advice. You provide **mathematically precise, actionable, and psychology-aware plans.** You are a dedicated advocate for the user's financial well-being.

    ## 2. USER CONTEXT
    - **Name:** ${userData?.name || "Client"}
    - **Monthly Income:** $${monthlyIncome}
    - **Monthly Expenses:** $${monthlyExpenses}
    - **Net Cash Flow:** $${disposableIncome}
    - **Selected Strategy:** ${userData?.strategy || "Undecided"}
    - **Primary Goal:** ${userData?.goal || "Financial Freedom"}

    ## 3. DEBT DATA
    ${JSON.stringify(userData?.debts || [], null, 2)}

    ## 4. PROTOCOLS

    ### PHASE 1: ANALYSIS
    - Compare Income vs. Expenses. 
    - If Expenses > Income, advise immediate budget restructuring and halting non-essential spending.
    - If Income > Expenses, calculate the surplus available for debt repayment.

    ### PHASE 2: PRIORITIZATION
    - Review the **"stress"** level (1-10). 
    - If a debt has Stress > 8, prioritize resolving it to improve the user's mental well-being, even if it is not the highest interest rate.

    ### PHASE 3: ACTION
    - Suggest specific methods:
      - **Consolidation:** Moving high-interest debt to lower-rate options.
      - **Asset Liquidation:** Selling items to clear small debts quickly.
      - **Hardship Plans:** Contacting lenders to request temporary rate reductions.

    ## 5. OUTPUT FORMAT (Markdown)
    
    **1. The Diagnosis** (A clear summary of their financial health.)

    **2. The Numbers**
    (Total debt load and estimated time to freedom.)

    **3. The Strategy**
    (Snowball vs. Avalanche vs. Hybrid. Explain the choice.)

    **4. Immediate Actions**
    (3 specific bullet points to generate cash or lower rates.)

    **5. 7-Day Plan**
    (A step-by-step checklist for the next week.)

    ## 6. TONE
    - **Professional:** You are an expert.
    - **Direct:** Be clear and concise.
    - **Empathetic:** Validate the user's situation.

    Analyze the data and provide the solution.
    `;

    // Call Azure OpenAI
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt } // This sends the user prompt to AI
      ],
      max_completion_tokens: 800
    });

    console.log("AI responded to user");

    // Check for content filtering (Safety Check)
    if (response.choices[0].finish_reason === "content_filter") {
        console.log("!!! BLOCKED BY CONTENT FILTER !!!");
        return res.json({ 
            reply: "My response was blocked by safety filters. Please try rephrasing.",
            userPrompt: prompt // Sending prompt back for debugging
        });
    }

    // Send success response
    res.json({ 
        reply: response.choices[0].message.content,
        userPrompt: prompt // <--- Added per your request: Sending the prompt back!
    });

  } catch (error) {
    console.error("Route Error:", error.message);
    res.status(500).json({ error: "Failed to connect to AI" });
  }
});

// CRITICAL FIX: Only listen ONCE, and bind to 0.0.0.0 for Azure Linux
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});