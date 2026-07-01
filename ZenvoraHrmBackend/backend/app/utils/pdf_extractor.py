try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

import re
import sys

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from PIL import Image
except ImportError:
    Image = None

# ✅ Windows: point to Tesseract binary explicitly
if sys.platform == "win32" and pytesseract is not None:
    pytesseract.pytesseract.tesseract_cmd = r"D:\Tools\Tesseract-OCR\tesseract.exe"


def clean_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()


def extract_text_pymupdf(file_bytes: bytes) -> str:
    """Fast text extraction from digital/text-based PDFs."""
    if fitz is None:
        print("[PyMuPDF] Module not available, skipping")
        return ""
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages_text = []
        for i, page in enumerate(doc):
            t = page.get_text("text")
            print(f"  [PyMuPDF] Page {i+1}: {len(t)} chars")
            pages_text.append(t)
        text = "\n".join(pages_text)
        print(f"[PyMuPDF] Total: {len(text)} chars across {len(doc)} pages")
        return text
    except Exception as e:
        print(f"[PyMuPDF ERROR] {e}")
        return ""


def extract_pdf_ocr(file_bytes: bytes) -> str:
    """OCR fallback for image-based or scanned PDFs."""
    if fitz is None or pytesseract is None or Image is None:
        print("[OCR] Required modules not available (fitz/pytesseract/PIL), skipping OCR")
        return ""

    # Verify Tesseract is reachable before spending time on rendering
    try:
        version = pytesseract.get_tesseract_version()
        print(f"[OCR] Tesseract version: {version}")
    except Exception as e:
        print(f"[OCR ERROR] Tesseract not found: {e}")
        print("[OCR] Install from: https://github.com/UB-Mannheim/tesseract/wiki")
        print(f"[OCR] Expected path: {pytesseract.pytesseract.tesseract_cmd}")
        return ""

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        all_text = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img)
            print(f"  [OCR] Page {i+1}: {len(page_text)} chars")
            all_text.append(page_text)
        text = "\n".join(all_text)
        print(f"[OCR] Total: {len(text)} chars")
        return text
    except Exception as e:
        print(f"[OCR ERROR] Page processing failed: {e}")
        return ""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Hybrid extractor:
    1. Try PyMuPDF  (fast, works on text-based PDFs)
    2. If < 100 chars extracted → OCR fallback (scanned / image PDFs)
    """
    print(f"[Extractor] PDF size: {len(file_bytes)} bytes")

    text = extract_text_pymupdf(file_bytes)

    if len(text.strip()) < 50:
        print(f"[Extractor] PyMuPDF too short ({len(text.strip())} chars), trying OCR...")
        text = extract_pdf_ocr(file_bytes)

    result = clean_text(text)
    print(f"[Extractor] Final clean text: {len(result)} chars")
    return result