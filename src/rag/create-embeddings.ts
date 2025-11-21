import 'dotenv/config';
import fs from "node:fs";
import {Settings, storageContextFromDefaults, VectorStoreIndex} from "llamaindex";
import {OpenAIEmbedding} from "@llamaindex/openai";
import {ArticleSchema} from "../scraping/article.schema";
import {Document} from "llamaindex";
import {ChromaVectorStore} from "@llamaindex/chroma";

const loadArticles = () => {
    const inputDir = 'src/scraping/results/';
    const inputFiles = fs.readdirSync(inputDir);
    const articles: ArticleSchema[] = [];

    for (const file of inputFiles) {
        const raw = fs.readFileSync(inputDir + file, 'utf-8');
        const parsed = JSON.parse(raw) as ArticleSchema[];
        articles.push(...parsed);
    }

    return articles;
}

const articleToDocument = (article: ArticleSchema) => {
    return new Document({
        id_: article.uuid,
        text: article.content,
        metadata: {
            title: article.title,
            url: article.url,
            category: article.metadata.category,
            tags: article.metadata.tags.join(', '),
            date: article.metadata.date
        }
    })
}

export const createEmbeddings = async () => {
    // PASO 0: Configurar LlamaIndex (cliente OpenAI para creación de embeddings)
    Settings.embedModel = new OpenAIEmbedding({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'text-embedding-3-small' // Probar a cambiar por otros
    });

    // PASO 1: Obtener los artículos desde los ficheros JSON
    const articles: ArticleSchema[] = loadArticles();

    // PASO 2: Convertir los artículos a documentos
    const documents: Document[] = articles.map(a => articleToDocument(a));

    // PASO 3: Inicializar la base de datos vectorial (en este caso, ChromaDB)
    const vectorStore = new ChromaVectorStore({
        collectionName: 'uex-rag'
    });

    // PASO 3.5: Inicializar el almacenamiento de datos (documentos + embeddings)
    const storageContext = await storageContextFromDefaults({
        vectorStore,
        persistDir: 'uex-rag-embeddings'
    })

    // PASO 4: Indexar documentos en ChromaDB
    await VectorStoreIndex.fromDocuments(documents, {
        storageContext
    });

}

createEmbeddings();