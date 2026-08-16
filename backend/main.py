from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import traceback
import os 
from langchain_community.document_loaders import PyPDFLoader
from pydantic import BaseModel

class QueryRequest(BaseModel):
    query: str


app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
curr_file=[]

@app.post("/upload-pdf")
async def upload_file(file: UploadFile = File(...)):
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        
        curr_dir=os.path.dirname(os.path.abspath(__file__))
        upload_dir=os.path.join(curr_dir,"uploads")

        file_path=os.path.join(upload_dir,file.filename)

        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        curr_file.append(file.filename)
        return {"message": "File uploaded successfully", "filename": file.filename}
    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@app.post("/query")
async def reply_query(request: QueryRequest):
    try:
        query = request.query
        if not curr_file:
            raise HTTPException(status_code=400, detail="No PDF files uploaded yet.")
        
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        upload_dir = os.path.join(curr_dir, "uploads")

        file_path = os.path.join(upload_dir, curr_file[-1])

        loader = PyPDFLoader(file_path)
        docs = loader.load()

        print(docs)
        return {"query": query, "message": f"Successfully parsed {len(docs)} pages from {curr_file[-1]}"}

    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
