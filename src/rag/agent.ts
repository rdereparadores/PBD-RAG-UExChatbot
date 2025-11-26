import 'dotenv/config';
import {Settings, VectorStoreIndex, tool} from "llamaindex";
import {OpenAI, OpenAIEmbedding} from "@llamaindex/openai";
import {ChromaVectorStore} from "@llamaindex/chroma";
import { agent } from "@llamaindex/workflow";
import { z } from "zod";
import {HuggingFaceEmbedding} from "@llamaindex/huggingface";

const init = async () => {
    // PASO 0: Configurar LlamaIndex (cliente OpenAI para chat)
    Settings.llm = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'gpt-5-mini', // Probar a cambiar por otros
        temperature: 1,
    });

    const llm = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'gpt-5-mini', // Probar a cambiar por otros
        temperature: 1,
    });

    Settings.embedModel = new OpenAIEmbedding({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'google/gemini-embedding-001' //'baai/bge-m3' // Probar a cambiar por otros
    });
    //Settings.embedModel = new HuggingFaceEmbedding();
    Settings.chunkSize = 1024; // Por defecto: 1024
    Settings.chunkOverlap = 100; // Por defecto: 20

    // PASO 1: Cargar embeddings generados anteriormente
    const vectorStore = new ChromaVectorStore({
        collectionName: 'uex-rag',
    });

    await vectorStore.getCollection()

    const index = await VectorStoreIndex.fromVectorStore(vectorStore);

    //Esto da el motor del RAG
    const queryEngine = index.asQueryEngine({ similarityTopK: 3 },); // similarityTopK: según chunkSize (1024 -> 2, 512 -> 4)

    const ragSearchTool = tool({
        name: "ragSearch",
        description: "Busca información en vextorStore usando embeddings",
        parameters: z.object({
            query: z.string(),
        }),
        execute: async ({query}) => {
            console.log("He sido llamada")
            const result = await queryEngine.query({query})
            return result.toString()
        }
    });

    const refineQueryTool = tool({
        name: "refine_query",
        description: "Genera una query mejorada para obtener más información del RAG.",
        parameters: z.object({
            question: z.string(),
            retrieved:z.string(),
        }),
        execute: async ({ question, retrieved })=> {
            const refinePrompt = `
            La pregunta del usuario es:
            "${question}"        
 
            La información recuperada hasta ahora es:
            "${retrieved}"           
          
            Si no es suficiente para responder, crea una consulta más precisa.
            Devuelve únicamente la nueva query.
            `;
            const response = await llm.complete({
                prompt: refinePrompt,
                stream: false,
            });
            console.log("He sido llamada 2")
            return { refinedQuery: response.text.trim() };
        }
    });

    const myAgent = agent({
        name: "ragAgent",
        tools: [ragSearchTool, refineQueryTool],
        llm: llm,
        systemPrompt: `Eres un agente que examina los datos de una universisdad y responde en base a ellos. Los datos se obtienen gracias a las tools pasadas. Debes llamar primero a "ragSearchTool" para obtener la información que el rag ha decidido como clave. Si no tienes información necesaria llamas a "refineQueryTool" para obtener los datos que necesites y que se le hayan pasado al rag`
    })

    const result = await myAgent.run("De que va la asignatura de tecnologia de los computadores?", {
        responseFormat: z.object({
            response: z.string()
        }),
    });
    console.log(result.data.result);
    return;
}

init();