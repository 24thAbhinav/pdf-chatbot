from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
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
    """
    Retrieve relevant chunks and generate answer using an LCEL (LangChain Expression Language) pipeline.
    
    The chain links:
      Inputs Dict -> Prompt Template -> Chat Model -> Output Parser
    via the pipe `|` operator.
    """
    # 1. Retriever component
    store = load_vectorstore(pdf_id)
    retriever = store.as_retriever(search_kwargs={"k": 4})
    
    # Helper to concatenate chunk contents into a single string
    format_docs = lambda docs: "\n\n".join(d.page_content for d in docs)

    # 2. Convert database Message records to LangChain message instances
    formatted_history = [
        HumanMessage(content=m.content) if m.role == MessageRole.USER
        else AIMessage(content=m.content)
        for m in history
    ]

    # 3. Prompt template with dynamic context, history placeholder, and user query
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a helpful assistant answering questions about a PDF document. "
            "Use the following context extracted from the document to answer the user's question. "
            "If the answer is not contained in the context, say so honestly.\n\n"
            "Context:\n{context}"
        )),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{query}")
    ])

    # 4. Local LLM via Ollama
    llm = ChatOllama(model="gemma2:2b")

    # 5. Build LCEL RAG Chain using the pipe (|) operator
    #
    # Step-by-step dataflow:
    #   a) Dict passes {"context": retriever -> format_docs, "query": query, "history": formatted_history}
    #   b) | prompt formats the messages
    #   c) | llm calls the model
    #   d) | StrOutputParser() extracts and returns the string response
    rag_chain = (
        {
            "context": retriever | format_docs,   # Pipe: query -> retriever -> format_docs
            "query": RunnablePassthrough(),       # Passes query string directly
            "history": lambda _: formatted_history # Injects formatted conversation history
        }
        | prompt                                  # Pipe into ChatPromptTemplate
        | llm                                     # Pipe into ChatOllama
        | StrOutputParser()                       # Pipe into output parser to extract response text
    )

    # Execute the chain
    return rag_chain.invoke(query)
