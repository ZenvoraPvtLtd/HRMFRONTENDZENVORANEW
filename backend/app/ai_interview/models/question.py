from sqlalchemy import Column, Integer, String, Text, ForeignKey
from ..database import Base

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    question_text = Column(Text, nullable=False)
    order = Column(Integer, default=0)
