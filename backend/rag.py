from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from utils import get_vectorstore_path


def _get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name="google/gemma-embedding-exp-03-07")


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
