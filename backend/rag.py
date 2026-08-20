from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_ollama import ChatOllama
from utils import get_vectorstore_path
from models import Message, MessageRole


def _get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def ingest_pdf(pdf_id: int, file_path: str):
    """Load, chunk, embed and persist a PDF's vector store. Runs once at upload time."""
    loader = PyPDFLoader(file_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)

    embeddings = _get_embeddings()
    vector_store = FAISS.from_documents(chunks, embedding=embeddings)
    vector_store.save_local(get_vectorstore_path(pdf_id))


def load_vectorstore(pdf_id: int) -> FAISS:
    """Load a persisted FAISS vector store for the given PDF id."""
    embeddings = _get_embeddings()
    return FAISS.load_local(
        get_vectorstore_path(pdf_id),
        embeddings,
        allow_dangerous_deserialization=True,
    )


def get_rag_answer(pdf_id: int, query: str, history: list[Message]) -> str:
    """Retrieve relevant chunks and call the LLM with conversation history."""
    # 1. Load vector store and retrieve top-4 relevant chunks
    store = load_vectorstore(pdf_id)
    docs = store.as_retriever(search_kwargs={"k": 4}).invoke(query)
    context = "\n\n".join(d.page_content for d in docs)

    # 2. Build message list: system prompt with context → history → current query
    messages = [
        SystemMessage(content=(
            "You are a helpful assistant answering questions about a PDF document. "
            "Use the following context extracted from the document to answer the user's question. "
            "If the answer is not contained in the context, say so honestly.\n\n"
            f"Context:\n{context}"
        ))
    ]

    for msg in history:
        if msg.role == MessageRole.USER:
            messages.append(HumanMessage(content=msg.content))
        else:
            messages.append(AIMessage(content=msg.content))

    messages.append(HumanMessage(content=query))

    # 3. Call LLM (runs locally via Ollama)
    llm = ChatOllama(model="gemma2:2b")
    response = llm.invoke(messages)
    return response.content
