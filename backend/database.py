from fastapi import Depends
from sqlalchemy.util.typing import Annotated
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "postgresql+psycopg2://abhinav@localhost:5432/pdf_chatbot"

engine = create_engine(DATABASE_URL, echo=True)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]
