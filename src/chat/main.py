import chromadb

from llama_index.core import StorageContext, VectorStoreIndex, Settings
from llama_index.core.tools import FunctionTool
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.agent.workflow import FunctionAgent, AgentStream
from llama_index.llms.openrouter import OpenRouter
from llama_index.vector_stores.chroma import ChromaVectorStore

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse

from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

embed_model = OpenAIEmbedding(
    model_name='google/gemini-embedding-001',
)
Settings.embed_model = embed_model

remote_db = chromadb.PersistentClient(path='./uex-rag')
chroma_collection = remote_db.get_collection('uex-rag')

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_vector_store(
    vector_store,
    storage_context=storage_context
)

rag_engine = index.as_query_engine(similarity_top_k=4)
last_source_nodes = []

def consultar_rag(consulta: str) -> str:
    global last_source_nodes
    last_source_nodes = []
    print(f"\nBUSCANDO: '{consulta}'")

    response = rag_engine.query(consulta)

    print("\n" + "=" * 40)
    print(f"DOCUMENTOS RECUPERADOS ({len(response.source_nodes)})")
    print("=" * 40)

    for i, nodo in enumerate(response.source_nodes):
        score = nodo.score if nodo.score else 0.0
        print(f"[{i + 1}] Similitud: {score:.4f}")
        print(f"Texto: \"{nodo.text[:150]}...\"")
        print("-" * 40)
        last_source_nodes.append({
            'score': score,
            'text': nodo.text
        })
    print("=" * 40 + "\n")

    return str(response)

rag_tool = FunctionTool.from_defaults(
    fn=consultar_rag,
    name="uex-rag",
    description='''
        Usa esta herramienta en ESPAÑOL.
        Útil si la información proporcionada no es suficiente para atender a la pregunta.
        Conecta directamente con una base de datos vectorial, por tanto usa palabras clave antes que frases completas.
        Esta herramienta ya presupone que estás hablando sobre la Universidad de Extremadura, no hace falta que lo repitas.
    '''
)

llm = OpenAI(
    model='gpt-5.1',
    temperature=0,
    max_retries=3
)
Settings.llm = llm

agent = FunctionAgent(
    tools=[rag_tool],
    llm=llm,
    verbose=True,
    system_prompt='''
        Eres un asistente útil, diseñado para únicamente responder cuestiones sobre la Universidad de Extremadura.
        Nunca te inventes información ni digas NADA que no se te haya proporcionado.
        Usa tus herramientas para asegurarte al 100% que la respuesta dada es certera.
        Response SIEMPRE en MARKDOWN (enlaces, código, listas, estilo de texto...).
        Usa tus herramientas tantas veces como necesites.
        Responde en el MISMO IDIOMA que la pregunta, TRADUCE si es necesario.
    '''
)

async def agent_stream_generator(message: str):
    handler = agent.run(user_msg=message)
    async for event in handler.stream_events():
        if isinstance(event, AgentStream):
            yield event.delta

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.post('/api/chat')
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        agent_stream_generator(request.message),
        media_type='text/plain'
    )

@app.get('/api/chat/documents')
async def chat_documents():
    return JSONResponse(last_source_nodes)