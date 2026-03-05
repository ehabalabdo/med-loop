const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const folder = 'C:\\Users\\Ehab\\Downloads\\New folder (4)';

async function main() {
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.pdf'));
  for (const file of files) {
    console.log('='.repeat(80));
    console.log('FILE:', file);
    console.log('='.repeat(80));
    try {
      const dataBuffer = fs.readFileSync(path.join(folder, file));
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      console.log(result.text);
    } catch (err) {
      console.log('ERROR:', err.message);
    }
    console.log('');
  }
}

main();
