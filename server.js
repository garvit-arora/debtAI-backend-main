import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AzureOpenAI } from "openai";

dotenv.config();

const app = express();
const port = 8080;

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
    const systemContent = `
      You are a debt coach. 
      User Context: Income is ${userData?.income}, Expenses are ${userData?.expenses}, Goal is ${userData?.goal}.
    `;

    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 800
    });

    console.log(" AI responded to user");
    res.json({ reply: response.choices[0].message.content });

  } catch (error) {
    console.error(" Route Error:", error.message);
    res.status(500).json({ error: "Failed to connect to AI" });
  }
});
app.listen(port, () => {
  console.log(` Server ready at http://localhost:${port}`);
  console.log(` Listening for frontend requests...`);
});
