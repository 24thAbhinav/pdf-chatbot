from sqlmodel import Session
from models import PDF
from fastapi import UploadFile
import os
def get_pdf_path(pdf:UploadFile) -> str:
    curr_dir=os.path.dirname(os.path.abspath(__file__))
    upload_dir=os.path.join(curr_dir,"uploads")
    file_path=os.path.join(upload_dir,pdf.filename)
    return file_path

async def save_pdf_to_disk(file_path:str,pdf:UploadFile):
    with open(file_path,"wb") as f:
        content=await pdf.read()
        f.write(content)

def save_pdf_to_db(file_path:str,pdf:UploadFile,session:Session):
    pdf=PDF(file_path=file_path,file_name=pdf.filename)
    session.add(pdf)
    session.commit()
    session.refresh(pdf)
    return pdf.id
def success_response(message: str, data=None) -> dict:
    return {"success": True, "message": message, "data": data}

