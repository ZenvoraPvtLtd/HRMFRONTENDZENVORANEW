import pdfplumber
from docx import Document
import pytesseract
from PIL import Image
import os


def parse_pdf(file_path):
    text = ""

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()

            if extracted:
                text += extracted + "\n"

    return text


def parse_docx(file_path):
    doc = Document(file_path)

    text = "\n".join([para.text for para in doc.paragraphs])

    return text


def parse_txt(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return file.read()


def parse_image(file_path):
    image = Image.open(file_path)

    text = pytesseract.image_to_string(image)

    return text


def universal_parser(file_path):
    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".pdf":
        return parse_pdf(file_path)

    elif extension == ".docx":
        return parse_docx(file_path)

    elif extension == ".txt":
        return parse_txt(file_path)

    elif extension in [".png", ".jpg", ".jpeg"]:
        return parse_image(file_path)

    else:
        raise Exception("Unsupported File Type")