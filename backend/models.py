from sqlmodel import Relationship
from enum import Enum
from datetime import datetime
from pytz import timezone
from sqlmodel import Field, SQLModel




class PDF(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    file_path: str
    file_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone("UTC")))
    messages: list["Message"]=Relationship(back_populates="pdf")


class Message(SQLModel,table=True):
    id:int = Field(default=None,primary_key=True)
    role:MessageRole
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone("UTC")))
    #actual db relationship
    pdf_id: int= Field(foreign_key="pdf.id")

    #connects pdf.messages with message.pdf so that they are accessible ORM level 
    pdf: PDF=Relationship(back_populates="messages") 
    #in back_populates use the attribute name in the other table apt


class MessageRole(str,Enum):
    USER="user"
    ASSISTANT="assistant"

