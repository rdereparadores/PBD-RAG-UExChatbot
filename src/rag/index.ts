import 'dotenv/config';
import {Settings, VectorStoreIndex} from "llamaindex";
import {OpenAI, OpenAIEmbedding} from "@llamaindex/openai";
import {ChromaVectorStore} from "@llamaindex/chroma";
import {HuggingFaceEmbedding} from "@llamaindex/huggingface";

const init = async () => {
    // PASO 0: Configurar LlamaIndex (cliente OpenAI para chat)
    Settings.llm = new OpenAI({
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
        collectionName: 'uex-rag'
    });

    const index = await VectorStoreIndex.fromVectorStore(vectorStore);

    const queryEngine = index.asQueryEngine({ similarityTopK: 3 }); // similarityTopK: según chunkSize (1024 -> 2, 512 -> 4)
    const stream = await queryEngine.query({
		query: '¿Hay algún evento reciente relacionado con el flamenco?',
		stream: true,
	});
	for await (const chunk of stream) {
		process.stdout.write(chunk.response);
	}
	console.log('');
    return;
}

init();