from fastapi import Body
from sqlalchemy import select
from models import Message
from typing import Annotated
from fastapi import Path, Query
from utils import save_pdf_to_db, update_pdf_file_path, save_pdf_to_disk, get_pdf_path, success_response
from rag import ingest_pdf
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
from database import create_db_and_tables, get_session
from models import PDF
from sqlmodel import Session
from fastapi import Depends

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
        messages=session.exec(
            select(Message).where(Message.pdf_id==id)
        ).all()

        return success_response("Previous Chats Loaded", {"messages": messages})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500,detail=f"Failed to fetch messages")

@app.post("/chat")
async def get_chat_response(query: Annotated[str, Body(...)], id: Annotated[int, Query(title="Id of the pdf")], session: Session = Depends(get_session)):

    try:

        pdf=session.get(PDF,id)

        if pdf is None:
             raise HTTPException(status_code=404,detail=f"PDF not found")
        


    
    except Exception as e:






