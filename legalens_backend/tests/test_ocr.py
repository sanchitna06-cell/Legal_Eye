import pymupdf
import pytesseract
from PIL import Image
import io

PDF_PATH = r"C:\Users\Sanchit\Downloads\Git Cheatsheet.pdf"


def test_ocr_first_page():
    # Open the PDF
    pdf = pymupdf.open(PDF_PATH)

    print(f"Total pages: {len(pdf)}")

    # Take the first page
    page = pdf[0]

    # Render the page as an image
    pixmap = page.get_pixmap(dpi=200)

    # Convert the rendered image into PNG bytes
    image_bytes = pixmap.tobytes("png")

    # Open the PNG as a Pillow image
    image = Image.open(io.BytesIO(image_bytes))

    # Run OCR
    data = pytesseract.image_to_data(
        image,
        output_type=pytesseract.Output.DICT,
    )

    text = "\n".join(
        word
        for word in data["text"]
    if word.strip()
    )

    confidences = [
        float(conf)
        for conf in data["conf"]
        if conf != -1
    ]

    average_confidence = (
        sum(confidences) / len(confidences)
        if confidences
        else None
    )

    print(f"OCR confidence: {average_confidence}")

    print("\n===== OCR RESULT =====")
    print(text)
    print("======================")

    pdf.close()


if __name__ == "__main__":
    test_ocr_first_page()