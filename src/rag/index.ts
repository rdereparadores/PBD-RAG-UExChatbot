import 'dotenv/config';
import {Settings, VectorStoreIndex} from "llamaindex";
import {OpenAI, OpenAIEmbedding} from "@llamaindex/openai";
import {ChromaVectorStore} from "@llamaindex/chroma";

const init = async () => {
    // PASO 0: Configurar LlamaIndex (cliente OpenAI para chat)
    Settings.llm = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'gpt-4o', // Probar a cambiar por otros
        temperature: 0,
    });

    Settings.embedModel = new OpenAIEmbedding({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'text-embedding-3-small' // Probar a cambiar por otros
    });

    // PASO 1: Cargar embeddings generados anteriormente
    const vectorStore = new ChromaVectorStore({
        collectionName: 'uex-rag'
    });

    // PASO 5: Indexar documentos en ChromaDB
    const index = await VectorStoreIndex.fromVectorStore(vectorStore);

    const queryEngine = index.asQueryEngine({ similarityTopK: 4 }); // similarityTopK: según chunkSize (1024 -> 2, 512 -> 4)
    const response = await queryEngine.query({
        query: '¿Qué asignaturas se cursan el primer curso de ingeniería informática en ingenieria de software?'
    });
    console.log(response.toString());
    return;
}

init();