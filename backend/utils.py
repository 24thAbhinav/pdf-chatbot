from sqlmodel import Session
from models import PDF
from fastapi import UploadFile
import os


def _ensure_dir(path: str) -> str:
    """Create directory if it doesn't exist and return the path."""
    os.makedirs(path, exist_ok=True)
    return path


def get_pdf_path(pdf_id: int) -> str:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    upload_dir = _ensure_dir(os.path.join(curr_dir, "uploads"))
    return os.path.join(upload_dir, f"{pdf_id}.pdf")


def get_vectorstore_path(pdf_id: int) -> str:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    vs_dir = _ensure_dir(os.path.join(curr_dir, "vectorstores", str(pdf_id)))
    return vs_dir


async def save_pdf_to_disk(file_path: str, pdf: UploadFile):
    with open(file_path, "wb") as f:
        content = await pdf.read()
        f.write(content)


def save_pdf_to_db(pdf: UploadFile, session: Session) -> PDF:
    """Insert PDF record with just the filename — file_path is set later."""
    pdf_record = PDF(file_path="", file_name=pdf.filename)
    session.add(pdf_record)
    session.commit()
    session.refresh(pdf_record)
    return pdf_record


def update_pdf_file_path(pdf_record: PDF, file_path: str, session: Session):
    pdf_record.file_path = file_path
    session.add(pdf_record)
    session.commit()


def success_response(message: str, data=None) -> dict:
    return {"success": True, "message": message, "data": data}
