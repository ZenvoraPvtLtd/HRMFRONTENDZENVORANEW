from pydantic import BaseModel


class TextFixRequest(BaseModel):
    text: str
