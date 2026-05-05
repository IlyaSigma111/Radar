import openpyxl
import os

path = r"C:\Users\games\OneDrive\Рабочий стол\ТЕСТПРОЕКТ\50 ссылок.xlsx"
wb = openpyxl.load_workbook(path)
ws = wb.active

links = []
for row in ws.iter_rows(values_only=True):
    for cell in row:
        if cell and isinstance(cell, str) and 'vk.com' in cell.lower():
            links.append(cell.strip())
        elif cell and isinstance(cell, str) and cell.startswith('http'):
            links.append(cell.strip())

print('\n'.join(links))
print(f'\nTotal: {len(links)}')
