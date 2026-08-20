from fastapi import Body, Depends, FastAPI, File, HTTPException, Path, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import select, Session
from contextlib import asynccontextmanager
import traceback

from database import create_db_and_tables, get_session
from models import PDF, Message, MessageRole
from rag import ingest_pdf, get_rag_answer
from utils import save_pdf_to_db, update_pdf_file_path, save_pdf_to_disk, get_pdf_path, success_response
from typing import Annotated

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail, "data": None}
    )


@app.get("/health")
async def health():
    return success_response("Running successfully")


@app.get("/pdfs")
async def get_all_pdfs(session: Session = Depends(get_session)):
    try:
        pdfs = session.exec(select(PDF).order_by(PDF.created_at.desc())).all()
        pdf_data = [
            {
                "id": p.id,
                "file_name": p.file_name,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in pdfs
        ]
        return success_response("PDFs fetched successfully", {"pdfs": pdf_data})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch PDFs: {str(e)}")


@app.post("/upload")
async def upload_file(pdf: UploadFile = File(...),
session: Session = Depends(get_session)
):
    try:
        if not pdf.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

        # 1. Create DB record first so we get the auto-generated id
        pdf_record = save_pdf_to_db(pdf, session)

        # 2. Build the id-based path and persist it back to DB
        file_path = get_pdf_path(pdf_record.id)
        
        update_pdf_file_path(pdf_record, file_path, session)

        # 3. Write bytes to disk
        await save_pdf_to_disk(file_path, pdf)

        # 4. Chunk, embed and persist the vector store
        ingest_pdf(pdf_record.id, file_path)

        return success_response("File uploaded successfully", {"filename": pdf_record.file_name, "id": pdf_record.id})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@app.get("/chat/{id}")
async def get_chat(id: Annotated[int, Path(gt=0)], session: Session = Depends(get_session)):
    try:
        messages = session.exec(
            select(Message).where(Message.pdf_id == id).order_by(Message.created_at)
        ).all()
        message_data = [
            {
                "id": m.id,
                "role": m.role.value if hasattr(m.role, "value") else str(m.role),
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in messages
        ]
        return success_response("Previous Chats Loaded", {"messages": message_data})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch messages")

@app.post("/chat")
async def get_chat_response(query: Annotated[str, Body(...)], id: Annotated[int, Query(title="Id of the pdf")], session: Session = Depends(get_session)):
    try:
        pdf = session.get(PDF, id)
        if pdf is None:
            raise HTTPException(status_code=404, detail="PDF not found")

        # Fetch last 10 messages in chronological order
        history = list(reversed(session.exec(
            select(Message)
            .where(Message.pdf_id == id)
            .order_by(Message.created_at.desc())
            .limit(10)
        ).all()))

        # Retrieve relevant chunks + call LLM
        answer = get_rag_answer(id, query, history)

        # Persist both turns — user first so order is always correct
        session.add(Message(role=MessageRole.USER, content=query, pdf_id=id))
        session.add(Message(role=MessageRole.ASSISTANT, content=answer, pdf_id=id))
        session.commit()

        return success_response("Answer generated", {"answer": answer})

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


