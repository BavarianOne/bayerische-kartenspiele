import urllib.request
import pdfplumber
import io

url = 'https://www.metzgerei-brandl.de/uploads/media/6a69b35b6f2ea/angebot-vom-10-08-15-08-26.pdf'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req, timeout=30)
pdf_data = response.read()

with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        print(f'--- Page {i+1} ---')
        print(text[:2000] if text else 'No text extracted')