import urllib.request
import re

main_url = 'https://www.metzgerei-brandl.de/speisekarten-angebote'
req = urllib.request.Request(main_url, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req, timeout=30)
html = response.read().decode('utf-8')

pdf_pattern = r'href="(/uploads/media/[^"]*angebot-vom-[^"]*\.pdf)"'
pdf_links = re.findall(pdf_pattern, html)

for i, link in enumerate(pdf_links):
    print(f'{i}: {link}')